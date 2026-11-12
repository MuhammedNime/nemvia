-- NEMVIA / Phase 1: accounts, roles, privacy, classroom foundation
-- Run in Supabase SQL Editor on a NEW project. Review before production use.
create extension if not exists pgcrypto;

create type public.app_role as enum ('student','teacher','admin');
create type public.account_visibility as enum ('public','private');
create type public.follow_status as enum ('pending','accepted','rejected');
create type public.post_visibility as enum ('public','followers','private');
create type public.class_member_role as enum ('student','assistant');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default 'NEMVIA User',
  bio text not null default '',
  avatar_url text,
  role public.app_role not null default 'student',
  visibility public.account_visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[A-Za-z0-9_]{3,24}$'),
  constraint display_name_length check (char_length(display_name) between 1 and 80),
  constraint bio_length check (char_length(bio) <= 500)
);

-- A user's role is chosen at signup (student/teacher). Only trusted admins may
-- promote users to admin or change roles later; clients cannot self-promote.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  safe_role public.app_role;
  safe_name text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  safe_role := case when requested_role = 'teacher' then 'teacher'::public.app_role
                    else 'student'::public.app_role end;
  safe_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                        nullif(split_part(coalesce(new.email,''), '@', 1), ''),
                        'NEMVIA User');
  insert into public.profiles(id, display_name, role)
  values (new.id, left(safe_name,80), safe_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an administrator may change account roles';
  end if;
  return new;
end;
$$;
create trigger profiles_role_guard
before update of role on public.profiles
for each row execute procedure public.prevent_self_role_change();

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists(select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'admin');
$$;

create table public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  status public.follow_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique(requester_id,target_id),
  check(requester_id <> target_id)
);
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,followed_id),
  check(follower_id <> followed_id)
);

create or replace function public.is_accepted_follower(target_user uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.follows f
    where f.followed_id = target_user
      and f.follower_id = (select auth.uid())
  );
$$;

-- Private-account follow requests become follows only after approval.
create or replace function public.accept_follow_request(request_id uuid)
returns void language plpgsql security definer
set search_path = ''
as $$
declare r public.follow_requests%rowtype;
begin
  select * into r from public.follow_requests
  where id = request_id and target_id = (select auth.uid()) and status = 'pending'
  for update;
  if not found then raise exception 'Follow request not found'; end if;
  update public.follow_requests set status='accepted' where id=request_id;
  insert into public.follows(follower_id,followed_id) values(r.requester_id,r.target_id)
  on conflict do nothing;
end;
$$;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  subject text not null default '',
  grade_level text not null default '',
  join_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  description text not null default '',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint class_title_length check (char_length(title) between 2 and 120)
);
create table public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role public.class_member_role not null default 'student',
  joined_at timestamptz not null default now(),
  primary key(class_id,user_id)
);

