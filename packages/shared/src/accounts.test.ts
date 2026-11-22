import { describe, expect, it } from "vitest";
import {
  displayNameSchema,
  passwordLimits,
  registrationSchema,
} from "./accounts.ts";

const register = (extra: object = {}) =>
  registrationSchema.safeParse({
    name: "Ania",
    email: "ania@example.com",
    password: "a".repeat(15),
    ...extra,
  });

describe("displayNameSchema", () => {
  it("ACC-2.12: trims, and accepts 1 to 50 characters", () => {
    expect(displayNameSchema.parse("  Ania  ")).toBe("Ania");
    expect(displayNameSchema.safeParse("a".repeat(50)).success).toBe(true);
  });

  it("ACC-2.12: refuses an empty, a blank, a 51-character and a control-character name", () => {
    for (const name of ["", "   ", "a".repeat(51), "An\u0007ia", "An\nia"]) {
      expect(displayNameSchema.safeParse(name).success).toBe(false);
    }
  });
});

describe("registrationSchema", () => {
  it("ACC-2.2: counts a password in UTF-16 code units, 15 to 128", () => {
    expect(passwordLimits).toEqual({ min: 15, max: 128 });
    expect(register({ password: "a".repeat(14) }).success).toBe(false);
    expect(register({ password: "a".repeat(15) }).success).toBe(true);
    expect(register({ password: "a".repeat(128) }).success).toBe(true);
    expect(register({ password: "a".repeat(129) }).success).toBe(false);
    expect(register({ password: "😀".repeat(7) + "a" }).success).toBe(true);
    expect(register({ password: "😀".repeat(7) }).success).toBe(false);
    expect(register({ password: "😀".repeat(64) }).success).toBe(true);
    expect(register({ password: "😀".repeat(65) }).success).toBe(false);
  });

  it("refuses a keepGuestData that is not a boolean, and a placeholder address", () => {
    expect(register({ keepGuestData: true }).success).toBe(true);
    expect(register({ keepGuestData: "yes" }).success).toBe(false);
    expect(register({ email: "x@anonymous.placeholder.invalid" }).success).toBe(
      false,
    );
    expect(register({ email: "nope" }).success).toBe(false);
  });
});
