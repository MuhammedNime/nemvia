-- =====================================================================
-- NEMVIA — PATCH 02 (آمن للتشغيل أكثر من مرة / idempotent)
-- شغّله في Supabase → SQL Editor بعد 01_COMPLETE_SETUP.sql
-- (إذا كنت شغّلت 01 سابقاً فشغّل هذا الملف فقط)
-- =====================================================================

-- ---------- 1) أعمدة إضافية يحتاجها التطبيق ----------
alter table public.profiles   add column if not exists points integer not null default 0;
alter table public.profiles   add column if not exists streak_days integer not null default 0;
alter table public.profiles   add column if not exists last_active date;
alter table public.classes    add column if not exists color_theme text not null default 'blue';
alter table public.lessons    add column if not exists duration text;
alter table public.lessons    add column if not exists attachment_name text;
alter table public.assignments add column if not exists total_points integer not null default 20;
alter table public.posts      add column if not exists category text not null default 'all';
alter table public.stories    add column if not exists bg_gradient text not null default 'from-sky-500 to-indigo-600';
alter table public.quizzes    add column if not exists time_limit_minutes integer not null default 10;
alter table public.quizzes    add column if not exists is_published boolean not null default true;
alter table public.quiz_questions add column if not exists explanation text not null default '';
alter table public.live_sessions  add column if not exists provider text not null default 'jitsi';

-- ---------- 2) حماية الأدوار والنقاط + تعيين المالك كأدمن ----------
create or replace function public.prevent_self_role_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role
     and not public.is_admin()
     and coalesce(current_setting('nemvia.allow_role_change', true), '') <> '1' then
    raise exception 'Only an administrator may change account roles';
  end if;
  return new;
end; $$;

create or replace function public.protect_profile_counters()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.points is distinct from old.points or new.streak_days is distinct from old.streak_days
      or new.last_active is distinct from old.last_active)
     and coalesce(current_setting('nemvia.allow_counter_change', true), '') <> '1' then
    new.points := old.points; new.streak_days := old.streak_days; new.last_active := old.last_active;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_counter_guard on public.profiles;
create trigger profiles_counter_guard before update on public.profiles
for each row execute procedure public.protect_profile_counters();

-- المالك: يصبح admin تلقائياً عند تأكيد بريده (وليس قبل التأكيد)
create or replace function public.promote_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if lower(new.email) = 'jamalnama19@gmail.com' and new.email_confirmed_at is not null then
    perform set_config('nemvia.allow_role_change', '1', true);
    update public.profiles set role = 'admin' where id = new.id and role <> 'admin';
  end if;
  return new;
end; $$;
drop trigger if exists on_owner_confirmed on auth.users;
create trigger on_owner_confirmed after insert or update of email_confirmed_at on auth.users
for each row execute procedure public.promote_owner();

-- إذا كان حساب المالك موجوداً ومؤكداً فعلاً: رقّه الآن
do $$ begin
  perform set_config('nemvia.allow_role_change', '1', true);
  update public.profiles set role = 'admin'
  where id in (select id from auth.users where lower(email)='jamalnama19@gmail.com' and email_confirmed_at is not null);
end $$;

-- ---------- 3) الملفات الشخصية: الاسم والصورة مرئيان لكل المسجّلين (المراسلة مفتوحة) ----------
drop policy if exists "profiles visible by privacy" on public.profiles;
drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles
for select to authenticated using (true);
-- الخصوصية (public/private) تتحكم بالمنشورات والقصص فقط.

-- ---------- 4) الصفوف: لا تُكشف رموز الانضمام للجميع ----------
drop policy if exists "active spaces discoverable" on public.classes;
drop policy if exists "classes visible to members" on public.classes;
create policy "classes visible to members" on public.classes for select to authenticated
using (teacher_id=(select auth.uid()) or public.is_class_member(id) or public.is_admin());

-- عدد الأعضاء (لأن الطالب لا يرى صفوف الأعضاء الآخرين)
create or replace function public.my_class_counts()
returns table(class_id uuid, members_count bigint)
language sql stable security definer set search_path = '' as $$
  select m.class_id, count(*)::bigint
  from public.class_members m
  where m.class_id in (select c.id from public.classes c
                       where c.teacher_id=(select auth.uid()) or public.is_class_member(c.id))
  group by m.class_id;
