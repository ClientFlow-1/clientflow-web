-- ─────────────────────────────────────────────
-- Migration: create notifications table
-- ─────────────────────────────────────────────

create table if not exists public.notifications (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  type         text        not null check (type in ('stock', 'relance', 'inactif', 'suggestion')),
  title        text        not null,
  message      text        not null,
  read         boolean     not null default false,
  created_at   timestamptz not null default now()
);

-- Index pour les requêtes par workspace (tri chronologique)
create index if not exists notifications_workspace_id_created_at_idx
  on public.notifications (workspace_id, created_at desc);

-- ─── Row Level Security ───────────────────────
alter table public.notifications enable row level security;

-- Les membres d'un workspace voient les notifs de ce workspace
create policy "workspace members can view notifications"
  on public.notifications
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = notifications.workspace_id
        and wm.user_id      = auth.uid()
        and wm.status       = 'active'
    )
  );

-- Seul le owner/admin peut insérer des notifications
create policy "workspace admins can insert notifications"
  on public.notifications
  for insert
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = notifications.workspace_id
        and wm.user_id      = auth.uid()
        and wm.role         in ('owner', 'admin')
        and wm.status       = 'active'
    )
  );

-- Les membres peuvent marquer leurs notifs comme lues
create policy "workspace members can update read status"
  on public.notifications
  for update
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = notifications.workspace_id
        and wm.user_id      = auth.uid()
        and wm.status       = 'active'
    )
  )
  with check (true);

-- Seul owner/admin peut supprimer
create policy "workspace admins can delete notifications"
  on public.notifications
  for delete
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = notifications.workspace_id
        and wm.user_id      = auth.uid()
        and wm.role         in ('owner', 'admin')
        and wm.status       = 'active'
    )
  );
