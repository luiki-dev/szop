import { randomUUID } from "node:crypto";
import { SendEmailCommand, type SESv2Client } from "@aws-sdk/client-sesv2";
import { describe, expect, it, vi } from "vitest";
import { testConfig } from "../test/config.ts";
import { createEmailSender } from "./sender.ts";

// Mailpit from compose.yaml, at a fixed address like PostgreSQL's.
const mailpit = "http://localhost:8025/api/v1";

const email = {
  to: "someone@example.com",
  subject: "Hello",
  text: "Plain",
  html: "<p>Rich</p>",
};

interface MailpitMessage {
  From: { Name: string; Address: string };
  To: { Address: string }[];
  Subject: string;
  Text: string;
  HTML: string;
}

async function mailpitMessage(to: string): Promise<MailpitMessage> {
  // Mailpit may store the message just after its SMTP reply.
  const id = await vi.waitFor(async () => {
    const response = await fetch(
      `${mailpit}/search?query=${encodeURIComponent(`to:${to}`)}`,
    );
    const found = (await response.json()) as { messages: { ID: string }[] };
    const [message, ...rest] = found.messages;
    if (message === undefined || rest.length > 0) {
      throw new Error(`expected one message to ${to}`);
    }
    return message.ID;
  });
  const response = await fetch(`${mailpit}/message/${id}`);
  return (await response.json()) as MailpitMessage;
}

describe("createEmailSender", () => {
  it("sends through SMTP to Mailpit", async () => {
    const to = `test-${randomUUID()}@example.com`;
    await createEmailSender(testConfig().email).send({ ...email, to });
    const message = await mailpitMessage(to);
    expect(message.From).toEqual({
      Name: "Szop",
      Address: "noreply@szop.dzwoniec.com",
    });
    expect(message.To.map((recipient) => recipient.Address)).toEqual([to]);
    expect(message.Subject).toBe("Hello");
    expect(message.Text).toContain("Plain");
    expect(message.HTML).toContain("<p>Rich</p>");
  });

  it("rejects when the SMTP server cannot be reached", async () => {
    const settings = {
      transport: "smtp",
      from: "noreply@szop.dzwoniec.com",
      smtpHost: "127.0.0.1",
      smtpPort: 1,
    } as const;
    await expect(createEmailSender(settings).send(email)).rejects.toThrow();
  });

  it("sends through SES with the From address", async () => {
    const sent: SendEmailCommand[] = [];
    const fake = {
      config: {},
      send: (command: SendEmailCommand) => {
        sent.push(command);
        return Promise.resolve({ MessageId: "id" });
      },
    } as unknown as SESv2Client;
    await createEmailSender(
      { transport: "ses", from: "Szop <noreply@szop.dzwoniec.com>" },
      fake,
    ).send(email);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(SendEmailCommand);
    const raw = Buffer.from(
      sent[0]?.input.Content?.Raw?.Data ?? new Uint8Array(),
    ).toString();
    expect(raw).toContain("From: Szop <noreply@szop.dzwoniec.com>");
    expect(raw).toContain("To: someone@example.com");
  });
});
