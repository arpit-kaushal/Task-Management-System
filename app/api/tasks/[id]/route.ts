import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUserIdFromRequest } from "@/lib/auth";
import { httpError, json } from "@/lib/http";
import { TaskStatus } from "@prisma/client";

export const runtime = "nodejs";

const UpdateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["pending", "completed"]).optional(),
  })
  .refine((val) => val.title !== undefined || val.status !== undefined, {
    message: "Provide at least one field to update",
  });

type Ctx = { params: { id: string } };

function parseTaskId(id: string): number | null {
  const taskId = Number(id);
  if (!Number.isInteger(taskId) || taskId <= 0) return null;
  return taskId;
}

export async function GET(req: Request, ctx: Ctx) {
  const userId = getAuthUserIdFromRequest(req);
  if (!userId) return httpError(401, "Unauthorized");

  const taskId = parseTaskId(ctx.params.id);
  if (!taskId) return httpError(400, "Invalid task id");

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
  });

  if (!task) return httpError(404, "Task not found");
  return json({ task });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const userId = getAuthUserIdFromRequest(req);
  if (!userId) return httpError(401, "Unauthorized");

  const taskId = parseTaskId(ctx.params.id);
  if (!taskId) return httpError(400, "Invalid task id");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return httpError(400, "Invalid JSON body");
  }

  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return httpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const updateData: { title?: string; status?: TaskStatus } = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status as TaskStatus;

  const result = await prisma.task.updateMany({
    where: { id: taskId, userId },
    data: updateData,
  });

  if (result.count === 0) return httpError(404, "Task not found");

  const updated = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
  });

  if (!updated) return httpError(404, "Task not found");
  return json({ task: updated });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const userId = getAuthUserIdFromRequest(req);
  if (!userId) return httpError(401, "Unauthorized");

  const taskId = parseTaskId(ctx.params.id);
  if (!taskId) return httpError(400, "Invalid task id");

  const result = await prisma.task.deleteMany({
    where: { id: taskId, userId },
  });

  if (result.count === 0) return httpError(404, "Task not found");
  return json({ id: taskId });
}

