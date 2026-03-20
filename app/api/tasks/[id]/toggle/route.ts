import { prisma } from "@/lib/prisma";
import { getAuthUserIdFromRequest } from "@/lib/auth";
import { httpError, json } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

function parseTaskId(id: string): number | null {
  const taskId = Number(id);
  if (!Number.isInteger(taskId) || taskId <= 0) return null;
  return taskId;
}

export async function POST(req: Request, ctx: Ctx) {
  const userId = getAuthUserIdFromRequest(req);
  if (!userId) return httpError(401, "Unauthorized");

  const taskId = parseTaskId(ctx.params.id);
  if (!taskId) return httpError(400, "Invalid task id");

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true, status: true },
  });

  if (!task) return httpError(404, "Task not found");

  const nextStatus = task.status === "pending" ? "completed" : "pending";

  const result = await prisma.task.updateMany({
    where: { id: taskId, userId },
    data: { status: nextStatus },
  });

  if (result.count === 0) return httpError(404, "Task not found");

  const updated = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
  });

  if (!updated) return httpError(404, "Task not found");

  return json({ task: updated });
}

