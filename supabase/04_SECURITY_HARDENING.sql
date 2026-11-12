-- =====================================================================
-- NEMVIA — PATCH 04: security hardening
-- Run after 01_COMPLETE_SETUP.sql, 02_NEMVIA_PATCH.sql, and 03_NEMVIA_PATCH.sql.
-- Safe to rerun. This migration tightens writes without changing existing data.
-- =====================================================================

-- Fix a self-referencing RLS check. Role changes are already enforced by the
-- SECURITY DEFINER trigger, so the policy only needs to establish row ownership.
drop policy if exists "profile owner updates safe fields" on public.profiles;
create policy "profile owner updates safe fields" on public.profiles for update to authenticated
using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

-- Students may edit an ungraded answer, teachers may grade their own class,
-- and admins may assist. Nobody may move a submission to another student or
-- assignment, or rewrite its submission timestamp.
create or replace function public.guard_submission_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_is_teacher boolean := false;
  v_total numeric;
begin
  if new.id is distinct from old.id
     or new.assignment_id is distinct from old.assignment_id
     or new.student_id is distinct from old.student_id
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'Submission identity and submission time cannot be changed';
  end if;

  if public.is_suspended() then
    raise exception 'Suspended accounts cannot update submissions';
  end if;

  if not public.is_admin() then
    select exists (
      select 1 from public.assignments a
      where a.id = old.assignment_id and public.is_class_teacher(a.class_id)
    ) into v_is_teacher;

    if v_is_teacher then
      if new.answer_text is distinct from old.answer_text
         or new.attachment_url is distinct from old.attachment_url then
        raise exception 'Teachers may only change the grade and feedback';
      end if;
    elsif old.student_id = v_uid then
      if old.grade is not null then
        raise exception 'A graded submission cannot be changed by its student';
      end if;
      if new.grade is distinct from old.grade
         or new.teacher_feedback is distinct from old.teacher_feedback then
        raise exception 'Students cannot change grades or teacher feedback';
      end if;
    else
      raise exception 'Not allowed to update this submission';
    end if;
  end if;

  if new.grade is not null then
    select a.total_points into v_total
    from public.assignments a where a.id = old.assignment_id;
    if new.grade < 0 or new.grade > coalesce(v_total, 20) then
      raise exception 'Grade must be between 0 and the assignment total';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.guard_submission_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
  if public.is_suspended() then raise exception 'Suspended accounts cannot submit assignments'; end if;
  if new.student_id is distinct from (select auth.uid()) then
    raise exception 'A submission must belong to the signed-in student';
  end if;
  if new.grade is not null or new.teacher_feedback is not null then
    raise exception 'Students cannot set grades or teacher feedback';
  end if;

  -- Use server time so a client cannot backdate or future-date a submission.
  new.submitted_at := statement_timestamp();
  return new;
end;
$$;

drop trigger if exists submissions_update_guard on public.submissions;
create trigger submissions_update_guard
before update on public.submissions
for each row execute function public.guard_submission_update();
drop trigger if exists submissions_insert_guard on public.submissions;
create trigger submissions_insert_guard
before insert on public.submissions
for each row execute function public.guard_submission_insert();

drop policy if exists "students update own submission before grading" on public.submissions;
drop policy if exists "teachers grade submissions" on public.submissions;
create policy "authorized users update submissions" on public.submissions for update to authenticated
using (
  (student_id = (select auth.uid()) and grade is null and not public.is_suspended())
  or (
    not public.is_suspended()
    and (public.is_admin() or exists (
      select 1 from public.assignments a
      where a.id = assignment_id and public.is_class_teacher(a.class_id)
    ))
  )
)
with check (
  (student_id = (select auth.uid()) and grade is null and not public.is_suspended())
  or (
    not public.is_suspended()
    and (public.is_admin() or exists (
      select 1 from public.assignments a
      where a.id = assignment_id and public.is_class_teacher(a.class_id)
    ))
  )
);

drop policy if exists "students submit as themselves" on public.submissions;
create policy "students submit as themselves" on public.submissions for insert to authenticated
with check (
  student_id = (select auth.uid())
  and not public.is_suspended()
  and grade is null
  and teacher_feedback is null
  and exists (
    select 1 from public.assignments a
    join public.class_members m on m.class_id = a.class_id
    where a.id = assignment_id
      and m.user_id = (select auth.uid())
      and m.member_role = 'student'
  )
);

-- Keep class joining unavailable to suspended accounts, including direct RPC calls.
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
  if v_user_id is null then raise exception 'You must be signed in to join a class'; end if;
  if public.is_suspended() then raise exception 'Suspended accounts cannot join classes'; end if;

  select c.id into v_class_id
  from public.classes c
  where c.join_code = upper(trim(p_join_code)) and c.is_archived = false;

  if v_class_id is null then raise exception 'Invalid or inactive class join code'; end if;

  insert into public.class_members(class_id, user_id, member_role)
  values (v_class_id, v_user_id, 'student')
  on conflict (class_id, user_id) do nothing;

  return v_class_id;
end;
$$;
revoke all on function public.join_class_by_code(text) from public;
grant execute on function public.join_class_by_code(text) to authenticated;

-- Apply suspension and ownership checks to the main write paths.
drop policy if exists "teachers create own classes" on public.classes;
create policy "teachers create own classes" on public.classes for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and not public.is_suspended()
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('teacher','admin'))
);

