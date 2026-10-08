import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// Pooled serverless client. Reads the connection string from the environment
// only — never hardcode credentials. Cached across invocations so serverless
// cold starts reuse the connection.
const sql = neon(process.env.DATABASE_URL as string);

export const db = drizzle(sql, { schema });
