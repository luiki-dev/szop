import type { Email } from "./sender.ts";

// Only the origin and the token are put into an email, never user input, so
// no email holds a name (PH-18b spec, "The emails"). The link is escaped; the fixed lines are ours.
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function layout(
  intro: string,
  link: string,
  button: string,
  closing: string,
): Omit<Email, "to" | "subject"> {
  return {
    text: `Hi,\n\n${intro}\n\n${link}\n\n${closing}\n`,
    html: `<p>Hi,</p><p>${intro}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 20px;background:#1a56db;color:#ffffff;text-decoration:none;border-radius:6px">${button}</a></p><p>${closing}</p>`,
  };
}

export function verificationEmail(link: string): Omit<Email, "to"> {
  return {
    subject: "Confirm your email for Szop",
    ...layout(
      "Confirm your address to finish creating your Szop account:",
      link,
      "Confirm my address",
      "The link works once, for 24 hours. If you didn't create an account, ignore this email; nothing happens.",
    ),
  };
}

export function existingAccountEmail(loginLink: string): Omit<Email, "to"> {
  return {
    subject: "You already have a Szop account",
    ...layout(
      "Someone, maybe you, tried to create a Szop account with this address. It already has one.",
      loginLink,
      "Log in",
      "If it wasn't you, ignore this email.",
    ),
  };
}
