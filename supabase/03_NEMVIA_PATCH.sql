-- =====================================================================
-- NEMVIA — PATCH 03 (آمن للتكرار). شغّله بعد 01 و 02.
-- إدارة المستخدمين (إيقاف حساب)، حماية الرسائل، فهارس أداء.
-- =====================================================================

-- ---------- 1) إيقاف الحسابات ----------
alter table public.profiles add column if not exists is_suspended boolean not null default false;
alter table public.profiles add column if not exists xp_today integer not null default 0;
alter table public.profiles add column if not exists xp_day date;

create or replace function public.is_suspended()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_suspended from public.profiles p where p.id = (select auth.uid())), false);
$$;

-- حماية العدّادات + حالة الإيقاف من التعديل الذاتي
create or replace function public.protect_profile_counters()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.points is distinct from old.points or new.streak_days is distinct from old.streak_days
      or new.last_active is distinct from old.last_active or new.xp_today is distinct from old.xp_today
      or new.xp_day is distinct from old.xp_day)
     and coalesce(current_setting('nemvia.allow_counter_change', true), '') <> '1' then
    new.points := old.points; new.streak_days := old.streak_days; new.last_active := old.last_active;
    new.xp_today := old.xp_today; new.xp_day := old.xp_day;
  end if;
  if new.is_suspended is distinct from old.is_suspended and not public.is_admin() then
    new.is_suspended := old.is_suspended;
  end if;
  return new;
end; $$;

-- المحظور لا يستطيع النشر أو المراسلة
drop policy if exists "users publish as themselves" on public.posts;
create policy "users publish as themselves" on public.posts for insert
with check (author_id=(select auth.uid()) and not public.is_suspended());

drop policy if exists "signed-in users comment" on public.comments;
create policy "signed-in users comment" on public.comments for insert
with check (author_id=(select auth.uid()) and not public.is_suspended()
            and exists(select 1 from public.posts p where p.id=post_id));

drop policy if exists "sender creates message" on public.direct_messages;
create policy "sender creates message" on public.direct_messages for insert to authenticated
with check (sender_id=(select auth.uid()) and not public.is_suspended());

drop policy if exists "members post class messages" on public.class_messages;
create policy "members post class messages" on public.class_messages for insert to authenticated
with check (sender_id=(select auth.uid()) and not public.is_suspended() and public.is_class_member(class_id));

drop policy if exists "stories insert own" on public.stories;
create policy "stories insert own" on public.stories for insert to authenticated
with check (user_id=(select auth.uid()) and not public.is_suspended());

-- ---------- 2) المستلم يغيّر «مقروءة» فقط، لا نص الرسالة ----------
create or replace function public.dm_only_read_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.sender_id is distinct from old.sender_id or new.recipient_id is distinct from old.recipient_id
     or new.body is distinct from old.body or new.attachment_url is distinct from old.attachment_url
     or new.created_at is distinct from old.created_at then
    raise exception 'Only the read flag may be updated';
  end if;
  return new;
end; $$;
drop trigger if exists dm_read_guard on public.direct_messages;
create trigger dm_read_guard before update on public.direct_messages
for each row execute procedure public.dm_only_read_update();

-- ---------- 3) فهارس أداء ----------
create index if not exists dm_recipient_unread_idx on public.direct_messages(recipient_id, read_at);
create index if not exists comments_post_idx on public.comments(post_id, created_at);
create index if not exists post_likes_post_idx on public.post_likes(post_id);
create index if not exists submissions_assignment_idx on public.submissions(assignment_id);
create index if not exists assignments_class_idx on public.assignments(class_id);
create index if not exists quizzes_class_idx on public.quizzes(class_id);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions(quiz_id, position);
create index if not exists quiz_attempts_quiz_idx on public.quiz_attempts(quiz_id);
create index if not exists live_sessions_start_idx on public.live_sessions(starts_at);
create index if not exists content_reports_status_idx on public.content_reports(status, created_at desc);

-- ---------- 4) تنظيف القصص المنتهية (اختياري يدوياً) ----------
create or replace function public.purge_expired_stories()
returns void language sql security definer set search_path = '' as $$
  delete from public.stories where expires_at < now() - interval '1 day';
$$;
revoke all on function public.purge_expired_stories() from public, anon, authenticated;

-- ---------- 5) ثيم الصف يُخزَّن كتدرّج Tailwind ----------
alter table public.classes alter column color_theme set default 'from-blue-600 to-indigo-700';
update public.classes set color_theme = 'from-blue-600 to-indigo-700' where color_theme in ('blue','') or color_theme is null;

-- ---------- 6) سقف يومي للنقاط (منع التلاعب بالضغط المتكرر) ----------
create or replace function public.award_points(p_xp integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_day date; v_today integer; v_grant integer; v_new integer;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  perform set_config('nemvia.allow_counter_change','1',true);
  select xp_day, xp_today into v_day, v_today from public.profiles where id = v_uid;
  if v_day is distinct from current_date then v_today := 0; end if;
  v_grant := greatest(0, least(p_xp, 100, 300 - v_today));
  update public.profiles
     set points = points + v_grant, xp_today = v_today + v_grant, xp_day = current_date
   where id = v_uid returning points into v_new;
  return v_new;
end; $$;
grant execute on function public.award_points(integer) to authenticated;
