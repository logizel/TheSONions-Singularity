<div align="center">

# 🌿 Sanjeevini

### Hospital network stock balancer

Know **before it happens** which hospital will run out of a medicine, what will expire unused,
and exactly **which hospital should send how much to which one**.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Neon Postgres](https://img.shields.io/badge/Neon-Postgres-00E599?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520.9-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/logizel/TheSONions-Singularity)](https://github.com/logizel/TheSONions-Singularity/commits/main)
[![Repo size](https://img.shields.io/github/repo-size/logizel/TheSONions-Singularity)](https://github.com/logizel/TheSONions-Singularity)

![Sanjeevini dashboard](docs/screenshots/dashboard.png)

</div>

---

## Table of contents

- [Overview](#overview)
- [Screenshots](#screenshots)
- [Key features](#key-features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Running the app](#running-the-app)
- [Demo walkthrough](#demo-walkthrough)
- [API reference](#api-reference)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Data and safety](#data-and-safety)
- [Contributing](#contributing)
- [Team](#team)
- [License](#license)

## Overview

**Sanjeevini** is a network inventory balancer for a small group of hospitals. It watches stock and
daily demand for every hospital and medicine, forecasts the next 30 days, and tells the
administrator:

- **who will run out** of a medicine before their supplier could deliver,
- **what will expire unused** and could be sent somewhere it is needed,
- **which transfer or supplier order fixes it**, with the exact quantity and the reasons it is safe.

It is a prototype for a small hospital network: a handful of hospitals and medicines, a single-screen
dashboard with a drill-in per hospital, and a quote-only chatbot that answers from the system's own
results.

> **Core value:** the administrator knows before it happens who runs out, what is wasted, and which
> transfer or order fixes it.

## Screenshots

> 📸 The images below are **placeholders**. To add your own, save a screenshot with the **same file
> name** into [`docs/screenshots/`](docs/screenshots) (PNG, around 1280×720 works well) and it will
> appear here automatically. No README edit needed.

| | |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png)<br>**Dashboard.** Hospital map with risk-coloured markers and the network panel.<br>`docs/screenshots/dashboard.png` | ![Hospital drill-in](docs/screenshots/hospital-detail.png)<br>**Hospital drill-in.** Stock, days until stock-out and transfers in and out.<br>`docs/screenshots/hospital-detail.png` |
| ![Transfer checkout](docs/screenshots/transfer-checkout.png)<br>**Transfer checkout.** Engine-suggested transfers with Accept and Accept all.<br>`docs/screenshots/transfer-checkout.png` | ![Order tracking](docs/screenshots/order-tracking.png)<br>**Order tracking.** ETA, status stepper and simulated vehicle.<br>`docs/screenshots/order-tracking.png` |
| ![Insights](docs/screenshots/insights.png)<br>**Insights.** Charts and plain-language explanations per hospital.<br>`docs/screenshots/insights.png` | ![Local events](docs/screenshots/local-events.png)<br>**Local events.** Add a flood or heat wave and watch the forecast react.<br>`docs/screenshots/local-events.png` |
| ![Stock entry](docs/screenshots/stock-entry.png)<br>**Enter stock.** Manual stock and usage entry for hospital admins.<br>`docs/screenshots/stock-entry.png` | ![Chatbot](docs/screenshots/chatbot.png)<br>**Chatbot.** Quote-only answers taken from the engine results.<br>`docs/screenshots/chatbot.png` |

## Key features

- **Single-screen dashboard.** A Leaflet map (or list view) of the hospitals coloured by risk, a
  network panel, and a drill-in sheet per hospital.
- **30-day demand forecast** per hospital and medicine from a 60-day usage history. Days 15 to 30 are
  marked *advisory* because the error grows with distance.
- **Stock-out warnings** when days of cover are shorter than the supplier lead time.
- **Waste warnings** for batches that will expire before they can be used.
- **Transfer suggestions** that say which hospital sends how much to which one, each passing five
  checks (arrival before stock-out, shelf life, sender buffer, within need, waste-first or nearest).
  Whatever transfers cannot cover becomes a **supplier order**.
- **Priority ranking** of every hospital and medicine pair, with the reasons shown.
- **Outbreak detection.** A sudden, sustained jump in a medicine's usage switches that series to a
  trend forecast.
- **Local events** (flood, heat wave, cyclone, earthquake, epidemic, festival). A network admin adds
  an event with a location, radius, dates and severity. A fixed, explainable rulebook raises the
  forecast for the affected medicine categories at hospitals inside the radius, and the reason is shown
  on the map, in the drill-in, on the insights page and in the chat.
- **Order lifecycle.** Accept a transfer, then track it through *accepted, packed, in transit,
  delivered* (or *cancelled*). Delivery moves the units between the two hospitals' stock records.
- **Manual stock entry.** Hospital admins add batches (expiry required), remove damaged stock and record
  daily usage for their own hospital.
- **Insights pages** with charts and plain-language explanations for each hospital.
- **Activity log** of every sign-in, order action, stock entry and event, scoped by role.
- **Quote-only chatbot.** Answers come from fixed templates filled from the same results snapshot, and
  every number in an answer is checked against that snapshot before it is shown.
- **Two roles** (network admin and hospital admin) with enforcement in middleware and again in the
  handlers.

## How it works

```
 usage history (60 days) + stock batches + supplier lead times + transport days + local events
                                          │
                                          ▼
                                 lib/engine (pure functions)
   forecast ─► outbreak check ─► event uplift ─► stock-out ─► waste ─► transfers ─► priorities
                                          │
                                          ▼
                     ResultsJSON snapshot  (GET /api/results)
              ┌───────────────┬───────────┴───────────┬───────────────┐
              ▼               ▼                       ▼               ▼
          Dashboard      Insights pages        Transfer checkout   Chatbot
```

1. **Forecast.** For each forecast day, the mean of the historical usage on the same weekday
   (`lib/engine/forecast.ts`). If the series is flagged as an outbreak, the average of the last 7 days
   is used instead (`lib/engine/outbreak.ts`).
2. **Local events.** Events near a hospital multiply the forecast for specific medicine categories on
   the days they cover (`lib/engine/events.ts`). For example a flood raises rehydration by 80% and
   antibiotics by 40% at severity 2. Overlapping events take the larger multiplier instead of stacking.
   Insulin is never raised.
3. **Risk.** Stock is depleted day by day against the forecast to get days until stock-out. A warning
   is raised when that is shorter than the supplier lead time (`lib/engine/stockout.ts`). Batches that
   would expire unused raise waste warnings (`lib/engine/waste.ts`).
4. **Moves.** Senders must keep a 7-day buffer, and the receiver gets exactly what it needs.
   Senders with the most expiring units go first, then the nearest. Any remainder becomes one supplier
   order (`lib/engine/moves.ts`).
5. **Priorities.** Every hospital and medicine pair gets a score from soonness, emergency share,
   patient load and substitutes (`lib/engine/priorities.ts`).

The engine is a set of **pure functions with no I/O**. `lib/network` loads the data and assembles one
`ResultsJSON` snapshot that the dashboard, the insights pages, the checkout and the chatbot all read, so
they can never disagree.

> No machine learning is used. Every number on screen can be traced back to a rule.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org/) 16 (App Router, route handlers, middleware), React 19 |
| Language | TypeScript |
| Database | [Neon](https://neon.tech/) serverless Postgres via `@neondatabase/serverless` |
| ORM and migrations | [Drizzle ORM](https://orm.drizzle.team/) and `drizzle-kit` |
| Map | Leaflet and react-leaflet, OpenStreetMap tiles |
| Road routing | [OSRM](https://project-osrm.org/) (public demo server by default) |
| Spreadsheet export | `xlsx` |
| Tests | [Vitest](https://vitest.dev/) |

## Architecture

```
Browser ──► middleware.ts (signed session cookie, role checks)
              │
              ├─► app/page.tsx ........ dashboard (map, panel, sheets)
              ├─► app/insights ........ per-hospital charts
              └─► app/api/* ........... route handlers
                       │
                       ├─ lib/network ... load DB ► engine ► ResultsJSON (cached briefly,
                       │                  falls back to data/results.json if the DB is down)
                       ├─ lib/engine .... pure forecasting and decision functions
                       ├─ lib/orders .... order lifecycle and stock movements
                       ├─ lib/events .... local-event validation and store
                       ├─ lib/chat ...... intent match ► template ► number validator
                       └─ db/ ........... Drizzle schema, migrations, pooled Neon client
```

- **One snapshot.** `GET /api/results` is the single source for every screen and the chatbot. When Neon
  is unreachable it serves the last written blob (`data/results.json`) with an
  `X-Results-Source: snapshot` header.
- **Auth.** A signed `session` cookie (HMAC with `SESSION_SECRET`) is checked in `middleware.ts`. The
  prototype uses a demo sign-in with no password, enabled only with `DEMO_AUTH=true`.
- **Quote-only chatbot.** It has no database access and does no calculation. It matches an intent
  (most at risk, stock-out timing, waste quantities, transfer reasons, event reasons), fills a fixed
  template from the snapshot, and rejects the answer if any number or date in it does not appear
  verbatim in the snapshot.

## Getting started

### Prerequisites

- **Node.js 20.9 or newer** (required by Next.js 16) and npm
- A **Neon** Postgres database (the free tier is enough) and its connection string
- Internet access for the OpenStreetMap tiles and the public OSRM server (or your own of each)

### Installation

```bash
# 1. Clone
git clone https://github.com/logizel/TheSONions-Singularity.git
cd TheSONions-Singularity

# 2. Install dependencies
npm install

# 3. Configure the environment (see the table below)
cp .env.example .env
#    then edit .env and fill in DATABASE_URL and SESSION_SECRET

# 4. Create the tables
npx drizzle-kit migrate

# 5. Load the demo data (3 hospitals x 5 medicines x 60 days, plus demo events)
node --env-file=.env --import tsx scripts/seed.ts
```

> ⚠️ `scripts/seed.ts` clears the base tables before inserting, so run it only on a database you are
> happy to reset. To add 10 more fictional hospitals around Mangaluru without touching the base seed,
> run `node --env-file=.env --import tsx scripts/seed-extra-hospitals.ts`.

## Environment variables

Copy [`.env.example`](.env.example) to `.env`. Never commit a real `.env`.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon connection string, e.g. `postgresql://user:pass@host/db?sslmode=require` |
| `SESSION_SECRET` | Yes | HMAC key for the signed `session` cookie. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `DEMO_AUTH` | For the demo | Set to `true` to enable the passwordless demo sign-in and the top-bar role switcher. Any other value disables both |
| `ROUTING_BASE_URL` | No | OSRM server for `GET /api/route`. Empty uses the public demo server (fair use, no SLA) |
| `NEXT_PUBLIC_TILE_URL` | No | Map tile URL template. Empty uses OpenStreetMap standard tiles |
| `RESULTS_BLOB_PATH` | No | Output path used by `scripts/generate-results.ts`. Defaults to `data/results.json` |

## Running the app

The frontend and the backend are one Next.js app, so a single command runs both.

```bash
# Development (http://localhost:3000)
npm run dev

# Production build and start
npm run build
npm run start
```

Open <http://localhost:3000/sign-in>. With `DEMO_AUTH=true`, pick a role and sign in. No password.

Optional data tools (each needs `DATABASE_URL`, so load `.env` as shown):

```bash
# Rewrite the fallback snapshot from the live database (add --stdout to print it)
node --env-file=.env --import tsx scripts/generate-results.ts

# Bulk-import usage history from CSV
#   header: date,hospital,medicine,used_qty,patient_load,emergency_pct
node --env-file=.env --import tsx scripts/csv-import.ts path/to/file.csv

# Export every table to a spreadsheet
node --env-file=.env --import tsx scripts/excel-export.ts out.xlsx

# Re-seed only the demo local events (touches only local_events)
node --env-file=.env --import tsx scripts/seed-events.ts

# Make a session cookie for API testing
node --env-file=.env --import tsx scripts/gen-cookie.ts network_admin
node --env-file=.env --import tsx scripts/gen-cookie.ts hospital_admin <hospitalId>
```

## Demo walkthrough

**As network admin: place, approve and track a transfer**

1. Sign in as **Network admin**.
2. On the map, click a red or amber hospital to see its stock and incoming or outgoing transfers.
3. Click **Review transfers (N)** to open the **Transfer checkout**. Expand **checks passed** on a line to
   see why it is safe.
4. Click **Accept transfer** on a line, or **Accept all**.
5. Click **Track**, then **Mark packed**, **Dispatch** and finally **Mark delivered**, then **Deliver and
   update stock**. Use the demo-clock speed buttons to fast-forward the simulated vehicle.
6. Open **Logs** to see the audit trail. **Reset demo** there undoes delivered stock moves and clears
   orders and the log.

**As hospital admin:** use the top-bar **Demo role** menu and pick a hospital. You can accept and advance
transfers that **your hospital sends**, and use **Enter stock** for your own hospital. Everything else is
read only.

**Local events:** as network admin, open **Events**, add a flood near a hospital, and watch its forecast,
stock-out days and badges change.

## API reference

All routes need a signed session cookie. A missing cookie returns `401`, a forbidden role returns `403`,
and errors are `{ "error": "..." }`. More detail is in [`docs/orders-api.md`](docs/orders-api.md) and
[`docs/hospital-locations-api.md`](docs/hospital-locations-api.md).

| Method and path | Who | Purpose |
|---|---|---|
| `GET /api/results` | both roles | The `ResultsJSON` snapshot that every screen reads |
| `GET /api/hospital-locations` | both roles | Hospital markers, map centre and bounds (Leaflet `[lat, lng]` order) |
| `GET /api/route?from=<id>&to=<id>` | both roles | Road route between two hospitals (falls back to a straight line) |
| `POST /api/chat` | both roles | `{ "question": "..." }`, answered only from the snapshot |
| `GET /api/orders` | network admin | All orders, newest first |
| `GET /api/orders/{id}` | network admin | One order |
| `POST /api/orders/accept` | network admin, or the sending hospital's admin | Accept one suggested transfer |
| `POST /api/orders/accept-all` | network admin | Accept every suggested transfer |
| `POST /api/orders/{id}/status` | network admin, or the sending hospital's admin | `{ "status": "packed" \| "in_transit" \| "delivered" \| "cancelled" }` |
| `GET /api/order-status` | both roles | Orders visible to the caller |
| `GET /api/events` | both roles | List local events |
| `POST /api/events` | network admin | Add a local event |
| `POST /api/events/{id}/end` | network admin | End an event (the row is kept) |
| `POST /api/inventory` | network admin, or the admin of that hospital | Manual stock entry: `action` is `add`, `remove` or `usage` |
| `GET /api/logs?hospital=&action=&limit=` | both roles (scoped) | Activity log |
| `POST /api/admin/demo-reset` | network admin | `{ "confirm": "RESET" }` reverses delivery stock moves and clears orders and logs |

Example, asking the chatbot (with a valid session cookie):

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "content-type: application/json" \
  -H "cookie: session=<value from scripts/gen-cookie.ts>" \
  -d '{"question":"Which hospital is most at risk?"}'
# {"answer":"..."}
```

## Testing

```bash
npm test            # Vitest, one run
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

Tests live next to the code they cover (`*.test.ts`) and cover the engine, the chatbot and its validator,
orders, events, insights and the dashboard view helpers.

## Project structure

```
.
├── app/                  Next.js App Router
│   ├── page.tsx          Dashboard
│   ├── insights/         Per-hospital charts
│   ├── sign-in/          Demo sign-in
│   └── api/              Route handlers (see API reference)
├── components/           UI: dashboard, map, orders, events, stock, insights, logs, chat
├── lib/
│   ├── engine/           Pure forecasting and decision functions (+ tests)
│   ├── network/          Load data, run the engine, build ResultsJSON
│   ├── orders/           Order lifecycle and stock movements
│   ├── events/           Local-event validation and store
│   ├── chat/             Intents, templates, quotes, validator
│   ├── insights/         Chart data and plain-language explanations
│   ├── logs/             Activity log
│   ├── session/          Signed cookie and demo auth
│   ├── routing/          OSRM client with straight-line fallback
│   └── contracts.ts      Shared types, including ResultsJSON
├── db/                   Drizzle schema, Neon client, SQL migrations
├── scripts/              Seeds, CSV import, Excel export, snapshot generator
├── data/results.json     Fallback results snapshot
├── docs/                 API notes and screenshots
├── theme/                Design tokens
└── middleware.ts         Session and role enforcement
```

## Data and safety

- **Aggregates only, no patient data.** The system stores stock, daily usage totals, patient load and
  emergency share per hospital. No PHI.
- **Chatbot safety.** The chatbot has no database access and does no calculation. Anything it cannot
  quote from the snapshot gets a fixed refusal sentence.
- **Prototype access.** The demo sign-in has no password and exists only for demos. Keep `DEMO_AUTH`
  unset anywhere that matters.
- **Public services.** The default OSRM server and map tiles are fair-use demo services.

## Contributing

1. Fork the repository and create a branch from `main`.
2. Make your change, with tests next to the code if it touches the engine, chat or API.
3. Make sure `npm test`, `npm run typecheck` and `npm run build` pass.
4. Use conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`) and open a pull request that
   explains what changed and why.

Never commit `.env` or real credentials.

## Team

TheSONions:

- Jizel Prince D'Souza ([logizel](https://github.com/logizel))
- Jovian Wilson Simon ([velo4705](https://github.com/velo4705))
- Anirudh Rao B ([ANI-CPU-TECH](https://github.com/ANI-CPU-tech))
- Likhith M Shetty ([likhith992](https://github.com/likhith992))

## License

Released under the [MIT License](LICENSE).
