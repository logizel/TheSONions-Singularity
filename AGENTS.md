<!-- GSD:project-start source:PROJECT.md -->

## Project

**TheSONions-Singularity — Hospital Stock Balancer**

Network inventory balancer for hospitals. It watches stock and demand per hospital and medicine, warns who will run out and what will expire unused, and tells the administrator exactly which hospital should send how much to which one. Single-screen dashboard with drill-in per hospital, plus a quote-only chatbot that answers from system results.

Prototype for a small hospital network. Built with Next.js + TypeScript, Drizzle ORM, Neon Postgres (free tier), hostable frontend + backend in the cloud.

**Core Value:** Administrator knows before it happens who runs out, what wastes, and which transfer or order fixes it.

### Constraints

- **Tech stack**: Next.js + TypeScript + Drizzle + Neon free tier — hosting simplicity over Python data libs
- **Data**: Aggregates only, no PHI — avoids HIPAA bloat and external egress risk
- **Scale**: Prototype, handful of hospitals/medicines, pooled Neon connections, cold-start tolerant
- **Chatbot**: No DB access, no calculation, quote-only with post-check — medical safety
- **Team**: Strict directory ownership (P1 app/components, P2 db/scripts, P3 lib/engine, P4 app/api + lib/chat) — no cross-edits
- **Performance**: Forecast must cover supplier lead time; 15-30d marked advisory due to growing error

<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
