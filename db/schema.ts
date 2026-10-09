import {
  boolean,
  check,
  date,
  doublePrecision,
  integer,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---- Master data -----------------------------------------------------------

// Coded medicine master (D-05): transfers match on stable ids, never on
// free-text names. substitute_ids + base_unit feed PRIOR-01 scoring.
export const medicines = pgTable("medicines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  isCritical: boolean("is_critical").notNull().default(false),
  baseUnit: text("base_unit").notNull(),
  substituteIds: text("substitute_ids").array().notNull().default([]),
});

// Map position (Phase 6, D-04): WGS84 decimal degrees + display address.
// Nullable so hospitals without a known location still load; the map
// drops them instead of guessing.
export const hospitals = pgTable("hospitals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  address: text("address"),
}, (t) => [
  check(
    "hospitals_latlng_check",
    sql`(${t.latitude} is null or ${t.latitude} between -90 and 90) and (${t.longitude} is null or ${t.longitude} between -180 and 180)`,
  ),
]);

// Ownership columns live here from day one (D-24); enforcement hardens in
// Phase 3 middleware. role is hospital_admin (own hospital) or network_admin.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  hospitalId: text("hospital_id").references(() => hospitals.id),
  role: text("role").notNull(),
}, (t) => [
  check("users_role_check", sql`${t.role} in ('hospital_admin','network_admin')`),
]);

// ---- Stock -----------------------------------------------------------------

// Batch rows (D-01/D-02): one row per hospital + medicine + qty + expiry.
// Expiry is mandatory (D-07). Expired batches are archived, never deleted (D-04).
// buffer_days is admin-editable per hospital+medicine (D-06, feeds MOVE-01).
export const stockBatches = pgTable("stock_batches", {
  id: text("id").primaryKey(),
  hospitalId: text("hospital_id").notNull().references(() => hospitals.id),
  medicineId: text("medicine_id").notNull().references(() => medicines.id),
  qty: integer("qty").notNull(),
  expiryDate: date("expiry_date").notNull(),
  archived: boolean("archived").notNull().default(false),
  bufferDays: integer("buffer_days").notNull().default(7),
}, (t) => [
  check("stock_batches_qty_check", sql`${t.qty} >= 0`),
]);

// ---- Usage -----------------------------------------------------------------

// Combined daily row (D-08): usage + load + emergency share in one table.
// used_qty NULL means missing (engine interpolates); zero only when explicit (D-10).
export const dailyUsage = pgTable("daily_usage", {
  usageDate: date("usage_date").notNull(),
  hospitalId: text("hospital_id").notNull().references(() => hospitals.id),
  medicineId: text("medicine_id").notNull().references(() => medicines.id),
  usedQty: integer("used_qty"),
  patientLoad: integer("patient_load").notNull(),
  emergencyPct: integer("emergency_pct").notNull(),
}, (t) => [
  primaryKey({ columns: [t.usageDate, t.hospitalId, t.medicineId] }),
  check("daily_usage_pct_check", sql`${t.emergencyPct} >= 0 and ${t.emergencyPct} <= 100`),
  check("daily_usage_qty_check", sql`${t.usedQty} is null or ${t.usedQty} >= 0`),
  check("daily_usage_load_check", sql`${t.patientLoad} >= 0`),
]);

// ---- Network config (network admin only, D-14) ------------------------------

// Directed pairwise matrix (D-12): asymmetric routes allowed, self-pair = 0.
export const transportDays = pgTable("transport_days", {
  fromHospital: text("from_hospital").notNull().references(() => hospitals.id),
  toHospital: text("to_hospital").notNull().references(() => hospitals.id),
  days: integer("days").notNull(),
}, (t) => [
  primaryKey({ columns: [t.fromHospital, t.toHospital] }),
  check("transport_days_check", sql`${t.days} >= 0 and ${t.days} <= 30`),
]);

// Per hospital+medicine lead times (D-13): RISK-02 warnings need precision.
export const supplierLeads = pgTable("supplier_leads", {
  hospitalId: text("hospital_id").notNull().references(() => hospitals.id),
  medicineId: text("medicine_id").notNull().references(() => medicines.id),
  leadDays: integer("lead_days").notNull(),
}, (t) => [
  primaryKey({ columns: [t.hospitalId, t.medicineId] }),
  check("supplier_leads_check", sql`${t.leadDays} >= 0 and ${t.leadDays} <= 30`),
]);

// ---- Transfer orders (Phase 6, D-08) -----------------------------------------

