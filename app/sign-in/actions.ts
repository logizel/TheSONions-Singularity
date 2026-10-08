"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { listHospitals } from "@/lib/hospital-locations";
import { logActivity } from "@/lib/logs";
import { getSession } from "@/lib/session/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_S,
  demoAuthEnabled,
  signSession,
  type SessionPayload,
} from "@/lib/session";

// Demo sign-in (Phase 6, D-13). Server Functions are POSTs to the page route,
// not /api, so middleware.ts never gates them; Next checks Origin vs Host.
// Disabled unless DEMO_AUTH=true. Mints the same signed cookie middleware.ts
// verifies, so every server-side 401/403 rule applies to the UI unchanged.

export interface SignInState {
  error: string | null;
}

const ROLES = new Set(["network_admin", "hospital_admin"]);

async function setSession(payload: SessionPayload): Promise<void> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(payload, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  if (!demoAuthEnabled()) return { error: "Demo sign-in is disabled on this deployment." };
  if (!process.env.SESSION_SECRET) return { error: "Server is missing SESSION_SECRET." };

  const role = form.get("role");
  const hospitalId = form.get("hospitalId");
  if (typeof role !== "string" || !ROLES.has(role)) return { error: "Choose a role." };

  const payload: SessionPayload = {
    role: role as SessionPayload["role"],
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S,
  };
  if (role === "hospital_admin") {
    if (typeof hospitalId !== "string" || hospitalId === "") return { error: "Choose your hospital." };
    let known: boolean;
    try {
      known = (await listHospitals()).some((h) => h.id === hospitalId);
    } catch {
      return { error: "Hospital list unavailable. Try again shortly." };
    }
    if (!known) return { error: "Unknown hospital." };
    payload.hospitalId = hospitalId;
  }

  await setSession(payload);
  await logActivity({ role: payload.role, hospitalId: payload.hospitalId ?? null }, "sign_in", `Signed in as ${payload.role === "network_admin" ? "network admin" : "hospital admin"}`);
  const next = form.get("next");
  // Only same-app relative paths; never an open redirect.
  redirect(typeof next === "string" && /^\/(?!\/)[\w\-/?=&.]*$/.test(next) ? next : "/");
}

export async function signOut(): Promise<void> {
  const current = await getSession();
  if (current) await logActivity({ role: current.role, hospitalId: current.hospitalId ?? null }, "sign_out", "Signed out");
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/sign-in");
}

/**
 * Top-bar role switcher (D-13): re-issues the signed cookie for another demo
 * role, then refreshes the router so server reads and API 401/403 rules
 * follow the new role. Same DEMO_AUTH gate and hospital check as signIn.
 */
export async function switchRole(form: FormData): Promise<SignInState> {
  if (!demoAuthEnabled()) return { error: "Demo sign-in is disabled on this deployment." };
  if (!process.env.SESSION_SECRET) return { error: "Server is missing SESSION_SECRET." };
  const role = form.get("role");
  const hospitalId = form.get("hospitalId");
  if (typeof role !== "string" || !ROLES.has(role)) return { error: "Choose a role." };
  const payload: SessionPayload = {
    role: role as SessionPayload["role"],
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S,
  };
  if (role === "hospital_admin") {
    if (typeof hospitalId !== "string" || hospitalId === "") return { error: "Choose your hospital." };
    try {
      if (!(await listHospitals()).some((h) => h.id === hospitalId)) return { error: "Unknown hospital." };
    } catch {
      return { error: "Hospital list unavailable. Try again shortly." };
    }
    payload.hospitalId = hospitalId;
  }
  const previous = await getSession();
  await setSession(payload);
  const to = payload.role === "network_admin" ? "network admin" : `hospital admin (${payload.hospitalId})`;
  const from = previous ? (previous.role === "network_admin" ? "network admin" : `hospital admin (${previous.hospitalId})`) : "signed out";
  await logActivity({ role: payload.role, hospitalId: payload.hospitalId ?? null }, "role_switch", `Switched role from ${from} to ${to}`, {
    hospitals: [previous?.hospitalId],
  });
  refresh();
  return { error: null };
}
