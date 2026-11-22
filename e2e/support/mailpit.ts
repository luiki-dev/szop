// The newest email Mailpit (docker compose, http://localhost:8025) caught for
// an address, polled until it arrives (ADR 0078). Each journey registers its
// own random address, so a search by recipient finds only its own mail.
const mailpit = "http://localhost:8025/api/v1";

export async function latestEmail(
  to: string,
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {},
): Promise<{ subject: string; text: string; verifyLink: string }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const search = await fetch(
      `${mailpit}/search?query=${encodeURIComponent(`to:${to}`)}`,
    );
    if (!search.ok)
      throw new Error(`Mailpit search answered ${String(search.status)}`);
    const found = (await search.json()) as { messages: { ID: string }[] };
    // The search lists the newest first.
    const id = found.messages[0]?.ID;
    if (id !== undefined) {
      const message = (await (
        await fetch(`${mailpit}/message/${id}`)
      ).json()) as {
        Subject: string;
        Text: string;
      };
      const verifyLink = /https?:\/\/\S+\/verify\?token=\S+/.exec(
        message.Text,
      )?.[0];
      if (verifyLink === undefined)
        throw new Error(
          `The email to ${to} holds no /verify?token= link:\n${message.Text}`,
        );
      return {
        subject: message.Subject,
        text: message.Text,
        verifyLink,
      };
    }
    if (Date.now() > deadline)
      throw new Error(
        `No email for ${to} reached Mailpit in ${String(timeoutMs)} ms`,
      );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
