import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

import type { ResultsJSON } from "@/lib/contracts";
import type { Actor } from "@/lib/logs";
import type { ApiError, Order } from "@/lib/orders";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "@/lib/session";

// Shared helpers for /api/orders/* (Phase 6, D-08). Auth: middleware.ts
// makes every /api/orders path network_admin-only (403 otherwise).

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function errorResponse(e: ApiError | { status: number; error: string }): NextResponse<{ error: string }> {
  return NextResponse.json({ error: e.error }, { status: e.status, headers: NO_STORE });
}

export async function readJson(req: Request, optional = false): Promise<unknown | ApiError> {
  const text = await req.text();
  if (text.trim() === "") return optional ? {} : { status: 400, error: "Missing JSON body" };
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { status: 400, error: "Invalid JSON body" };
  }
}

export const ORDER_ID = /^ord-[0-9a-f]{12}$/;

export const ordersUnavailable = { status: 503, error: "Order store unavailable" } as const;

export function sessionOf(req: NextRequest): SessionPayload | null {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
}

/** Network admin, or the admin of the sending hospital. */
export function canActForSender(s: SessionPayload | null, fromHospital: string): boolean {
  return s !== null && (s.role === "network_admin" || (s.role === "hospital_admin" && s.hospitalId === fromHospital));
}

export const notSender = { status: 403, error: "Only the sending hospital's admin or a network admin can do this" } as const;

/** "Paracetamol 521.4 tablets, City Civil Hospital → Northgate General" using snapshot names. */
export function describeOrder(o: Order, r: ResultsJSON | null): string {
  const h = (id: string) => r?.hospitals.find((x) => x.hospitalId === id)?.hospitalName ?? id;
  const m = (id: string) => r?.medicines.find((x) => x.medicineId === id);
  const lines = o.lines.map((l) => {
    const med = m(l.medicineId);
    const unit = med?.baseUnit ?? "unit";
    return `${med?.medicineName ?? l.medicineId} ${l.qty} ${l.qty === 1 ? unit : `${unit}s`}`;
  });
  return `${lines.join(", ")}, ${h(o.fromHospital)} → ${h(o.toHospital)}`;
}

/** Log entry actor from a (middleware-verified) session. */
export function actorOf(s: SessionPayload | null): Actor {
  return s ? { role: s.role, hospitalId: s.hospitalId ?? null } : { role: "network_admin" };
}
