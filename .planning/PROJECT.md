# TheSONions-Singularity — Hospital Stock Balancer

## What This Is

Network inventory balancer for hospitals. It watches stock and demand per hospital and medicine, warns who will run out and what will expire unused, and tells the administrator exactly which hospital should send how much to which one. Single-screen dashboard with drill-in per hospital, plus a quote-only chatbot that answers from system results.

Prototype for a small hospital network. Built with Next.js + TypeScript, Drizzle ORM, Neon Postgres (free tier), hostable frontend + backend in the cloud.

## Core Value

Administrator knows before it happens who runs out, what wastes, and which transfer or order fixes it.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Collect per-hospital/medicine picture: stock, expiry, daily usage, patient load, emergency share, transport days, supplier lead time
- [ ] Forecast demand over coming days/weeks from weekly pattern, report error (3-11% target)
- [ ] Flag outbreak when daily demand climbs far above normal, switch to recent rising trend forecast
- [ ] Warn stock-out via days-until-stockout vs supplier lead time
- [ ] Warn waste via stock vs demand before expiry
- [ ] Suggest optimal transfers passing 5 checks + emergency order for remainder
- [ ] Rank competing hospitals by visible priority score (load, emergency, soonness, substitute)
- [ ] Show inventory, forecast, shortage, expiry, moves, priorities on one screen with drill-in
- [ ] Chatbot answers only from system results, quotes numbers, rejects hallucinated numbers

### Out of Scope

- Patient-level data / PHI — aggregates only to stay out of HIPAA scope
- Direct EHR integration — dashboard entry + CSV upload only for v1
- Real supplier ordering integration — recommend order only
- Mobile app — web dashboard first

## Context

- Greenfield prototype, 4 people, file-ownership split to avoid merge conflicts. UI theme decided by principal UI person (P1).
- History: 60 days daily usage to learn weekly pattern. Forecast: 30 days ops (act on lead-time window, 15-30d advisory) + to-expiry capped 90 days for waste.
- Data entry: per-hospital dashboard + bulk CSV upload + Excel export. Neon Postgres is source of truth.
- Forecast engine is pure TS statistical functions (weekday averages + trend switch), no ML training.
- Chatbot is rule-based tiny intent matcher + templates + number validator in v1, interface swappable to local/remote LLM later. No DB credentials for chatbot, only precomputed ResultsJSON with aggregates.
- Auth: hospital_admin RW-own / RO-others, network_admin full.
- MCPs available to all 4: context7 (docs), github (issues/PRs), playwright (verify flows), magicuidesign-mcp (P1 components, others read-only), hf-mcp-server (tiny-model comparison if needed), gsd/opencode (state).
- Repo: empty except README, git initialized, no .planning before init.

## Constraints

- **Tech stack**: Next.js + TypeScript + Drizzle + Neon free tier — hosting simplicity over Python data libs
- **Data**: Aggregates only, no PHI — avoids HIPAA bloat and external egress risk
- **Scale**: Prototype, handful of hospitals/medicines, pooled Neon connections, cold-start tolerant
- **Chatbot**: No DB access, no calculation, quote-only with post-check — medical safety
- **Team**: Strict directory ownership (P1 app/components, P2 db/scripts, P3 lib/engine, P4 app/api + lib/chat) — no cross-edits
- **Performance**: Forecast must cover supplier lead time; 15-30d marked advisory due to growing error

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Dashboard entry + CSV vs EHR API | EHR API invasive, HIPAA risk; dashboard keeps aggregates-only | — Pending |
| Next.js TS + Drizzle + Neon free tier | Single codebase, easy cloud host for prototype | — Pending |
| 60d history / 30d forecast / expiry cap 90 | Stable weekly baseline, early warning beyond lead time | — Pending |
| Per-hospital admin RW-own RO-others + network_admin | Hospitals self-serve numbers, central coordinator decides moves | — Pending |
| Rule-based chatbot vs whole LLM | Quote-only spec forbids generation; tiny, auditable, zero egress | — Pending |
| Local-first chat interface, swappable | Start zero-egress, allow remote LLM later without rewrite | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-08 after initialization*
