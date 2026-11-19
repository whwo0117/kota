-- Run once in Supabase: SQL Editor -> New query -> paste -> Run
create table if not exists public.responses (
  id         bigint generated always as identity primary key,
  client_id  text not null unique,                 -- per-visit id: blocks double counting
  answers    smallint[] not null,                  -- 6 answers, 1..5
  created_at timestamptz not null default now(),
  constraint answers_len   check (array_length(answers, 1) = 6),
  constraint answers_range check (answers <@ array[1,2,3,4,5]::smallint[])
);

-- Nobody can read/write the table from the browser. Only the server (service_role key) can.
alter table public.responses enable row level security;
revoke all on public.responses from anon, authenticated;

create or replace function public.gaze_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'n', count(*),
    'a', coalesce(sum((answers[1] >= 3)::int + (answers[2] >= 3)::int + (answers[3] >= 3)::int), 0),
    'b', coalesce(sum((answers[4] <= 3)::int + (answers[5] <= 3)::int + (answers[6] <= 3)::int), 0)
  ) from public.responses;
$$;
revoke all on function public.gaze_stats() from public, anon, authenticated;
grant execute on function public.gaze_stats() to service_role;
