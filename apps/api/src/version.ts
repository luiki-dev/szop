import { readFileSync } from "node:fs";
import { z } from "zod";

// The release version, from the root package.json, which release-please
// bumps. The image copies that file to the same relative place, so one path
// serves both (PH-16c spec, "The version in the menu").
export function readVersion(): string {
  const file = new URL("../../../package.json", import.meta.url);
  // Stryker disable next-line StringLiteral: a Buffer parses to the same JSON as the utf8 string
  const text = readFileSync(file, "utf8");
  const { version } = z.object({ version: z.string() }).parse(JSON.parse(text));
  return version;
}
