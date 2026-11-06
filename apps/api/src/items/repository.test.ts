import { describe, expect, it } from "vitest";
import { isForeignKeyViolation } from "./repository.ts";

describe("isForeignKeyViolation", () => {
  it("NFR-4.10: sees code 23503 on the error or on its cause, nothing else", () => {
    expect(isForeignKeyViolation({ code: "23503" })).toBe(true);
    expect(
      isForeignKeyViolation(new Error("x", { cause: { code: "23503" } })),
    ).toBe(true);
    expect(isForeignKeyViolation({ code: "23505" })).toBe(false);
    expect(isForeignKeyViolation(new Error("x"))).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
  });
});
