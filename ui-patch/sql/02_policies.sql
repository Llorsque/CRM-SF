
alter table public.clubs enable row level security;
alter table public.contacts enable row level security;
alter table public.member_stats enable row level security;
alter table public.fees enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where polname = 'clubs_all') then
    create policy clubs_all on public.clubs for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where polname = 'contacts_all') then
    create policy contacts_all on public.contacts for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where polname = 'member_stats_all') then
    create policy member_stats_all on public.member_stats for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where polname = 'fees_all') then
    create policy fees_all on public.fees for all using (true) with check (true);
  end if;
end $$;