// One accepted shipment on a lane (from -> to). Lifecycle:
// accepted -> packed -> in_transit -> delivered, or cancelled from any open
// state; one timestamp column per step. "Suggested" is the engine snapshot
// the order came from (suggested_at = its generatedAt). Delivery is a status
// only: nothing here ever writes stock_batches.
export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  // Sorted line keys: the same set of suggestions always maps to one order.
  idempotencyKey: text("idempotency_key").notNull(),
  fromHospital: text("from_hospital").notNull().references(() => hospitals.id),
  toHospital: text("to_hospital").notNull().references(() => hospitals.id),
  status: text("status").notNull().default("accepted"),
  // Engine delivery window at accept time (whole days, transport_days).
  transportDays: integer("transport_days").notNull(),
  asOf: date("as_of").notNull(),
  suggestedAt: timestamp("suggested_at", { withTimezone: true, mode: "string" }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  packedAt: timestamp("packed_at", { withTimezone: true, mode: "string" }),
  inTransitAt: timestamp("in_transit_at", { withTimezone: true, mode: "string" }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "string" }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "string" }),
  // Set when delivery moved the units in stock_batches (see stock_movements).
  stockAppliedAt: timestamp("stock_applied_at", { withTimezone: true, mode: "string" }),
}, (t) => [
  uniqueIndex("orders_idempotency_key_uq").on(t.idempotencyKey),
  index("orders_lane_idx").on(t.fromHospital, t.toHospital),
  check("orders_status_check", sql`${t.status} in ('accepted','packed','in_transit','delivered','cancelled')`),
  check("orders_lane_check", sql`${t.fromHospital} <> ${t.toHospital}`),
  check("orders_transport_days_check", sql`${t.transportDays} >= 0 and ${t.transportDays} <= 30`),
]);

// One medicine on an order. idempotency_key = xfer:<asOf>:<from>:<to>:<med>
// (+ "#n" after n cancels): a double click or re-accept hits the unique
// index instead of creating a second line.
export const orderLines = pgTable("order_lines", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  medicineId: text("medicine_id").notNull().references(() => medicines.id),
  qty: doublePrecision("qty").notNull(),
  suggestedQty: doublePrecision("suggested_qty").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  checksPassed: text("checks_passed").array().notNull().default([]),
}, (t) => [
  uniqueIndex("order_lines_idempotency_key_uq").on(t.idempotencyKey),
  index("order_lines_order_idx").on(t.orderId),
  check("order_lines_qty_check", sql`${t.qty} > 0 and ${t.qty} <= ${t.suggestedQty}`),
]);

// ---- Activity log (Phase 6) ---------------------------------------------------

// Who did what, at every level. Actor is a role + hospital (no personal data).
// hospital_ids = every hospital involved (actor's, sender, receiver), so a
// hospital admin sees its own actions and anything touching its hospital;
// the network admin sees all rows.
export const activityLog = pgTable("activity_log", {
  id: text("id").primaryKey(),
  at: timestamp("at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  actorRole: text("actor_role").notNull(),
  actorHospital: text("actor_hospital"),
  action: text("action").notNull(),
  orderId: text("order_id"),
  hospitalIds: text("hospital_ids").array().notNull().default([]),
  summary: text("summary").notNull(),
}, (t) => [
  index("activity_log_at_idx").on(t.at.desc()),
  index("activity_log_hospitals_idx").using("gin", t.hospitalIds),
  check("activity_log_role_check", sql`${t.actorRole} in ('hospital_admin','network_admin')`),
]);

// Every stock_batches change made by a delivery, so it is auditable and the
// demo reset can undo it exactly: delta < 0 = taken from a sender batch,
// created = a new receiver batch (deleted on reset).
export const stockMovements = pgTable("stock_movements", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  batchId: text("batch_id").notNull(),
  hospitalId: text("hospital_id").notNull().references(() => hospitals.id),
  medicineId: text("medicine_id").notNull().references(() => medicines.id),
  delta: integer("delta").notNull(),
  created: boolean("created").notNull().default(false),
  at: timestamp("at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (t) => [index("stock_movements_order_idx").on(t.orderId)]);

// ---- Local events (EVT-01) -----------------------------------------------------

// Floods, heat waves, epidemics, ... near hospitals. Aggregate geo + dates
// only, no PHI. Rows are never deleted: ending an event sets ends_on, so the
// history of what moved a forecast stays auditable. source = 'feed' is
// reserved for future auto feeds; only 'manual' is written today.
export const localEvents = pgTable("local_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  radiusKm: doublePrecision("radius_km").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  severity: integer("severity").notNull(),
  source: text("source").notNull().default("manual"),
  note: text("note"),
}, (t) => [
  index("local_events_ends_on_idx").on(t.endsOn),
  check(
    "local_events_type_check",
    sql`${t.type} in ('flood','heatwave','cyclone','earthquake','epidemic','festival','other')`,
  ),
  check("local_events_source_check", sql`${t.source} in ('manual','feed')`),
  check("local_events_severity_check", sql`${t.severity} between 1 and 3`),
  check("local_events_radius_check", sql`${t.radiusKm} > 0 and ${t.radiusKm} <= 200`),
  check("local_events_dates_check", sql`${t.endsOn} >= ${t.startsOn}`),
  check(
    "local_events_latlng_check",
    sql`${t.latitude} between -90 and 90 and ${t.longitude} between -180 and 180`,
  ),
]);
