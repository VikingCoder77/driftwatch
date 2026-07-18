import { findGitRoot } from "../git.js";
import { type RenderedReport, renderDriftReport } from "../report.js";
import { ClaimsSchema, MappingSchema, StateSchema } from "../schemas.js";
import { readDriftwatchJson, writeDriftwatchText } from "../storage.js";

export async function reportCommand(cwd: string): Promise<RenderedReport> {
  const root = await findGitRoot(cwd);
  const [claims, mapping, state] = await Promise.all([
    readDriftwatchJson(root, "claims.json", ClaimsSchema),
    readDriftwatchJson(root, "mapping.json", MappingSchema),
    readDriftwatchJson(root, "state.json", StateSchema),
  ]);
  const report = renderDriftReport(claims, mapping, state);
  await writeDriftwatchText(root, "DRIFT.md", report.content);
  return report;
}
