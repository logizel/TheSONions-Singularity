# Team Plan — TheSONions-Singularity (prototype)

Pull-accessible plan. Everyone gets this on `git pull`. Agents working on a track MUST update that member's progress file in `docs/progress/`.

## Tracks and file ownership

No one edits another track's directories. Need a change elsewhere → open a GitHub issue, the owner edits.

| Track | Owns (only these dirs) | Phase | Member | Branch |
|-------|------------------------|-------|--------|--------|
| P1 UI principal (theme final) | `app/` except `app/api/`, `components/`, `theme/` | 4 | Likith M Shetty (likhith992) | `p1/ui` |
| P2 Data | `db/`, `scripts/` (+ freezes `lib/contracts.ts` in Phase 1) | 1 | Jovian Wilson Simon (velo4705) | `p2/data` |
| P3 Engine | `lib/engine/` only | 2 | Anirudh Rao B (ANI-CPU-TECH) | `p3/engine` |
| P4 API/Chat/Auth | `app/api/`, `lib/chat/`, `middleware.ts` | 3 | Jizel Prince D'Souza (logizel) | `p4/api` |
| Integration (Phase 5) | No new dirs; fixes inside owning track's dirs only | 5 | All, coordinated via contracts | `integrate/phase-5` |

Shared contracts (frozen in Phase 1, changes need all-track agreement):
- `db/schema.ts` — tables
- `lib/contracts.ts` — engine in/out types + ResultsJSON shape
- `theme/tokens.ts` — UI theme tokens (P1 decides)

## Claim your track

Tracks are claimed (2026-10-08):

- P1 UI principal — Likith M Shetty (likhith992)
- P2 Data — Jovian Wilson Simon (velo4705)
- P3 Engine — Anirudh Rao B (ANI-CPU-TECH)
- P4 API/Chat/Auth — Jizel Prince D'Souza (logizel)

The UI principal (P1) has final say on theme — no theme debates in other tracks' PRs.

## MCPs (same set for all 4)

- `context7` — Next.js / Drizzle / Neon docs (resolve library ID first, then query-docs)
- `github` — issues, PRs, reviews (all changes merge via PR)
- `playwright` — P1 verifies dashboard flows, P4 verifies API + chat flow in browser
- `magicuidesign-mcp` — P1 picks components; other tracks read-only, no UI edits
- `hf-mcp-server` — only if comparing tiny intent models for chat (default is rule-based, no model needed)
- `gsd` / `opencode` — planning state and session tools

## Workflow

1. Day 1: P2 freezes `db/schema.ts` + `lib/contracts.ts`, P1 publishes `theme/tokens.ts`. Others build against stubs.
2. Daily: `git pull --rebase`, merge `main` into your branch before opening a PR.
3. PR rule: only touch your track's dirs. CI/reviewer rejects cross-track edits.
4. Progress: agents update `docs/progress/<you>.md` on every work session (status + log entry).
5. Phase order: 1 → 2 → 3 → 4 → 5. P1 (Phase 4) can start early against mock ResultsJSON.

## Planning docs

- `.planning/PROJECT.md` — context, constraints, decisions
- `.planning/REQUIREMENTS.md` — 24 v1 reqs with REQ-IDs + traceability
- `.planning/ROADMAP.md` — 5 phases, success criteria
- `.planning/STATE.md` — project memory
- `.planning/config.json` — Interactive, coarse, parallel, plan-check + verifier on
