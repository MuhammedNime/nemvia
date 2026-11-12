import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Flame, 
  Award, 
  User, 
  ShieldCheck, 
  Database, 
  Sparkles, 
  LogOut,
  Lock,
  KeyRound,
  Code2
} from 'lucide-react';
import { AppRole, NotificationItem, Profile } from '../../types';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface AppHeaderProps {
  currentProfile: Profile;
  currentRole: AppRole;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onSignOut: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentProfile,
  currentRole,
  notifications,
  onMarkNotificationRead,
  onSignOut,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;


  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* Top bar */}
      <div className="bg-[#0f233a] text-white px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold">NEMVIA · المنصة التعليمية والمجتمع الأكاديمي</span>
          </div>
          <PWAInstallButton />
        </div>
      </div>

      {/* Main Navigation Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0f233a] to-[#1677c7] text-white flex items-center justify-center font-black text-xl shadow-md shadow-sky-950/10">
            N
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg text-slate-900 tracking-wide">NEMVIA</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-sky-100 text-[#1677c7]">
                نسخة رسمية
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              تعلّم، شارك، وحقّق إنجازك · مجتمع تعليمي رقمي
            </p>
          </div>
        </div>

        {/* Right Section: Real Profile & Notifications */}
        <div className="flex items-center gap-3">
          {/* User Points & Streak */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-1 px-2 py-1 text-orange-600 font-bold">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>{currentProfile.streakDays} أيام</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1 px-2 py-1 text-amber-600 font-bold">
              <Award className="w-4 h-4 text-amber-500" />
              <span>{currentProfile.points} XP</span>
            </div>
          </div>

          {/* User Account Capsule */}
          <div className="flex items-center gap-2 bg-slate-100/90 py-1.5 px-3 rounded-2xl border border-slate-200 text-xs">
            <div className="w-6 h-6 rounded-lg bg-[#1677c7] text-white flex items-center justify-center font-bold text-xs">
              {currentProfile.display_name.slice(0, 1)}
            </div>
            <div className="text-right">
              <span className="font-bold text-slate-900 block leading-tight">
                {currentProfile.display_name}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {currentRole === 'teacher' ? 'معلم معتمد' : currentRole === 'admin' ? 'مؤسس المنصة' : 'طالب'}
              </span>
            </div>

            {/* Switch Account / Sign out */}
            <button
              onClick={onSignOut}
              title="تسجيل الخروج"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer mr-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Notifications Button */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors relative cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute left-0 sm:right-auto sm:left-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 space-y-3 z-50 animate-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-xs text-slate-900">الإشعارات والتنبيهات ({notifications.length})</span>
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    إغلاق
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {notifications.length === 0 && <p className="text-[11px] text-slate-400 text-center py-4">لا توجد إشعارات بعد</p>}
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => onMarkNotificationRead(n.id)}
                      className={`p-2.5 rounded-xl text-xs transition-colors cursor-pointer border ${
                        n.read ? 'bg-slate-50 border-slate-100 text-slate-600' : 'bg-sky-50/70 border-sky-100 text-slate-800 font-bold'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-[#1677c7] font-bold">{n.title}</span>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#1677c7]" />}
                      </div>
                      <p className="text-[11px] font-normal leading-relaxed">{n.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