drop policy if exists "teachers create lessons in own classes" on public.lessons;
create policy "teachers create lessons in own classes" on public.lessons for insert to authenticated
with check (teacher_id = (select auth.uid()) and not public.is_suspended() and public.is_class_teacher(class_id));
drop policy if exists "teachers manage lessons" on public.lessons;
create policy "teachers manage lessons" on public.lessons for update to authenticated
using (not public.is_suspended() and (teacher_id = (select auth.uid()) or public.is_admin()))
with check (not public.is_suspended() and (teacher_id = (select auth.uid()) or public.is_admin()));

drop policy if exists "teachers create assignments" on public.assignments;
create policy "teachers create assignments" on public.assignments for insert to authenticated
with check (teacher_id = (select auth.uid()) and not public.is_suspended() and public.is_class_teacher(class_id));
drop policy if exists "teachers manage assignments" on public.assignments;
create policy "teachers manage assignments" on public.assignments for update to authenticated
using (not public.is_suspended() and (teacher_id = (select auth.uid()) or public.is_admin()))
with check (not public.is_suspended() and (teacher_id = (select auth.uid()) or public.is_admin()));

drop policy if exists "class teachers create quizzes" on public.quizzes;
create policy "class teachers create quizzes" on public.quizzes for insert to authenticated
with check (teacher_id = (select auth.uid()) and not public.is_suspended() and public.is_class_teacher(class_id));
drop policy if exists "quiz owners manage" on public.quizzes;
create policy "quiz owners manage" on public.quizzes for update to authenticated
using (not public.is_suspended() and (teacher_id = (select auth.uid()) or public.is_admin()))
with check (not public.is_suspended() and (teacher_id = (select auth.uid()) or public.is_admin()));

drop policy if exists "users publish as themselves" on public.posts;
create policy "users publish as themselves" on public.posts for insert to authenticated
with check (author_id = (select auth.uid()) and not public.is_suspended());
drop policy if exists "authors update own posts" on public.posts;
create policy "authors update own posts" on public.posts for update to authenticated
using (not public.is_suspended() and (author_id = (select auth.uid()) or public.is_admin()))
with check (not public.is_suspended() and (author_id = (select auth.uid()) or public.is_admin()));

drop policy if exists "signed-in users comment" on public.comments;
create policy "signed-in users comment" on public.comments for insert to authenticated
with check (
  author_id = (select auth.uid()) and not public.is_suspended()
  and exists (select 1 from public.posts p where p.id = post_id)
);
drop policy if exists "users like posts" on public.post_likes;
create policy "users like posts" on public.post_likes for insert to authenticated
with check (
  user_id = (select auth.uid()) and not public.is_suspended()
  and exists (select 1 from public.posts p where p.id = post_id)
);

drop policy if exists "sender creates message" on public.direct_messages;
create policy "sender creates message" on public.direct_messages for insert to authenticated
with check (sender_id = (select auth.uid()) and not public.is_suspended());
drop policy if exists "members post class messages" on public.class_messages;
create policy "members post class messages" on public.class_messages for insert to authenticated
with check (sender_id = (select auth.uid()) and not public.is_suspended() and public.is_class_member(class_id));
drop policy if exists "stories insert own" on public.stories;
create policy "stories insert own" on public.stories for insert to authenticated
with check (user_id = (select auth.uid()) and not public.is_suspended());

drop policy if exists "users upload to own folder" on storage.objects;
create policy "users upload to own folder" on storage.objects for insert to authenticated
with check (
  bucket_id = 'nemvia-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not public.is_suspended()
);

-- A suspended learner cannot submit a quiz through the SECURITY DEFINER RPC.
create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_class uuid; v_score numeric := 0; v_total numeric := 0; v_key jsonb := '{}'::jsonb; r record;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if public.is_suspended() then raise exception 'Suspended accounts cannot submit quizzes'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'Answers must be a JSON object'; end if;

  select class_id into v_class from public.quizzes where id = p_quiz_id and is_published;
  if v_class is null or not public.is_class_member(v_class) then raise exception 'Quiz not available'; end if;
  if exists (select 1 from public.quiz_attempts where quiz_id = p_quiz_id and student_id = v_uid) then
    raise exception 'لقد أجريت هذا الاختبار من قبل';
  end if;

  for r in
    select qq.id, qq.points, qq.explanation, qq.options, k.correct_option
    from public.quiz_questions qq
    left join public.quiz_answer_keys k on k.question_id = qq.id
    where qq.quiz_id = p_quiz_id
  loop
    v_total := v_total + r.points;
    if p_answers ? r.id::text then
      if jsonb_typeof(p_answers -> r.id::text) <> 'number'
         or (p_answers ->> r.id::text) !~ '^[0-9]+$' then
        raise exception 'Answer values must be non-negative integer option indexes';
      end if;
      if (p_answers ->> r.id::text)::integer >= coalesce(jsonb_array_length(r.options), 0) then
        raise exception 'Answer option is outside the question options';
      end if;
      if (p_answers ->> r.id::text)::integer = r.correct_option then v_score := v_score + r.points; end if;
    end if;
    v_key := v_key || jsonb_build_object(r.id::text, jsonb_build_object('correct', r.correct_option, 'explanation', r.explanation));
  end loop;

  if exists (
    select 1 from jsonb_object_keys(p_answers) as answer(question_id)
    where not exists (
      select 1 from public.quiz_questions qq
      where qq.id::text = answer.question_id and qq.quiz_id = p_quiz_id
    )
  ) then raise exception 'Answers contain a question outside this quiz'; end if;

  insert into public.quiz_attempts(quiz_id, student_id, answers, score)
  values (p_quiz_id, v_uid, p_answers, v_score);
  return jsonb_build_object('score', v_score, 'total', v_total, 'key', v_key);
end;
$$;
revoke all on function public.submit_quiz_attempt(uuid, jsonb) from public;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
