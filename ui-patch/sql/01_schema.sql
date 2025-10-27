
-- SCHEMA
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text not null,
  municipality text not null,
  federation text,
  street text,
  postcode text,
  city text,
  has_canteen boolean,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists public.member_stats (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  year int not null check (year >= 1900 and year <= extract(year from now()) + 1),
  members int,
  volunteers int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (club_id, year)
);
create table if not exists public.fees (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  year int not null check (year >= 1900 and year <= extract(year from now()) + 1),
  description text,
  amount_cents int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create or replace function public.set_updated_at()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_clubs') then
    create trigger set_updated_at_clubs before update on public.clubs for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_contacts') then
    create trigger set_updated_at_contacts before update on public.contacts for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_member_stats') then
    create trigger set_updated_at_member_stats before update on public.member_stats for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_fees') then
    create trigger set_updated_at_fees before update on public.fees for each row execute function public.set_updated_at();
  end if;
end $$;
