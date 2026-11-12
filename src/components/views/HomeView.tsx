import React from 'react';
import { 
  Sparkles, 
  Flame, 
  Award, 
  BookOpen, 
  Video, 
  CheckCircle2, 
  Clock, 
  Users, 
  ArrowRight,
  TrendingUp,
  Radio,
  FileCheck
} from 'lucide-react';
import { AppRole, Assignment, ClassItem, LiveSession, Post, Profile, Quiz } from '../../types';

interface HomeViewProps {
  currentProfile: Profile;
  classes: ClassItem[];
  assignments: Assignment[];
  quizzes: Quiz[];
  liveSessions: LiveSession[];
  posts: Post[];
  onNavigate: (section: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  currentProfile,
  classes,
  assignments,
  quizzes,
  liveSessions,
  posts,
  onNavigate,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[#0f233a] via-[#164673] to-[#1677c7] text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-bold text-sky-200">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>مرحباً بعودتك، {currentProfile.display_name}! 👋</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black leading-tight">
            مساحتك الذكية <span className="text-sky-300">للتعلم، التعاون، والتفوق</span>
          </h2>

          <p className="text-xs sm:text-sm text-sky-100 leading-relaxed">
            لديك اليوم <strong>{liveSessions.length} حصة مباشرة</strong> و <strong>{assignments.length} مهام دراسية</strong>. تابع إنجازك الأسبوعي وحقق أهدافك الأكاديمية!
          </p>

          <div className="pt-2 flex flex-wrap gap-2.5">
            <button
              onClick={() => onNavigate('live')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition-transform hover:scale-105 cursor-pointer shadow-md shadow-emerald-900/20"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>دخول الحصة المباشرة والسبورة</span>
            </button>

            <button
              onClick={() => onNavigate('courses')}
              className="px-4 py-2 bg-white text-[#0f233a] hover:bg-sky-50 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              خوض اختبار قياس المستوى
            </button>
          </div>
        </div>

        {/* Student Gamification Card on Right */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl text-white space-y-3 min-w-[240px]">
          <span className="text-xs font-bold text-sky-200 block">مستوى الإنجاز الأكاديمي:</span>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" />
              <span className="text-xs font-bold">الحماس اليومي:</span>
            </div>
            <span className="font-black text-sm text-orange-300">{currentProfile.streakDays} يوماً متتالياً 🔥</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold">نقاط الخبرة:</span>
            </div>
            <span className="font-black text-sm text-amber-300">{currentProfile.points} XP 🏆</span>
          </div>

          <div className="pt-2 border-t border-white/10">
            <span className="text-[11px] text-sky-200">الدور الحالي: {currentProfile.role === 'teacher' ? 'أستاذ معتمد' : currentProfile.role === 'admin' ? 'مدير المنصة' : 'طالب متميز'}</span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div 
          onClick={() => onNavigate('classes')}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs hover:border-[#1677c7] transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold">الصفوف والمجموعات</span>
            <BookOpen className="w-4 h-4 text-[#1677c7]" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 block">{classes.length}</span>
          <span className="text-[10px] text-slate-400">انضمام ومشاركة</span>
        </div>

        <div 
          onClick={() => onNavigate('courses')}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs hover:border-[#1677c7] transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold">الاختبارات الذكية</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-emerald-600 block">{quizzes.length}</span>
          <span className="text-[10px] text-emerald-600 font-bold">تصحيح فوري متاح</span>
        </div>

        <div 
          onClick={() => onNavigate('assignments')}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs hover:border-[#1677c7] transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold">الواجبات والتسليمات</span>
            <FileCheck className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-amber-600 block">{assignments.length}</span>
          <span className="text-[10px] text-slate-400">مهام دراسية</span>
        </div>

        <div 
          onClick={() => onNavigate('community')}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs hover:border-[#1677c7] transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold">المجتمع والقصص</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-purple-600 block">{posts.length}</span>
          <span className="text-[10px] text-purple-600 font-bold">تفاعل لحظي</span>
        </div>
      </div>

      {/* Two Column Layout: Upcoming Live & Quizzes vs Community highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Live Classes & Assignments */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
              <span>الحصص المباشرة القادمة اليوم</span>
            </h3>
            <button
              onClick={() => onNavigate('live')}
              className="text-xs text-[#1677c7] font-bold hover:underline cursor-pointer"
            >
              عرض قاعات البث ←
            </button>
          </div>

          <div className="space-y-3">
            {liveSessions.map(ls => (
              <div 
                key={ls.id} 
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                      بث مباشر تفاعلي
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(ls.starts_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{ls.title}</h4>
                  <span className="text-xs text-slate-500 block">المقدم: {ls.host_name}</span>
                </div>

                <button
                  onClick={() => onNavigate('live')}
                  className="px-4 py-2 bg-[#1677c7] hover:bg-[#125fa0] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer self-end sm:self-center"
                >
                  دخول القاعة والسبورة
                </button>
              </div>
            ))}
          </div>

          {/* Quick Quiz Card */}
          <div className="p-5 bg-gradient-to-r from-emerald-500 to-teal-700 text-white rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider block">
                تحدي اليوم السريع 🎯
              </span>
              <h4 className="text-base font-black">اختبار قياس المستوى في الرياضيات والجبر</h4>
              <p className="text-xs text-emerald-100">3 أسئلة سريعة · 10 دقائق · شهادة إتمام فورية</p>
            </div>
            <button
              onClick={() => onNavigate('courses')}
              className="px-4 py-2 bg-white text-emerald-900 font-black rounded-xl text-xs shadow-md cursor-pointer hover:bg-emerald-50 transition-colors"
            >
              ابدأ الاختبار
            </button>
          </div>
        </div>

        {/* Right Col: Community Stream Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1677c7]" />
              <span>نبض المجتمع التعليمي</span>
            </h3>
            <button
              onClick={() => onNavigate('community')}
              className="text-xs text-[#1677c7] font-bold hover:underline cursor-pointer"
            >
              فتح المجتمع ←
            </button>
          </div>

          <div className="space-y-3">
            {posts.slice(0, 3).map(p => (
              <div key={p.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-sky-100 text-[#1677c7] flex items-center justify-center font-bold text-xs">
                      {p.author_name.slice(0, 1)}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">{p.author_name}</span>
                      <span className="text-[10px] text-slate-400">
                        {p.author_role === 'teacher' ? 'معلم' : p.author_role === 'admin' ? 'مؤسس' : 'طالب'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">اليوم</span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                  {p.body}
                </p>

                <div className="pt-1 flex items-center gap-3 text-[11px] text-slate-500">
                  <span>♡ {p.likes_count} إعجاب</span>
                  <span>💬 {p.comments_count} ردود</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
