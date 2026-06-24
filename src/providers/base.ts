import { HunoError, Result } from "../utils/errors.js";

export interface Provider {
  readonly name: string;
  readonly model: string;
  complete(prompt: string, context: string): Promise<Result<string>>;
}
