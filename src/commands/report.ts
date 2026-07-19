import { OperationalError } from "../errors.js";
import { findGitRoot, getCurrentCommit } from "../git.js";
import { type RenderedReport, renderDriftReport } from "../report.js";
import { ClaimsSchema, MappingSchema, StateSchema } from "../schemas.js";
import {
  readDriftwatchJson,
  writeDriftwatchJson,
  writeDriftwatchText,
} from "../storage.js";

export interface ReportOptions {
  waive?: {
    claimId: string;
    rationale: string;
  };
  unwaive?: string;
}

export async function reportCommand(
  cwd: string,
  options: ReportOptions = {},
): Promise<RenderedReport> {
  const root = await findGitRoot(cwd);
  const [claims, mapping, storedState] = await Promise.all([
    readDriftwatchJson(root, "claims.json", ClaimsSchema),
    readDriftwatchJson(root, "mapping.json", MappingSchema),
    readDriftwatchJson(root, "state.json", StateSchema),
  ]);
  if (options.waive !== undefined && options.unwaive !== undefined) {
    throw new OperationalError("choose either --waive or --unwaive, not both");
  }

  let state = storedState;
  if (options.waive !== undefined) {
    const claimId = options.waive.claimId;
    const rationale = options.waive.rationale.trim();
    if (rationale.length === 0) {
      throw new OperationalError("--waive requires a non-empty --reason");
    }
    if (!claims.some((claim) => claim.id === claimId)) {
      throw new OperationalError(`claim ${claimId} does not exist`);
    }
    state = {
      ...state,
      waivers: {
        ...state.waivers,
        [claimId]: {
          rationale,
          waivedAtCommit: await getCurrentCommit(root),
        },
      },
    };
    await writeDriftwatchJson(root, "state.json", state);
  } else if (options.unwaive !== undefined) {
    if (state.waivers[options.unwaive] === undefined) {
      throw new OperationalError(`claim ${options.unwaive} is not waived`);
    }
    const waivers = { ...state.waivers };
    delete waivers[options.unwaive];
    state = { ...state, waivers };
    await writeDriftwatchJson(root, "state.json", state);
  }

  const report = renderDriftReport(claims, mapping, state);
  await writeDriftwatchText(root, "DRIFT.md", report.content);
  return report;
}
