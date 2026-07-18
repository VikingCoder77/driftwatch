import { z } from "zod";

export const ClaimTypeSchema = z.enum([
  "behavior",
  "data-model",
  "api-contract",
  "limit",
  "config",
  "cli",
]);

export const ClaimSchema = z
  .object({
    id: z.string().regex(/^C\d+$/),
    section: z.string().min(1),
    text: z.string().min(1),
    type: ClaimTypeSchema,
  })
  .strict();

export const ClaimsSchema = z.array(ClaimSchema);

export const VerificationStatusSchema = z.enum([
  "SATISFIED",
  "VIOLATED",
  "NOT_FOUND",
]);

export const VerificationResultSchema = z
  .object({
    status: VerificationStatusSchema,
    file: z.string().min(1).nullable(),
    lines: z
      .string()
      .regex(/^\d+-\d+$/)
      .nullable(),
    evidence: z.string().min(1),
  })
  .strict();

export const MappingEntrySchema = VerificationResultSchema.extend({
  checkedAtCommit: z.string().min(1),
});

export const MappingSchema = z.record(z.string(), MappingEntrySchema);

export const BackendNameSchema = z.enum([
  "codex",
  "opencode",
  "claude-code",
  "antigravity",
]);

export const ConfigSchema = z
  .object({
    backend: BackendNameSchema,
    model: z.string().min(1).nullable(),
    prdPath: z.string().min(1).nullable(),
  })
  .strict();

export const StateSchema = z
  .object({
    lastCheckedCommit: z.string().min(1).optional(),
  })
  .strict();

export type Claim = z.infer<typeof ClaimSchema>;
export type BackendName = z.infer<typeof BackendNameSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type MappingEntry = z.infer<typeof MappingEntrySchema>;
export type State = z.infer<typeof StateSchema>;
export type VerificationResult = z.infer<typeof VerificationResultSchema>;
