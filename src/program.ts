import { Command } from "commander";
import { checkCommand } from "./commands/check.js";
import { ingestCommand } from "./commands/ingest.js";
import { initCommand } from "./commands/init.js";
import { reportCommand } from "./commands/report.js";

export function createProgram(cwd = process.cwd()): Command {
  const program = new Command()
    .name("driftwatch")
    .description("Detect implementation drift from product requirements")
    .version("0.1.0");

  program
    .command("init")
    .description("Initialize Driftwatch state in the repository")
    .action(async () => {
      const directory = await initCommand(cwd);
      process.stdout.write(`Initialized ${directory}\n`);
    });

  program
    .command("ingest <prd>")
    .description("Extract and verify claims from a PRD")
    .action(async (prd: string) => {
      const summary = await ingestCommand(cwd, prd);
      process.stdout.write(
        `Ingested ${summary.claimCount} claims at ${summary.commit}\n`,
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
    .action(async () => {
      const report = await reportCommand(cwd);
      process.stdout.write(report.content);
      if (report.hasViolations) {
        process.exitCode = 1;
      }
    });

  return program;
}
