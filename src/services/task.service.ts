import { db } from "../db/connection.js";
import { tasks } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { notFound } from "../utils/errors.js";
import { PROTOCOL } from "../config.js";
import * as vm from "node:vm";

export async function submitTask(params: {
  submitterAgentId: string;
  code: string;
  inputs: Record<string, unknown>;
  sandboxLimits?: { time_s: number; mem_mb: number };
}) {
  const taskId = nanoid();
  const limits = params.sandboxLimits ?? {
    time_s: PROTOCOL.SANDBOX.DEFAULT_TIME_S,
    mem_mb: PROTOCOL.SANDBOX.DEFAULT_MEM_MB,
  };

  await db.insert(tasks).values({
    taskId,
    submitterAgentId: params.submitterAgentId,
    code: params.code,
    inputs: params.inputs,
    sandboxLimits: limits,
    status: "running",
  });

  runInSandbox(taskId, params.code, params.inputs, limits.time_s).catch(() => {});

  return {
    task_id: taskId,
    status: "running",
    estimated_ready_s: limits.time_s,
  };
}

export async function getTask(taskId: string) {
  const rows = await db.select().from(tasks).where(eq(tasks.taskId, taskId)).limit(1);
  if (rows.length === 0) throw notFound("Task", taskId);

  const t = rows[0];
  return {
    task_id: t.taskId,
    submitter_agent_id: t.submitterAgentId,
    status: t.status,
    result: t.result,
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
  };
}

async function runInSandbox(
  taskId: string,
  code: string,
  inputs: Record<string, unknown>,
  timeoutSeconds: number,
) {
  try {
    const sandbox = { inputs, result: undefined as unknown };
    const context = vm.createContext(sandbox);
    const script = new vm.Script(code);
    script.runInContext(context, { timeout: timeoutSeconds * 1000 });

    await db
      .update(tasks)
      .set({ status: "completed", result: { output: sandbox.result }, updatedAt: new Date() })
      .where(eq(tasks.taskId, taskId));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(tasks)
      .set({ status: "failed", result: { error: message }, updatedAt: new Date() })
      .where(eq(tasks.taskId, taskId));
  }
}
