export class OperationalError extends Error {
  readonly exitCode = 2;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OperationalError";
  }
}

export class ModelOutputError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ModelOutputError";
  }
}
