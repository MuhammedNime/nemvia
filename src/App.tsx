import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Home, BookOpen, Award, FileCheck, Users, Radio, MessageSquare, Loader2, CheckCircle2, AlertCircle, MoreHorizontal, X, ShieldAlert, Layers, UserCircle, Scale, ShieldCheck } from 'lucide-react';
import { AppHeader } from './components/navigation/AppHeader';
import { AppSidebar } from './components/navigation/AppSidebar';
import { HomeView } from './components/views/HomeView';
import { ClassesView } from './components/views/ClassesView';
import { CoursesView } from './components/views/CoursesView';
import { AssignmentsView } from './components/views/AssignmentsView';
import { CommunityView } from './components/views/CommunityView';
import { LiveClassroomView } from './components/views/LiveClassroomView';
import { MessagesView } from './components/views/MessagesView';
import { StudyToolsView } from './components/views/StudyToolsView';
import { AdminView } from './components/views/AdminView';
import { ProfileView } from './components/views/ProfileView';
import { LegalView } from './components/views/LegalView';
import { AuthScreen, NewPasswordScreen } from './components/auth/AuthScreen';
import { ReportModal, ReportTarget } from './components/ReportModal';
import { supabase } from './lib/supabase';
import * as api from './lib/api';
import { AppData } from './lib/api';
import {
  Profile, ClassItem, Lesson, Submission, Quiz, QuizAnswerValue, QuizQuestionGrade, Post, Story, DirectMessage,
} from './types';

