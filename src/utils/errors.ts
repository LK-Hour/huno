export class HunoError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly hint?: string
  ) {
    super(message);
    this.name = "HunoError";
  }

  toString(): string {
    let output = `${this.name}: ${this.message}`;
    if (this.hint) {
      output += `\n\n${this.hint}`;
    }
    return output;
  }
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: HunoError };