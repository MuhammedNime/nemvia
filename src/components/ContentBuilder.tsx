import React, { useState } from 'react';
import { X, Plus, Trash2, Paperclip, Loader2 } from 'lucide-react';
import { ClassItem, Lesson, Quiz, QuizQuestion, QuizQuestionType } from '../types';
import { UploadedFile } from '../lib/api';

const field = 'w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1677c7] focus:bg-white';

function toEmbed(url: string): string {
  const u = url.trim();
  if (!u) return '';
  const m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : u;
}

const Shell: React.FC<{ title: string; onClose: () => void; onSubmit: (e: React.FormEvent) => void; children: React.ReactNode; busy?: boolean; submitLabel?: string }> =
  ({ title, onClose, onSubmit, children, busy, submitLabel = 'نشر' }) => (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <form onSubmit={onSubmit} className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        {children}
        <button type="submit" disabled={busy} className="w-full py-3 bg-[#1677c7] hover:bg-[#125fa0] disabled:opacity-60 text-white font-black rounded-xl text-sm cursor-pointer flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {submitLabel}
        </button>
      </form>
    </div>
  );

/* ------------------------- Lesson ------------------------- */
export const LessonBuilderModal: React.FC<{
  classes: ClassItem[]; teacherName: string; onClose: () => void;
  onSubmit: (l: Lesson) => void; onUpload: (f: File, folder: string) => Promise<UploadedFile>;
}> = ({ classes, teacherName, onClose, onSubmit, onUpload }) => {
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [video, setVideo] = useState('');
  const [duration, setDuration] = useState('');
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try { setFile(await onUpload(f, 'lessons')); } catch { /* toast في App */ }
    setBusy(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !title.trim()) return;
    onSubmit({
      id: 'new', class_id: classId, teacher_id: '', teacher_name: teacherName, title: title.trim(), content: content.trim(),
      video_url: toEmbed(video) || undefined, duration: duration.trim() || undefined,
      attachment_url: file?.url, attachment_name: file?.name, position: 0, published_at: new Date().toISOString(),
    } as Lesson);
    onClose();
  };

  return (
    <Shell title="إضافة درس جديد" onClose={onClose} onSubmit={submit} busy={busy}>
      <select value={classId} onChange={e => setClassId(e.target.value)} className={field} required>
        {classes.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان الدرس" className={field} required maxLength={150} />
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="شرح الدرس…" rows={6} className={field} />
      <div className="grid sm:grid-cols-2 gap-3">
        <input value={video} onChange={e => setVideo(e.target.value)} placeholder="رابط فيديو يوتيوب (اختياري)" className={field} dir="ltr" />
        <input value={duration} onChange={e => setDuration(e.target.value)} placeholder="المدة (مثال: 20 دقيقة)" className={field} />
      </div>
      <label className="flex items-center gap-2 p-2.5 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50">
        <Paperclip className="w-4 h-4" /> {file ? file.name : 'إرفاق ملف (PDF / مستند — حتى 10MB)'}
        <input type="file" className="hidden" onChange={pick} />
      </label>
    </Shell>
  );
};

/* ------------------------- Quiz ------------------------- */
const blankQ = (type: QuizQuestionType = 'single_choice'): QuizQuestion => ({
  id: crypto.randomUUID(), type, question: '', options: type === 'true_false' ? ['صح', 'خطأ'] : type === 'single_choice' ? ['', '', '', ''] : [],
  correctOptionIndex: 0, acceptedAnswers: [], explanation: '', points: 1,
});

