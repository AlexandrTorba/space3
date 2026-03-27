import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DB_URL) {
  console.warn("⚠️ ERROR: DB_URL is missing in environment! Check .env file.");
} else {
  console.log("🛠️ Drizzle: DB_URL loaded from environment.");
}

export default defineConfig({
  dialect: "turso",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DB_URL!,
    authToken: process.env.DB_AUTH_TOKEN!,
  },
});
