// ABOUTME: 默认示例：一份已完成的原创研究（问题、已确认计划、7 项来源与带引用的报告），依据 SQLite 公有领域文档整理。
import type { Research, Source, Step } from "./research.ts";

export const SAMPLE_TITLE = "单机多进程 Node 服务是否应为 SQLite 开启 WAL";
const at = "2026-10-27T09:30:00.000Z";
const step = (id: string, title: string, kind: Step["kind"], query: string, urls: string, findings: string): Step => ({
  id,
  title,
  kind,
  query,
  urls,
  findings,
  status: "done",
  error: "",
  ranAt: at,
});
const source = (cite: number, stepId: string, url: string, title: string, excerpt: string, note: string, origin = "web"): Source => ({
  id: "sample-source-" + cite,
  cite,
  url,
  title,
  excerpt,
  text: "",
  note,
  checked: true,
  origin,
  stepId,
  fetchedAt: at,
});

const steps: Step[] = [
  step(
    "sample-step-1",
    "界定场景与判断标准",
    "analyze",
    "",
    "",
    "场景：一台服务器上 2–4 个 Node 进程（HTTP 服务、后台任务队列、定时导出）共用同一个 SQLite 文件；读多写少，偶有批量写入，数据位于本地 SSD。\n判断标准：① 读写是否互相阻塞；② 崩溃或断电后可能丢失多少已提交事务；③ 文件增长与运维负担；④ 部署约束（文件系统、容器卷）。",
  ),
  step(
    "sample-step-2",
    "精读 WAL 官方说明",
    "read",
    "",
    "https://www.sqlite.org/wal.html",
    "WAL 的核心收益是读写并发：读者读取各自的快照，写者只向 WAL 追加。代价集中在三处：必须同机（依赖共享内存索引），需要检查点把 WAL 写回主库，长时间不断的读事务会让检查点无法完成、WAL 持续变大。",
  ),
  step(
    "sample-step-3",
    "锁、隔离与错误码",
    "read",
    "",
    "https://www.sqlite.org/lockingv3.html\nhttps://www.sqlite.org/isolation.html\nhttps://www.sqlite.org/rescode.html",
    "无论哪种日志模式，同一时刻只有一个写者。回滚日志模式下提交需要独占锁，会短暂阻塞所有读者；WAL 下读者不受写者影响。需要特别处理的是“先读后写”的延迟事务：快照过期时得到 SQLITE_BUSY_SNAPSHOT，等待重试无效，应改为一开始就用 BEGIN IMMEDIATE。",
  ),
  step(
    "sample-step-4",
    "同步级别与检查点设置",
    "read",
    "",
    "https://www.sqlite.org/pragma.html",
    "synchronous=NORMAL 在 WAL 下不会造成数据库损坏，但断电后最近提交的事务可能回滚；需要每笔提交都落盘时保留 FULL。busy_timeout 让连接在遇到锁时等待而不是立即报错；wal_autocheckpoint 与 journal_size_limit 控制 WAL 的增长。",
  ),
  step(
    "sample-step-5",
    "适用边界",
    "web-search",
    "SQLite appropriate uses concurrency single writer",
    "",
    "官方把 SQLite 定位为应用内嵌数据库：并发读不设上限，但写入串行；写并发很高、或需要多台机器通过网络访问同一数据时，应考虑客户端/服务器数据库。我们的场景（单机、读多写少）在适用范围内。",
  ),
  step(
    "sample-step-6",
    "生态实践",
    "github",
    "sqlite WAL checkpoint starvation",
    "",
    "better-sqlite3 的性能文档把开启 WAL 作为首要建议，同时提醒检查点饥饿，并给出定时检查 -wal 文件大小、必要时执行 wal_checkpoint(RESTART) 的做法。",
  ),
  step(
    "sample-step-7",
    "比较与结论",
    "analyze",
    "",
    "",
    "四项标准中，WAL 在“读写阻塞”上明显更好，在“部署约束”上更严格（必须本机文件系统），“持久性”取决于 synchronous 选择，“运维负担”增加一项：监控 WAL 大小与检查点。结论见报告。",
  ),
];

