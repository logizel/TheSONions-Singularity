import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // drizzle-kit reads the connection string from the environment.
    // Never hardcode credentials here.
    url: process.env.DATABASE_URL as string,
  },
});
