-- DGDH agent surface: keys + append-only usage. Generic (column `app`) so every DGDH app can share it.
create table if not exists agent_api_keys (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  org text not null,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,        -- sha256 hex; plaintext key shown once at creation
  scopes text[] not null,
  rate_limit_per_min int not null default 60,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);
create index if not exists agent_api_keys_org on agent_api_keys (app, org);
create table if not exists agent_usage_events (
  id bigserial primary key,
  app text not null,
  key_id uuid not null,
  org text not null,
  tool text not null,
  units int not null,
  ts timestamptz not null default now(),
  status text not null,
  ms int not null,
  channel text not null
);
create index if not exists agent_usage_org_ts on agent_usage_events (app, org, ts);
create or replace function agent_usage_immutable() returns trigger language plpgsql as
$$ begin raise exception 'agent_usage_events is append-only'; end $$;
drop trigger if exists agent_usage_no_mutate on agent_usage_events;
create trigger agent_usage_no_mutate before update or delete on agent_usage_events
  for each row execute function agent_usage_immutable();
-- Service-role only: RLS on, no policies.
alter table agent_api_keys enable row level security;
alter table agent_usage_events enable row level security;
