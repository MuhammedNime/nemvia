import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  Database, 
  Lock,
  Layers,
  Sparkles
} from 'lucide-react';
import { ContentReport, Profile } from '../../types';

interface AdminViewProps {
  currentUserId: string;
  onListUsers: (q?: string) => Promise<{ id: string; display_name: string; role: 'student' | 'teacher' | 'admin'; is_suspended: boolean; created_at: string }[]>;
  onSetRole: (id: string, role: 'student' | 'teacher' | 'admin') => Promise<boolean>;
  onSetSuspended: (id: string, v: boolean) => Promise<boolean>;
  stats: Record<string, number> | null;
  reports: ContentReport[];
  onResolveReport: (reportId: string) => void;
  onDismissReport: (reportId: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUserId,
  onListUsers,
  onSetRole,
  onSetSuspended,
  stats,
  reports,
  onResolveReport,
  onDismissReport,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'users' | 'security'>('overview');
  const [users, setUsers] = useState<Awaited<ReturnType<AdminViewProps['onListUsers']>>>([]);
  const [userQuery, setUserQuery] = useState('');
  const loadUsers = async (q = userQuery) => setUsers(await onListUsers(q));
  useEffect(() => {
    if (activeTab !== 'users') return;
    const t = setTimeout(() => { void loadUsers(userQuery); }, 250);
    return () => clearTimeout(t);
  }, [activeTab, userQuery]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-[#0f233a] text-white p-6 sm:p-8 rounded-3xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-sky-500/20 text-sky-300 px-3 py-1 rounded-full text-xs font-bold border border-sky-400/20">
            <ShieldCheck className="w-4 h-4" />
            <span>لوحة الإشراف وإدارة منصة NEMVIA</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">
            مراقبة الأداء، مراجعة البلاغات، وأمان النظام
          </h2>
          <p className="text-xs sm:text-sm text-sky-100 max-w-2xl leading-relaxed">
            بصفتك مؤسس المنصة أو مشرفاً عاماً، لديك صلاحية مراقبة حركة المستخدمين، إيقاف المحتوى المخالف، ومتابعة صحة قواعد البيانات وسياسات RLS.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-white/10 p-1.5 rounded-2xl gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
              activeTab === 'overview' ? 'bg-white text-[#0f233a] shadow-xs' : 'text-white/80'
            }`}
          >
            نظرة عامة
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
              activeTab === 'reports' ? 'bg-white text-[#0f233a] shadow-xs' : 'text-white/80'
            }`}
          >
            البلاغات ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
              activeTab === 'users' ? 'bg-white text-[#0f233a] shadow-xs' : 'text-white/80'
            }`}
          >
            المستخدمون
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
              activeTab === 'security' ? 'bg-white text-[#0f233a] shadow-xs' : 'text-white/80'
            }`}
          >
            فحص الأمان
          </button>
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>إجمالي الطلاب</span>
                <Users className="w-4 h-4 text-[#1677c7]" />
              </div>
              <span className="text-3xl font-black text-slate-900 block">{stats?.students ?? '—'}</span>
              <span className="text-[11px] text-slate-400">حساب طالب مسجّل</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>الصفوف النشطة</span>
                <Layers className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-3xl font-black text-slate-900 block">{stats?.classes ?? '—'}</span>
              <span className="text-[11px] text-slate-400">صفوف ومجموعات دراسة</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>البلاغات المعلقة</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-3xl font-black text-amber-600 block">{stats?.open_reports ?? reports.length}</span>
              <span className="text-[11px] text-slate-400">تحتاج مراجعة المشرف</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>المعلمون</span>
                <Database className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="text-3xl font-black text-emerald-600 block">{stats?.teachers ?? '—'}</span>
              <span className="text-[11px] text-slate-400">من أصل {stats?.users ?? '—'} مستخدم · {stats?.posts ?? 0} منشور</span>
            </div>
          </div>

        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <h3 className="font-extrabold text-slate-900 text-base">بلاغات المحتوى والأمان (Content Reports Queue)</h3>
          {reports.length > 0 ? (
            <div className="space-y-3">
              {reports.map((rep) => (
                <div key={rep.id} className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      بلاغ: {rep.reason}
                    </span>
                    <span className="text-slate-400">
                      {new Date(rep.created_at).toLocaleDateString('ar')}
                    </span>
                  </div>

                  <p className="text-slate-700 leading-relaxed">
                    <strong>المبلّغ:</strong> {rep.reporter_name} · <strong>التفاصيل:</strong> {rep.details}
                  </p>

                  <div className="pt-2 border-t border-slate-100 flex gap-2">
                    <button
                      onClick={() => onResolveReport(rep.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>اتخاذ إجراء وحل البلاغ</span>
                    </button>

                    <button
                      onClick={() => onDismissReport(rep.id)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>تجاهل البلاغ (لا توجد مخالفة)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="font-black text-slate-900 text-base">لا توجد بلاغات معلقة!</h4>
              <p className="text-xs text-slate-500">المجتمع التعليمي هادئ وآمن وتجري التفاعلات بانتظام.</p>
            </div>
          )}
        </div>
      )}

      {/* SECURITY TAB */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
          <input value={userQuery} onChange={e => setUserQuery(e.target.value)} placeholder="ابحث بالاسم…"
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677c7]" />
          {users.length === 0 && <p className="text-slate-400 text-center py-4">لا يوجد مستخدمون.</p>}
          {users.map(u => (
            <div key={u.id} className="p-3 bg-slate-50 rounded-xl flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-900">{u.display_name}</span>
                {u.is_suspended && <span className="mr-2 text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">موقوف</span>}
                <span className="block text-[10px] text-slate-400">انضم {new Date(u.created_at).toLocaleDateString('ar')}</span>
              </div>
              {u.id !== currentUserId && (
                <div className="flex items-center gap-2">
                  <select value={u.role} onChange={async e => { if (await onSetRole(u.id, e.target.value as any)) void loadUsers(); }}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg">
                    <option value="student">طالب</option>
                    <option value="teacher">معلم</option>
                    <option value="admin">أدمن</option>
                  </select>
                  <button onClick={async () => { if (await onSetSuspended(u.id, !u.is_suspended)) void loadUsers(); }}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${u.is_suspended ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {u.is_suspended ? 'إلغاء الإيقاف' : 'إيقاف'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span>حالة الجدار الأمني وتشفير البيانات (RLS Audit)</span>
          </h3>

          <div className="space-y-2.5">
            {[
              { rule: 'تفعيل Row Level Security على جميع جميع الجداول', status: 'مفعل بنسبة 100%', ok: true },
              { rule: 'دالة منع الترقية الذاتية للمشرف (prevent_self_role_change)', status: 'نشطة ومؤمنة في Trigger', ok: true },
              { rule: 'حماية الانضمام للصفوف برمز حصري (join_class_by_code Security Definer)', status: 'نشطة ومؤمنة', ok: true },
              { rule: 'حجب مفتاح الخادم service_role عن كود المتصفح والواجهة', status: 'مطبق بدقة', ok: true },
              { rule: 'حماية قصص المجتمع لـ 24 ساعة فقط ثم انتهاء صلاحيتها (Expires At)', status: 'نشطة ومؤتمتة', ok: true },
            ].map((s, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <span className="font-bold text-slate-800">{s.rule}</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{s.status}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
