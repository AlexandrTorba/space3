
import { createClient } from "@libsql/client";

async function checkDb() {
    const url = process.env.LIBSQL_URL || "file:./local.db";
    const token = process.env.LIBSQL_AUTH_TOKEN || "";
    
    console.log("Checking DB at:", url);
    const client = createClient({ url, authToken: token });
    
    try {
        const res = await client.execute("SELECT id, video_enabled FROM matches ORDER BY created_at DESC LIMIT 5");
        console.log("Recent matches:");
        res.rows.forEach(r => console.log(r));
    } catch (e) {
        console.error("DB check failed:", e);
    }
}

checkDb();
