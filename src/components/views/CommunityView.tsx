import React, { useState, useRef } from 'react';
import { 
  Users, 
  Heart, 
  MessageSquare, 
  Bookmark, 
  Send, 
  Sparkles, 
  Image as ImageIcon, 
  Clock, 
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flag,
  Trash2
} from 'lucide-react';
import { AppRole, Post, PostComment, Story } from '../../types';
import { UploadedFile } from '../../lib/api';
import type { ReportTarget } from '../ReportModal';

interface CommunityViewProps {
  currentRole: AppRole;
  currentUserId: string;
  currentUserName: string;
  posts: Post[];
  stories: Story[];
  onAddPost: (post: Post) => void;
  onAddStory: (story: Story) => void;
  onToggleLike: (postId: string) => void;
  onAddComment: (postId: string, comment: PostComment) => void;
  onUpload: (f: File, folder: string) => Promise<UploadedFile>;
  onDeletePost: (postId: string) => void;
  onReport: (target: ReportTarget) => void;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  currentRole,
  currentUserId,
  currentUserName,
  posts,
  stories,
  onAddPost,
  onAddStory,
  onToggleLike,
  onAddComment,
  onUpload,
  onDeletePost,
  onReport,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'questions' | 'notes' | 'announcements'>('all');
  const [postText, setPostText] = useState('');
  const [postCategory, setPostCategory] = useState<'questions' | 'notes' | 'announcements'>('questions');
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  
  // Story modal state
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [newStoryText, setNewStoryText] = useState('');
  const [showStoryComposer, setShowStoryComposer] = useState(false);

  // Active comments dropdown for each post
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');

