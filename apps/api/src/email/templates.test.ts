import { describe, expect, it } from "vitest";
import { existingAccountEmail, verificationEmail } from "./templates.ts";

describe("verificationEmail", () => {
  const email = verificationEmail("https://szop.test/verify?token=a<b");

  it("has the subject, the greeting, the link and the closing line", () => {
    expect(email.subject).toBe("Confirm your email for Szop");
    expect(email.text.startsWith("Hi,")).toBe(true);
    expect(email.text).toContain("https://szop.test/verify?token=a<b");
    for (const part of [email.text, email.html]) {
      expect(part).toContain(
        "The link works once, for 24 hours. If you didn't create an account, ignore this email; nothing happens.",
      );
    }
  });

  it("holds no name: the text is the same for any link but the link", () => {
    const other = verificationEmail("https://other.test/x");
    expect(other.text.replace("https://other.test/x", "L")).toBe(
      email.text.replace("https://szop.test/verify?token=a<b", "L"),
    );
  });

  it("escapes the link in the HTML and has the button", () => {
    expect(email.html).toContain("verify?token=a&lt;b");
    expect(email.html).not.toContain("token=a<b");
    expect(email.html).toContain("Confirm my address");
  });
});

describe("existingAccountEmail", () => {
  const email = existingAccountEmail("https://szop.test/login");

  it("has the subject, the button and no reset line", () => {
    expect(email.subject).toBe("You already have a Szop account");
    expect(email.text.startsWith("Hi,")).toBe(true);
    expect(email.text).toContain("https://szop.test/login");
    expect(email.html).toContain("Log in");
    expect(email.html).toContain("If it wasn't you, ignore this email.");
    expect(email.text + email.html).not.toContain("Forgot your password");
  });
});
