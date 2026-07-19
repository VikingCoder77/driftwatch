import type { Claim } from "./schemas.js";

export interface ClaimChanges {
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
}

export interface ReconciledClaims {
  claims: Claim[];
  changes: ClaimChanges;
}

function normalized(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function exactKey(claim: Claim): string {
  return [claim.type, normalized(claim.section), normalized(claim.text)].join(
    "\u0000",
  );
}

function sameClaim(left: Claim, right: Claim): boolean {
  return (
    left.section === right.section &&
    left.text === right.text &&
    left.type === right.type &&
    (left.sourceId ?? null) === (right.sourceId ?? null)
  );
}

function nextClaimId(
  previousClaims: Claim[],
  usedIds: Set<string>,
): () => string {
  let nextNumber = previousClaims.reduce((maximum, claim) => {
    const number = Number.parseInt(claim.id.slice(1), 10);
    return Math.max(maximum, number);
  }, 0);

  return () => {
    do {
      nextNumber += 1;
    } while (usedIds.has(`C${nextNumber}`));
    const id = `C${nextNumber}`;
    usedIds.add(id);
    return id;
  };
}

export function reconcileClaimIdentities(
  extractedClaims: Claim[],
  previousClaims: Claim[],
): ReconciledClaims {
  const unmatchedPrevious = new Set(previousClaims.map((claim) => claim.id));
  const usedIds = new Set(previousClaims.map((claim) => claim.id));
  const allocateId = nextClaimId(previousClaims, usedIds);
  const changes: ClaimChanges = {
    added: 0,
    changed: 0,
    removed: 0,
    unchanged: 0,
  };

  const findMatch = (claim: Claim): Claim | undefined => {
    if (claim.sourceId != null) {
      const sourceMatch = previousClaims.find(
        (previous) =>
          unmatchedPrevious.has(previous.id) &&
          previous.sourceId === claim.sourceId,
      );
      if (sourceMatch !== undefined) {
        return sourceMatch;
      }
    }
    const key = exactKey(claim);
    return previousClaims.find(
      (previous) =>
        unmatchedPrevious.has(previous.id) && exactKey(previous) === key,
    );
  };

  const claims = extractedClaims.map((claim) => {
    const match = findMatch(claim);
    if (match === undefined) {
      changes.added += 1;
      return { ...claim, id: allocateId() };
    }

    unmatchedPrevious.delete(match.id);
    if (sameClaim(match, claim)) {
      changes.unchanged += 1;
    } else {
      changes.changed += 1;
    }
    return { ...claim, id: match.id };
  });

  changes.removed = unmatchedPrevious.size;
  return { claims, changes };
}
