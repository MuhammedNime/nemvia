import React, { useState } from 'react';
import { GraduationCap, Mail, Lock, User, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LegalContent } from '../views/LegalView';

type Mode = 'login' | 'signup' | 'reset';

function arabicError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (m.includes('email not confirmed')) return 'لم يتم تأكيد بريدك بعد. افتح رسالة التأكيد في بريدك ثم أعد المحاولة.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'هذا البريد مسجّل مسبقاً، جرّب تسجيل الدخول.';
  if (m.includes('password') && m.includes('6')) return 'كلمة المرور قصيرة، يجب ألا تقل عن 6 أحرف.';
  if (m.includes('rate limit') || m.includes('too many')) return 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة.';
  if (m.includes('network') || m.includes('fetch')) return 'تعذّر الاتصال بالخادم، تحقق من الإنترنت.';
  return msg;
}

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === 'signup') {
        if (!name.trim()) throw new Error('اكتب اسمك الظاهر');
        if (!agreed) throw new Error('يجب الموافقة على شروط الاستخدام وسياسة الخصوصية');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim(), role },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo('تم إنشاء حسابك! أرسلنا رسالة تأكيد إلى بريدك الإلكتروني، افتحها ثم سجّل الدخول.');
          setMode('login');
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) throw error;
        setInfo('إن كان البريد مسجّلاً سيصلك رابط لإعادة تعيين كلمة المرور.');
        setMode('login');
      }
    } catch (err: any) {
      setError(arabicError(err.message || 'حدث خطأ'));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setError('تسجيل الدخول عبر Google غير مفعّل بعد في إعدادات Supabase.');
  };

  const input = 'w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#1677c7] focus:bg-white';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f233a] via-[#164673] to-[#1677c7] flex items-center justify-center p-4 font-['Cairo',sans-serif]" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#0f233a] to-[#1677c7] text-white flex items-center justify-center">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">NEMVIA</h1>
          <p className="text-xs text-slate-500">منصة تعليمية ومجتمع أكاديمي للجميع</p>
        </div>

        {mode !== 'reset' && (
          <div className="flex bg-slate-100 p-1 rounded-2xl text-sm font-bold">
            <button type="button" onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2 rounded-xl cursor-pointer ${mode === 'login' ? 'bg-white text-[#1677c7] shadow-xs' : 'text-slate-500'}`}>
              تسجيل الدخول
            </button>
            <button type="button" onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-2 rounded-xl cursor-pointer ${mode === 'signup' ? 'bg-white text-[#1677c7] shadow-xs' : 'text-slate-500'}`}>
              حساب جديد
            </button>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم الظاهر" maxLength={80} className={input} required />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                {(['student', 'teacher'] as const).map(r => (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    className={`py-2.5 rounded-xl border cursor-pointer ${role === r ? 'border-[#1677c7] bg-sky-50 text-[#1677c7]' : 'border-slate-200 text-slate-500'}`}>
                    {r === 'student' ? '🎓 طالب' : '👨‍🏫 معلم'}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني" className={input} dir="ltr" required />
          </div>

          {mode !== 'reset' && (
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور (6 أحرف فأكثر)" minLength={6} className={input} dir="ltr" required />
            </div>
          )}

          {mode === 'signup' && (
            <label className="flex items-start gap-2 text-[11px] text-slate-600 leading-relaxed cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 accent-[#1677c7]" />
              <span>
                أوافق على{' '}
                <button type="button" onClick={() => setLegalTab('terms')} className="text-[#1677c7] font-bold underline cursor-pointer">شروط الاستخدام</button>
                {' '}و{' '}
                <button type="button" onClick={() => setLegalTab('privacy')} className="text-[#1677c7] font-bold underline cursor-pointer">سياسة الخصوصية</button>
              </span>
            </label>
          )}

          {error && (
            <div className="p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 flex items-start gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
          {info && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-start gap-2 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><span>{info}</span>
            </div>
          )}

          <button type="submit" disabled={busy}
            className="w-full py-3 bg-[#1677c7] hover:bg-[#125fa0] disabled:opacity-60 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'دخول' : mode === 'signup' ? 'إنشاء الحساب' : 'إرسال رابط إعادة التعيين'}
          </button>
        </form>

        {mode !== 'reset' && (
          <>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <div className="flex-1 h-px bg-slate-200" /><span>أو</span><div className="flex-1 h-px bg-slate-200" />
            </div>
            <button type="button" onClick={google}
              className="w-full py-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-700 flex items-center justify-center gap-2 cursor-pointer">
              <svg className="w-4 h-4" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.3-4 6.8-9.8 6.8-16.9z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.7 2.3-8.8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
              المتابعة عبر Google
            </button>
          </>
        )}

        {legalTab && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClick={() => setLegalTab(null)}>
            <div className="bg-white rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-black text-slate-900">{legalTab === 'terms' ? 'شروط الاستخدام' : 'سياسة الخصوصية'}</h3>
              <LegalContent tab={legalTab} />
              <button type="button" onClick={() => setLegalTab(null)} className="w-full py-2.5 bg-[#1677c7] text-white font-bold rounded-xl text-sm cursor-pointer">إغلاق</button>
            </div>
          </div>
        )}

        <div className="text-center text-xs">
          {mode === 'login' && (
            <button type="button" onClick={() => { setMode('reset'); setError(null); }} className="text-slate-500 hover:text-[#1677c7] cursor-pointer">
              نسيت كلمة المرور؟
            </button>
          )}
          {mode === 'reset' && (
            <button type="button" onClick={() => { setMode('login'); setError(null); }} className="text-slate-500 hover:text-[#1677c7] cursor-pointer">
              الرجوع لتسجيل الدخول
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const NewPasswordScreen: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(arabicError(error.message));
    else onDone();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f233a] via-[#164673] to-[#1677c7] flex items-center justify-center p-4 font-['Cairo',sans-serif]" dir="rtl">
      <form onSubmit={save} className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 space-y-4">
        <h1 className="text-xl font-black text-slate-900 text-center">تعيين كلمة مرور جديدة</h1>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required dir="ltr"
          placeholder="كلمة المرور الجديدة (6 أحرف فأكثر)" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#1677c7]" />
        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-3 bg-[#1677c7] hover:bg-[#125fa0] disabled:opacity-60 text-white font-black rounded-xl text-sm cursor-pointer">حفظ ومتابعة</button>
      </form>
    </div>
  );
};
