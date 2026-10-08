import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

import { chat } from "@/lib/chat";
import type { ResultsJSON } from "@/lib/contracts";

// POST /api/chat — accepts {question: string}, answers from precomputed
// ResultsJSON only. Auth enforced by middleware.ts (D-05); no session logic here.
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

  const blobPath = process.env.RESULTS_BLOB_PATH ?? "/tmp/results.json";
  let resultsJson: ResultsJSON;
  try {
    resultsJson = JSON.parse(await readFile(blobPath, "utf8")) as ResultsJSON;
  } catch {
    return NextResponse.json({ error: "Results not available" }, { status: 503 });
  }

  return NextResponse.json(chat(question, resultsJson));
}
