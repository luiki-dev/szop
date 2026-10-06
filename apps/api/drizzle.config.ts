import { defineConfig } from "drizzle-kit";

// drizzle-kit's settings. `generate` compares the schema with the last
// snapshot and writes a migration; it never connects to a database.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
