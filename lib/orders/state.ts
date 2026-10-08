/**
 * Order lifecycle (Phase 6, D-08):
 *   Suggested -> Accepted -> Packed -> In transit -> Delivered, + Cancelled.
 * Cancel is allowed from any open state. Delivered and Cancelled are final.
 * Nothing here touches stock: delivery is a status, never a stock movement.
 */
import type { Order, OrderStatus, OrderStep } from './types';

export const ORDER_STATUSES: readonly OrderStatus[] = ['accepted', 'packed', 'in_transit', 'delivered', 'cancelled'];

export const ORDER_STEPS: readonly OrderStep[] = ['suggested', 'accepted', 'packed', 'in_transit', 'delivered'];

export const STATUS_LABEL: Record<OrderStep | 'cancelled', string> = {
  suggested: 'Suggested',
  accepted: 'Accepted',
  packed: 'Packed',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  accepted: ['packed', 'cancelled'],
  packed: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === 'string' && (ORDER_STATUSES as readonly string[]).includes(v);
}

export function isOpen(status: OrderStatus): boolean {
  return status !== 'delivered' && status !== 'cancelled';
}

export type TransitionResult =
  | { kind: 'apply' }
  /** Already in the target state: idempotent no-op. */
  | { kind: 'noop' }
  | { kind: 'invalid'; reason: string };

export function checkTransition(from: OrderStatus, to: OrderStatus): TransitionResult {
  if (from === to) return { kind: 'noop' };
  if (NEXT[from].includes(to)) return { kind: 'apply' };
  return {
    kind: 'invalid',
    reason: `Cannot move a ${STATUS_LABEL[from].toLowerCase()} transfer to ${STATUS_LABEL[to].toLowerCase()}`,
  };
}

/** DB column (camelCase) holding each status's timestamp. */
export const STATUS_TIMESTAMP: Record<OrderStatus, 'acceptedAt' | 'packedAt' | 'inTransitAt' | 'deliveredAt' | 'cancelledAt'> = {
  accepted: 'acceptedAt',
  packed: 'packedAt',
  in_transit: 'inTransitAt',
  delivered: 'deliveredAt',
  cancelled: 'cancelledAt',
};

/** The one forward action an admin can take next, with its button copy. */
export function nextAction(status: OrderStatus): { to: OrderStatus; label: string } | null {
  switch (status) {
    case 'accepted':
      return { to: 'packed', label: 'Mark packed' };
    case 'packed':
      return { to: 'in_transit', label: 'Dispatch' };
    case 'in_transit':
      return { to: 'delivered', label: 'Mark delivered' };
    default:
      return null;
  }
}

export type StepState = 'done' | 'current' | 'pending' | 'not-reached';

export interface StepView {
  step: OrderStep;
  label: string;
  state: StepState;
  at: string | null;
}

/** Stepper rows for an order. Cancelled marks every unreached step `not-reached`. */
export function stepperView(order: Pick<Order, 'status' | 'suggestedAt' | 'acceptedAt' | 'packedAt' | 'inTransitAt' | 'deliveredAt'>): StepView[] {
  const at: Record<OrderStep, string | null> = {
    suggested: order.suggestedAt,
    accepted: order.acceptedAt,
    packed: order.packedAt,
    in_transit: order.inTransitAt,
    delivered: order.deliveredAt,
  };
  const reachedIdx = order.status === 'cancelled'
    ? ORDER_STEPS.reduce((acc, s, i) => (at[s] ? i : acc), 0)
    : ORDER_STEPS.indexOf(order.status);
  return ORDER_STEPS.map((step, i) => {
    let state: StepState;
    if (order.status === 'cancelled') state = i <= reachedIdx ? 'done' : 'not-reached';
    else if (i < reachedIdx || (i === reachedIdx && order.status === 'delivered')) state = 'done';
    else if (i === reachedIdx) state = 'current';
    else state = 'pending';
    return { step, label: STATUS_LABEL[step], state, at: state === 'done' || state === 'current' ? at[step] : null };
  });
}
