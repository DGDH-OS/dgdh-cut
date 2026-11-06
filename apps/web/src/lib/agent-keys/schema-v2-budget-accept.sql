-- DGDH CUT agent layer v2 (ADDITIVE, NOT APPLIED). Review, then apply once to the shared Supabase:
--   budgets per key, price/eur on usage events, accept-export state. Safe to re-run.
-- Order: apply BEFORE deploying code that writes the new columns (the usage insert includes them).

alter table agent_api_keys
  add column if not exists budget_eur_month numeric,      -- hard cap EUR per UTC calendar month; null = unlimited
  add column if not exists budget_units_day numeric;      -- hard cap billable units per UTC day; null = unlimited

-- pricing.json units are fractional (0.1 granularity), so units int -> numeric (no data loss).
alter table agent_usage_events alter column units type numeric using units::numeric;
alter table agent_usage_events
  add column if not exists event_id uuid not null default gen_random_uuid(),
  add column if not exists eur numeric not null default 0,
  add column if not exists unit text,
  add column if not exists state text not null default 'final',  -- final | pending | accepted | voided
  add column if not exists ref uuid;                             -- resolution events point at the render event_id
create unique index if not exists agent_usage_event_id on agent_usage_events (event_id);
create index if not exists agent_usage_key_ts on agent_usage_events (app, key_id, ts);
do $$ begin
  alter table agent_usage_events add constraint agent_usage_state_chk check (state in ('final','pending','accepted','voided'));
exception when duplicate_object then null; end $$;
-- The table stays append-only (existing trigger): a render is inserted as 'pending'; accept_export INSERTS a
-- resolution row (tool='accept_export', ref=<render event_id>, state='accepted'|'voided', eur=0). Pending rows
-- without resolution are treated as accepted after 24h by the reader (see billing.ts), never by UPDATE.
-- Billing query: sum(eur) over rows where ref is null and state in ('final','accepted') plus pending rows older
-- than 24h with no resolution row (or: use the view below).
create or replace view agent_usage_billable as
select e.* from agent_usage_events e
where e.ref is null and e.status = 'ok'
  and (e.state in ('final','accepted')
       or (e.state = 'pending'
           and not exists (select 1 from agent_usage_events r where r.ref = e.event_id and r.state = 'voided')
           and (e.ts < now() - interval '24 hours'
                or exists (select 1 from agent_usage_events r where r.ref = e.event_id and r.state = 'accepted'))));
