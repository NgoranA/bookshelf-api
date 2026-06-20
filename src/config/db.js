import { Pool } from "pg";
import { config } from "./env-config.js";

export const db = new Pool({ connectionString: config.DATABASE_URL });
