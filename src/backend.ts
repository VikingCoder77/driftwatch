import { spawn } from "node:child_process";
import { OperationalError } from "./errors.js";

export interface Backend {
  run(prompt: string): Promise<string>;
}

interface ProcessOptions {
  cwd: string;
  input: string;
}

interface ProcessResult {
  stdout: string;
  stderr: string;
}

export type ProcessRunner = (
  executable: string,
  args: string[],
  options: ProcessOptions,
) => Promise<ProcessResult>;

export const runProcess: ProcessRunner = (executable, args, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          stderr.trim().split("\n")[0] ||
            `Codex CLI exited with code ${exitCode ?? "unknown"}`,
        ),
      );
    });
    child.stdin.end(options.input);
  });

export class CodexBackend implements Backend {
  constructor(
    private readonly model: string,
    private readonly cwd: string,
    private readonly executable = "codex",
    private readonly runner: ProcessRunner = runProcess,
  ) {}

  async run(prompt: string): Promise<string> {
    try {
      const { stdout } = await this.runner(
        this.executable,
        [
          "exec",
          "--ephemeral",
          "--model",
          this.model,
          "--sandbox",
          "read-only",
          "--color",
          "never",
          "-",
        ],
        { cwd: this.cwd, input: prompt },
      );
      return stdout;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new OperationalError(
          "Codex CLI not found; install Codex and ensure `codex` is on PATH",
          { cause: error },
        );
      }

      const message = error instanceof Error ? error.message : "unknown error";
      throw new OperationalError(`Codex CLI failed: ${message}`, {
        cause: error,
      });
    }
  }
}
