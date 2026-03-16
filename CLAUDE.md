# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint check
```

Required environment variables (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Architecture Overview

**ClientFlow** is a multi-workspace CRM for boutique/retail businesses. Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, and Supabase as the backend.

### Core Abstractions

**Workspace** — The central multi-tenancy unit. Each user can own multiple workspaces ("boutiques") and be a member of others. The active workspace is stored in `localStorage` and provided via `WorkspaceProvider`. Every data query is scoped to `activeWorkspace.id`.

**Role system** (`lib/useRole.ts`) — Three roles with permission checks:
- `owner` — full access including analytics, CA visibility, workspace management
- `admin` — can manage members, edit/delete sales, send relances
- `vendeur` — limited view; blocked entirely if workspace `is_open === false`

The `can` object from `useRole()` centralizes all permission checks used throughout pages.

### Key Files

| Path | Purpose |
|------|---------|
| `lib/supabaseClient.ts` | Single Supabase client instance (browser-only, uses `NEXT_PUBLIC_*` vars) |
| `lib/workspaceContext.tsx` | `WorkspaceProvider` + `useWorkspace()` hook — workspace list, active selection, CRUD |
| `lib/useRole.ts` | `useRole()` hook — fetches role from `workspace_members` table, exposes `can` permissions |
| `app/components/DashboardShell.tsx` | Main layout shell: sidebar nav, topbar, workspace picker, profile menu. Contains all global CSS as inline `<style>` using `ds-*` class names |
| `app/dashboard/layout.tsx` | Wraps all dashboard pages in `WorkspaceProvider` + `DashboardShell` |

### Dashboard Pages

All pages under `app/dashboard/` are `"use client"` components that:
1. Call `useWorkspace()` to get `activeWorkspace`
2. Call `useRole()` to check permissions
3. Query Supabase directly (no API routes) scoped to `workspace_id`

| Route | Access | Description |
|-------|--------|-------------|
| `/dashboard/import` | owner | CSV import of clients |
| `/dashboard/clients` | all | Client list with sales history, status tags (VIP/regular/inactive/new), inline sale creation |
| `/dashboard/produits` | all | Product catalog with categories and prices |
| `/dashboard/inventaire` | all | Stock management initialized from product catalog |
| `/dashboard/relances` | owner/admin | Client segments (VIP, réguliers, inactifs, nouveaux, sans achat) with email blast per segment |
| `/dashboard/analytiques` | owner only | Revenue analytics |
| `/dashboard/sales` | owner/admin | Sales log |
| `/dashboard/parametres` | owner/admin | Team members, invitations, workspace settings, shop open/close toggle |

### Supabase Database Tables

Key tables (all queries are workspace-scoped):
- `workspaces` — `id`, `user_id` (owner), `name`, `is_open`
- `workspace_members` — `workspace_id`, `user_id`, `role`, `status`
- `workspace_invitations` — `token`, `invited_email`, `role`, `expires_at`, `accepted_at`
- `clients` — `workspace_id`, `prenom`, `nom`, `email`, `birthdate`, `notes`, `status_override`
- `sales` — `workspace_id`, `client_id`, `user_id`, `amount`, `product_id`, `product_name`
- `products` — `workspace_id`, `name`, `category`, `price`
- `inventory` — stock quantities linked to products

RPC function `get_my_accessible_workspaces()` (SECURITY DEFINER) returns all workspaces accessible to the current user (owned + member).

### Styling Conventions

All global styles are defined inline in `DashboardShell.tsx` as a `<style>` block using `ds-*` CSS class names. Pages use a mix of `ds-*` classes and inline `style={{}}` props — no external CSS files beyond `globals.css`. Design tokens are CSS custom properties defined on `:root` (e.g., `--accent: #6378ff`, `--bg: #0a0a0f`).

### Auth Flow

- Login at `/login` using Supabase `signInWithPassword`
- Invite acceptance at `/invite/[token]` — supports login or register for new users
- After login, redirects to `/dashboard/import`
- No middleware — auth state checked per-page via `supabase.auth.getUser()`
