import type { DatabaseSync } from "node:sqlite";
import {
  BaseCheckpointSaver,
  WRITES_IDX_MAP,
  compareWritesSortKeys,
  writesSortKey,
  type Checkpoint,
  type CheckpointMetadata,
  type CheckpointTuple,
  type CheckpointListOptions,
  type ChannelVersions,
  type PendingWrite,
  type CheckpointPendingWrite,
} from "@langchain/langgraph-checkpoint";

type Config = Parameters<BaseCheckpointSaver["getTuple"]>[0];
type Row = Record<string, string | number | bigint | Uint8Array | null>;
function key(value: unknown, empty = false): string {
  if (typeof value !== "string" || (!empty && !value) || value.length > 500)
    throw new Error("Invalid checkpoint key");
  return value;
}
function blob(value: Row[string]): Uint8Array {
  if (!(value instanceof Uint8Array))
    throw new Error("Invalid checkpoint data");
  return value;
}
const configFor = (thread: string, namespace: string, id: string): Config => ({
  configurable: {
    thread_id: thread,
    checkpoint_ns: namespace,
    checkpoint_id: id,
  },
});

/** Node's built-in SQLite; opaque values use LangGraph's own typed serializer. */
export class SqliteCheckpointer extends BaseCheckpointSaver {
  private database: DatabaseSync;
  constructor(database: DatabaseSync) {
    super();
    this.database = database;
  }
  async getTuple(config: Config): Promise<CheckpointTuple | undefined> {
    const thread = key(config.configurable?.thread_id),
      namespace = key(config.configurable?.checkpoint_ns ?? "", true);
    const id: unknown = config.configurable?.checkpoint_id;
    const row = id
      ? this.database
          .prepare(
            "SELECT * FROM lg_checkpoints WHERE thread_id=? AND namespace=? AND checkpoint_id=?",
          )
          .get(thread, namespace, key(id))
      : this.database
          .prepare(
            "SELECT * FROM lg_checkpoints WHERE thread_id=? AND namespace=? ORDER BY checkpoint_id DESC LIMIT 1",
          )
          .get(thread, namespace);
    if (!row) return undefined;
    const savedId = String(row.checkpoint_id);
    const writes = this.database
      .prepare(
        "SELECT * FROM lg_writes WHERE thread_id=? AND namespace=? AND checkpoint_id=?",
      )
      .all(thread, namespace, savedId);
    writes.sort((a, b) =>
      compareWritesSortKeys(
        writesSortKey(String(a.task_path), String(a.task_id), Number(a.idx)),
        writesSortKey(String(b.task_path), String(b.task_id), Number(b.idx)),
      ),
    );
    const pendingWrites: CheckpointPendingWrite[] = await Promise.all(
      writes.map(
        async (write): Promise<CheckpointPendingWrite> => [
          String(write.task_id),
          String(write.channel),
          await this.serde.loadsTyped(
            String(write.value_type),
            blob(write.value),
          ),
        ],
      ),
    );
    const checkpoint = (await this.serde.loadsTyped(
      String(row.checkpoint_type),
      blob(row.checkpoint),
    )) as Checkpoint;
    if (checkpoint.v !== 4)
      throw new Error(
        "Unsupported checkpoint format; this application pins LangGraph checkpoint v4.",
      );
    return {
      config: configFor(thread, namespace, savedId),
      checkpoint,
      metadata: (await this.serde.loadsTyped(
        String(row.metadata_type),
        blob(row.metadata),
      )) as CheckpointMetadata,
      pendingWrites,
      ...(row.parent_id
        ? { parentConfig: configFor(thread, namespace, String(row.parent_id)) }
        : {}),
    };
  }
  async *list(
    config: Config,
    options: CheckpointListOptions = {},
  ): AsyncGenerator<CheckpointTuple> {
    const thread = key(config.configurable?.thread_id),
      namespace = key(config.configurable?.checkpoint_ns ?? "", true);
    const before: unknown = options.before?.configurable?.checkpoint_id;
    const rows = before
      ? this.database
          .prepare(
            "SELECT checkpoint_id FROM lg_checkpoints WHERE thread_id=? AND namespace=? AND checkpoint_id<? ORDER BY checkpoint_id DESC",
          )
          .all(thread, namespace, key(before))
      : this.database
          .prepare(
            "SELECT checkpoint_id FROM lg_checkpoints WHERE thread_id=? AND namespace=? ORDER BY checkpoint_id DESC",
          )
          .all(thread, namespace);
    let remaining = options.limit ?? Number.POSITIVE_INFINITY;
    for (const row of rows) {
      if (remaining <= 0) break;
      const tuple = await this.getTuple(
        configFor(thread, namespace, String(row.checkpoint_id)),
      );
      if (!tuple) continue;
      if (
        options.filter &&
        !Object.entries(options.filter).every(
          ([name, value]) =>
            JSON.stringify(
              new Map<string, unknown>(
                Object.entries(tuple.metadata ?? {}),
              ).get(name),
            ) === JSON.stringify(value),
        )
      )
        continue;
      remaining--;
      yield tuple;
    }
  }
  async put(
    config: Config,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions,
  ): Promise<Config> {
    const thread = key(config.configurable?.thread_id),
      namespace = key(config.configurable?.checkpoint_ns ?? "", true);
    const parent: unknown = config.configurable?.checkpoint_id;
    const [[checkpointType, checkpointBytes], [metadataType, metadataBytes]] =
      await Promise.all([
        this.serde.dumpsTyped(checkpoint),
        this.serde.dumpsTyped(metadata),
      ]);
    this.database
      .prepare(
        "INSERT INTO lg_checkpoints VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(thread_id,namespace,checkpoint_id) DO UPDATE SET checkpoint_type=excluded.checkpoint_type,checkpoint=excluded.checkpoint,metadata_type=excluded.metadata_type,metadata=excluded.metadata",
      )
      .run(
        thread,
        namespace,
        key(checkpoint.id),
        parent ? key(parent) : null,
        checkpointType,
        checkpointBytes,
        metadataType,
        metadataBytes,
      );
    return configFor(thread, namespace, checkpoint.id);
  }
  async putWrites(
    config: Config,
    writes: PendingWrite[],
    taskId: string,
    taskPath = "",
  ): Promise<void> {
    const thread = key(config.configurable?.thread_id),
      namespace = key(config.configurable?.checkpoint_ns ?? "", true),
      checkpointId = key(config.configurable?.checkpoint_id);
    const serialized = await Promise.all(
      writes.map(async ([channel, value], index) => ({
        channel,
        index: WRITES_IDX_MAP[channel] ?? index,
        serialized: await this.serde.dumpsTyped(value),
      })),
    );
    this.database.exec("BEGIN IMMEDIATE");
    try {
      for (const write of serialized) {
        const suffix =
          write.index < 0
            ? "DO UPDATE SET channel=excluded.channel,value_type=excluded.value_type,value=excluded.value,task_path=excluded.task_path"
            : "DO NOTHING";
        this.database
          .prepare(
            `INSERT INTO lg_writes VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(thread_id,namespace,checkpoint_id,task_id,idx) ${suffix}`,
          )
          .run(
            thread,
            namespace,
            checkpointId,
            key(taskId),
            taskPath,
            write.index,
            write.channel,
            write.serialized[0],
            write.serialized[1],
          );
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
  async deleteThread(threadId: string): Promise<void> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare("DELETE FROM lg_writes WHERE thread_id=?")
        .run(key(threadId));
      this.database
        .prepare("DELETE FROM lg_checkpoints WHERE thread_id=?")
        .run(threadId);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}
