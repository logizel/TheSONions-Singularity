# Transfer orders API (Phase 6)

Engine transfers (`ResultsJSON.transfers`) become orders when a network admin accepts them.
State lives in Neon `orders` + `order_lines` (migration `0002_orders`). Delivery changes
status only; `stock_batches` is never written.

Lifecycle: `accepted -> packed -> in_transit -> delivered`, or `cancelled` from any open state.
Each step stamps its own timestamp. "Suggested" is the snapshot the order came from
(`suggested_at` = its `generatedAt`).

| Method + path | Who | Body | Result |
|---|---|---|---|
| `GET /api/orders` | network_admin | - | `{ orders }`, newest first |
| `GET /api/orders/{id}` | network_admin | - | `{ order }` or 404 |
| `POST /api/orders/accept` | network_admin, or the sending hospital's admin | `{ fromHospital, toHospital, medicineId, qty? }` | 201 created / 200 existing, `{ orders, created }` |
| `POST /api/orders/accept-all` | network_admin | empty or `{}` | 201 / 200, `{ orders, created }` |
| `POST /api/orders/{id}/status` | network_admin, or the sending hospital's admin | `{ status: packed \| in_transit \| delivered \| cancelled }` | 200 `{ order, changed }`; 409 on a skipped step or a final state |
| `GET /api/order-status` | both roles | - | `{ orders }`: all for network_admin, own hospital's lanes for hospital_admin |

Validation: ids must exist (404), the engine must have suggested that lane + medicine in the
live snapshot (404), and `qty` must be positive (400) and at most the engine qty (422).
Middleware returns 401 without a session and 403 for hospital_admin on `/api/orders/*`, except accept and status, where the handler allows only the admin of the sending hospital (`fromHospital`).
Wrong methods get 405.

Idempotency: each line's key is `xfer:<asOf>:<from>:<to>:<medicineId>` (plus `#n` after n
cancels), behind a unique index. A double click, a re-accept, or accept-all after a single
accept returns the existing order instead of creating another. New lines on one lane are
grouped into one order whose id is derived from its sorted line keys.

Tracking (UI): the simulated vehicle runs the engine delivery window (`transportDays`) on a
demo clock (default 2880x, so a 2-day transfer takes about 1 min). The road drive time from
`/api/route` is shown separately and is never merged with the engine window.
