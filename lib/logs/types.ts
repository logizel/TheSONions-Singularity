export type ActorRole = 'network_admin' | 'hospital_admin';

export const LOG_ACTIONS = [
  'sign_in',
  'sign_out',
  'role_switch',
  'order_accept',
  'order_packed',
  'order_in_transit',
  'order_delivered',
  'order_cancelled',
  'action_rejected',
  'demo_reset',
] as const;
export type LogAction = (typeof LOG_ACTIONS)[number];

export const ACTION_LABEL: Record<LogAction, string> = {
  sign_in: 'Signed in',
  sign_out: 'Signed out',
  role_switch: 'Role switched',
  order_accept: 'Accepted',
  order_packed: 'Packed',
  order_in_transit: 'Dispatched',
  order_delivered: 'Delivered',
  order_cancelled: 'Cancelled',
  action_rejected: 'Rejected',
  demo_reset: 'Demo reset',
};

export interface LogEntry {
  id: string;
  /** ISO timestamp. */
  at: string;
  actorRole: ActorRole;
  actorHospital: string | null;
  action: LogAction;
  orderId: string | null;
  hospitalIds: string[];
  summary: string;
}

export interface Actor {
  role: ActorRole;
  hospitalId?: string | null;
}
