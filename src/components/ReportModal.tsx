import React, { useState } from 'react';
import { Flag, X } from 'lucide-react';

export interface ReportTarget {
  type: 'post' | 'comment' | 'user' | 'message';
  id: string;
  label: string;
  snapshot?: string;
}

const REASONS = ['محتوى مسيء أو شتائم', 'تحرش أو تنمّر', 'محتوى غير لائق', 'احتيال أو انتحال', 'رسائل مزعجة (سبام)', 'أخرى'];

export const ReportModal: React.FC<{
  target: ReportTarget | null;
  onClose: () => void;
  onSubmit: (r: { reason: string; details: string }) => Promise<void> | void;
}> = ({ target, onClose, onSubmit }) => {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  if (!target) return null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await onSubmit({ reason, details: details.trim() });
    setBusy(false);
    setDetails('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <form onSubmit={send} className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-900 flex items-center gap-2"><Flag className="w-4 h-4 text-rose-500" />الإبلاغ عن {target.label}</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        {target.snapshot && <p className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-600 line-clamp-3">«{target.snapshot}»</p>}
        <div className="space-y-1.5">
          {REASONS.map(r => (
            <label key={r} className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${reason === r ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600'}`}>
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-rose-500" />{r}
            </label>
          ))}
        </div>
        <textarea value={details} onChange={e => setDetails(e.target.value)} maxLength={500} rows={3}
          placeholder="تفاصيل إضافية (اختياري)" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-rose-400" />
        <button type="submit" disabled={busy} className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-black rounded-xl text-sm cursor-pointer">
          إرسال البلاغ
        </button>
      </form>
    </div>
  );
};
