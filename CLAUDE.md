# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart Link Manager (SLM) is a SaaS short link management platform built with Vite + React 19 (frontend) and Express + tRPC (backend). It provides URL shortening, custom domains, QR codes, click analytics, and multi-tenant subscription management.

## Commands

```bash
pnpm install        # Install dependencies
pnpm run dev        # Start development server (tsx watch)
pnpm run build      # Production build (vite + esbuild)
pnpm run start      # Start production server
pnpm run check      # TypeScript type check
pnpm run test       # Run tests with Vitest
pnpm run db:push    # Generate and run Drizzle migrations
```

## Architecture

### Frontend-Backend Communication
- **tRPC**: Full-stack type-safe API layer. Router defined in `server/routers.ts`, client in `client/src/lib/trpc.ts`
- **Procedure Types**:
  - `publicProcedure`: No auth required
  - `protectedProcedure`: Requires authenticated user
  - `adminProcedure`: Requires admin role

### Key Directories
- `client/src/`: React frontend (pages, components, hooks)
- `server/`: Express backend with tRPC routers
- `server/_core/`: Core utilities (trpc, context, env, logger, rate limiting)
- `drizzle/`: Database schema and migrations
- `shared/`: Shared constants and error codes between frontend/backend

### Authentication Flow
- JWT tokens stored in HttpOnly cookies (`app_session_id`)
- Session verification via `server/_core/context.ts`
- Development mode: Auto-creates dev user when no cookies present

### Database (Drizzle ORM + MySQL)
- Schema: `drizzle/schema.ts` defines tables: `users`, `links`, `domains`, `linkStats`, `linkChecks`, `notifications`, `usageLogs`, `apiKeys`, `auditLogs`
- All DB operations in `server/db.ts` using lazy connection pattern

### Short Link Redirect Logic
- Entry: `server/redirectHandler.ts`
- Route: `GET /s/:shortCode`
- Mobile: Direct redirect to original URL
- Desktop: Redirects to `/verify/:token` (QR verification page)
- Bot detection: Serves SEO meta tags for crawlers

### Subscription & Limits
- Tiers: `free`, `pro`, `business`, `ENTERPRISE`
- Limits enforced via `server/licenseService.ts`
- Quota checks on: links, domains, API keys

## Environment Variables

Required in `.env`:
- `DATABASE_URL`: MySQL connection string
- `JWT_SECRET`: Secret for JWT signing
- `VITE_APP_ID`: App identifier for short URL generation
- `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD`: Auto-created admin

## i18n Convention

All UI text must be externalized. When adding new text:
1. Add keys to `client/src/locales/zh.json` and `client/src/locales/en.json`
2. Use `const { t } = useTranslation()` with appropriate namespace

## Testing

Tests located in `server/**/*.test.ts`. Use Vitest with node environment. Test setup in `server/setupTests.ts`.

Example test pattern from `server/auth.logout.test.ts`:
- Create mock context with fake user and request/response objects
- Use `appRouter.createCaller(ctx)` to invoke procedures directly