export const QuizBuilderModal: React.FC<{
  classes: ClassItem[]; onClose: () => void; onSubmit: (q: Quiz) => void;
}> = ({ classes, onClose, onSubmit }) => {
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [passPercentage, setPassPercentage] = useState(50);
  const [isPublished, setIsPublished] = useState(true);
  const [qs, setQs] = useState<QuizQuestion[]>([blankQ()]);
  const [error, setError] = useState('');

  const upd = (i: number, patch: Partial<QuizQuestion>) => setQs(list => list.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const updOpt = (i: number, j: number, v: string) => setQs(list => list.map((q, k) => (k === i ? { ...q, options: q.options.map((o, x) => (x === j ? v : o)) } : q)));
  const changeType = (i: number, type: QuizQuestionType) => upd(i, {
    type,
    options: type === 'true_false' ? ['صح', 'خطأ'] : type === 'single_choice' ? ['', '', '', ''] : [],
    correctOptionIndex: 0,
    acceptedAnswers: [],
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!classId || !title.trim()) return;
    if (qs.length === 0) { setError('أضف سؤالاً واحداً على الأقل.'); return; }
    for (const q of qs) {
      if (!q.question.trim()) { setError('اكتب نص كل سؤال قبل النشر.'); return; }
      if (!Number.isFinite(q.points) || q.points <= 0 || q.points > 100) { setError('درجة كل سؤال يجب أن تكون أكبر من 0 وبحد أقصى 100.'); return; }
      if (q.type === 'single_choice') {
        const filled = q.options.filter(o => o.trim());
        if (filled.length < 2 || !q.options[q.correctOptionIndex]?.trim()) { setError('سؤال الاختيار يحتاج خيارين على الأقل وإجابة صحيحة.'); return; }
      }
      if (q.type === 'short_answer' && !(q.acceptedAnswers || []).some(a => a.trim())) { setError('أضف إجابة نموذجية واحدة على الأقل للسؤال القصير.'); return; }
    }
    onSubmit({
      id: 'new', class_id: classId, class_title: '', title: title.trim(), description: desc.trim(),
      timeLimitMinutes: Math.min(240, Math.max(0, minutes)), passPercentage: Math.min(100, Math.max(0, passPercentage)),
      isPublished, attemptsCount: 0,
      questions: qs.map(q => {
        const keep = q.type === 'single_choice' ? q.options.map((o, i) => ({ o: o.trim(), i })).filter(x => x.o) : [];
        return {
          ...q,
          question: q.question.trim(),
          options: q.type === 'single_choice' ? keep.map(x => x.o) : q.type === 'true_false' ? ['صح', 'خطأ'] : [],
          correctOptionIndex: q.type === 'single_choice' ? keep.findIndex(x => x.i === q.correctOptionIndex) : q.correctOptionIndex,
          acceptedAnswers: q.type === 'short_answer' ? (q.acceptedAnswers || []).map(a => a.trim()).filter(Boolean) : [],
        };
      }),
    } as Quiz);
    onClose();
  };

  return (
    <Shell title="منشئ الاختبارات" onClose={onClose} onSubmit={submit} submitLabel={isPublished ? 'نشر الاختبار' : 'حفظ كمسودة'}>
      <select value={classId} onChange={e => setClassId(e.target.value)} className={field} required>
        {classes.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان الاختبار" className={field} required maxLength={150} />
      <div className="grid sm:grid-cols-3 gap-3">
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="تعليمات الاختبار أو وصفه" className={`${field} sm:col-span-2`} maxLength={2000} />
        <label className="text-[11px] font-bold text-slate-600 space-y-1">المدة بالدقائق (0 بلا حد)
          <input type="number" min={0} max={240} value={minutes} onChange={e => setMinutes(Number(e.target.value))} className={field} />
        </label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 p-3 bg-sky-50 rounded-2xl border border-sky-100">
        <label className="text-xs font-bold text-slate-700 space-y-2">درجة النجاح (%)
          <input type="number" min={0} max={100} value={passPercentage} onChange={e => setPassPercentage(Number(e.target.value))} className={field} />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
          <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="accent-[#1677c7]" />
          نشر الاختبار للطلاب فوراً
        </label>
      </div>

      {qs.map((q, i) => (
        <div key={q.id} className="p-3 border border-slate-200 rounded-2xl space-y-2 bg-slate-50/60">
          <div className="flex items-center justify-between text-xs font-black text-slate-700">
            <span>السؤال {i + 1} · {q.points} علامة</span>
            {qs.length > 1 && <button type="button" onClick={() => setQs(l => l.filter((_, k) => k !== i))} className="text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
          </div>
          <select value={q.type} onChange={e => changeType(i, e.target.value as QuizQuestionType)} className={field}>
            <option value="single_choice">اختيار من متعدد</option>
            <option value="true_false">صح أو خطأ</option>
            <option value="short_answer">إجابة قصيرة · تصحيح آلي</option>
            <option value="essay">إجابة كتابية / تقرير · تصحيح المعلم</option>
          </select>
          <input value={q.question} onChange={e => upd(i, { question: e.target.value })} placeholder="نص السؤال" className={field} />
          {q.type === 'single_choice' && q.options.map((o, j) => (
            <label key={j} className="flex items-center gap-2">
              <input type="radio" name={`c-${q.id}`} checked={q.correctOptionIndex === j} onChange={() => upd(i, { correctOptionIndex: j })} className="accent-emerald-500" title="الإجابة الصحيحة" />
              <input value={o} onChange={e => updOpt(i, j, e.target.value)} placeholder={`الخيار ${j + 1}`} className={field} />
            </label>
          ))}
          {q.type === 'single_choice' && (
            <button type="button" disabled={q.options.length >= 8} onClick={() => upd(i, { options: [...q.options, ''] })} className="text-[11px] font-bold text-[#1677c7] disabled:opacity-40">+ إضافة خيار</button>
          )}
          {q.type === 'true_false' && (
            <div className="flex gap-4 text-xs font-bold text-slate-700">
              {['صح', 'خطأ'].map((label, index) => <label key={label} className="flex items-center gap-1.5"><input type="radio" name={`c-${q.id}`} checked={q.correctOptionIndex === index} onChange={() => upd(i, { correctOptionIndex: index })} className="accent-emerald-500" /> {label}</label>)}
            </div>
          )}
          {q.type === 'short_answer' && (
            <div className="space-y-1">
              <textarea value={(q.acceptedAnswers || []).join('\n')} onChange={e => upd(i, { acceptedAnswers: e.target.value.split('\n') })} placeholder={'الإجابات المقبولة، كل إجابة في سطر\nمثال: دمشق'} rows={3} className={field} />
              <p className="text-[10px] text-slate-500">التصحيح يتجاهل اختلاف حالة الأحرف والمسافات الزائدة.</p>
            </div>
          )}
          {q.type === 'essay' && <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg">سيكتب الطالب إجابته أو تقريره، ثم تمنح الدرجة والتعليق من لوحة تصحيح المحاولات.</p>}
          <div className="grid sm:grid-cols-4 gap-2">
            <input value={q.explanation} onChange={e => upd(i, { explanation: e.target.value })} placeholder="شرح أو ملاحظة للطالب بعد الحل" className={`${field} sm:col-span-3`} maxLength={2000} />
            <label className="text-[10px] font-bold text-slate-600">علامة السؤال
            <input type="number" min={0.01} max={100} step={0.01} value={q.points} onChange={e => upd(i, { points: Number(e.target.value) })} className={field} />
            </label>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between px-1 text-xs font-black text-slate-700"><span>العلامة الكلية</span><span>{qs.reduce((n, q) => n + (Number(q.points) || 0), 0).toFixed(2)}</span></div>
      <button type="button" disabled={qs.length >= 100} onClick={() => setQs(l => [...l, blankQ()])} className="w-full py-2 border border-dashed border-[#1677c7] text-[#1677c7] rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40">
        <Plus className="w-3.5 h-3.5" /> إضافة سؤال
      </button>
      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
    </Shell>
  );
};
