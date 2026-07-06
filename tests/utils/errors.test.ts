import { describe, it, expect } from "vitest";
import { HunoError } from "../../src/utils/errors.js";
import type { Result } from "../../src/utils/errors.js";

describe("HunoError", () => {
  it("creates with message and code", () => {
    const err = new HunoError("something failed", "TEST_ERROR");
    expect(err.message).toBe("something failed");
    expect(err.code).toBe("TEST_ERROR");
    expect(err.name).toBe("HunoError");
    expect(err.hint).toBeUndefined();
  });

  it("creates with hint", () => {
    const err = new HunoError("bad config", "CFG_BAD", "Try running init");
    expect(err.hint).toBe("Try running init");
  });

  it("extends Error", () => {
    const err = new HunoError("fail", "CODE");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HunoError);
  });

  it("toString includes message and hint", () => {
    const err = new HunoError("failed", "X", "do this");
    const str = err.toString();
    expect(str).toContain("HunoError: failed");
    expect(str).toContain("do this");
  });

  it("toString without hint shows only message", () => {
    const err = new HunoError("oops", "Y");
    const str = err.toString();
    expect(str).toBe("HunoError: oops");
  });
});

describe("Result type", () => {
  it("ok result carries data", () => {
    const result: Result<number> = { ok: true, data: 42 };
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(42);
  });

  it("error result carries HunoError", () => {
    const result: Result<string> = {
      ok: false,
      error: new HunoError("nope", "NOPE"),
    };
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOPE");
      expect(result.error.message).toBe("nope");
    }
  });
});
