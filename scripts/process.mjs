import { spawn } from "node:child_process";
export function runCommand(
  bin,
  args,
  { cwd = process.cwd(), allowInterrupt = false, stdio = "inherit" } = {},
) {
  return new Promise((accept, reject) => {
    const child = spawn(bin, args, { cwd, stdio });
    let interrupted = false;
    const stop = () => {
      interrupted = true;
      child.kill("SIGINT");
    };
    const cleanup = () => process.removeListener("SIGINT", stop);
    process.once("SIGINT", stop);
    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      cleanup();
      const cancelled = interrupted || signal === "SIGINT" || code === 130;
      if (cancelled && !allowInterrupt) {
        reject(
          Object.assign(new Error(`${bin} interrupted`), { exitCode: 130 }),
        );
        return;
      }
      if (code === 0 || (cancelled && allowInterrupt)) {
        accept();
        return;
      }
      reject(
        Object.assign(new Error(`${bin} exited ${code ?? signal}`), {
          exitCode: code ?? 1,
        }),
      );
    });
  });
}
