import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Save } from 'lucide-react';
import { QuizAttempt, QuizQuestion, QuizQuestionGrade } from '../types';

interface Props {
  attempt: QuizAttempt;
  questions: QuizQuestion[];
  onGrade: (attemptId: string, grades: Record<string, QuizQuestionGrade>, feedback: string) => Promise<boolean>;
}

const answerText = (question: QuizQuestion, value: unknown) => {
  if (value === undefined || value === null || value === '') return 'لم تتم الإجابة';
  if (question.type === 'true_false' && typeof value === 'boolean') return value ? 'صح' : 'خطأ';
  if (question.type === 'single_choice' && typeof value === 'number') return question.options[value] || 'خيار غير معروف';
  return String(value);
};

export const QuizAttemptReview: React.FC<Props> = ({ attempt, questions, onGrade }) => {
  const [editing, setEditing] = useState(attempt.gradingStatus === 'pending');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(attempt.teacherFeedback || '');
  const [grades, setGrades] = useState<Record<string, QuizQuestionGrade>>({});

  useEffect(() => {
    setGrades(Object.fromEntries(questions.map(q => [q.id, {
      score: attempt.questionGrades[q.id]?.score ?? null,
      feedback: attempt.questionGrades[q.id]?.feedback || '',
    }])));
    setFeedback(attempt.teacherFeedback || '');
    setEditing(attempt.gradingStatus === 'pending');
  }, [attempt.id, attempt.graded_at, attempt.gradingStatus, attempt.questionGrades, attempt.teacherFeedback, questions]);

  const changeGrade = (id: string, value: string) => setGrades(current => ({
    ...current,
    [id]: { ...current[id], score: value === '' ? null : Number(value) },
  }));
  const changeQuestionFeedback = (id: string, value: string) => setGrades(current => ({
    ...current,
    [id]: { ...current[id], feedback: value },
  }));

  const save = async () => {
    if (questions.some(q => grades[q.id]?.score === null || grades[q.id]?.score === undefined)) return;
    setBusy(true);
    const saved = await onGrade(attempt.id, grades, feedback);
    setBusy(false);
    if (saved) setEditing(false);
  };

  const total = questions.reduce((sum, q) => sum + q.points, 0);
  const draftTotal = questions.reduce((sum, q) => sum + (grades[q.id]?.score || 0), 0);

  return (
    <article className="border border-slate-200 rounded-xl bg-white overflow-hidden" dir="rtl">
      <div className="p-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
        <div>
          <h5 className="text-xs font-black text-slate-800">{attempt.student_name}</h5>
          <p className="text-[10px] text-slate-500">التسليم: {new Date(attempt.submitted_at).toLocaleString('ar')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${attempt.gradingStatus === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {attempt.gradingStatus === 'pending' ? <><Clock3 className="inline w-3 h-3 ml-1" />بانتظار التصحيح</> : <><CheckCircle2 className="inline w-3 h-3 ml-1" />تم التصحيح</>}
          </span>
          <strong className="text-xs text-slate-700">{attempt.score} / {attempt.totalPoints}</strong>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {questions.map((q, i) => {
          const existing = attempt.questionGrades[q.id];
          const draft = grades[q.id];
          return (
            <section key={q.id} className="p-3 rounded-xl border border-slate-100 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800">{i + 1}. {q.question}</p>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap break-words">{answerText(q, attempt.answers[q.id])}</p>
                  {existing?.feedback && <p className="text-[11px] text-sky-800">ملاحظة: {existing.feedback}</p>}
                </div>
                <div className="shrink-0 text-[10px] text-slate-500">من {q.points}</div>
              </div>
              {editing ? (
                <div className="grid sm:grid-cols-[120px_1fr] gap-2">
                  <input type="number" min={0} max={q.points} step={0.25} value={draft?.score ?? ''}
                    onChange={e => changeGrade(q.id, e.target.value)} placeholder="العلامة" className="w-full p-2 border border-slate-200 rounded-lg text-xs" />
                  <input value={draft?.feedback || ''} onChange={e => changeQuestionFeedback(q.id, e.target.value)}
                    placeholder="ملاحظة لهذا السؤال (اختياري)" className="w-full p-2 border border-slate-200 rounded-lg text-xs" maxLength={2000} />
                </div>
              ) : (
                <p className="text-[11px] font-bold text-emerald-700">العلامة: {existing?.score ?? '—'} / {q.points}</p>
              )}
            </section>
          );
        })}

        {editing && (
          <>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={2} maxLength={5000}
              placeholder="تعليق عام للطالب" className="w-full p-2.5 border border-slate-200 rounded-xl text-xs" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700">المجموع بعد التصحيح: {draftTotal} / {total}</span>
              <button type="button" onClick={save} disabled={busy || questions.some(q => grades[q.id]?.score === null || grades[q.id]?.score === undefined)}
                className="px-3 py-2 rounded-lg bg-[#1677c7] text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> {busy ? 'جارٍ الحفظ…' : 'حفظ التصحيح'}
              </button>
            </div>
          </>
        )}
        {!editing && attempt.teacherFeedback && <p className="p-2 bg-sky-50 rounded-lg text-xs text-sky-900">التعليق العام: {attempt.teacherFeedback}</p>}
        {!editing && <button type="button" onClick={() => setEditing(true)} className="text-xs font-bold text-[#1677c7]">تعديل التصحيح</button>}
      </div>
    </article>
  );
};
