@AGENTS.md

# Calorie Tracker - Project Context

## Stack
Next.js 15 (App Router) + Vercel + Supabase + Drizzle + tRPC v11 + TanStack Query + shadcn/ui + Tailwind v4 + Motion + Vaul + Sonner + Recharts + Vercel AI SDK

## Key Architecture Rules

### Supabase PostgREST vs Drizzle
- **Drizzle (`ctx.db`)**: Use for SELECT queries and non-jsonb writes. Works through pgbouncer.
- **Supabase (`ctx.supabase`)**: Use for ANY writes to tables with jsonb columns (e.g., `profiles.meal_types`). Drizzle + postgres.js cannot serialize jsonb through pgbouncer.
- **Supabase returns snake_case** column names. Always normalize to camelCase for the frontend (see `normalizeProfile()` in `src/lib/trpc/routers/user.ts`).

### Cache Invalidation
- TanStack Query staleTime: 5 minutes, refetchOnMount: true
- After mutations, always call `utils.<router>.<procedure>.invalidate()` for affected queries
- The dashboard reads meal types from `trpc.user.getProfile`, not from `daily.get`

## Deployment
- GitHub: wesleybhansen/calorie-tracker (auto-deploys to Vercel on push)
- Vercel: wesleybhansen-1409s-projects scope
- Supabase project: qrggsjvvdwqczotrtssi (us-east-1)
- Test user: wesley.b.hansen@gmail.com (ID: 1a2bb71e-8de3-4b1f-8a1e-a20862fb4e00)

## Known Issue (pick up here)
Meal types sync from Profile settings to Dashboard needs verification. Latest fix: dashboard reads from `trpc.user.getProfile` directly. Test by deleting a meal type in settings and confirming it disappears from home page.

## Research Docs
Spec and research files are in the parent directory `/Users/wesleyhansen/Desktop/Calorie Tracker/`:
- SPEC.md — Full MVP specification
- DESIGN_RESEARCH.md — UI/UX design system
- PHOTO_RECOGNITION_STRATEGY.md — AI photo pipeline
- competitive-analysis.md — Market analysis
- TECHNICAL_PLAN.md — Stack decisions
- STACK_RESEARCH.md — Framework comparisons
