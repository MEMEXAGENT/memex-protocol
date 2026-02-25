import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
import { ENV } from "../config.js";

const client = postgres(ENV.DATABASE_URL);
export const db = drizzle(client, { schema });
export { client };
