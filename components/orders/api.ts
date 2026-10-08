"use client";

import type { Order, OrderStatus } from "@/lib/orders";

export class ApiFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiFailure(json.error ?? `Request failed (${res.status})`, res.status);
  return json as T;
}

export function acceptTransfer(line: { fromHospital: string; toHospital: string; medicineId: string; qty: number }) {
  return post<{ orders: Order[]; created: number }>("/api/orders/accept", line);
}

export function acceptAll() {
  return post<{ orders: Order[]; created: number }>("/api/orders/accept-all", {});
}

export function setOrderStatus(id: string, status: OrderStatus) {
  return post<{ order: Order; changed: boolean }>(`/api/orders/${encodeURIComponent(id)}/status`, { status });
}
