-- DGDH CUT: tenant/workspace per Suite-organisatie (09-11-2026). Additief, idempotent.
-- organization_id = suite.organizations.id. Service-role only (RLS aan, geen policies).
create table if not exists public.cut_workspaces (
  organization_id uuid primary key references suite.organizations(id) on delete cascade,
  name text not null,
  slug text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.cut_workspaces enable row level security;
