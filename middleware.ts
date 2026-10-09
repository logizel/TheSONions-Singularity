import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "session";

type Role = "hospital_admin" | "network_admin";

interface SessionPayload {
  role: Role;
  hospitalId?: string;
  /** Optional expiry, epoch seconds (demo sign-in sets it; gen-cookie omits it). */
  exp?: number;
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256Base64Url(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return toBase64Url(signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifySession(
  cookieValue: string | undefined,
  secret: string | undefined,
): Promise<SessionPayload | null> {
  if (!cookieValue || !secret) return null;

  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return null;

  const payloadPart = cookieValue.slice(0, dot);
  const signaturePart = cookieValue.slice(dot + 1);

  const expected = await hmacSha256Base64Url(secret, payloadPart);
  if (!timingSafeEqual(signaturePart, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart)) as SessionPayload;
    if (payload.role !== "hospital_admin" && payload.role !== "network_admin") {
      return null;
    }
    if (payload.role === "hospital_admin" && typeof payload.hospitalId !== "string") {
      return null;
    }
    if (
      payload.exp !== undefined &&
      (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000))
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// Best-effort target-hospital extraction for scoping decisions.
function hospitalIdForRequest(req: NextRequest): string | null {
  const pathMatch = req.nextUrl.pathname.match(/^\/api\/hospitals\/([^/]+)/);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  return req.nextUrl.searchParams.get("hospitalId");
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export default async function middleware(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(
    req.cookies.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET,
  );
  if (session === null) {
    // Pages: send people to the demo sign-in with a real 307 (the dashboard
    // streams, so a redirect from inside it would arrive as a meta refresh).
    if (!req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/sign-in", req.url), 307);
    }
    return unauthorized();
  }

  // D-07: hospital_admin may write only to its own hospital; reads open to all.
  if (session.role === "hospital_admin" && req.method !== "GET" && req.method !== "HEAD") {
    const target = hospitalIdForRequest(req);
    if (target !== null && target !== session.hospitalId) {
      return forbidden();
    }
  }

  // D-08: moves/orders are network_admin-only, except that a hospital admin
  // may accept a transfer and advance its status (POST accept / <id>/status);
  // those handlers then require the admin's hospital to be the sender.
  const path = req.nextUrl.pathname;
  const senderPath =
    req.method === "POST" && (path === "/api/orders/accept" || /^\/api\/orders\/[^/]+\/status$/.test(path));
  if (
    session.role !== "network_admin" &&
    (path.startsWith("/api/moves") || path.startsWith("/api/orders")) &&
    !senderPath
  ) {
    return forbidden();
  }

  // network_admin: full access, including moves/orders (D-08).
  return NextResponse.next();
}

export const config = {
  // "/" is the dashboard page; /sign-in stays public.
  matcher: ["/api/:path*", "/", "/insights", "/insights/:path*"],
};