-- Secure class joining: users must provide a valid, active class join code.
create or replace function public.join_class_by_code(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_class_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to join a class';
  end if;

  select c.id into v_class_id
  from public.classes c
  where c.join_code = upper(trim(p_join_code))
    and c.is_archived = false;

  if v_class_id is null then
    raise exception 'Invalid or inactive class join code';
  end if;

  insert into public.class_members(class_id, user_id, member_role)
  values (v_class_id, v_user_id, 'student')
  on conflict (class_id, user_id) do nothing;

  return v_class_id;
end;
$$;
revoke all on function public.join_class_by_code(text) from public;
grant execute on function public.join_class_by_code(text) to authenticated;
-- Automatically add the creator to their newly created learning space.
create or replace function public.add_class_creator_as_member() returns trigger language plpgsql security definer set search_path='' as $$
declare v_role public.class_member_role; begin select case when role='teacher' then 'assistant'::public.class_member_role else 'student'::public.class_member_role end into v_role from public.profiles where id=new.teacher_id; insert into public.class_members(class_id,user_id,member_role) values(new.id,new.teacher_id,coalesce(v_role,'student'::public.class_member_role)) on conflict do nothing; return new; end $$;
drop trigger if exists class_creator_membership on public.classes; create trigger class_creator_membership after insert on public.classes for each row execute function public.add_class_creator_as_member();

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  media_url text,
  media_type text check (media_type is null or media_type in ('image','video','document')),
  visibility public.post_visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_content_present check (char_length(body) > 0 or media_url is not null),
  constraint post_body_length check (char_length(body) <= 10000)
);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);
create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  content text not null default '',
  video_url text,
  attachment_url text,
  position integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  instructions text not null default '',
  due_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answer_text text not null default '',
  attachment_url text,
  submitted_at timestamptz not null default now(),
  grade numeric(5,2),
  teacher_feedback text,
  unique(assignment_id,student_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index posts_author_created_idx on public.posts(author_id,created_at desc);
create index posts_created_idx on public.posts(created_at desc);
create index classes_teacher_idx on public.classes(teacher_id);
create index class_members_user_idx on public.class_members(user_id);
create index lessons_class_position_idx on public.lessons(class_id,position);
create index notifications_user_created_idx on public.notifications(user_id,created_at desc);
create index follow_requests_target_status_idx on public.follow_requests(target_id,status);

-- Helper functions for access checks.
create or replace function public.is_class_teacher(target_class uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.classes c where c.id=target_class and c.teacher_id=(select auth.uid())); $$;

create or replace function public.is_class_member(target_class uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.class_members m where m.class_id=target_class and m.user_id=(select auth.uid()))
          or public.is_class_teacher(target_class); $$;

-- RLS everywhere: no table should rely on UI-only restrictions.
alter table public.profiles enable row level security;
alter table public.follow_requests enable row level security;
alter table public.follows enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.lessons enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.notifications enable row level security;

create policy "profiles visible by privacy" on public.profiles for select
using (id=(select auth.uid()) or role='admin'
  or visibility='public'
  or public.is_accepted_follower(id));
create policy "profile owner updates safe fields" on public.profiles for update
using (id=(select auth.uid()) or public.is_admin())
with check (
  public.is_admin()
  or (id=(select auth.uid()) and role = (select p.role from public.profiles p where p.id=(select auth.uid())))
);
create policy "profile owner inserts own profile" on public.profiles for insert
with check (id=(select auth.uid()) and role in ('student','teacher'));

create policy "requester creates follow request" on public.follow_requests for insert
with check (requester_id=(select auth.uid()) and requester_id<>target_id);
create policy "participants read follow requests" on public.follow_requests for select
using (requester_id=(select auth.uid()) or target_id=(select auth.uid()) or public.is_admin());
create policy "target manages follow requests" on public.follow_requests for update
using (target_id=(select auth.uid()) or public.is_admin())
with check (target_id=(select auth.uid()) or public.is_admin());
create policy "requester cancels pending request" on public.follow_requests for delete
using (requester_id=(select auth.uid()) and status='pending');

create policy "follows visible to participants" on public.follows for select
using (follower_id=(select auth.uid()) or followed_id=(select auth.uid()) or public.is_admin());
create policy "user follows public account" on public.follows for insert
with check (follower_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=followed_id and p.visibility='public'));
create policy "user unfollows" on public.follows for delete
using (follower_id=(select auth.uid()) or public.is_admin());

create policy "classes visible to members" on public.classes for select
using (teacher_id=(select auth.uid()) or public.is_class_member(id) or public.is_admin());
create policy "teachers create own classes" on public.classes for insert
with check (teacher_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('teacher','admin')));
create policy "teachers update own classes" on public.classes for update
using (teacher_id=(select auth.uid()) or public.is_admin())
with check (teacher_id=(select auth.uid()) or public.is_admin());
create policy "teachers delete own classes" on public.classes for delete
using (teacher_id=(select auth.uid()) or public.is_admin());

create policy "class members visible to class" on public.class_members for select
using (user_id=(select auth.uid()) or public.is_class_teacher(class_id) or public.is_admin());
-- Direct client inserts are intentionally not allowed; use join_class_by_code().
create policy "teachers remove class members" on public.class_members for delete
using (public.is_class_teacher(class_id) or user_id=(select auth.uid()) or public.is_admin());

create policy "posts follow visibility rules" on public.posts for select
using (
 author_id=(select auth.uid()) or public.is_admin()
 or (visibility='public' and exists(select 1 from public.profiles p where p.id=author_id and p.visibility='public'))
 or (visibility='followers' and public.is_accepted_follower(author_id))
 or (visibility='private' and public.is_accepted_follower(author_id))
);
create policy "users publish as themselves" on public.posts for insert
with check (author_id=(select auth.uid()));
create policy "authors update own posts" on public.posts for update
using (author_id=(select auth.uid()) or public.is_admin())
with check (author_id=(select auth.uid()) or public.is_admin());
create policy "authors delete own posts" on public.posts for delete
using (author_id=(select auth.uid()) or public.is_admin());

