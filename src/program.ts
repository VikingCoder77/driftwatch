import { Command, Option } from "commander";
import { checkCommand } from "./commands/check.js";
import { ingestCommand } from "./commands/ingest.js";
import { initCommand } from "./commands/init.js";
import { reportCommand } from "./commands/report.js";
import { OperationalError } from "./errors.js";
import { type BackendName, BackendNameSchema } from "./schemas.js";

export function createProgram(cwd = process.cwd()): Command {
  const program = new Command()
    .name("driftwatch")
    .description("Detect implementation drift from product requirements")
    .version("0.1.0");

  program
    .command("init")
    .description("Initialize Driftwatch state in the repository")
    .addOption(
      new Option("-b, --backend <backend>", "inference harness")
        .choices([...BackendNameSchema.options])
        .default("codex"),
    )
    .option("-m, --model <model>", "harness model name")
    .action(async (options: { backend: BackendName; model?: string }) => {
      const directory = await initCommand(cwd, options);
      process.stdout.write(`Initialized ${directory}\n`);
    });

  program
    .command("ingest <prd>")
    .description("Extract and verify claims from a PRD")
    .action(async (prd: string) => {
      const summary = await ingestCommand(cwd, prd);
      process.stdout.write(
        `Ingested ${summary.claimCount} claims at ${summary.commit} (${summary.changes.added} added, ${summary.changes.changed} changed, ${summary.changes.removed} removed, ${summary.changes.unchanged} unchanged)\n`,
      );
    });

  program
    .command("check")
    .description("Re-verify claims affected by repository changes")
    .action(async () => {
      const summary = await checkCommand(cwd);
      process.stdout.write(
        `Checked ${summary.checkedClaimCount} claims at ${summary.commit}\n`,
      );
      if (summary.hasViolations) {
        process.exitCode = 1;
      }
    });

  program
    .command("report")
    .description("Render the current drift report")
    .option("--waive <claim-id>", "waive one claim")
    .option("--reason <text>", "committed waiver rationale")
    .option("--unwaive <claim-id>", "remove one waiver")
    .action(
      async (options: {
        waive?: string;
        reason?: string;
        unwaive?: string;
      }) => {
        if (options.reason !== undefined && options.waive === undefined) {
          throw new OperationalError("--reason requires --waive");
        }
        const report = await reportCommand(cwd, {
          ...(options.waive === undefined
            ? {}
            : {
                waive: {
                  claimId: options.waive,
                  rationale: options.reason ?? "",
                },
              }),
          ...(options.unwaive === undefined
            ? {}
            : { unwaive: options.unwaive }),
        });
        process.stdout.write(report.content);
        if (report.hasViolations) {
          process.exitCode = 1;
        }
      },
    );

  return program;
}
