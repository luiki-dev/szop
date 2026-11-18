import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nodemailer from "nodemailer";
import type { EmailSettings } from "../config.ts";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSender {
  // Rejects when the email is not handed over; callers start it in the
  // background (background.ts).
  send(email: Email): Promise<void>;
}

// nodemailer builds the message once and hands it to Mailpit over SMTP, or to
// SES as the task's role, with its region and credentials from the
// environment (ADR 0078, decision 3). sesClient: tests pass a fake.
export function createEmailSender(
  settings: EmailSettings,
  sesClient?: SESv2Client,
): EmailSender {
  const transporter =
    settings.transport === "smtp"
      ? nodemailer.createTransport({
          host: settings.smtpHost,
          port: settings.smtpPort,
          secure: false,
        })
      : nodemailer.createTransport({
          SES: {
            sesClient: sesClient ?? new SESv2Client({}),
            SendEmailCommand,
          },
        });
  return {
    async send(email) {
      await transporter.sendMail({ from: settings.from, ...email });
    },
  };
}
