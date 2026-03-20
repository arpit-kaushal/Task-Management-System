import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUserIdFromRequest } from "@/lib/auth";
import { httpError, json } from "@/lib/http";
import { TaskStatus } from "@prisma/client";

export const runtime = "nodejs";

const StatusSchema = z.enum(["pending", "completed"]);

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: StatusSchema.optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

const CreateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  status: StatusSchema.optional(),
});

export async function GET(req: Request) {
  const userId = getAuthUserIdFromRequest(req);
  if (!userId) return httpError(401, "Unauthorized");

  const url = new URL(req.url);
  const input = {
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  };

  const parsed = QuerySchema.safeParse(input);
  if (!parsed.success) {
    return httpError(400, parsed.error.issues[0]?.message ?? "Invalid query");
  }

  const page = parsed.data.page ?? 1;
  const limit = parsed.data.limit ?? 20;

  const where: { userId: number; status?: TaskStatus } & Record<string, unknown> = {
    userId,
  };

  if (parsed.data.status) {
    where.status = parsed.data.status as TaskStatus;
  }

  if (parsed.data.q) {
    // TiDB/MySQL connector doesn't support `mode: "insensitive"` on `contains`.
    (where as any).title = { contains: parsed.data.q };
  }

  const [total, tasks] = await Promise.all([
    prisma.task.count({
      where: where as any,
    }),
    prisma.task.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return json({
    data: tasks,
    page,
    limit,
    total,
    totalPages,
  });
}

export async function POST(req: Request) {
  const userId = getAuthUserIdFromRequest(req);
  if (!userId) return httpError(401, "Unauthorized");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return httpError(400, "Invalid JSON body");
  }

  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return httpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const created = await prisma.task.create({
    data: {
      userId,
      title: parsed.data.title,
      ...(parsed.data.status ? { status: parsed.data.status as TaskStatus } : {}),
    },
    select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
  });

  return json({ task: created }, 201);
}

