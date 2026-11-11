-- Run this in Supabase SQL Editor after creating a project.
create table if not exists public.live_shows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  artist text not null,
  tour text,
  venue text,
  prefecture text,
  ticket_yen integer not null default 0 check (ticket_yen >= 0),
  transport_yen integer not null default 0 check (transport_yen >= 0),
  hotel_yen integer not null default 0 check (hotel_yen >= 0),
  other_yen integer not null default 0 check (other_yen >= 0),
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist text not null,
  unique(user_id, title, artist)
);
create table if not exists public.setlist_items (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.live_shows(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position integer not null default 0,
  unique(show_id, position)
);
alter table public.live_shows enable row level security;
alter table public.songs enable row level security;
alter table public.setlist_items enable row level security;
create policy "Users manage own shows" on public.live_shows for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own songs" on public.songs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own setlists" on public.setlist_items for all using (
  exists(select 1 from public.live_shows s where s.id = show_id and s.user_id = auth.uid())
) with check (
  exists(select 1 from public.live_shows s where s.id = show_id and s.user_id = auth.uid())
);