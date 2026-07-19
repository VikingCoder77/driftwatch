import { spawn } from "node:child_process";
import { OperationalError } from "./errors.js";
import type { Config } from "./schemas.js";

export interface Backend {
  run(prompt: string): Promise<string>;
}

interface ProcessOptions {
  cwd: string;
  input: string;
  env?: NodeJS.ProcessEnv;
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
      env:
        options.env === undefined
          ? undefined
          : { ...process.env, ...options.env },
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

interface CliInvocation {
  args: string[];
  input?: string;
  env?: NodeJS.ProcessEnv;
}

async function runCliBackend(
  displayName: string,
  executable: string,
  cwd: string,
  invocation: CliInvocation,
  runner: ProcessRunner,
): Promise<string> {
  try {
    const { stdout } = await runner(executable, invocation.args, {
      cwd,
      input: invocation.input ?? "",
      ...(invocation.env === undefined ? {} : { env: invocation.env }),
    });
    return stdout;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new OperationalError(
        `${displayName} CLI not found; install it and ensure \`${executable}\` is on PATH`,
        { cause: error },
      );
    }

    const message = error instanceof Error ? error.message : "unknown error";
    throw new OperationalError(`${displayName} CLI failed: ${message}`, {
      cause: error,
    });
  }
}

export class CodexBackend implements Backend {
  constructor(
    private readonly model: string | null,
    private readonly cwd: string,
    private readonly executable = "codex",
    private readonly runner: ProcessRunner = runProcess,
  ) {}

  async run(prompt: string): Promise<string> {
    return runCliBackend(
      "Codex",
      this.executable,
      this.cwd,
      {
        args: [
          "exec",
          "--ephemeral",
          ...(this.model === null ? [] : ["--model", this.model]),
          "--sandbox",
          "read-only",
          "--color",
          "never",
          "-",
        ],
        input: prompt,
      },
      this.runner,
    );
  }
}

export class OpenCodeBackend implements Backend {
  constructor(
    private readonly model: string | null,
    private readonly cwd: string,
    private readonly executable = "opencode",
    private readonly runner: ProcessRunner = runProcess,
  ) {}

  async run(prompt: string): Promise<string> {
    return runCliBackend(
      "OpenCode",
      this.executable,
      this.cwd,
      {
        args: [
          "--pure",
          "run",
          ...(this.model === null ? [] : ["--model", this.model]),
          prompt,
        ],
        env: { OPENCODE_PERMISSION: JSON.stringify({ "*": "deny" }) },
      },
      this.runner,
    );
  }
}

export class ClaudeCodeBackend implements Backend {
  constructor(
    private readonly model: string | null,
    private readonly cwd: string,
    private readonly executable = "claude",
    private readonly runner: ProcessRunner = runProcess,
  ) {}

  async run(prompt: string): Promise<string> {
    return runCliBackend(
      "Claude Code",
      this.executable,
      this.cwd,
      {
        args: [
          "-p",
          "--output-format",
          "text",
          "--no-session-persistence",
          "--tools",
          "",
          "--disallowedTools",
          "mcp__*",
          ...(this.model === null ? [] : ["--model", this.model]),
          prompt,
        ],
      },
      this.runner,
    );
  }
}

export class AntigravityBackend implements Backend {
  constructor(
    private readonly model: string | null,
    private readonly cwd: string,
    private readonly executable = "agy",
    private readonly runner: ProcessRunner = runProcess,
  ) {}

  async run(prompt: string): Promise<string> {
    return runCliBackend(
      "Antigravity",
      this.executable,
      this.cwd,
      {
        args: [
          ...(this.model === null ? [] : ["--model", this.model]),
          "-p",
          `Do not use tools or modify files. Work only from the supplied prompt.\n\n${prompt}`,
        ],
      },
      this.runner,
    );
  }
}

export function createBackend(
  config: Config,
  cwd: string,
  runner: ProcessRunner = runProcess,
): Backend {
  switch (config.backend) {
    case "codex":
      return new CodexBackend(config.model, cwd, "codex", runner);
    case "opencode":
      return new OpenCodeBackend(config.model, cwd, "opencode", runner);
    case "claude-code":
      return new ClaudeCodeBackend(config.model, cwd, "claude", runner);
    case "antigravity":
      return new AntigravityBackend(config.model, cwd, "agy", runner);
  }
}

export function verifierConfig(config: Config): Config {
  return {
    ...config,
    backend: config.verifierBackend ?? config.backend,
    model:
      config.verifierModel ??
      (config.verifierBackend === null ? config.model : null),
  };
}
