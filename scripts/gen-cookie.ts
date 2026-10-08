#!/usr/bin/env node
/**
 * Generate a valid session cookie for testing.
 * Usage: npx tsx scripts/gen-cookie.ts [network_admin|hospital_admin] [hospitalId]
 */
import { createHmac } from "node:crypto";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "test-secret-for-uat-testing";
const [, , role, hospitalId] = process.argv;

if (!role || (role === "hospital_admin" && !hospitalId)) {
  console.error("Usage: npx tsx scripts/gen-cookie.ts <network_admin|hospital_admin> [hospitalId]");
  process.exit(1);
}

const payload: Record<string, string> = { role };
if (hospitalId) payload.hospitalId = hospitalId;

const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
const signature = createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");

console.log(`${payloadB64}.${signature}`);
