import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { chat } from "@/lib/chat";
import { getResults } from "@/lib/network";

// POST /api/chat — accepts {question: string}, answers only from the same
// ResultsJSON snapshot /api/results serves (Phase 6, D-11). Auth enforced by
// middleware.ts (D-05); no session logic here.
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = (body as { question?: unknown } | null)?.question;
  if (typeof question !== "string" || question.trim() === "") {
    return NextResponse.json({ error: "Missing question" }, { status: 400 });
  }

  if (question.length > 500) {
    return NextResponse.json({ error: "Question too long" }, { status: 400 });
  }

  const envelope = await getResults();
  if (envelope === null) {
    return NextResponse.json({ error: "Results not available" }, { status: 503 });
  }

  return NextResponse.json(chat(question, envelope.results), {
    headers: { "Cache-Control": "private, no-store" },
  });
}