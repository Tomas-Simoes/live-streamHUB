import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: `.env.${process.env["NODE_ENV"] || "development"}` });
config();

const databaseUrl =
  process.env["DATABASE_URL"] ||
  `postgresql://${process.env["DB_USER"] || "user"}:${process.env["DB_PASSWORD"] || "pwd"}@${process.env["DB_HOST"] || "localhost"}:${process.env["DB_PORT"] || "5432"}/${process.env["DB_NAME"] || "live_stream_hub"}?schema=${process.env["DB_SCHEMA"] || "public"}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
