#!/usr/bin/env node

import { OperationalError } from "./errors.js";
import { createProgram } from "./program.js";

async function main(): Promise<void> {
  try {
    await createProgram().parseAsync(process.argv);
  } catch (error) {
    if (error instanceof OperationalError) {
      process.stderr.write(`driftwatch: ${error.message}\n`);
      process.exitCode = error.exitCode;
      return;
    }
    throw error;
  }
}

void main();