$$;
grant execute on function public.my_class_counts() to authenticated;

-- ---------- 5) الاختبارات: الإجابات الصحيحة سرّية + تصحيح من السيرفر ----------
create table if not exists public.quiz_answer_keys(
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_option integer not null
);
alter table public.quiz_answer_keys enable row level security;
drop policy if exists "teachers manage answer keys" on public.quiz_answer_keys;
create policy "teachers manage answer keys" on public.quiz_answer_keys for all to authenticated
using (exists(select 1 from public.quiz_questions qq join public.quizzes q on q.id=qq.quiz_id
              where qq.id=question_id and (q.teacher_id=(select auth.uid()) or public.is_admin())))
with check (exists(select 1 from public.quiz_questions qq join public.quizzes q on q.id=qq.quiz_id
              where qq.id=question_id and (q.teacher_id=(select auth.uid()) or public.is_admin())));

-- انقل أي مفاتيح قديمة ثم احذف العمود المكشوف
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='quiz_questions' and column_name='correct_option') then
    insert into public.quiz_answer_keys(question_id, correct_option)
      select id, correct_option from public.quiz_questions where correct_option is not null
      on conflict do nothing;
    alter table public.quiz_questions drop column correct_option;
  end if;
end $$;

-- الطالب لا يكتب نتيجته بنفسه: فقط عبر الدالة
drop policy if exists "students submit own attempts" on public.quiz_attempts;
drop policy if exists "students update own attempts" on public.quiz_attempts;

create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_class uuid; v_score numeric := 0; v_total numeric := 0; v_key jsonb := '{}'::jsonb; r record;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  select class_id into v_class from public.quizzes where id=p_quiz_id and is_published;
  if v_class is null or not public.is_class_member(v_class) then raise exception 'Quiz not available'; end if;
  if exists(select 1 from public.quiz_attempts where quiz_id=p_quiz_id and student_id=v_uid) then
    raise exception 'لقد أجريت هذا الاختبار من قبل';
  end if;
  for r in select qq.id, qq.points, qq.explanation, k.correct_option
           from public.quiz_questions qq left join public.quiz_answer_keys k on k.question_id=qq.id
           where qq.quiz_id=p_quiz_id loop
    v_total := v_total + r.points;
    if (p_answers ->> r.id::text) is not null and (p_answers ->> r.id::text)::int = r.correct_option then
      v_score := v_score + r.points;
    end if;
    v_key := v_key || jsonb_build_object(r.id::text, jsonb_build_object('correct', r.correct_option, 'explanation', r.explanation));
  end loop;
  insert into public.quiz_attempts(quiz_id, student_id, answers, score) values (p_quiz_id, v_uid, p_answers, v_score);
  return jsonb_build_object('score', v_score, 'total', v_total, 'key', v_key);
end; $$;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;

-- ---------- 6) رسائل المجموعات/الصفوف ----------
create table if not exists public.class_messages(
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  attachment_url text,
  attachment_name text,
  created_at timestamptz not null default now()
);
create index if not exists class_messages_idx on public.class_messages(class_id, created_at);
alter table public.class_messages enable row level security;
drop policy if exists "members read class messages" on public.class_messages;
create policy "members read class messages" on public.class_messages for select to authenticated
using (public.is_class_member(class_id) or public.is_admin());
drop policy if exists "members post class messages" on public.class_messages;
create policy "members post class messages" on public.class_messages for insert to authenticated
with check (sender_id=(select auth.uid()) and public.is_class_member(class_id));
drop policy if exists "senders delete class messages" on public.class_messages;
create policy "senders delete class messages" on public.class_messages for delete to authenticated
using (sender_id=(select auth.uid()) or public.is_admin());

alter table public.direct_messages add column if not exists attachment_name text;

do $$ begin alter publication supabase_realtime add table public.class_messages;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- ---------- 7) البلاغات: الإدارة ترى الكل، والمبلّغ يرى بلاغاته ----------
-- (السياسات موجودة في 01) — نضيف عمود لقطة المحتوى لأن الأدمن لا يقرأ الرسائل الخاصة
alter table public.content_reports add column if not exists snapshot text not null default '';