create policy "comments readable when post readable" on public.comments for select
using (exists(select 1 from public.posts p where p.id=post_id));
create policy "signed-in users comment" on public.comments for insert
with check (author_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id));
create policy "comment authors delete own" on public.comments for delete
using (author_id=(select auth.uid()) or public.is_admin());

create policy "likes visible when post visible" on public.post_likes for select
using (exists(select 1 from public.posts p where p.id=post_id));
create policy "users like posts" on public.post_likes for insert
with check (user_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id));
create policy "users remove own likes" on public.post_likes for delete
using (user_id=(select auth.uid()) or public.is_admin());

create policy "class members read published lessons" on public.lessons for select
using (public.is_class_member(class_id) and (published_at is not null or public.is_class_teacher(class_id)) or public.is_admin());
create policy "teachers create lessons in own classes" on public.lessons for insert
with check (teacher_id=(select auth.uid()) and public.is_class_teacher(class_id));
create policy "teachers manage lessons" on public.lessons for update
using (teacher_id=(select auth.uid()) or public.is_admin())
with check (teacher_id=(select auth.uid()) or public.is_admin());
create policy "teachers delete lessons" on public.lessons for delete
using (teacher_id=(select auth.uid()) or public.is_admin());

create policy "class members read assignments" on public.assignments for select
using (public.is_class_member(class_id) or public.is_admin());
create policy "teachers create assignments" on public.assignments for insert
with check (teacher_id=(select auth.uid()) and public.is_class_teacher(class_id));
create policy "teachers manage assignments" on public.assignments for update
using (teacher_id=(select auth.uid()) or public.is_admin())
with check (teacher_id=(select auth.uid()) or public.is_admin());
create policy "teachers delete assignments" on public.assignments for delete
using (teacher_id=(select auth.uid()) or public.is_admin());

create policy "students see own submissions and teachers see class submissions" on public.submissions for select
using (student_id=(select auth.uid()) or exists(select 1 from public.assignments a where a.id=assignment_id and public.is_class_teacher(a.class_id)) or public.is_admin());
create policy "students submit as themselves" on public.submissions for insert
with check (student_id=(select auth.uid()) and exists(select 1 from public.assignments a join public.class_members m on m.class_id=a.class_id where a.id=assignment_id and m.user_id=(select auth.uid()) and m.member_role='student'));
create policy "students update own submission before grading" on public.submissions for update
using (student_id=(select auth.uid()) and grade is null)
with check (student_id=(select auth.uid()) and grade is null);
create policy "teachers grade submissions" on public.submissions for update
using (exists(select 1 from public.assignments a where a.id=assignment_id and public.is_class_teacher(a.class_id)) or public.is_admin())
with check (exists(select 1 from public.assignments a where a.id=assignment_id and public.is_class_teacher(a.class_id)) or public.is_admin());

create policy "users read own notifications" on public.notifications for select
using (user_id=(select auth.uid()) or public.is_admin());
create policy "users mark own notifications" on public.notifications for update
using (user_id=(select auth.uid()) or public.is_admin())
with check (user_id=(select auth.uid()) or public.is_admin());

-- IMPORTANT: joining by join_code must be implemented through a server-side
-- Edge Function/RPC that validates the code and inserts class_members.
-- Never expose the Supabase service-role key in browser code.


