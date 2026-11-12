import React, { useState } from 'react';
import { 
  BookOpen, 
  Users, 
  Plus, 
  Share2, 
  Copy, 
  Check, 
  GraduationCap, 
  X,
  Search,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { AppRole, ClassItem, ClassMemberInfo } from '../../types';

interface ClassesViewProps {
  currentRole: AppRole;
  currentUserId: string;
  currentUserName: string;
  classes: ClassItem[];
  onAddClass: (cls: ClassItem) => void;
  onJoinClass: (joinCode: string) => Promise<boolean>;
  members: ClassMemberInfo[];
  onLeaveClass: (classId: string) => void;
  onDeleteClass: (classId: string) => void;
  onArchiveClass: (classId: string, archived: boolean) => void;
  onRemoveMember: (classId: string, userId: string) => void;
}

export const ClassesView: React.FC<ClassesViewProps> = ({
  currentRole,
  currentUserId,
  currentUserName,
  classes,
  onAddClass,
  onJoinClass,
  members,
  onLeaveClass,
  onDeleteClass,
  onArchiveClass,
  onRemoveMember,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'class' | 'study'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create Class Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newGrade, setNewGrade] = useState('الصف التاسع');
  const [newType, setNewType] = useState<'class' | 'study'>('study');
  const [newDescription, setNewDescription] = useState('');
  const [newTheme, setNewTheme] = useState('from-blue-600 to-indigo-700');

  // Join Code Modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinResult, setJoinResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Copy Code Feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Class Detail Modal
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  const filteredClasses = classes.filter(c => {
    const matchesFilter = filterType === 'all' || c.class_type === filterType;
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const randomCode = 'NEM' + Math.floor(1000 + Math.random() * 9000);
    const newClass: ClassItem = {
      id: `cls-${Date.now()}`,
      teacher_id: currentUserId,
      teacher_name: currentUserName,
      title: newTitle.trim(),
      subject: newSubject.trim() || 'عام',
      grade_level: newGrade,
      join_code: randomCode,
      description: newDescription.trim() || 'مساحة دراسية تفاعلية مخصصة للنقاش وحل الواجبات والمذاكرة الجماعية.',
      class_type: newType,
      is_archived: false,
      members_count: 1,
      colorTheme: newTheme,
      created_at: new Date().toISOString(),
    };
    onAddClass(newClass);
    setShowCreateModal(false);
    setNewTitle('');
    setNewSubject('');
    setNewDescription('');
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    const ok = await onJoinClass(joinCode.trim().toUpperCase());
    if (ok) {
      setJoinResult({ success: true, msg: 'تم الانضمام للصف بنجاح!' });
      setTimeout(() => {
        setJoinResult(null);
        setShowJoinModal(false);
        setJoinCode('');
      }, 1500);
    } else {
      setJoinResult({ success: false, msg: 'رمز الانضمام غير صحيح، يرجى التأكد منه.' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">الصفوف ومجموعات الدراسة الأكاديمية</h2>
          <p className="text-xs text-slate-500">
            انضم لمساحات التعلم المنظمة، شارك في مجموعات الدراسة التعاونية، وتابع واجباتك
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-[#1677c7] font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>الانضمام برمز الدعوة</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#1677c7] hover:bg-[#125fa0] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء صف / مجموعة جديدة</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              filterType === 'all' ? 'bg-white text-[#1677c7] shadow-xs' : 'text-slate-600'
            }`}
          >
            الكل ({classes.length})
          </button>
          <button
            onClick={() => setFilterType('class')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              filterType === 'class' ? 'bg-white text-[#1677c7] shadow-xs' : 'text-slate-600'
            }`}
          >
            صفوف تعليمية رسمية
          </button>
          <button
            onClick={() => setFilterType('study')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              filterType === 'study' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            مجموعات دراسة تعاونية
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث عن صف أو مادة..."
            className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677c7] text-xs"
          />
        </div>
      </div>

      {/* Classes Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClasses.map((cls) => (
          <div
            key={cls.id}
            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:border-[#1677c7] transition-all flex flex-col justify-between"
          >
            {/* Header with color gradient */}
            <div className={`p-5 bg-gradient-to-r ${cls.colorTheme} text-white space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                  {cls.class_type === 'study' ? 'مجموعة دراسة طلابية' : 'صف تعليمي رسمي'}
                </span>
                <span className="text-[11px] text-white/80 font-mono">{cls.grade_level}</span>
              </div>
              <h3 className="font-extrabold text-base leading-snug line-clamp-1">{cls.title}</h3>
              <span className="text-xs text-white/80 block">المادة: {cls.subject}</span>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between text-xs">
              <p className="text-slate-600 leading-relaxed line-clamp-2">
                {cls.description}
              </p>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-slate-500">
                  <span>الأستاذ/المشرف:</span>
                  <span className="font-bold text-slate-800">{cls.teacher_name}</span>
                </div>

                <div className="flex items-center justify-between text-slate-500">
                  <span>الطلاب المسجلون:</span>
                  <span className="font-bold text-[#1677c7]">{cls.members_count} طالباً</span>
                </div>

                {/* Join Code Box */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">رمز الانضمام:</span>
                    <span className="font-mono font-black text-slate-900 text-sm tracking-wider">
                      {cls.join_code}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCopyCode(cls.join_code)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-[#1677c7] font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedCode === cls.join_code ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>نسخ الرمز</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => setSelectedClass(cls)}
                  className="w-full py-2 bg-slate-100 hover:bg-[#1677c7] hover:text-white text-slate-700 font-bold rounded-xl transition-all cursor-pointer text-center block"
                >
                  دخول الصف واستعراض المحتوى ←
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE CLASS MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-[#0f233a] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-base">إنشاء صف أو مجموعة دراسة جديدة</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-white/70 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الصف أو المجموعة:</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="مثال: مراجعة الفيزياء للشهادة الثانوية"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677c7]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع المساحة:</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="study">مجموعة دراسة تعاونية</option>
                    <option value="class">صف تعليمي رسمي</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المادة الدراسية:</label>
                  <input
                    type="text"
                    value={newSubject}
                    onChange={e => setNewSubject(e.target.value)}
                    placeholder="الرياضيات، برمجة، لغات..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المرحلة / الصف:</label>
                <input
                  type="text"
                  value={newGrade}
                  onChange={e => setNewGrade(e.target.value)}
                  placeholder="الصف التاسع، العاشر، جامعي..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الوصف وأهداف المساحة:</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="اكتب أهداف المجموعة، مواعيد المذاكرة، أو تعليمات الطلاب..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none min-h-[70px]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#1677c7] text-white font-bold rounded-xl cursor-pointer"
                >
                  إنشاء المساحة وتوليد رمز الانضمام
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN CLASS MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-[#1677c7] text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                <span>الانضمام برمز الصف (Join Code)</span>
              </h3>
              <button onClick={() => setShowJoinModal(false)} className="text-white/70 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleJoinSubmit} className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                أدخل رمز الدعوة المكون من 6 إلى 8 أحرف المخصص للصف الدراسي.
              </p>

              <div>
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="مثال: MATH9X أو CODE2026"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center text-lg font-black tracking-widest uppercase outline-none focus:border-[#1677c7]"
                  required
                />
              </div>

              {joinResult && (
                <div className={`p-3 rounded-xl border text-xs font-bold ${
                  joinResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {joinResult.msg}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#1677c7] text-white font-bold rounded-xl cursor-pointer"
                >
                  انضمام الآن
                </button>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLASS DETAILS DRAWER / MODAL */}
      {selectedClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className={`p-6 bg-gradient-to-r ${selectedClass.colorTheme} text-white space-y-2 relative`}>
              <button
                onClick={() => setSelectedClass(null)}
                className="absolute top-4 left-4 p-1 rounded-full bg-black/20 text-white hover:bg-black/40 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full inline-block">
                {selectedClass.grade_level} · {selectedClass.subject}
              </span>
              <h3 className="text-xl font-black">{selectedClass.title}</h3>
              <p className="text-xs text-white/90 leading-relaxed">{selectedClass.description}</p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3 text-slate-700">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold">المعلم / المشرف</span>
                  <span className="font-bold text-sm text-slate-900">{selectedClass.teacher_name}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold">عدد الطلاب المسجلين</span>
                  <span className="font-bold text-sm text-[#1677c7]">{selectedClass.members_count} طالباً</span>
                </div>
              </div>

              <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block">رمز مشاركة الصف:</span>
                  <span className="font-mono font-black text-base text-[#0f233a]">{selectedClass.join_code}</span>
                </div>
                <button
                  onClick={() => handleCopyCode(selectedClass.join_code)}
                  className="px-3 py-1.5 bg-[#1677c7] text-white font-bold rounded-lg cursor-pointer text-xs"
                >
                  نسخ الرمز
                </button>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-800 block">معلومات الصف:</span>
                <div className="space-y-1.5">
                  <div className="p-2 bg-slate-50 rounded-lg flex items-center justify-between text-slate-700">
                    <span>المنشئ / المعلم</span>
                    <span className="font-bold">{selectedClass.teacher_name}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg flex items-center justify-between text-slate-700">
                    <span>عدد الأعضاء</span>
                    <span className="font-bold">{selectedClass.members_count}</span>
                  </div>
                  {selectedClass.is_archived && (
                    <div className="p-2 bg-amber-50 text-amber-800 rounded-lg font-bold">هذا الصف مؤرشف</div>
                  )}
                </div>
              </div>

              {selectedClass.teacher_id === currentUserId && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-800 block">الأعضاء:</span>
                  {members.filter(m => m.class_id === selectedClass.id && m.user_id !== currentUserId).length === 0 && (
                    <p className="text-slate-400">لم ينضم أحد بعد. شارك الرمز أعلاه.</p>
                  )}
                  {members.filter(m => m.class_id === selectedClass.id && m.user_id !== currentUserId).map(m => (
                    <div key={m.user_id} className="p-2 bg-slate-50 rounded-lg flex items-center justify-between">
                      <span className="font-bold text-slate-700">{m.name}</span>
                      <button
                        onClick={() => onRemoveMember(selectedClass.id, m.user_id)}
                        className="text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg font-bold cursor-pointer"
                      >
                        إزالة
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { onArchiveClass(selectedClass.id, !selectedClass.is_archived); setSelectedClass(null); }}
                      className="flex-1 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl cursor-pointer"
                    >
                      {selectedClass.is_archived ? 'إلغاء الأرشفة' : 'أرشفة الصف'}
                    </button>
                    <button
                      onClick={() => { onDeleteClass(selectedClass.id); setSelectedClass(null); }}
                      className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl cursor-pointer"
                    >
                      حذف الصف
                    </button>
                  </div>
                </div>
              )}
              {selectedClass.teacher_id !== currentUserId && (
                <button
                  onClick={() => { onLeaveClass(selectedClass.id); setSelectedClass(null); }}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl cursor-pointer"
                >
                  مغادرة الصف
                </button>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
              <button
                onClick={() => setSelectedClass(null)}
                className="w-full py-2 bg-[#0f233a] text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