const sources: Source[] = [
  source(
    1,
    "sample-step-2",
    "https://www.sqlite.org/wal.html",
    "Write-Ahead Logging（SQLite 官方文档）",
    "要点（意译）：WAL 模式下读者不阻塞写者、写者也不阻塞读者，读写可以并发进行，多数场景比回滚日志更快。代价是所有访问数据库的进程必须在同一台主机上，WAL 不能用于网络文件系统；需要检查点把 WAL 内容写回数据库，默认在 WAL 约 1000 页时自动进行；如果始终有读事务存在，检查点无法完成，WAL 文件会不断增长。",
    "支撑“读写并发”和“同机限制”两条结论；检查点饥饿是主要运维风险。",
  ),
  source(
    2,
    "sample-step-3",
    "https://www.sqlite.org/lockingv3.html",
    "File Locking And Concurrency In SQLite Version 3",
    "要点（意译）：回滚日志模式使用 SHARED、RESERVED、PENDING、EXCLUSIVE 等锁状态；写事务提交时需要取得独占锁，期间其他连接无法读取。",
    "用于对比：说明不开 WAL 时写入提交会短暂阻塞读者。",
  ),
  source(
    3,
    "sample-step-3",
    "https://www.sqlite.org/isolation.html",
    "Isolation In SQLite",
    "要点（意译）：SQLite 的事务是可串行化的，同一时刻只允许一个写者；WAL 模式下，读事务看到的是它开始时数据库的快照，不受随后提交的写入影响。",
    "说明 WAL 并不提供多写者，只是让读者读快照。",
  ),
  source(
    4,
    "sample-step-3",
    "https://www.sqlite.org/rescode.html",
    "Result and Error Codes（SQLITE_BUSY_SNAPSHOT）",
    "要点（意译）：SQLITE_BUSY_SNAPSHOT 是 WAL 模式下的扩展错误码：一个连接试图把读事务升级为写事务时，发现其他连接已经写入，原先的读取已失效。",
    "据此建议写操作使用 BEGIN IMMEDIATE，而不是依赖 busy_timeout 重试。",
  ),
  source(
    5,
    "sample-step-4",
    "https://www.sqlite.org/pragma.html",
    "Pragma statements（synchronous、busy_timeout、wal_autocheckpoint）",
    "要点（意译）：WAL 模式在 synchronous=NORMAL 下始终保持一致，但会损失持久性：断电或系统崩溃后，最近提交的事务可能回滚。busy_timeout 设置遇到锁时的等待时长；wal_autocheckpoint 设置自动检查点的页数阈值；journal_size_limit 限制检查点后保留的日志文件大小。",
    "持久性取舍的直接依据；配置清单中的四个 PRAGMA 均出自此页。",
  ),
  source(
    6,
    "sample-step-5",
    "https://www.sqlite.org/whentouse.html",
    "Appropriate Uses For SQLite",
    "要点（意译）：SQLite 支持任意数量的并发读者，但任一时刻只允许一个写者；对写并发很高的场景，或数据与应用分处不同机器、需要经网络访问时，客户端/服务器数据库更合适。",
    "界定适用边界：单机、读多写少属于适用场景。",
  ),
  source(
    7,
    "sample-step-6",
    "https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md",
    "WiseLibs/better-sqlite3 · docs/performance.md",
    "要点（意译）：建议对大多数应用开启 WAL 以获得更好的并发性能；提醒在读取持续不断时会出现检查点饥饿，可定期检查 -wal 文件大小，超过阈值时执行 wal_checkpoint(RESTART)。",
    "生态侧的佐证，并提供了可直接借鉴的监控方式。",
    "github",
  ),
];

const report = `# ${SAMPLE_TITLE}

> 研究问题：一台服务器上 2–4 个 Node 进程共用一个 SQLite 文件，读多写少，是否应开启 WAL？需要哪些配套设置？

## 结论

1. **应当开启 WAL。** 在这个场景里最大的问题是“写入提交时读者被挡住”：回滚日志模式提交需要独占锁 [2]，而 WAL 模式下读写互不阻塞，多数场景还更快 [1]。
2. **WAL 不解决多写者。** 同一时刻仍只有一个写者 [3][6]；后台批量写入与在线写入会排队，需要靠短事务与等待时间来平滑。
3. **前提是同机、本地文件系统。** 所有进程必须在同一台主机上，数据库不能放在网络文件系统上 [1]。容器部署时，数据卷必须是本机卷，且各进程挂载同一路径。
4. **持久性要明确选择。** 选用 \`synchronous=NORMAL\` 时数据库不会损坏，但断电后最近提交的事务可能回滚 [5]；涉及资金或不可重放的写入应保留 \`FULL\`。

## 推荐配置

| 设置 | 建议值 | 理由 |
| --- | --- | --- |
| \`journal_mode\` | \`WAL\` | 读写并发 [1] |
| \`synchronous\` | \`NORMAL\`（关键数据用 \`FULL\`） | 一致但可能丢最近提交 [5] |
| \`busy_timeout\` | 3000–5000 ms | 写锁冲突时等待而不是立即失败 [5] |
| \`wal_autocheckpoint\` | 保持默认 1000 页 | 默认自动检查点 [1][5] |
| \`journal_size_limit\` | 例如 64 MB | 检查点后截断过大的 WAL 文件 [5] |

写事务一律使用 \`BEGIN IMMEDIATE\`：先读后写的延迟事务在快照过期时会得到 \`SQLITE_BUSY_SNAPSHOT\`，等待重试无法解决 [4]。

## 风险与应对

- **检查点饥饿。** 只要始终存在读事务，检查点就无法完成，WAL 会持续增长 [1]。应对：避免长时间打开的读事务（例如流式导出要分批），并像 better-sqlite3 文档建议的那样定时检查 \`-wal\` 文件大小，超过阈值时执行 \`wal_checkpoint(RESTART)\` [7]。
- **写入排队。** 批量写入拆成小事务，单个事务控制在数十毫秒内，避免在线请求等到 \`busy_timeout\` 上限 [3][5]。
- **部署漂移。** 若将来改为多台机器共享数据，WAL 与 SQLite 本身都不再适合，应迁移到客户端/服务器数据库 [6][1]。

## 待核实

- 本研究未做基准测试；“更快”的结论来自官方说明 [1]，实际收益需要用生产负载验证。
- \`journal_size_limit\` 的具体阈值依写入量而定，上线后根据监控调整。
`;

export const sampleResearch: Research = {
  version: 2,
  question: "单机多进程的 Node 服务共用一个 SQLite 文件、读多写少，是否应开启 WAL？需要哪些配套设置？",
  scope: "约束：单台服务器、本地 SSD、2–4 个进程；不考虑迁移到其他数据库。\n交付：一页结论 + 推荐配置表 + 风险清单，结论须标注来源。",
  plan: { steps, confirmed: true, confirmedAt: at, origin: "manual" },
  sources,
  report,
  stage: "ready",
  native: "",
  threadId: "",
};
