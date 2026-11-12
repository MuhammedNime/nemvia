import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Smile, 
  FileText, 
  Image as ImageIcon, 
  Download, 
  ExternalLink, 
  Users, 
  User, 
  FolderLock, 
  Sparkles, 
  Search, 
  Plus, 
  X, 
  Check, 
  Code2, 
  Filter,
  CheckCheck,
  ShieldCheck,
  Flag
} from 'lucide-react';
import { AppRole, ChatAttachment, DirectMessage, StudyGroup, ClassItem, ContactInfo } from '../../types';
import { UploadedFile } from '../../lib/api';
import type { ReportTarget } from '../ReportModal';

interface MessagesViewProps {
  currentUserId: string;
  currentUserName: string;
  currentRole: AppRole;
  messages: DirectMessage[];
  onSendMessage: (msg: DirectMessage) => void;
  groups: ClassItem[];
  contacts: ContactInfo[];
  onCreateGroup: (c: ClassItem) => void;
  onSearchContacts: (q: string) => Promise<ContactInfo[]>;
  onUpload: (f: File, folder: string) => Promise<UploadedFile>;
  onReport: (t: ReportTarget) => void;
  onMarkRead: (ids: string[]) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  currentUserId,
  currentUserName,
  currentRole,
  messages,
  onSendMessage,
  groups,
  contacts: contactProps,
  onCreateGroup,
  onSearchContacts,
  onUpload,
  onReport,
  onMarkRead,
}) => {
  const studyGroups: StudyGroup[] = groups.map(c => ({
    id: c.id,
    name: c.title,
    description: c.description || c.subject,
    category: c.class_type === 'study' ? 'مجموعات الدراسة' : 'الصفوف',
    avatar_icon: c.class_type === 'study' ? '📚' : '🎓',
    members_count: c.members_count,
    unread_count: 0,
  }));
  const [activeTargetId, setActiveTargetId] = useState<string>(groups[0]?.id || '');
  const [activeTargetType, setActiveTargetType] = useState<'group' | 'dm'>(groups.length ? 'group' : 'dm');
  const [contactQuery, setContactQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContactInfo[] | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Vault Panel Drawer state
  const [showFilesVault, setShowFilesVault] = useState<boolean>(false);
  const [vaultFilter, setVaultFilter] = useState<'all' | 'pdf' | 'image' | 'code'>('all');
  const [vaultSearch, setVaultSearch] = useState('');

  // Composer state
  const [inputText, setInputText] = useState('');
  const [pendingFile, setPendingFile] = useState<ChatAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // New Group Modal
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('📚');

  // Contacts for DMs (everyone is open to message; also include anyone who messaged me)
  const roleLabel = (r: AppRole) => (r === 'teacher' ? 'معلم' : r === 'admin' ? 'مؤسس المنصة' : 'طالب');
  const baseContacts: ContactInfo[] = [...contactProps];
  messages.forEach(m => {
    if (m.channel_id) return;
    const otherId = m.sender_id === currentUserId ? m.recipient_id : m.sender_id;
    const otherName = m.sender_id === currentUserId ? m.recipient_name : m.sender_name;
    const otherRole = m.sender_id === currentUserId ? 'student' : m.sender_role;
    if (otherId && !baseContacts.some(c => c.id === otherId)) baseContacts.unshift({ id: otherId, name: otherName, role: otherRole as AppRole });
  });
  const contacts = (searchResults ?? baseContacts).map(c => ({
    id: c.id, name: c.name, role: roleLabel(c.role), avatar: c.name.slice(0, 1),
  }));

  useEffect(() => {
    if (!contactQuery.trim()) { setSearchResults(null); return; }
    const t = setTimeout(async () => setSearchResults(await onSearchContacts(contactQuery)), 300);
    return () => clearTimeout(t);
  }, [contactQuery]);

  const activeGroup = studyGroups.find(g => g.id === activeTargetId);
  const activeContact = contacts.find(c => c.id === activeTargetId);

  // Active channel title & description
  const activeTitle = activeTargetType === 'group' 
    ? (activeGroup?.name || 'مجموعة دراسة') 
    : (activeContact?.name || 'محادثة مباشرة');

  const activeSubtitle = activeTargetType === 'group' 
    ? `${activeGroup?.members_count || 1} عضواً نشطاً · ${activeGroup?.description || ''}`
    : `${activeContact?.role || 'محادثة مباشرة'}`;

  // Filter messages for current active conversation
  // علّم رسائل المحادثة المفتوحة كمقروءة
  const unreadIds = activeTargetType === 'dm'
    ? messages.filter(m => !m.channel_id && m.sender_id === activeTargetId && m.recipient_id === currentUserId && !m.read_at).map(m => m.id)
    : [];
  useEffect(() => { if (unreadIds.length) onMarkRead(unreadIds); }, [unreadIds.join(',')]);

  const currentMessages = messages.filter(m => {
    if (activeTargetType === 'group') {
      return m.channel_id === activeTargetId || m.recipient_id === activeTargetId;
    } else {
      return (
        (m.sender_id === currentUserId && m.recipient_id === activeTargetId) ||
        (m.sender_id === activeTargetId && m.recipient_id === currentUserId)
      );
    }
  });

  // Extract all files from this specific conversation for the Smart Vault
  const conversationFiles: ChatAttachment[] = currentMessages
    .filter(m => Boolean(m.attachment))
    .map(m => m.attachment as ChatAttachment);

  // Filtered files in Vault
  const filteredVaultFiles = conversationFiles.filter(f => {
    if (vaultFilter !== 'all' && f.type !== vaultFilter) return false;
    if (vaultSearch.trim() && !f.name.toLowerCase().includes(vaultSearch.toLowerCase())) return false;
    return true;
  });

  // Handle selecting a real file from device (uploaded to storage)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const up = await onUpload(file, 'chat');
      setPendingFile({
        id: `att-${Date.now()}`, name: up.name, size: up.size, type: up.type, url: up.url,
        uploaded_by: currentUserName, uploaded_at: new Date().toISOString(),
      });
    } catch { /* الرسالة تظهر من الواجهة الرئيسية */ }
    setUploading(false);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTargetId) return;
    if (!inputText.trim() && !pendingFile) return;

    const newMsg: DirectMessage = {
      id: `msg-${Date.now()}`,
      sender_id: currentUserId,
      sender_name: currentUserName,
      sender_role: currentRole,
      recipient_id: activeTargetId,
      recipient_name: activeTitle,
      channel_id: activeTargetType === 'group' ? activeTargetId : undefined,
      body: inputText.trim() || (pendingFile ? `أرفق ملفاً: ${pendingFile.name}` : ''),
      attachment: pendingFile || undefined,
      reactions: {},
      created_at: new Date().toISOString(),
    };

    onSendMessage(newMsg);
    setInputText('');
    setPendingFile(null);
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    onCreateGroup({
      id: 'new', teacher_id: currentUserId, teacher_name: currentUserName, title: newGroupName.trim(),
      subject: '', grade_level: '', join_code: '', class_type: 'study', is_archived: false, members_count: 1,
      description: newGroupDesc.trim() || 'مجموعة دراسية نشطة لمشاركة الأفكار والملفات.',
      colorTheme: 'blue', created_at: new Date().toISOString(),
    });
    setShowNewGroupModal(false);
    setNewGroupName('');
    setNewGroupDesc('');
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-[#0f233a] via-[#164673] to-[#1677c7] text-white p-5 rounded-3xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 max-w-xl">
          <span className="text-xs font-bold text-sky-200 bg-white/10 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-sky-300" />
            <span>نظام مجموعات الدراسة والتواصل وخزينة الملفات الذكية</span>
          </span>
          <h2 className="text-xl sm:text-2xl font-black">
            مساحات حوارية أكاديمية، تبادل للملازم، وخزينة مجمعة للملفات
          </h2>
          <p className="text-xs text-sky-100 leading-relaxed">
            تواصل مع المعلمين والطلاب في مجموعات متخصصة، وأرسل واستقبل مستندات وملفات يتم حفظها وتنظيمها تلقائياً في خزينة المحادثة دون أن تضيع وسط الرسائل.
          </p>
        </div>

        <button
          onClick={() => setShowNewGroupModal(true)}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 cursor-pointer transition-transform hover:scale-105 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء مجموعة دراسة جديدة</span>
        </button>
      </div>

      {/* Main Container: Sidebar (Channels/DMs) + Chat Window + Smart Files Vault */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[640px] max-h-[750px]">
        
        {/* Left Side: Study Groups & Direct Chats Navigation */}
        <div className="w-full md:w-80 border-l border-slate-200 bg-slate-50/70 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-900 text-sm">القنوات والمحادثات</span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {studyGroups.length + contacts.length} محادثة
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* STUDY GROUPS SECTION */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-black text-slate-400 px-2 uppercase tracking-wider block">
                مجموعات الدراسة الأكاديمية ({studyGroups.length})
              </span>

              {studyGroups.length === 0 && <p className="text-[11px] text-slate-400 px-2">انضم إلى صف أو أنشئ مجموعة دراسة لتظهر هنا.</p>}
              {studyGroups.map(grp => {
                const isSelected = activeTargetId === grp.id && activeTargetType === 'group';
                return (
                  <button
                    key={grp.id}
                    onClick={() => {
                      setActiveTargetId(grp.id);
                      setActiveTargetType('group');
                    }}
                    className={`w-full p-2.5 rounded-2xl text-right transition-all flex items-center gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-sky-100/80 border border-[#1677c7] text-[#0f233a] font-bold shadow-xs'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-base shadow-xs shrink-0">
                      {grp.avatar_icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate block">{grp.name}</span>
                        {grp.unread_count > 0 && (
                          <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                            {grp.unread_count}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 truncate block">
                        {grp.members_count} عضواً · {grp.category}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* DIRECT MESSAGES SECTION */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <span className="text-[11px] font-black text-slate-400 px-2 uppercase tracking-wider block">
                المحادثات المباشرة الفردية ({contacts.length})
              </span>
              <input
                value={contactQuery}
                onChange={e => setContactQuery(e.target.value)}
                placeholder="ابحث عن مستخدم بالاسم…"
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1677c7]"
              />
              {contacts.length === 0 && <p className="text-[11px] text-slate-400 px-2">لا يوجد مستخدمون آخرون بعد.</p>}

              {contacts.map(c => {
                const isSelected = activeTargetId === c.id && activeTargetType === 'dm';
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveTargetId(c.id);
                      setActiveTargetType('dm');
                    }}
                    className={`w-full p-2.5 rounded-2xl text-right transition-all flex items-center gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-sky-100/80 border border-[#1677c7] text-[#0f233a] font-bold shadow-xs'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0f233a] to-[#1677c7] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {c.avatar}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold truncate block">{c.name}</span>
                      <span className="text-[10px] text-slate-400 truncate block">{c.role}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center: Live Chat Stream Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Active Conversation Top Bar */}
          <div className="p-3.5 px-5 border-b border-slate-200 flex items-center justify-between bg-white z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-lg shrink-0">
                {activeTargetType === 'group' ? (activeGroup?.avatar_icon || '👥') : '💬'}
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-slate-900 text-sm truncate">{activeTitle}</h3>
                <p className="text-[11px] text-slate-500 truncate">{activeSubtitle}</p>
              </div>
            </div>

            {/* Smart Files Vault Toggle Button */}
            <button
              onClick={() => setShowFilesVault(!showFilesVault)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                showFilesVault 
                  ? 'bg-[#1677c7] text-white shadow-sm' 
                  : 'bg-sky-50 hover:bg-sky-100 text-[#1677c7] border border-sky-200'
              }`}
              title="عرض كل الملفات والملازم المتبادلة في هذه المحادثة"
            >
              <FolderLock className="w-3.5 h-3.5" />
              <span>خزينة الملفات الذكية ({conversationFiles.length})</span>
            </button>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/40">
            {currentMessages.length > 0 ? (
              currentMessages.map(msg => {
                const isMine = msg.sender_id === currentUserId;
                const isTeacher = msg.sender_role === 'teacher';
                const isAdmin = msg.sender_role === 'admin';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} space-y-1 max-w-xl ${isMine ? 'mr-auto' : 'ml-auto'}`}
                  >
                    {/* Sender meta */}
                    <div className="flex items-center gap-1.5 px-1 text-[11px]">
                      <span className="font-bold text-slate-700">{msg.sender_name}</span>
                      {isAdmin && (
                        <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded-md flex items-center gap-0.5">
                          <ShieldCheck className="w-3 h-3" />
                          <span>المؤسس</span>
                        </span>
                      )}
                      {isTeacher && (
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-black rounded-md">
                          معلم
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(msg.created_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {!isMine && !msg.channel_id && (
                        <button
                          onClick={() => onReport({ type: 'message', id: msg.id, label: 'رسالة', snapshot: msg.body.slice(0, 200) })}
                          title="إبلاغ عن الرسالة"
                          className="text-slate-300 hover:text-rose-600 cursor-pointer"
                        >
                          <Flag className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`p-3.5 rounded-2xl text-xs sm:text-sm space-y-2 shadow-xs leading-relaxed ${
                        isMine
                          ? 'bg-[#1677c7] text-white rounded-tr-xs'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.body}</p>

                      {/* Attached Smart File Card */}
                      {msg.attachment && (
                        <div
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                            isMine
                              ? 'bg-white/10 border-white/20 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center shrink-0">
                              {msg.attachment.type === 'image' && <ImageIcon className="w-4 h-4 text-emerald-400" />}
                              {msg.attachment.type === 'pdf' && <FileText className="w-4 h-4 text-rose-400" />}
                              {msg.attachment.type === 'code' && <Code2 className="w-4 h-4 text-amber-400" />}
                              {msg.attachment.type === 'doc' && <FileText className="w-4 h-4 text-sky-400" />}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-xs truncate block">{msg.attachment.name}</span>
                              <span className="text-[10px] opacity-70 block">{msg.attachment.size}</span>
                            </div>
                          </div>

                          <a
                            href={msg.attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            download={msg.attachment.name}
                            className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                              isMine ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-200 text-[#1677c7]'
                            }`}
                            title="تحميل / فتح الملف"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Reactions pill */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex items-center gap-1 px-1">
                        {Object.entries(msg.reactions).map(([emoji, count]) => (
                          <span
                            key={emoji}
                            className="bg-white border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-600 flex items-center gap-1 shadow-2xs"
                          >
                            <span>{emoji}</span>
                            <span>{count}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#1677c7] flex items-center justify-center text-xl">
                  💬
                </div>
                <h4 className="font-bold text-slate-800 text-sm">لا توجد رسائل سابقة في هذه المحادثة</h4>
                <p className="text-xs text-slate-400 max-w-xs">
                  ابدأ النقاش الآن، اطرح سؤالاً، أو أرفق ملخصاً أو ملف PDF ليستفيد منه الجميع!
                </p>
              </div>
            )}
          </div>

          {/* Pending File Attachment Preview */}
          {pendingFile && (
            <div className="p-3 bg-sky-50 border-t border-sky-200 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1677c7]" />
                <span className="font-bold text-slate-800">{pendingFile.name}</span>
                <span className="text-[10px] text-slate-500">({pendingFile.size})</span>
              </div>
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Message Composer */}
          <form onSubmit={handleSend} className="p-3 sm:p-4 border-t border-slate-200 bg-white flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.txt,.ts,.js,.py"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              title="إرفاق ملف أو صورة من جهازك"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={`اكتب رسالتك في ${activeTitle}...`}
              className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-[#1677c7]"
            />

            <button
              type="submit"
              className="px-4 py-2.5 bg-[#1677c7] hover:bg-[#125fa0] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">إرسال</span>
            </button>
          </form>
        </div>

        {/* Right Side: Smart Files Vault Drawer */}
        {showFilesVault && (
          <div className="w-full md:w-80 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-200">
            <div className="p-4 border-b border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderLock className="w-4 h-4 text-[#1677c7]" />
                  <span className="font-black text-slate-900 text-xs">خزينة الملفات والملازم</span>
                </div>
                <button
                  onClick={() => setShowFilesVault(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search in Files */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={vaultSearch}
                  onChange={e => setVaultSearch(e.target.value)}
                  placeholder="بحث في ملفات المحادثة..."
                  className="w-full pr-8 pl-3 py-1.5 bg-slate-100 rounded-xl text-xs outline-none"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'pdf', label: 'PDF' },
                  { id: 'image', label: 'صور' },
                  { id: 'code', label: 'كود' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setVaultFilter(tab.id as any)}
                    className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                      vaultFilter === tab.id ? 'bg-white text-[#1677c7] shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Files List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredVaultFiles.length > 0 ? (
                filteredVaultFiles.map(file => (
                  <div
                    key={file.id}
                    className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2 shadow-2xs hover:border-[#1677c7] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-sky-50 text-[#1677c7] flex items-center justify-center shrink-0">
                          {file.type === 'pdf' && <FileText className="w-4 h-4 text-rose-500" />}
                          {file.type === 'image' && <ImageIcon className="w-4 h-4 text-emerald-500" />}
                          {file.type === 'code' && <Code2 className="w-4 h-4 text-amber-500" />}
                          {file.type === 'doc' && <FileText className="w-4 h-4 text-sky-500" />}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-slate-900 block truncate" title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">{file.size}</span>
                        </div>
                      </div>

                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        download={file.name}
                        className="p-1.5 bg-slate-100 hover:bg-[#1677c7] hover:text-white text-slate-600 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="تحميل الملف"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span>رافع الملف: {file.uploaded_by}</span>
                      <span>{new Date(file.uploaded_at).toLocaleDateString('ar')}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs space-y-1">
                  <FolderLock className="w-8 h-8 mx-auto text-slate-300" />
                  <p>لا توجد ملفات مطابقة في الخزينة حالياً</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CREATE NEW STUDY GROUP MODAL */}
      {showNewGroupModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#1677c7] flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">إنشاء مجموعة دراسية جديدة</h3>
              </div>
              <button onClick={() => setShowNewGroupModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المجموعة الدراسية:</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="مثال: نادي الرياضيات المتقدمة، حلقة اللغة العربية..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677c7]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وصف المجموعة والهدف منها:</label>
                <textarea
                  value={newGroupDesc}
                  onChange={e => setNewGroupDesc(e.target.value)}
                  placeholder="شرح بسيط لما ستناقشه هذه المجموعة وكيف ستساعد الطلاب..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677c7] min-h-[70px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">أيقونة المجموعة التعبيرية:</label>
                <div className="flex items-center gap-2">
                  {['📚', '📐', '💻', '⚡', '🔬', '🎨', '🚀'].map(emoji => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => setNewGroupIcon(emoji)}
                      className={`w-9 h-9 rounded-xl border text-base flex items-center justify-center transition-all cursor-pointer ${
                        newGroupIcon === emoji ? 'bg-sky-100 border-[#1677c7] scale-110' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#1677c7] hover:bg-[#125fa0] text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>إنشاء وتفعيل المجموعة فوراً</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