-- NEMVIA COMPLETE PLATFORM EXTENSION (run after Phase 1 core schema)
-- Students and teachers can both create learning spaces and join them.
alter table public.classes add column if not exists class_type text not null default 'class' check (class_type in ('class','study'));
drop policy if exists "teachers create own classes" on public.classes;
create policy "authenticated users create learning spaces" on public.classes for insert to authenticated with check (teacher_id=(select auth.uid()));
drop policy if exists "classes visible to members" on public.classes;
create policy "active spaces discoverable" on public.classes for select to authenticated using (is_archived=false or teacher_id=(select auth.uid()) or public.is_class_member(id) or public.is_admin());
create or replace function public.join_class_by_code(p_join_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid := (select auth.uid()); v_cid uuid;
begin if v_uid is null then raise exception 'Sign in required'; end if;
select id into v_cid from public.classes where join_code=upper(trim(p_join_code)) and is_archived=false;
if v_cid is null then raise exception 'رمز الانضمام غير صحيح'; end if;
insert into public.class_members(class_id,user_id,member_role) values(v_cid,v_uid,case when exists(select 1 from public.profiles where id=v_uid and role='teacher') then 'assistant'::public.class_member_role else 'student'::public.class_member_role end) on conflict do nothing;
return v_cid; end $$;
grant execute on function public.join_class_by_code(text) to authenticated;
-- Automatically add the creator to their newly created learning space.
create or replace function public.add_class_creator_as_member() returns trigger language plpgsql security definer set search_path='' as $$
declare v_role public.class_member_role; begin select case when role='teacher' then 'assistant'::public.class_member_role else 'student'::public.class_member_role end into v_role from public.profiles where id=new.teacher_id; insert into public.class_members(class_id,user_id,member_role) values(new.id,new.teacher_id,coalesce(v_role,'student'::public.class_member_role)) on conflict do nothing; return new; end $$;
drop trigger if exists class_creator_membership on public.classes; create trigger class_creator_membership after insert on public.classes for each row execute function public.add_class_creator_as_member();

create table if not exists public.stories(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,body text not null check(char_length(body) between 1 and 500),created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '24 hours'));
create index if not exists stories_expiry_idx on public.stories(expires_at desc);
alter table public.stories enable row level security;
drop policy if exists "stories read permitted" on public.stories;
create policy "stories read permitted" on public.stories for select to authenticated using(expires_at>now() and (user_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=user_id and p.visibility='public') or public.is_accepted_follower(user_id)));
drop policy if exists "stories insert own" on public.stories;
create policy "stories insert own" on public.stories for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists "stories delete own" on public.stories;
create policy "stories delete own" on public.stories for delete to authenticated using(user_id=(select auth.uid()) or public.is_admin());

create table if not exists public.courses(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,title text not null,description text not null default '',cover_url text,visibility text not null default 'public' check(visibility in ('public','private')),created_at timestamptz not null default now());
alter table public.courses enable row level security;
create policy "courses public or owner read" on public.courses for select to authenticated using(visibility='public' or owner_id=(select auth.uid()) or public.is_admin());
create policy "users create own courses" on public.courses for insert to authenticated with check(owner_id=(select auth.uid()));
create policy "owners update courses" on public.courses for update to authenticated using(owner_id=(select auth.uid()) or public.is_admin()) with check(owner_id=(select auth.uid()) or public.is_admin());
create policy "owners delete courses" on public.courses for delete to authenticated using(owner_id=(select auth.uid()) or public.is_admin());

create table if not exists public.live_sessions(id uuid primary key default gen_random_uuid(),host_id uuid not null references public.profiles(id) on delete cascade,class_id uuid references public.classes(id) on delete set null,title text not null,description text not null default '',meeting_url text,provider_room text,starts_at timestamptz not null,status text not null default 'scheduled' check(status in ('scheduled','live','ended','cancelled')),created_at timestamptz not null default now());
alter table public.live_sessions enable row level security;
create policy "live sessions visible to signed users" on public.live_sessions for select to authenticated using(host_id=(select auth.uid()) or class_id is null or public.is_class_member(class_id) or public.is_admin());
create policy "users schedule own live sessions" on public.live_sessions for insert to authenticated with check(host_id=(select auth.uid()));
create policy "hosts manage live sessions" on public.live_sessions for update to authenticated using(host_id=(select auth.uid()) or public.is_admin()) with check(host_id=(select auth.uid()) or public.is_admin());
create policy "hosts delete live sessions" on public.live_sessions for delete to authenticated using(host_id=(select auth.uid()) or public.is_admin());

create table if not exists public.direct_messages(id uuid primary key default gen_random_uuid(),sender_id uuid not null references public.profiles(id) on delete cascade,recipient_id uuid not null references public.profiles(id) on delete cascade,body text not null check(char_length(body) between 1 and 5000),attachment_url text,read_at timestamptz,created_at timestamptz not null default now(),check(sender_id<>recipient_id));
create index if not exists direct_messages_pair_idx on public.direct_messages(sender_id,recipient_id,created_at desc);
alter table public.direct_messages enable row level security;
create policy "message participants read" on public.direct_messages for select to authenticated using(sender_id=(select auth.uid()) or recipient_id=(select auth.uid()));
create policy "sender creates message" on public.direct_messages for insert to authenticated with check(sender_id=(select auth.uid()));
create policy "recipient marks message read" on public.direct_messages for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
create policy "sender deletes own message" on public.direct_messages for delete to authenticated using(sender_id=(select auth.uid()));

