// Stryker disable all: entry point, checked by hand (testing.md, Rules): it only wires the sender, which sender.test.ts tests
import { loadConfig, type Config } from "./config.ts";
import { createEmailSender } from "./email/sender.ts";
import { instanceId } from "./instance.ts";

// Sends one email through the app's own sender, transport and address, to
// prove the path end to end: `node src/send-test-email.ts <address>`, on the
// demo through ECS Exec (ADR 0078, decision 4). The third file that reads
// process.env, checked by hand like server.ts (ADR 0019, decision 10).
const [to, ...rest] = process.argv.slice(2);
if (to === undefined || rest.length > 0) {
  console.error("Usage: node src/send-test-email.ts <address>");
  process.exit(1);
}

let config: Config;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const sentence = `Sent by Szop's test script at ${new Date().toISOString()} from instance ${instanceId}.`;
try {
  await createEmailSender(config.email).send({
    to,
    subject: "Szop test email",
    text: sentence,
    html: `<p>${sentence}</p>`,
  });
  // The address is not printed: whoever runs this typed it.
  console.log(JSON.stringify({ msg: "test email sent" }));
} catch (error) {
  const { name, code } = error as { name?: unknown; code?: unknown };
  console.log(
    JSON.stringify({
      msg: "test email not sent",
      errorName: name,
      errorCode: code,
    }),
  );
  process.exitCode = 1;
}
