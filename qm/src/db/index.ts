import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  // Serverless: kurze Timeouts, damit hängende Verbindungen nicht Funktionsinstanzen blockieren und
  // ungenutzte Verbindungen schnell an den Pooler zurückgehen (R49).
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  });

// Auf Vercel (Fluid Compute) wird die Instanz zwischen Anfragen eingefroren; dann laufen die Idle-Timer des Pools nicht
// und die Verbindungen sind beim Auftauen tot (Verbindungs-Timeouts, abgelehnte Sitzungsabfragen). attachDatabasePool
// hält die Instanz, bis der Pool seine Leerlaufverbindungen freigegeben hat.
if (process.env.VERCEL) attachDatabasePool(pool);

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