create table if not exists public.content_reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles(id) on delete cascade,target_type text not null check(target_type in ('post','profile','comment','message')),target_id uuid not null,reason text not null,details text not null default '',status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),created_at timestamptz not null default now());
alter table public.content_reports enable row level security;
create policy "reporter and admin read reports" on public.content_reports for select to authenticated using(reporter_id=(select auth.uid()) or public.is_admin());
create policy "users submit reports" on public.content_reports for insert to authenticated with check(reporter_id=(select auth.uid()));
create policy "admins manage reports" on public.content_reports for update to authenticated using(public.is_admin()) with check(public.is_admin());

create table if not exists public.course_enrollments(course_id uuid not null references public.courses(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,joined_at timestamptz not null default now(),primary key(course_id,user_id));
alter table public.course_enrollments enable row level security;
create policy "enrollment visible to participant or owner" on public.course_enrollments for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.courses c where c.id=course_id and c.owner_id=(select auth.uid())) or public.is_admin());
create policy "users enroll themselves" on public.course_enrollments for insert to authenticated with check(user_id=(select auth.uid()));
create policy "users unenroll themselves" on public.course_enrollments for delete to authenticated using(user_id=(select auth.uid()) or public.is_admin());

create table if not exists public.quizzes(id uuid primary key default gen_random_uuid(),class_id uuid not null references public.classes(id) on delete cascade,teacher_id uuid not null references public.profiles(id) on delete cascade,title text not null,description text not null default '',opens_at timestamptz,closes_at timestamptz,created_at timestamptz not null default now());
create table if not exists public.quiz_questions(id uuid primary key default gen_random_uuid(),quiz_id uuid not null references public.quizzes(id) on delete cascade,question text not null,options jsonb not null default '[]'::jsonb,correct_option integer,points numeric(6,2) not null default 1,position integer not null default 0);
create table if not exists public.quiz_attempts(id uuid primary key default gen_random_uuid(),quiz_id uuid not null references public.quizzes(id) on delete cascade,student_id uuid not null references public.profiles(id) on delete cascade,answers jsonb not null default '{}'::jsonb,score numeric(7,2),submitted_at timestamptz not null default now(),unique(quiz_id,student_id));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['quizzes','quiz_questions','quiz_attempts'] LOOP EXECUTE format('alter table public.%I enable row level security',t); END LOOP; END $$;
create policy "class members read quizzes" on public.quizzes for select to authenticated using(public.is_class_member(class_id) or public.is_admin());
create policy "class teachers create quizzes" on public.quizzes for insert to authenticated with check(teacher_id=(select auth.uid()) and public.is_class_teacher(class_id));
create policy "quiz owners manage" on public.quizzes for update to authenticated using(teacher_id=(select auth.uid()) or public.is_admin()) with check(teacher_id=(select auth.uid()) or public.is_admin());
create policy "quiz owners delete" on public.quizzes for delete to authenticated using(teacher_id=(select auth.uid()) or public.is_admin());
create policy "quiz questions visible to class" on public.quiz_questions for select to authenticated using(exists(select 1 from public.quizzes q where q.id=quiz_id and public.is_class_member(q.class_id)));
create policy "quiz teachers manage questions" on public.quiz_questions for all to authenticated using(exists(select 1 from public.quizzes q where q.id=quiz_id and (q.teacher_id=(select auth.uid()) or public.is_admin()))) with check(exists(select 1 from public.quizzes q where q.id=quiz_id and (q.teacher_id=(select auth.uid()) or public.is_admin())));
create policy "students read own attempts and teachers class attempts" on public.quiz_attempts for select to authenticated using(student_id=(select auth.uid()) or exists(select 1 from public.quizzes q where q.id=quiz_id and public.is_class_teacher(q.class_id)) or public.is_admin());
create policy "students submit own attempts" on public.quiz_attempts for insert to authenticated with check(student_id=(select auth.uid()) and exists(select 1 from public.quizzes q where q.id=quiz_id and public.is_class_member(q.class_id)));
create policy "students update own attempts" on public.quiz_attempts for update to authenticated using(student_id=(select auth.uid()) and score is null) with check(student_id=(select auth.uid()));

-- Realtime is optional; enable it for messaging if the project publication exists.
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