const EMPTY: AppData = {
  classes: [], courses: [], lessons: [], quizzes: [], assignments: [], submissions: [], posts: [],
  stories: [], liveSessions: [], messages: [], notifications: [], reports: [], contacts: [], classMembers: [],
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [data, setData] = useState<AppData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const profileRef = useRef<Profile | null>(null);
  profileRef.current = profile;

  const notify = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ---------------- Auth session ---------------- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event: string, s: Session | null) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    const me = profileRef.current;
    if (!me) return;
    const fresh = await api.loadAll(me);
    setData(fresh);
  }, []);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) return;
    const p = await api.fetchOwnProfile(uid);
    if (p) setProfile(p);
  }, [session?.user.id]);

  // عند تغيّر المستخدم: حمّل الملف الشخصي ثم كل البيانات
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) {
      setProfile(null);
      setData(EMPTY);
      setProfileError(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      await api.touchStreak();
      const p = await api.fetchOwnProfile(uid);
      if (cancelled) return;
      if (!p) { setProfileError(true); setLoading(false); return; }
      profileRef.current = p;
      setProfile(p);
      setData(await api.loadAll(p));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session?.user.id]);

  // تحديث لحظي للرسائل والإشعارات
  useEffect(() => {
    if (!profile) return;
    let timer: number | undefined;
    const bump = () => { window.clearTimeout(timer); timer = window.setTimeout(() => refresh(), 400); };
    const ch = supabase.channel('nemvia-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, bump)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'class_messages' }, bump)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, bump)
      .subscribe();
    return () => { window.clearTimeout(timer); supabase.removeChannel(ch); };
  }, [profile?.id, refresh]);

  useEffect(() => {
    if (profile?.role === 'admin') api.adminStats().then(setStats);
  }, [profile?.id, profile?.role, data.reports.length]);

  /* ---------------- Action helper ---------------- */
  const run = useCallback(async (fn: () => Promise<unknown>, okMsg?: string): Promise<boolean> => {
    try {
      await fn();
      await refresh();
      if (okMsg) notify(okMsg);
      return true;
    } catch (e: any) {
      notify(e?.message || 'تعذّر تنفيذ العملية', false);
      return false;
    }
  }, [refresh, notify]);

  const uid = profile?.id || '';

  const upload = async (file: File, folder: string) => {
    try { return await api.uploadFile(uid, file, folder); }
    catch (e: any) { notify(e.message || 'فشل رفع الملف', false); throw e; }
  };

  /* ---------------- Handlers passed to views ---------------- */
  const handleAddClass = (c: ClassItem) => { void run(() => api.createClass(uid, c), 'تم إنشاء المساحة بنجاح'); };
  const handleJoinClass = async (code: string) => {
    const ok = await api.joinClass(code);
    if (ok) await refresh();
    return ok;
  };
  const handleAddLesson = (l: Lesson) => { void run(() => api.createLesson(uid, l), 'تم نشر الدرس'); };
  const handleAddQuiz = (q: Quiz) => { void run(() => api.createQuiz(q), q.isPublished ? 'تم نشر الاختبار' : 'تم حفظ الاختبار كمسودة'); };
  const handleSubmitQuiz = async (quizId: string, answers: Record<string, QuizAnswerValue>) => {
    try {
      const res = await api.submitQuiz(quizId, answers);
      void refresh();
      return res;
    } catch (e: any) {
      notify(e.message || 'تعذّر إرسال الاختبار', false);
      throw e;
    }
  };
  const handleGradeQuizAttempt = (attemptId: string, grades: Record<string, QuizQuestionGrade>, feedback: string) =>
    run(() => api.gradeQuizAttempt(attemptId, grades, feedback), 'تم حفظ تصحيح الاختبار');
  const handleRewardPoints = async (points: number) => {
    const total = await api.awardPoints(points);
    if (total !== null) setProfile(p => (p ? { ...p, points: total } : p));
  };
  const handleCreateAssignment = (a: Parameters<typeof api.createAssignment>[1]) =>
    run(() => api.createAssignment(uid, a), 'تم نشر الواجب');
  const handleSubmitAssignment = (s: Submission) => { void run(() => api.submitAssignment(uid, s), 'تم تسليم الواجب'); };
  const handleGradeSubmission = (id: string, grade: number, feedback: string) => {
    void run(() => api.gradeSubmission(id, grade, feedback), 'تم رصد الدرجة');
  };
  const handleAddPost = (p: Post) => { void run(() => api.createPost(uid, p), 'تم نشر المنشور'); };
  const handleAddStory = (s: Story) => { void run(() => api.createStory(uid, s), 'تم نشر القصة'); };
  const handleToggleLike = (postId: string) => {
    const post = data.posts.find(p => p.id === postId);
    if (!post) return;
    // تحديث فوري للواجهة ثم مزامنة
    setData(d => ({
      ...d,
      posts: d.posts.map(p => p.id === postId
        ? { ...p, is_liked: !p.is_liked, likes_count: p.likes_count + (p.is_liked ? -1 : 1) } : p),
    }));
    api.setLike(uid, postId, !post.is_liked).catch(e => { notify(e.message, false); void refresh(); });
  };
  const handleAddComment = (postId: string, c: { body: string }) => { void run(() => api.addComment(uid, postId, c.body)); };
  const handleDeletePost = (id: string) => { void run(() => api.deletePost(id), 'تم حذف المنشور'); };
  const handleScheduleLive = (l: Parameters<typeof api.createLive>[1]) =>
    run(() => api.createLive(uid, l), 'تمت جدولة الحصة');
  const handleLiveStatus = (id: string, status: 'live' | 'ended' | 'cancelled') =>
    run(() => api.setLiveStatus(id, status));
  const handleSendMessage = (m: DirectMessage) => { void run(() => api.sendMessage(uid, m)); };
  const handleMarkNotificationRead = (id: string) => {
    setData(d => ({ ...d, notifications: d.notifications.map(n => (n.id === id ? { ...n, read: true } : n)) }));
    void api.markNotificationRead(id);
  };
  const handleResolveReport = (id: string) => { void run(() => api.setReportStatus(id, 'resolved'), 'تمت معالجة البلاغ'); };
  const handleDismissReport = (id: string) => { void run(() => api.setReportStatus(id, 'dismissed'), 'تم تجاهل البلاغ'); };
  const handleCreateReport = async (r: { reason: string; details: string }) => {
    if (!reportTarget) return;
    const ok = await run(() => api.createReport(uid, {
      target_type: reportTarget.type === 'user' ? 'profile' : reportTarget.type,
      target_id: reportTarget.id, reason: r.reason, details: r.details, snapshot: reportTarget.snapshot,
    }), 'شكراً لك، تم إرسال البلاغ للإدارة');
    if (ok) setReportTarget(null);
  };
  const handleSaveProfile = (patch: { display_name: string; bio: string; visibility: 'public' | 'private'; avatar_url?: string }) =>
    run(async () => { await api.updateProfile(uid, patch); await refreshProfile(); }, 'تم حفظ ملفك الشخصي');
  const handleDelete = (table: 'lessons' | 'quizzes' | 'assignments' | 'classes' | 'live_sessions', label: string) =>
    (id: string) => { if (confirm(`حذف ${label} نهائياً؟`)) void run(() => api.deleteRow(table, id), `تم حذف ${label}`); };
  const handleLeaveClass = (classId: string) => {
    if (confirm('هل تريد مغادرة هذا الصف؟')) void run(() => api.leaveClass(uid, classId), 'تمت مغادرة الصف');
  };
  const handleRemoveMember = (classId: string, userId: string) => {
    if (confirm('إزالة هذا العضو من الصف؟')) void run(() => api.removeMember(classId, userId), 'تمت إزالة العضو');
  };
  const handleArchiveClass = (classId: string, archived: boolean) => { void run(() => api.archiveClass(classId, archived), archived ? 'تمت أرشفة الصف' : 'تم إلغاء الأرشفة'); };
  const handleMarkDmRead = (ids: string[]) => {
    if (!ids.length) return;
    setData(d => ({ ...d, messages: d.messages.map(m => (ids.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m)) }));
    void api.markDmRead(ids);
  };
  const handleSetRole = (id: string, role: 'student' | 'teacher' | 'admin') => run(() => api.setUserRole(id, role), 'تم تغيير الدور');
  const handleSetSuspended = (id: string, v: boolean) => run(() => api.setSuspended(id, v), v ? 'تم إيقاف الحساب' : 'تم إلغاء الإيقاف');
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setActiveSection('home');
  };

  /* ---------------- Gates ---------------- */
  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-[#1677c7]" /></div>;
  }
  if (session && recovery) return <NewPasswordScreen onDone={() => setRecovery(false)} />;
  if (!session) return <AuthScreen />;
  if (profileError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-slate-50" dir="rtl">
        <AlertCircle className="w-10 h-10 text-rose-500" />
        <p className="font-bold text-slate-800">تعذّر تحميل ملفك الشخصي. تأكد من تشغيل ملفات SQL في Supabase ثم أعد المحاولة.</p>
        <button onClick={handleSignOut} className="px-5 py-2.5 bg-[#1677c7] text-white rounded-xl font-bold text-sm cursor-pointer">تسجيل الخروج</button>
      </div>
    );
  }
  if (!profile || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-[#1677c7]" /></div>;
  }

  if (profile.is_suspended) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-slate-50" dir="rtl">
        <ShieldAlert className="w-12 h-12 text-rose-500" />
        <h2 className="text-lg font-black text-slate-900">تم إيقاف حسابك</h2>
        <p className="text-sm text-slate-600 max-w-sm">خالفت شروط الاستخدام أو صدر بحقك بلاغ. إن كنت تعتقد أن هذا خطأ تواصل مع إدارة المنصة.</p>
        <button onClick={handleSignOut} className="px-5 py-2.5 bg-[#1677c7] text-white rounded-xl font-bold text-sm cursor-pointer">تسجيل الخروج</button>
      </div>
    );
  }

  const role = profile.role;
  const section = activeSection === 'admin' && role !== 'admin' ? 'home' : activeSection;
  const unreadMessages = data.messages.filter(m => !m.channel_id && m.recipient_id === uid && !m.read_at).length;
  const myPending = role === 'student'
    ? data.assignments.filter(a => !data.submissions.some(s => s.assignment_id === a.id && s.student_id === uid)).length
    : 0;

  return (
    <div dir="rtl" className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-['Cairo',sans-serif] selection:bg-[#1677c7]/20 selection:text-[#0f233a]">
      <AppHeader
        currentProfile={profile}
        currentRole={role}
        notifications={data.notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <div className="hidden md:block">
          <AppSidebar
            activeSection={section}
            onSelectSection={setActiveSection}
            currentRole={role}
            currentProfile={profile}
            unreadMessagesCount={unreadMessages}
            pendingAssignmentsCount={myPending}
          />
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 pb-24 md:pb-8">
          {section === 'home' && (
            <HomeView currentProfile={profile} classes={data.classes} assignments={data.assignments}
              quizzes={data.quizzes} liveSessions={data.liveSessions} posts={data.posts} onNavigate={setActiveSection} />
          )}

          {section === 'classes' && (
            <ClassesView currentRole={role} currentUserId={uid} currentUserName={profile.display_name}
              classes={data.classes} members={data.classMembers} onAddClass={handleAddClass} onJoinClass={handleJoinClass}
              onLeaveClass={handleLeaveClass} onDeleteClass={handleDelete('classes', 'الصف')} onArchiveClass={handleArchiveClass}
              onRemoveMember={handleRemoveMember} />
          )}

          {section === 'courses' && (
            <CoursesView currentRole={role} currentUserId={uid} currentUserName={profile.display_name} courses={data.courses}
              lessons={data.lessons} quizzes={data.quizzes} classes={data.classes}
              onAddQuiz={handleAddQuiz} onAddLesson={handleAddLesson} onSubmitQuiz={handleSubmitQuiz}
              onGradeQuizAttempt={handleGradeQuizAttempt}
              onRewardPoints={handleRewardPoints} onUpload={upload}
              onDeleteLesson={handleDelete('lessons', 'الدرس')} onDeleteQuiz={handleDelete('quizzes', 'الاختبار')} />
          )}

          {['tools', 'flashcards', 'pomodoro', 'grapher', 'certificate', 'badges'].includes(section) && (
            <StudyToolsView currentProfile={profile} onRewardXP={handleRewardPoints}
              initialTab={section === 'tools' ? 'flashcards' : (section as any)} />
          )}

          {section === 'assignments' && (
            <AssignmentsView currentRole={role} currentUserId={uid} currentUserName={profile.display_name}
              assignments={data.assignments} submissions={data.submissions} classes={data.classes}
              onSubmitAssignment={handleSubmitAssignment} onGradeSubmission={handleGradeSubmission}
              onCreateAssignment={handleCreateAssignment} onUpload={upload} onDeleteAssignment={handleDelete('assignments', 'الواجب')} />
          )}

          {section === 'community' && (
            <CommunityView currentRole={role} currentUserId={uid} currentUserName={profile.display_name}
              posts={data.posts} stories={data.stories} onAddPost={handleAddPost} onAddStory={handleAddStory}
              onToggleLike={handleToggleLike} onAddComment={handleAddComment} onUpload={upload}
              onDeletePost={handleDeletePost}
              onReport={(t: ReportTarget) => setReportTarget(t)} />
          )}

          {section === 'live' && (
            <LiveClassroomView currentRole={role} currentUserId={uid} currentUserName={profile.display_name}
              sessions={data.liveSessions} classes={data.classes}
              onScheduleSession={handleScheduleLive} onSetStatus={handleLiveStatus} />
          )}

          {section === 'messages' && (
            <MessagesView currentUserId={uid} currentUserName={profile.display_name} currentRole={role}
              messages={data.messages} groups={data.classes} contacts={data.contacts}
              onSendMessage={handleSendMessage}
              onCreateGroup={(c: ClassItem) => handleAddClass(c)}
              onSearchContacts={(q: string) => api.searchContacts(uid, q)}
              onUpload={upload} onMarkRead={handleMarkDmRead}
              onReport={(t: ReportTarget) => setReportTarget(t)} />
          )}

          {section === 'admin' && role === 'admin' && (
            <AdminView stats={stats} reports={data.reports} currentUserId={uid} onResolveReport={handleResolveReport} onDismissReport={handleDismissReport}
              onListUsers={api.listUsers} onSetRole={handleSetRole} onSetSuspended={handleSetSuspended} />
          )}

          {section === 'profile' && (
            <ProfileView profile={profile} email={session.user.email || ''} classesCount={data.classes.length}
              onSave={handleSaveProfile} onUpload={upload} onSignOut={handleSignOut} />
          )}

          {section === 'legal' && <LegalView />}
        </main>
      </div>

      {/* Mobile bottom dock */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-2 flex justify-around items-center">
        {[
          { id: 'home', label: 'الرئيسية', icon: Home },
          { id: 'classes', label: 'الصفوف', icon: BookOpen },
          { id: 'assignments', label: 'الواجبات', icon: FileCheck },
          { id: 'community', label: 'المجتمع', icon: Users },
          { id: 'messages', label: 'الرسائل', icon: MessageSquare, badge: unreadMessages },
        ].map(item => {
          const Icon = item.icon;
          const isActive = section === item.id;
          return (
            <button key={item.id} onClick={() => setActiveSection(item.id)}
              className={`relative flex flex-col items-center gap-0.5 p-1 text-[10px] font-bold transition-all cursor-pointer ${isActive ? 'text-[#1677c7]' : 'text-slate-500'}`}>
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
              {!!item.badge && <span className="absolute -top-0.5 right-0 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center">{item.badge}</span>}
            </button>
          );
        })}
        <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 p-1 text-[10px] font-bold text-slate-500 cursor-pointer">
          <MoreHorizontal className="w-4 h-4" /><span>المزيد</span>
        </button>
      </div>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/50" onClick={() => setMoreOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 space-y-3" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-sm">المزيد</h3>
              <button onClick={() => setMoreOpen(false)} className="p-1 text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] font-bold">
              {[
                { id: 'courses', label: 'المحتوى والاختبارات', icon: Award },
                { id: 'live', label: 'الحصص المباشرة', icon: Radio },
                { id: 'tools', label: 'أدوات الدراسة', icon: Layers },
                { id: 'profile', label: 'ملفي الشخصي', icon: UserCircle },
                { id: 'legal', label: 'الخصوصية والشروط', icon: Scale },
                ...(role === 'admin' ? [{ id: 'admin', label: 'لوحة الإدارة', icon: ShieldCheck }] : []),
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.id} onClick={() => { setActiveSection(item.id); setMoreOpen(false); }}
                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex flex-col items-center gap-1.5 text-slate-700 cursor-pointer">
                    <Icon className="w-5 h-5 text-[#1677c7]" /><span className="text-center leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} onSubmit={handleCreateReport} />

      {toast && (
        <div className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 text-white ${toast.ok ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
