-- =====================================================================
-- NEMVIA — PATCH 05: flexible quizzes, automatic and manual grading
-- Run after patches 01–04. Safe to rerun.
-- =====================================================================

alter table public.quizzes
  add column if not exists pass_percentage numeric(5,2) not null default 50;

alter table public.quiz_questions
  add column if not exists question_type text not null default 'single_choice';

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'quiz_questions_question_type_check'
      and conrelid = 'public.quiz_questions'::regclass
  ) then
    alter table public.quiz_questions
      add constraint quiz_questions_question_type_check
      check (question_type in ('single_choice','true_false','short_answer','essay'));
  end if;
end $$;

alter table public.quiz_answer_keys
  add column if not exists correct_answer text,
  add column if not exists accepted_answers text[] not null default '{}';

alter table public.quiz_attempts
  add column if not exists total_points numeric(7,2) not null default 0,
  add column if not exists grading_status text not null default 'graded',
  add column if not exists question_grades jsonb not null default '{}'::jsonb,
  add column if not exists teacher_feedback text,
  add column if not exists graded_by uuid references public.profiles(id) on delete set null,
  add column if not exists graded_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'quiz_attempts_grading_status_check'
      and conrelid = 'public.quiz_attempts'::regclass
  ) then
    alter table public.quiz_attempts
      add constraint quiz_attempts_grading_status_check
      check (grading_status in ('pending','graded'));
  end if;
end $$;

update public.quiz_attempts a
set total_points = coalesce((select sum(q.points) from public.quiz_questions q where q.quiz_id = a.quiz_id), 0)
where a.total_points = 0;

