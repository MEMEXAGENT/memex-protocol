import { db } from "../db/connection.js";
import { vectors } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function storeVector(params: {
  ownerAgentId: string;
  space: string;
  dim: number;
  vector: number[];
  tags?: string[];
  meta?: Record<string, unknown>;
}) {
  const vectorId = nanoid();
  const embeddingStr = `[${params.vector.join(",")}]`;

  await db.execute(sql`
    INSERT INTO vectors (vector_id, owner_agent_id, space, dim, embedding, tags, meta)
    VALUES (
      ${vectorId},
      ${params.ownerAgentId},
      ${params.space},
      ${params.dim},
      ${embeddingStr}::vector,
      ${JSON.stringify(params.tags ?? [])}::jsonb,
      ${JSON.stringify(params.meta ?? {})}::jsonb
    )
  `);

  return {
    vector_id: vectorId,
    space: params.space,
    dim: params.dim,
    created_at: new Date().toISOString(),
  };
}

export async function getVector(vectorId: string, includeVector: boolean) {
  const rows = await db.execute(sql`
    SELECT vector_id, owner_agent_id, space, dim,
           ${includeVector ? sql`embedding::text` : sql`NULL`} as embedding,
           tags, meta, created_at
    FROM vectors WHERE vector_id = ${vectorId}
  `);

  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;

  return {
    vector_id: row.vector_id,
    owner_agent_id: row.owner_agent_id,
    space: row.space,
    dim: row.dim,
    vector: includeVector && row.embedding
      ? String(row.embedding).replace(/[[\]]/g, "").split(",").map(Number)
      : null,
    tags: row.tags ?? [],
    meta: row.meta ?? {},
    created_at: row.created_at,
  };
}

export async function searchVectors(params: {
  space: string;
  queryVector: number[];
  topK: number;
  filterTags?: string[];
}) {
  const embeddingStr = `[${params.queryVector.join(",")}]`;
  const tagFilter = params.filterTags && params.filterTags.length > 0
    ? sql`AND tags ?| ${sql.raw(`ARRAY[${params.filterTags.map((t) => `'${t}'`).join(",")}]`)}`
    : sql``;

  const rows = await db.execute(sql`
    SELECT vector_id, tags, meta,
           1 - (embedding <=> ${embeddingStr}::vector) AS score
    FROM vectors
    WHERE space = ${params.space} ${tagFilter}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${params.topK}
  `);

  return {
    space: params.space,
    top_k: params.topK,
    results: (rows as Array<Record<string, unknown>>).map((r) => ({
      vector_id: r.vector_id,
      score: Number(r.score),
      tags: r.tags ?? [],
      meta: r.meta ?? {},
    })),
  };
}
