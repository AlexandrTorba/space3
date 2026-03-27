import "dotenv/config";
import { sql } from "drizzle-orm";
import { createDb } from "./index";

async function testConnection() {
  console.log("🚀 Testing database connection...");
  
  const url = process.env.DB_URL;
  const authToken = process.env.DB_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("❌ ERROR: Missing credentials in .env");
    process.exit(1);
  }

  try {
    const db = createDb(url, authToken);
    // Use select to verify schema/connection
    const result = await db.run(sql`SELECT 1+1`);
    console.log("✅ Connection successful!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Connection failed!", error);
    process.exit(1);
  }
}

testConnection();
