import { NextResponse } from "next/server";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function httpError(status: number, message: string): NextResponse {
  return NextResponse.json({ message }, { status });
}

