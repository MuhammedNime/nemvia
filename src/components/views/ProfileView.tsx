import React, { useState } from 'react';
import { Camera, Loader2, Lock, Globe, Flame, Star, LogOut } from 'lucide-react';
import { Profile } from '../../types';
import { UploadedFile } from '../../lib/api';
import { supabase } from '../../lib/supabase';

interface ProfileViewProps {
  profile: Profile;
  email: string;
  classesCount: number;
  onSave: (patch: { display_name: string; bio: string; visibility: 'public' | 'private'; avatar_url?: string }) => Promise<boolean>;
  onUpload: (f: File, folder: string) => Promise<UploadedFile>;
  onSignOut: () => void;
}

const roleName = { student: 'طالب', teacher: 'معلم', admin: 'مؤسس / أدمن' } as const;
const input = 'w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#1677c7] focus:bg-white';

export const ProfileView: React.FC<ProfileViewProps> = ({ profile, email, classesCount, onSave, onUpload, onSignOut }) => {
  const [name, setName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [visibility, setVisibility] = useState<'public' | 'private'>(profile.visibility as 'public' | 'private');
  const [avatar, setAvatar] = useState(profile.avatar_url || '');
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !f.type.startsWith('image/')) return;
    setBusy(true);
    try { setAvatar((await onUpload(f, 'avatars')).url); } catch { /* toast */ }
    setBusy(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await onSave({ display_name: name.trim(), bio: bio.trim(), visibility, avatar_url: avatar || undefined });
    setBusy(false);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'تم تغيير كلمة المرور' });
    if (!error) setPw('');
  };

  return (
    <div className="space-y-5 animate-in fade-in max-w-2xl">
      <div className="bg-gradient-to-br from-[#0f233a] to-[#1677c7] rounded-3xl p-6 text-white flex items-center gap-4">
        <div className="relative shrink-0">
          {avatar ? (
            <img src={avatar} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-white/30" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white/15 flex items-center justify-center text-3xl font-black">{name.slice(0, 1) || '؟'}</div>
          )}
          <label className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full bg-white text-[#1677c7] flex items-center justify-center cursor-pointer shadow">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            <input type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
          </label>
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-black truncate">{profile.display_name}</h2>
          <p className="text-xs text-white/70">{roleName[profile.role]} · منضم {profile.joinedDate}</p>
          <div className="flex gap-3 mt-2 text-xs font-bold">
            <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-300" />{profile.points} نقطة</span>
            <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-300" />{profile.streakDays} يوم</span>
            <span>{classesCount} صف</span>
          </div>
        </div>
      </div>

      <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h3 className="font-black text-slate-900 text-sm">معلومات الحساب</h3>
        <div className="space-y-1"><label className="text-xs font-bold text-slate-600">الاسم الظاهر</label>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={80} required className={input} /></div>
        <div className="space-y-1"><label className="text-xs font-bold text-slate-600">نبذة عنك</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={300} rows={3} className={input} /></div>
        <div className="space-y-1"><label className="text-xs font-bold text-slate-600">البريد الإلكتروني</label>
          <input value={email} readOnly dir="ltr" className={`${input} text-slate-400`} /></div>

        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          {([['public', 'عام', Globe, 'منشوراتك وقصصك يراها كل المسجّلين'], ['private', 'خاص', Lock, 'منشوراتك لا تظهر إلا لك ولأعضاء صفوفك']] as const).map(([v, label, Icon, hint]) => (
            <button type="button" key={v} onClick={() => setVisibility(v)}
              className={`p-3 rounded-xl border text-right cursor-pointer ${visibility === v ? 'border-[#1677c7] bg-sky-50 text-[#1677c7]' : 'border-slate-200 text-slate-500'}`}>
              <span className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" />{label}</span>
              <span className="block text-[10px] font-normal mt-1 leading-relaxed">{hint}</span>
            </button>
          ))}
        </div>
        <button type="submit" disabled={busy} className="w-full py-3 bg-[#1677c7] hover:bg-[#125fa0] disabled:opacity-60 text-white font-black rounded-xl text-sm cursor-pointer">حفظ التغييرات</button>
      </form>

      <form onSubmit={changePassword} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h3 className="font-black text-slate-900 text-sm">تغيير كلمة المرور</h3>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} minLength={6} required dir="ltr" placeholder="كلمة مرور جديدة (6 أحرف فأكثر)" className={input} />
        {pwMsg && <p className={`text-xs font-bold ${pwMsg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{pwMsg.text}</p>}
        <button type="submit" className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer">تغيير</button>
      </form>

      <button onClick={onSignOut} className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer">
        <LogOut className="w-4 h-4" /> تسجيل الخروج
      </button>
      <p className="text-[11px] text-slate-400 text-center">لطلب حذف حسابك نهائياً تواصل مع إدارة المنصة.</p>
    </div>
  );
};