-- ---------- 8) الإشعارات التلقائية ----------
create or replace function public.notify_on_grade()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.grade is not null and (old.grade is null or new.grade is distinct from old.grade) then
    insert into public.notifications(user_id, kind, payload)
    values (new.student_id, 'grade', jsonb_build_object('title','تم رصد درجتك!','body','تم تصحيح واجبك وحصلت على '||new.grade::text||' درجة.'));
  end if;
  return new;
end; $$;
drop trigger if exists submissions_notify_grade on public.submissions;
create trigger submissions_notify_grade after update on public.submissions
for each row execute procedure public.notify_on_grade();

create or replace function public.notify_on_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications(user_id, actor_id, kind, payload)
  select m.user_id, new.teacher_id, 'academic',
         jsonb_build_object('title','واجب جديد','body','تم نشر الواجب: '||new.title)
  from public.class_members m where m.class_id=new.class_id and m.user_id<>new.teacher_id;
  return new;
end; $$;
drop trigger if exists assignments_notify on public.assignments;
create trigger assignments_notify after insert on public.assignments
for each row execute procedure public.notify_on_assignment();

create or replace function public.notify_on_live()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.class_id is not null then
    insert into public.notifications(user_id, actor_id, kind, payload)
    select m.user_id, new.host_id, 'live',
           jsonb_build_object('title','حصة مباشرة جديدة','body','تمت جدولة: '||new.title)
    from public.class_members m where m.class_id=new.class_id and m.user_id<>new.host_id;
  end if;
  return new;
end; $$;
drop trigger if exists live_notify on public.live_sessions;
create trigger live_notify after insert on public.live_sessions
for each row execute procedure public.notify_on_live();

-- ---------- 9) النقاط والسلسلة اليومية ----------
create or replace function public.award_points(p_xp integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_new integer;
begin
  if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
  perform set_config('nemvia.allow_counter_change','1',true);
  update public.profiles set points = points + greatest(0, least(p_xp, 100))
  where id=(select auth.uid()) returning points into v_new;
  return v_new;
end; $$;
grant execute on function public.award_points(integer) to authenticated;

create or replace function public.touch_streak()
returns void language plpgsql security definer set search_path = '' as $$
declare v_last date;
begin
  if (select auth.uid()) is null then return; end if;
  select last_active into v_last from public.profiles where id=(select auth.uid());
  if v_last = current_date then return; end if;
  perform set_config('nemvia.allow_counter_change','1',true);
  update public.profiles
     set streak_days = case when v_last = current_date - 1 then streak_days + 1 else 1 end,
         last_active = current_date
   where id=(select auth.uid());
end; $$;
grant execute on function public.touch_streak() to authenticated;

-- ---------- 10) تخزين الملفات (صور، مرفقات، تسليمات) ----------
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('nemvia-files','nemvia-files', true, 10485760,
  array['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip','application/x-zip-compressed','video/mp4','video/webm','video/quicktime',
        'text/csv','text/markdown','application/json','text/x-python','text/javascript','audio/mpeg','audio/mp4'])
on conflict (id) do update set file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "users upload to own folder" on storage.objects;
create policy "users upload to own folder" on storage.objects for insert to authenticated
with check (bucket_id='nemvia-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "users delete own files" on storage.objects;
create policy "users delete own files" on storage.objects for delete to authenticated
using (bucket_id='nemvia-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- الحاوية عامة: الروابط المباشرة تعمل دون سياسة قراءة (وبذلك لا يمكن استعراض قائمة الملفات)
drop policy if exists "files readable by link" on storage.objects;

-- ---------- 11) ملخص للإدارة ----------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'users',(select count(*) from public.profiles),
    'teachers',(select count(*) from public.profiles where role='teacher'),
    'students',(select count(*) from public.profiles where role='student'),
    'classes',(select count(*) from public.classes),
    'posts',(select count(*) from public.posts),
    'open_reports',(select count(*) from public.content_reports where status='open'));
end; $$;
grant execute on function public.admin_stats() to authenticated;

-- ---------- 12) الاختبارات غير المنشورة لا يراها إلا المعلم ----------
drop policy if exists "class members read quizzes" on public.quizzes;
create policy "class members read quizzes" on public.quizzes for select to authenticated
using ((public.is_class_member(class_id) and (is_published or public.is_class_teacher(class_id))) or public.is_admin());
