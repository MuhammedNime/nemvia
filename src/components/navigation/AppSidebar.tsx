import React from 'react';
import { 
  Home, 
  BookOpen, 
  Award, 
  FileCheck, 
  Users, 
  Video, 
  MessageSquare, 
  ShieldCheck, 
  Code2, 
  LogOut,
  Flame,
  Radio,
  Sparkles,
  Layers,
  Clock,
  Activity,
  Zap,
  UserCircle,
  Scale
} from 'lucide-react';
import { AppRole, Profile } from '../../types';

interface AppSidebarProps {
  activeSection: string;
  onSelectSection: (section: string) => void;
  currentRole: AppRole;
  currentProfile: Profile;
  unreadMessagesCount: number;
  pendingAssignmentsCount: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  highlight?: boolean;
  badge?: number;
  pulse?: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeSection,
  onSelectSection,
  currentRole,
  currentProfile,
  unreadMessagesCount,
  pendingAssignmentsCount,
}) => {
  const navItems: NavItem[] = [
    { id: 'home', label: 'الرئيسية والمتابعة', icon: Home },
    { id: 'classes', label: 'الصفوف والمجموعات', icon: BookOpen },
    { id: 'courses', label: 'المحتوى والاختبارات', icon: Award },
    { id: 'flashcards', label: 'بطاقات المراجعة (Flashcards) 🧠', icon: Layers },
    { id: 'pomodoro', label: 'غرفة التركيز بومودورو ⏱️', icon: Clock },
    { id: 'grapher', label: 'محاكي الدوال والمختبر 📐', icon: Activity },
    { id: 'certificate', label: 'شهادة الإنجاز 🎓', icon: Award },
    { id: 'badges', label: 'لوحة الشرف والأوسمة 🏆', icon: Zap },
    { id: 'assignments', label: 'الواجبات والتسليمات', icon: FileCheck, badge: pendingAssignmentsCount },
    { id: 'community', label: 'المجتمع والقصص 24h', icon: Users },
    { id: 'live', label: 'القاعة والسبورة الحية', icon: Radio, pulse: true },
    { id: 'messages', label: 'المجموعات وخزينة الملفات', icon: MessageSquare, badge: unreadMessagesCount },
    ...(currentRole === 'admin' ? [{ id: 'admin', label: 'لوحة الإدارة والأمان', icon: ShieldCheck }] : []),
    { id: 'profile', label: 'ملفي الشخصي', icon: UserCircle },
    { id: 'legal', label: 'الخصوصية والشروط', icon: Scale },
  ];

  return (
    <aside className="w-full md:w-64 bg-white border-l border-slate-200 p-4 flex flex-col justify-between shrink-0 min-h-screen">
      <div className="space-y-6">
        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1677c7] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${item.pulse && !isActive ? 'text-rose-500 animate-pulse' : ''}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {item.badge}
                  </span>
                )}

                {item.highlight && !isActive && (
                  <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.2 rounded">
                    جديد
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Info Card Bottom */}
      <div className="pt-4 border-t border-slate-200 mt-6 space-y-3">
        <button onClick={() => onSelectSection('profile')} className="w-full text-right flex items-center gap-3 p-2 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200/80 cursor-pointer">
          {currentProfile.avatar_url ? (
            <img src={currentProfile.avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-[#1677c7] flex items-center justify-center font-bold text-sm">
              {currentProfile.display_name.slice(0, 1)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span className="font-bold text-xs text-slate-900 block truncate">
              {currentProfile.display_name}
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              {currentRole === 'teacher' ? 'معلم معتمد' : currentRole === 'admin' ? 'مؤسس المنصة' : 'طالب في NEMVIA'}
            </span>
          </div>
        </button>

        <div className="text-center text-[10px] text-slate-400">
          NEMVIA EDU PLATFORM · V1.1
        </div>
      </div>
    </aside>
  );
};