  // Bookmarks
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});

  const filteredPosts = posts.filter(p => {
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    try {
      const up = await onUpload(file, 'posts');
      setPostImagePreview(up.url);
    } catch { /* الرسالة تظهر من الواجهة الرئيسية */ }
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim() && !postImagePreview) return;
    const newP: Post = {
      id: `post-${Date.now()}`,
      author_id: currentUserId,
      author_name: currentUserName,
      author_role: currentRole,
      body: postText.trim(),
      category: postCategory,
      media_url: postImagePreview || undefined,
      media_type: postImagePreview ? 'image' : undefined,
      visibility: 'public',
      likes_count: 0,
      comments_count: 0,
      comments: [],
      is_liked: false,
      created_at: new Date().toISOString(),
    };
    onAddPost(newP);
    setPostText('');
    setPostImagePreview(null);
  };

  const handleCreateStory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoryText.trim()) return;
    const gradients = [
      'from-blue-900 via-indigo-900 to-slate-900',
      'from-purple-900 via-pink-900 to-slate-900',
      'from-emerald-900 via-teal-900 to-slate-900',
      'from-amber-900 via-orange-900 to-slate-900',
    ];
    const newS: Story = {
      id: `str-${Date.now()}`,
      user_id: currentUserId,
      user_name: currentUserName,
      user_role: currentRole,
      body: newStoryText.trim(),
      bgGradient: gradients[Math.floor(Math.random() * gradients.length)],
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    onAddStory(newS);
    setNewStoryText('');
    setShowStoryComposer(false);
  };

  const handleSendComment = (postId: string) => {
    if (!commentInput.trim()) return;
    const newC: PostComment = {
      id: `cmt-${Date.now()}`,
      post_id: postId,
      author_id: currentUserId,
      author_name: currentUserName,
      body: commentInput.trim(),
      created_at: new Date().toISOString(),
    };
    onAddComment(postId, newC);
    setCommentInput('');
  };

  const toggleBookmark = (id: string) => {
    setSavedPosts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* 24-HOUR STORIES VIEWER MODAL */}
      {activeStoryIndex !== null && stories[activeStoryIndex] && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-sm w-full h-[520px] rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-6 text-white border border-white/20 animate-in zoom-in-95">
            {/* Background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${stories[activeStoryIndex].bgGradient} -z-10`} />

            {/* Top Bar with Progress Line */}
            <div className="space-y-3 z-10">
              <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white animate-[pulse_2s_infinite] w-full" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                    {stories[activeStoryIndex].user_name.slice(0, 1)}
                  </div>
                  <div>
                    <span className="font-bold text-xs block">{stories[activeStoryIndex].user_name}</span>
                    <span className="text-[10px] text-white/70">قصة مؤقتة · 24 ساعة</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveStoryIndex(null)}
                  className="p-1 rounded-full bg-black/30 hover:bg-black/50 text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Story Text Center */}
            <div className="my-auto text-center px-4 py-8">
              <p className="text-lg sm:text-xl font-bold leading-relaxed whitespace-pre-wrap">
                {stories[activeStoryIndex].body}
              </p>
            </div>

            {/* Navigation Controls Bottom */}
            <div className="flex items-center justify-between z-10 pt-4 border-t border-white/10 text-xs text-white/70">
              <button
                onClick={() => setActiveStoryIndex(Math.max(0, activeStoryIndex - 1))}
                disabled={activeStoryIndex === 0}
                className="disabled:opacity-30 cursor-pointer flex items-center gap-1 font-bold"
              >
                <ChevronRight className="w-4 h-4" />
                <span>السابقة</span>
              </button>

              <span>{activeStoryIndex + 1} من {stories.length}</span>

              <button
                onClick={() => setActiveStoryIndex(Math.min(stories.length - 1, activeStoryIndex + 1))}
                disabled={activeStoryIndex === stories.length - 1}
                className="disabled:opacity-30 cursor-pointer flex items-center gap-1 font-bold"
              >
                <span>التالية</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stories Carousel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>القصص اليومية التفاعلية (24 ساعة)</span>
          </span>
          <span className="text-[11px] text-slate-400">تختفي بعد 24 ساعة تلقائياً</span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {/* Add story card */}
          <div 
            onClick={() => setShowStoryComposer(true)}
            className="shrink-0 w-32 h-44 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-dashed border-slate-300 p-3 flex flex-col justify-between items-center text-center cursor-pointer hover:border-[#1677c7] transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-[#1677c7] text-white flex items-center justify-center font-bold text-xl mt-3 shadow-md">
              +
            </div>
            <div>
              <span className="font-bold text-xs text-slate-800 block">أضف قصة</span>
              <span className="text-[10px] text-slate-500">شارك إنجازك اليومي</span>
            </div>
          </div>

          {/* Stories list */}
          {stories.map((st, i) => (
            <div
              key={st.id}
              onClick={() => setActiveStoryIndex(i)}
              className={`shrink-0 w-32 h-44 rounded-2xl bg-gradient-to-br ${st.bgGradient} text-white p-3.5 flex flex-col justify-between shadow-xs hover:scale-102 transition-transform cursor-pointer relative overflow-hidden`}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px] font-bold ring-2 ring-white/50">
                  {st.user_name.slice(0, 1)}
                </div>
                <span className="text-[10px] font-bold text-sky-100 truncate">{st.user_name}</span>
              </div>

              <p className="text-xs font-semibold leading-relaxed line-clamp-4">
                {st.body}
              </p>

              <span className="text-[9px] text-white/70 block">انقر للعرض</span>
            </div>
          ))}
        </div>
      </div>

      {/* Story Composer Dialog */}
      {showStoryComposer && (
        <div className="p-4 bg-sky-50 rounded-2xl border border-sky-200 animate-in fade-in space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#0f233a]">نشر قصة سريعة تختفي بعد 24 ساعة:</h4>
            <button onClick={() => setShowStoryComposer(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreateStory} className="space-y-2">
            <input
              type="text"
              value={newStoryText}
              onChange={e => setNewStoryText(e.target.value)}
              placeholder="مثال: أنهيت درس الجبر واستعد للحصة المباشرة! 📚✨"
              className="w-full p-2.5 bg-white border border-sky-200 rounded-xl text-xs outline-none"
              required
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#1677c7] text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              نشر القصة الآن
            </button>
          </form>
        </div>
      )}

      {/* Post Composer */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#1677c7] flex items-center justify-center font-bold text-xs">
            {currentUserName.slice(0, 1)}
          </div>
          <div>
            <span className="font-bold text-xs text-slate-800 block">نشر مشاركة أو سؤال تعليمي</span>
            <span className="text-[10px] text-slate-400">باسم: {currentUserName}</span>
          </div>
        </div>

        <form onSubmit={handleCreatePost} className="space-y-3">
          <textarea
            value={postText}
            onChange={e => setPostText(e.target.value)}
            placeholder="اطرح سؤالاً، شارك ملخصاً، أو ارفع صورة مسألة من كتابك لمناقشتها مع زملائك..."
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-[#1677c7] min-h-[90px] leading-relaxed"
          />

          {/* Attached Image Preview */}
          {postImagePreview && (
            <div className="relative inline-block rounded-xl overflow-hidden border border-slate-200 max-w-xs">
              <img src={postImagePreview} alt="مرفق المشاركة" className="max-h-48 rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => setPostImagePreview(null)}
                className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600">التصنيف:</span>
                <select
                  value={postCategory}
                  onChange={e => setPostCategory(e.target.value as any)}
                  className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-xs outline-none"
                >
                  <option value="questions">سؤال أو استفسار علمي</option>
                  <option value="notes">ملخص أو نصيحة دراسية</option>
                  {currentRole !== 'student' && <option value="announcements">إعلان رسمي من المعلم</option>}
                </select>
              </div>

              {/* Real Photo Attachment Trigger */}
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="p-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="إرفاق صورة مسألة أو مخطط"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#1677c7]" />
                <span>إرفاق صورة</span>
              </button>
            </div>

            <button
              type="submit"
              className="px-5 py-2 bg-[#1677c7] hover:bg-[#125fa0] text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>نشر في المجتمع</span>
            </button>
          </div>
        </form>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'all', label: 'كل المنشورات' },
            { id: 'questions', label: 'أسئلة ونقاشات 🙋‍♂️' },
            { id: 'notes', label: 'ملخصات ونصائح 💡' },
            { id: 'announcements', label: 'إعلانات المعلمين 📢' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedCategory === tab.id
                  ? 'bg-white text-[#1677c7] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-slate-400 font-medium hidden sm:inline">{filteredPosts.length} منشور</span>
      </div>

      {/* Posts Feed */}
      <div className="space-y-4">
        {filteredPosts.map(post => {
          const isCommentsOpen = activeCommentsPostId === post.id;
          const isSaved = Boolean(savedPosts[post.id]);
          return (
            <div key={post.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3.5">
              {/* Post Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-100 text-[#1677c7] flex items-center justify-center font-bold text-sm">
                    {post.author_name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-sm">{post.author_name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                        post.author_role === 'teacher' ? 'bg-amber-100 text-amber-800' :
                        post.author_role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {post.author_role === 'teacher' ? 'أستاذ' : post.author_role === 'admin' ? 'مؤسس المنصة' : 'طالب'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(post.created_at).toLocaleString('ar')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                {(post.author_id === currentUserId || currentRole === 'admin') && (
                  <button
                    onClick={() => { if (confirm('حذف هذا المنشور نهائياً؟')) onDeletePost(post.id); }}
                    title="حذف المنشور"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                {post.author_id !== currentUserId && (
                  <button
                    onClick={() => onReport({ type: 'post', id: post.id, label: 'منشور', snapshot: post.body.slice(0, 200) })}
                    title="إبلاغ عن المنشور"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => toggleBookmark(post.id)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isSaved ? 'text-[#1677c7] bg-sky-50' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-[#1677c7]' : ''}`} />
                </button>
                </div>
              </div>

              {/* Post Content */}
              {post.body && (
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {post.body}
                </p>
              )}

              {/* Post Attached Media Image */}
              {post.media_url && (
                <div className="rounded-xl overflow-hidden border border-slate-200 max-h-80 bg-slate-50 flex items-center justify-center">
                  <img
                    src={post.media_url}
                    alt="مرفق منشور"
                    className="max-h-80 w-auto object-contain rounded-xl"
                  />
                </div>
              )}

              {/* Action Bar */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => onToggleLike(post.id)}
                    className={`flex items-center gap-1.5 font-bold cursor-pointer transition-colors ${
                      post.is_liked ? 'text-rose-600' : 'text-slate-500 hover:text-rose-600'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${post.is_liked ? 'fill-rose-500' : ''}`} />
                    <span>{post.likes_count} إعجاب</span>
                  </button>

                  <button
                    onClick={() => setActiveCommentsPostId(isCommentsOpen ? null : post.id)}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-[#1677c7] font-medium cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{post.comments.length} تعليقات</span>
                  </button>
                </div>

                <span className="text-[11px] text-slate-400">مجتمع NEMVIA التعليمي</span>
              </div>

              {/* Expandable Comments Section */}
              {isCommentsOpen && (
                <div className="pt-3 border-t border-slate-100 space-y-3 bg-slate-50/50 -mx-5 -mb-5 p-5 rounded-b-2xl">
                  {/* Comments list */}
                  <div className="space-y-2">
                    {post.comments.map(c => (
                      <div key={c.id} className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{c.author_name}</span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-2">
                            {c.author_id !== currentUserId && (
                              <button onClick={() => onReport({ type: 'comment', id: c.id, label: 'تعليق', snapshot: c.body.slice(0, 200) })} title="إبلاغ عن التعليق" className="text-slate-300 hover:text-rose-600 cursor-pointer"><Flag className="w-3 h-3" /></button>
                            )}
                            {new Date(c.created_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{c.body}</p>
                      </div>
                    ))}
                  </div>

                  {/* Add comment input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={commentInput}
                      onChange={e => setCommentInput(e.target.value)}
                      placeholder="اكتب ردك أو تعليقك العلمي هنا..."
                      className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1677c7]"
                    />
                    <button
                      onClick={() => handleSendComment(post.id)}
                      className="px-3.5 py-2 bg-[#1677c7] text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      إرسال
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