create or replace function public.create_quiz_with_questions(p_quiz jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_class_id uuid;
  v_quiz_id uuid;
  v_question_id uuid;
  v_question jsonb;
  v_type text;
  v_options jsonb;
  v_correct integer;
  v_points numeric;
  v_accepted text[];
  v_count integer := 0;
  v_minutes integer;
  v_pass numeric;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if public.is_suspended() then raise exception 'Suspended accounts cannot create quizzes'; end if;
  if p_quiz is null or jsonb_typeof(p_quiz) is distinct from 'object' then raise exception 'Quiz data must be an object'; end if;
  if nullif(trim(p_quiz->>'title'), '') is null then raise exception 'Quiz title is required'; end if;

  v_class_id := (p_quiz->>'classId')::uuid;
  if not public.is_class_teacher(v_class_id) then raise exception 'You can only create quizzes in your own class'; end if;

  v_minutes := coalesce((p_quiz->>'timeLimitMinutes')::integer, 10);
  v_pass := coalesce((p_quiz->>'passPercentage')::numeric, 50);
  if v_minutes < 0 or v_minutes > 240 then raise exception 'Time limit must be between 0 and 240 minutes'; end if;
  if v_pass < 0 or v_pass > 100 then raise exception 'Pass percentage must be between 0 and 100'; end if;
  if jsonb_typeof(p_quiz->'questions') is distinct from 'array'
     or jsonb_array_length(p_quiz->'questions') not between 1 and 100 then
    raise exception 'A quiz must have between 1 and 100 questions';
  end if;

  insert into public.quizzes(class_id, teacher_id, title, description, time_limit_minutes, is_published, pass_percentage)
  values (
    v_class_id, v_uid, left(trim(p_quiz->>'title'), 150),
    left(coalesce(p_quiz->>'description', ''), 2000), v_minutes,
    coalesce((p_quiz->>'isPublished')::boolean, true), v_pass
  ) returning id into v_quiz_id;

  for v_question in select value from jsonb_array_elements(p_quiz->'questions') loop
    v_type := coalesce(v_question->>'type', 'single_choice');
    if v_type not in ('single_choice','true_false','short_answer','essay') then
      raise exception 'Unsupported question type: %', v_type;
    end if;
    if nullif(trim(v_question->>'question'), '') is null then raise exception 'Question text is required'; end if;

    v_points := coalesce((v_question->>'points')::numeric, 1);
    if v_points <= 0 or v_points > 100 then raise exception 'Each question must be worth more than 0 and at most 100 points'; end if;

    if v_type = 'single_choice' then
      v_options := v_question->'options';
      if jsonb_typeof(v_options) is distinct from 'array'
         or jsonb_array_length(v_options) not between 2 and 8 then
        raise exception 'Multiple-choice questions need between 2 and 8 options';
      end if;
      v_correct := (v_question->>'correctOptionIndex')::integer;
      if v_correct < 0 or v_correct >= jsonb_array_length(v_options) then raise exception 'Choose a valid correct option'; end if;
    elsif v_type = 'true_false' then
      v_options := '["صح","خطأ"]'::jsonb;
      v_correct := (v_question->>'correctOptionIndex')::integer;
      if v_correct not in (0,1) then raise exception 'Choose صح or خطأ as the correct answer'; end if;
    else
      v_options := '[]'::jsonb;
      v_correct := -1;
    end if;

    insert into public.quiz_questions(quiz_id, question, options, points, position, explanation, question_type)
    values (
      v_quiz_id, left(trim(v_question->>'question'), 4000), v_options, v_points,
      v_count, left(coalesce(v_question->>'explanation', ''), 2000), v_type
    ) returning id into v_question_id;

    if v_type in ('single_choice','true_false') then
      insert into public.quiz_answer_keys(question_id, correct_option, correct_answer, accepted_answers)
      values (v_question_id, v_correct, null, '{}');
    elsif v_type = 'short_answer' then
      if jsonb_typeof(v_question->'acceptedAnswers') is distinct from 'array' then
        raise exception 'Short-answer questions need at least one accepted answer';
      end if;
      select coalesce(array_agg(trim(value)), '{}') into v_accepted
      from jsonb_array_elements_text(v_question->'acceptedAnswers') as answer(value)
      where nullif(trim(value), '') is not null;
      if coalesce(array_length(v_accepted, 1), 0) = 0 then raise exception 'Short-answer questions need at least one accepted answer'; end if;
      insert into public.quiz_answer_keys(question_id, correct_option, correct_answer, accepted_answers)
      values (v_question_id, -1, v_accepted[1], v_accepted);
    end if;
    v_count := v_count + 1;
  end loop;

  return v_quiz_id;
end;
$$;
revoke all on function public.create_quiz_with_questions(jsonb) from public;
grant execute on function public.create_quiz_with_questions(jsonb) to authenticated;

create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_class uuid;
  v_score numeric := 0;
  v_total numeric := 0;
  v_pending boolean := false;
  v_key jsonb := '{}'::jsonb;
  v_grades jsonb := '{}'::jsonb;
  v_answer jsonb;
  v_answer_text text;
  v_mark numeric;
  r record;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if public.is_suspended() then raise exception 'Suspended accounts cannot submit quizzes'; end if;
  if p_answers is null or jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Answers must be a JSON object'; end if;
  if exists (
    select 1 from jsonb_object_keys(p_answers) as answer(question_id)
    where not exists (
      select 1 from public.quiz_questions qq where qq.id::text = answer.question_id and qq.quiz_id = p_quiz_id
    )
  ) then raise exception 'Answers contain a question outside this quiz'; end if;

  select class_id into v_class from public.quizzes where id = p_quiz_id and is_published;
  if v_class is null or not public.is_class_member(v_class) then raise exception 'Quiz not available'; end if;
  if exists (select 1 from public.quiz_attempts where quiz_id = p_quiz_id and student_id = v_uid) then
    raise exception 'لقد أجريت هذا الاختبار من قبل';
  end if;

  for r in
    select qq.id, qq.question_type, qq.points, qq.explanation, qq.options,
           k.correct_option, k.correct_answer, k.accepted_answers
    from public.quiz_questions qq
    left join public.quiz_answer_keys k on k.question_id = qq.id
    where qq.quiz_id = p_quiz_id order by qq.position
  loop
    v_total := v_total + r.points;
    v_answer := p_answers -> r.id::text;
    v_mark := 0;

    if r.question_type = 'single_choice' then
      if v_answer is not null then
        if jsonb_typeof(v_answer) is distinct from 'number' or (v_answer #>> '{}') !~ '^[0-9]+$' then
          raise exception 'Multiple-choice answers must be option indexes';
        end if;
        if (v_answer #>> '{}')::integer >= jsonb_array_length(r.options) then raise exception 'Option index is outside the choices'; end if;
        if (v_answer #>> '{}')::integer = r.correct_option then v_mark := r.points; end if;
      end if;
      v_key := v_key || jsonb_build_object(r.id::text, jsonb_build_object('type', r.question_type, 'correctOptionIndex', r.correct_option, 'explanation', r.explanation));
    elsif r.question_type = 'true_false' then
      if v_answer is not null then
        if jsonb_typeof(v_answer) is distinct from 'boolean' then raise exception 'True/false answers must be boolean'; end if;
        if ((v_answer #>> '{}')::boolean and r.correct_option = 0)
           or (not (v_answer #>> '{}')::boolean and r.correct_option = 1) then v_mark := r.points; end if;
      end if;
      v_key := v_key || jsonb_build_object(r.id::text, jsonb_build_object('type', r.question_type, 'correctOptionIndex', r.correct_option, 'explanation', r.explanation));
    elsif r.question_type = 'short_answer' then
      if v_answer is not null then
        if jsonb_typeof(v_answer) is distinct from 'string' then raise exception 'Short answers must be text'; end if;
        v_answer_text := lower(regexp_replace(trim(v_answer #>> '{}'), '\s+', ' ', 'g'));
        if exists (
          select 1 from unnest(coalesce(r.accepted_answers, array[r.correct_answer])) as accepted(value)
          where lower(regexp_replace(trim(accepted.value), '\s+', ' ', 'g')) = v_answer_text
        ) then v_mark := r.points; end if;
      end if;
      v_key := v_key || jsonb_build_object(r.id::text, jsonb_build_object('type', r.question_type, 'correctAnswer', r.correct_answer, 'explanation', r.explanation));
    else
      if v_answer is not null and jsonb_typeof(v_answer) is distinct from 'string' then raise exception 'Written answers must be text'; end if;
      if coalesce(length(v_answer #>> '{}'), 0) > 20000 then raise exception 'Written answers are limited to 20,000 characters'; end if;
      v_pending := true;
      v_grades := v_grades || jsonb_build_object(r.id::text, jsonb_build_object('score', null, 'feedback', '', 'pending', true));
      v_key := v_key || jsonb_build_object(r.id::text, jsonb_build_object('type', r.question_type, 'explanation', r.explanation));
    end if;

    if r.question_type <> 'essay' then
      v_score := v_score + v_mark;
      v_grades := v_grades || jsonb_build_object(r.id::text, jsonb_build_object('score', v_mark, 'feedback', '', 'pending', false));
    end if;
  end loop;

  insert into public.quiz_attempts(quiz_id, student_id, answers, score, total_points, grading_status, question_grades)
  values (p_quiz_id, v_uid, p_answers, v_score, v_total, case when v_pending then 'pending' else 'graded' end, v_grades);
  return jsonb_build_object('score', v_score, 'total', v_total, 'pendingReview', v_pending, 'key', v_key, 'questionGrades', v_grades);
end;
$$;
revoke all on function public.submit_quiz_attempt(uuid, jsonb) from public;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;

create or replace function public.grade_quiz_attempt(p_attempt_id uuid, p_grades jsonb, p_feedback text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_quiz_id uuid;
  v_class_id uuid;
  v_score numeric := 0;
  v_total numeric := 0;
  v_count integer := 0;
  v_grades jsonb := '{}'::jsonb;
  v_item jsonb;
  v_mark numeric;
  v_feedback text;
  r record;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if public.is_suspended() then raise exception 'Suspended accounts cannot grade quizzes'; end if;
  if p_grades is null or jsonb_typeof(p_grades) is distinct from 'object' then raise exception 'Grades must be a JSON object'; end if;

  select a.quiz_id, q.class_id into v_quiz_id, v_class_id
  from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
  where a.id = p_attempt_id;
  if v_quiz_id is null then raise exception 'Quiz attempt not found'; end if;
  if not public.is_admin() and not public.is_class_teacher(v_class_id) then raise exception 'Only this class teacher can grade the attempt'; end if;

  for r in select id, points from public.quiz_questions where quiz_id = v_quiz_id order by position loop
    v_count := v_count + 1;
    if not (p_grades ? r.id::text) then raise exception 'Every question needs a grade'; end if;
    v_item := p_grades -> r.id::text;
    if jsonb_typeof(v_item) is distinct from 'object'
       or jsonb_typeof(v_item->'score') is distinct from 'number'
       or (v_item->>'score') !~ '^[0-9]+(\.[0-9]+)?$' then
      raise exception 'Each grade must include a numeric score';
    end if;
    v_mark := (v_item->>'score')::numeric;
    if v_mark < 0 or v_mark > r.points then raise exception 'Question grade is outside its point range'; end if;
    v_feedback := left(coalesce(v_item->>'feedback', ''), 2000);
    v_score := v_score + v_mark;
    v_total := v_total + r.points;
    v_grades := v_grades || jsonb_build_object(r.id::text, jsonb_build_object('score', v_mark, 'feedback', v_feedback, 'pending', false));
  end loop;
  if jsonb_object_length(p_grades) <> v_count then raise exception 'Grades contain a question outside this quiz'; end if;

  update public.quiz_attempts
  set score = v_score, total_points = v_total, grading_status = 'graded', question_grades = v_grades,
      teacher_feedback = left(coalesce(p_feedback, ''), 5000), graded_by = v_uid, graded_at = now()
  where id = p_attempt_id;

  return jsonb_build_object('score', v_score, 'total', v_total, 'questionGrades', v_grades);
end;
$$;
revoke all on function public.grade_quiz_attempt(uuid, jsonb, text) from public;
grant execute on function public.grade_quiz_attempt(uuid, jsonb, text) to authenticated;
