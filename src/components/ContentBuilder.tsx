import React, { useState } from 'react';
import { X, Plus, Trash2, Paperclip, Loader2 } from 'lucide-react';
import { ClassItem, Lesson, Quiz, QuizQuestion } from '../types';
import { UploadedFile } from '../lib/api';

const field = 'w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1677c7] focus:bg-white';

function toEmbed(url: string): string {
  const u = url.trim();
  if (!u) return '';
  const m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : u;
}

const Shell: React.FC<{ title: string; onClose: () => void; onSubmit: (e: React.FormEvent) => void; children: React.ReactNode; busy?: boolean }> =
  ({ title, onClose, onSubmit, children, busy }) => (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <form onSubmit={onSubmit} className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        {children}
        <button type="submit" disabled={busy} className="w-full py-3 bg-[#1677c7] hover:bg-[#125fa0] disabled:opacity-60 text-white font-black rounded-xl text-sm cursor-pointer flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} نشر
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
const blankQ = (): QuizQuestion => ({ id: Math.random().toString(36).slice(2), question: '', options: ['', '', '', ''], correctOptionIndex: 0, explanation: '', points: 1 });

export const QuizBuilderModal: React.FC<{
  classes: ClassItem[]; onClose: () => void; onSubmit: (q: Quiz) => void;
}> = ({ classes, onClose, onSubmit }) => {
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [qs, setQs] = useState<QuizQuestion[]>([blankQ()]);
  const [error, setError] = useState('');

  const upd = (i: number, patch: Partial<QuizQuestion>) => setQs(list => list.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const updOpt = (i: number, j: number, v: string) => setQs(list => list.map((q, k) => (k === i ? { ...q, options: q.options.map((o, x) => (x === j ? v : o)) } : q)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !title.trim()) return;
    for (const q of qs) {
      const filled = q.options.filter(o => o.trim());
      if (!q.question.trim() || filled.length < 2) { setError('كل سؤال يحتاج نصاً وخيارين على الأقل.'); return; }
      if (!q.options[q.correctOptionIndex]?.trim()) { setError('الإجابة الصحيحة يجب أن تكون خياراً غير فارغ.'); return; }
    }
    onSubmit({
      id: 'new', class_id: classId, class_title: '', title: title.trim(), description: desc.trim(),
      timeLimitMinutes: Math.max(1, minutes), isPublished: true, attemptsCount: 0,
      questions: qs.map(q => {
        const keep = q.options.map((o, i) => ({ o: o.trim(), i })).filter(x => x.o);
        return { ...q, question: q.question.trim(), options: keep.map(x => x.o), correctOptionIndex: keep.findIndex(x => x.i === q.correctOptionIndex) };
      }),
    } as Quiz);
    onClose();
  };

  return (
    <Shell title="إنشاء اختبار جديد" onClose={onClose} onSubmit={submit}>
      <select value={classId} onChange={e => setClassId(e.target.value)} className={field} required>
        {classes.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان الاختبار" className={field} required maxLength={150} />
      <div className="grid sm:grid-cols-3 gap-3">
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="وصف قصير" className={`${field} sm:col-span-2`} />
        <input type="number" min={1} max={180} value={minutes} onChange={e => setMinutes(Number(e.target.value))} className={field} title="المدة بالدقائق" />
      </div>

      {qs.map((q, i) => (
        <div key={q.id} className="p-3 border border-slate-200 rounded-2xl space-y-2 bg-slate-50/60">
          <div className="flex items-center justify-between text-xs font-black text-slate-700">
            <span>السؤال {i + 1}</span>
            {qs.length > 1 && <button type="button" onClick={() => setQs(l => l.filter((_, k) => k !== i))} className="text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
          </div>
          <input value={q.question} onChange={e => upd(i, { question: e.target.value })} placeholder="نص السؤال" className={field} />
          {q.options.map((o, j) => (
            <label key={j} className="flex items-center gap-2">
              <input type="radio" name={`c-${q.id}`} checked={q.correctOptionIndex === j} onChange={() => upd(i, { correctOptionIndex: j })} className="accent-emerald-500" title="الإجابة الصحيحة" />
              <input value={o} onChange={e => updOpt(i, j, e.target.value)} placeholder={`الخيار ${j + 1}`} className={field} />
            </label>
          ))}
          <div className="grid grid-cols-4 gap-2">
            <input value={q.explanation} onChange={e => upd(i, { explanation: e.target.value })} placeholder="تفسير الإجابة (يظهر بعد التسليم)" className={`${field} col-span-3`} />
            <input type="number" min={1} max={20} value={q.points} onChange={e => upd(i, { points: Math.max(1, Number(e.target.value)) })} className={field} title="الدرجة" />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setQs(l => [...l, blankQ()])} className="w-full py-2 border border-dashed border-[#1677c7] text-[#1677c7] rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
        <Plus className="w-3.5 h-3.5" /> إضافة سؤال
      </button>
      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
    </Shell>
  );
};
