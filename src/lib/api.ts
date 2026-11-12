import { supabase } from './supabase';
import {
  AppRole, Profile, ClassItem, Lesson, Assignment, Submission, Quiz, QuizQuestion,
  Post, PostComment, Story, LiveSession, DirectMessage, Course, NotificationItem,
  ContentReport, ContactInfo, ClassMemberInfo,
} from '../types';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Row = Record<string, any>;

function rows(r: { data: any; error: any }, label: string): Row[] {
  if (r.error) {
    console.warn(`[NEMVIA] ${label}:`, r.error.message);
    return [];
  }
  return (r.data as Row[]) ?? [];
}

function fail(error: { message: string } | null, fallback = 'حدث خطأ غير متوقع') {
  if (error) throw new Error(error.message || fallback);
}

export function mapProfile(r: Row): Profile {
  return {
    id: r.id,
    username: r.username || '',
    display_name: r.display_name || 'مستخدم NEMVIA',
    bio: r.bio || '',
    avatar_url: r.avatar_url || undefined,
    role: (r.role as AppRole) || 'student',
    visibility: r.visibility || 'public',
    points: r.points ?? 0,
    streakDays: r.streak_days ?? 0,
    is_suspended: !!r.is_suspended,
    joinedDate: r.created_at
      ? new Date(r.created_at).toLocaleDateString('ar', { month: 'long', year: 'numeric' })
      : '',
  };
}

const TW_HEX: Record<string, string> = {
  blue: '#2563eb', indigo: '#4f46e5', emerald: '#059669', rose: '#e11d48', amber: '#d97706', sky: '#0284c7',
  violet: '#7c3aed', teal: '#0d9488', purple: '#9333ea', slate: '#334155', orange: '#ea580c', cyan: '#0891b2',
  pink: '#db2777', green: '#16a34a', red: '#dc2626', fuchsia: '#c026d3',
};
export const DEFAULT_THEME = 'from-blue-600 to-indigo-700';

function coverFor(theme: string, title: string) {
  const from = TW_HEX[(theme.match(/from-([a-z]+)/) || [])[1]] || '#2563eb';
  const to = TW_HEX[(theme.match(/to-([a-z]+)/) || [])[1]] || '#4338ca';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='600' height='300' fill='url(#g)'/><text x='300' y='165' font-size='120' text-anchor='middle' fill='white' fill-opacity='.25' font-family='sans-serif'>${(title || 'N').trim().slice(0, 1).replace(/[<&>]/g, '')}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ------------------------------------------------------------------ */
/* Profile / auth helpers                                              */
/* ------------------------------------------------------------------ */

export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) console.warn('[NEMVIA] profile:', error.message);
    if (data) return mapProfile(data);
    await new Promise(r => setTimeout(r, 400)); // الـ trigger ينشئ الملف بعد التسجيل بلحظات
  }
  return null;
}

export async function updateProfile(userId: string, patch: Partial<{ display_name: string; bio: string; avatar_url: string; visibility: 'public' | 'private' }>) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  fail(error);
}

export async function touchStreak() {
  await supabase.rpc('touch_streak');
}

export async function awardPoints(xp: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('award_points', { p_xp: Math.round(xp) });
  if (error) { console.warn('[NEMVIA] award_points:', error.message); return null; }
  return data as number;
}

export async function searchContacts(meId: string, q = ''): Promise<ContactInfo[]> {
  let query = supabase.from('profiles').select('id, display_name, role, avatar_url').neq('id', meId).limit(60);
  if (q.trim()) query = query.ilike('display_name', `%${q.trim()}%`);
  else query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) { console.warn('[NEMVIA] contacts:', error.message); return []; }
  return (data || []).map((r: Row) => ({ id: r.id, name: r.display_name, role: r.role, avatar_url: r.avatar_url || undefined }));
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

export interface UploadedFile { url: string; name: string; size: string; type: 'pdf' | 'image' | 'doc' | 'code'; }

export async function uploadFile(userId: string, file: File, folder: string): Promise<UploadedFile> {
  if (file.size > 10 * 1024 * 1024) throw new Error('حجم الملف أكبر من 10 ميجابايت');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('nemvia-files').upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('mime') || m.includes('not supported')) throw new Error('نوع الملف غير مسموح (المسموح: صور، PDF، Word/Excel/PowerPoint، فيديو، ZIP)');
    if (m.includes('size') || m.includes('exceeded')) throw new Error('حجم الملف أكبر من 10 ميجابايت');
    throw new Error(error.message);
  }
  const { data } = supabase.storage.from('nemvia-files').getPublicUrl(path);
  const kb = file.size / 1024;
  const type: UploadedFile['type'] = ext === 'pdf' ? 'pdf'
    : ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? 'image'
    : ['ts', 'js', 'py', 'java', 'html', 'css', 'sql', 'txt'].includes(ext) ? 'code' : 'doc';
  return {
    url: data.publicUrl,
    name: file.name,
    size: kb > 1024 ? `${(kb / 1024).toFixed(1)} ميجابايت` : `${Math.round(kb)} كيلوبايت`,
    type,
  };
}

/* ------------------------------------------------------------------ */
/* Load everything                                                     */
/* ------------------------------------------------------------------ */

export interface AppData {
  classes: ClassItem[];
  courses: Course[];
  lessons: Lesson[];
  quizzes: Quiz[];
  assignments: Assignment[];
  submissions: Submission[];
  posts: Post[];
  stories: Story[];
  liveSessions: LiveSession[];
  messages: DirectMessage[];
  notifications: NotificationItem[];
  reports: ContentReport[];
  contacts: ContactInfo[];
  classMembers: ClassMemberInfo[];
}

export async function loadAll(me: Profile): Promise<AppData> {
  const [
    classesR, countsR, lessonsR, assignR, subsR, quizzesR, qqR, keysR, attemptsR,
    postsR, commentsR, likesR, storiesR, liveR, dmR, cmR, notifR, reportsR, contacts, membersR,
  ] = await Promise.all([
    supabase.from('classes').select('*').order('created_at', { ascending: false }),
    supabase.rpc('my_class_counts'),
    supabase.from('lessons').select('*').order('position', { ascending: true }),
    supabase.from('assignments').select('*').order('created_at', { ascending: false }),
    supabase.from('submissions').select('*').order('submitted_at', { ascending: false }),
    supabase.from('quizzes').select('*').order('created_at', { ascending: false }),
    supabase.from('quiz_questions').select('*').order('position', { ascending: true }),
    supabase.from('quiz_answer_keys').select('*'),
    supabase.from('quiz_attempts').select('quiz_id, student_id, score'),
    supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('comments').select('*').order('created_at', { ascending: true }),
    supabase.from('post_likes').select('post_id, user_id'),
    supabase.from('stories').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    supabase.from('live_sessions').select('*').neq('status', 'cancelled').order('starts_at', { ascending: true }),
    supabase.from('direct_messages').select('*').order('created_at', { ascending: true }).limit(500),
    supabase.from('class_messages').select('*').order('created_at', { ascending: true }).limit(500),
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
    me.role === 'admin'
      ? supabase.from('content_reports').select('*').in('status', ['open', 'reviewing']).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as any),
    searchContacts(me.id),
    supabase.from('class_members').select('class_id, user_id, member_role'),
  ]);

  const classRows = rows(classesR, 'classes');
  const counts: Record<string, number> = {};
  rows(countsR, 'counts').forEach(r => { counts[r.class_id] = Number(r.members_count); });
  const lessonRows = rows(lessonsR, 'lessons');
  const assignRows = rows(assignR, 'assignments');
  const subRows = rows(subsR, 'submissions');
  const quizRows = rows(quizzesR, 'quizzes');
  const qqRows = rows(qqR, 'quiz_questions');
  const keyRows = rows(keysR, 'quiz_answer_keys');
  const attemptRows = rows(attemptsR, 'quiz_attempts');
  const postRows = rows(postsR, 'posts');
  const commentRows = rows(commentsR, 'comments');
  const likeRows = rows(likesR, 'post_likes');
  const storyRows = rows(storiesR, 'stories');
  const liveRows = rows(liveR, 'live_sessions');
  const dmRows = rows(dmR, 'direct_messages');
  const cmRows = rows(cmR, 'class_messages');
  const notifRows = rows(notifR, 'notifications');
  const reportRows = rows(reportsR, 'reports');
  const memberRows = rows(membersR, 'class_members');

  // أسماء كل من ظهر في البيانات
  const ids = new Set<string>([me.id]);
  [classRows.map(r => r.teacher_id), lessonRows.map(r => r.teacher_id), assignRows.map(r => r.teacher_id),
   subRows.map(r => r.student_id), postRows.map(r => r.author_id), commentRows.map(r => r.author_id),
   storyRows.map(r => r.user_id), liveRows.map(r => r.host_id),
   dmRows.flatMap(r => [r.sender_id, r.recipient_id]), cmRows.map(r => r.sender_id),
   reportRows.map(r => r.reporter_id), memberRows.map(r => r.user_id)].forEach(list => list.forEach((i: string) => i && ids.add(i)));
  const known = new Map<string, Row>();
  contacts.forEach(c => known.set(c.id, { id: c.id, display_name: c.name, role: c.role, avatar_url: c.avatar_url }));
  const missing = [...ids].filter(i => !known.has(i) && i !== me.id);
  if (missing.length) {
    const { data } = await supabase.from('profiles').select('id, display_name, role, avatar_url').in('id', missing.slice(0, 200));
    (data || []).forEach((r: Row) => known.set(r.id, r));
  }
  known.set(me.id, { id: me.id, display_name: me.display_name, role: me.role, avatar_url: me.avatar_url });
  const nm = (id: string) => known.get(id)?.display_name || 'مستخدم';
  const rl = (id: string): AppRole => (known.get(id)?.role as AppRole) || 'student';
  const av = (id: string) => known.get(id)?.avatar_url || undefined;

  // الصفوف
  const classes: ClassItem[] = classRows.map(r => ({
    id: r.id, teacher_id: r.teacher_id, teacher_name: nm(r.teacher_id), title: r.title,
    subject: r.subject, grade_level: r.grade_level, join_code: r.join_code, description: r.description,
    class_type: r.class_type, is_archived: r.is_archived, members_count: counts[r.id] ?? 1,
    colorTheme: r.color_theme && r.color_theme.includes('from-') ? r.color_theme : DEFAULT_THEME, created_at: r.created_at,
  }));
  const classById = new Map(classes.map(c => [c.id, c]));

  const lessons: Lesson[] = lessonRows.map(r => ({
    id: r.id, class_id: r.class_id, teacher_id: r.teacher_id, teacher_name: nm(r.teacher_id),
    title: r.title, content: r.content, video_url: r.video_url || undefined, duration: r.duration || undefined,
    attachment_url: r.attachment_url || undefined, attachment_name: r.attachment_name || undefined,
    position: r.position, published_at: r.published_at || r.created_at,
  }));

  const courses: Course[] = classes.filter(c => c.class_type === 'class').map(c => ({
    id: c.id, owner_id: c.teacher_id, owner_name: c.teacher_name, title: c.title,
    description: c.description, category: c.subject || 'عام',
    lessons_count: lessons.filter(l => l.class_id === c.id).length,
    students_count: c.members_count, rating: 0, image_url: coverFor(c.colorTheme, c.title),
  }));

  const submissions: Submission[] = subRows.map(r => ({
    id: r.id, assignment_id: r.assignment_id, student_id: r.student_id, student_name: nm(r.student_id),
    answer_text: r.answer_text, attachment_url: r.attachment_url || undefined, submitted_at: r.submitted_at,
    grade: r.grade ?? undefined, teacher_feedback: r.teacher_feedback || undefined,
    graded_at: r.grade != null ? r.submitted_at : undefined,
  }));

  const assignments: Assignment[] = assignRows.map(r => ({
    id: r.id, class_id: r.class_id, class_title: classById.get(r.class_id)?.title || '',
    teacher_id: r.teacher_id, teacher_name: nm(r.teacher_id), title: r.title, instructions: r.instructions,
    due_at: r.due_at || r.created_at, total_points: r.total_points ?? 20,
    submissions_count: submissions.filter(s => s.assignment_id === r.id).length, created_at: r.created_at,
  }));

  const keys = new Map(keyRows.map(k => [k.question_id, k.correct_option]));
  const quizzes: Quiz[] = quizRows.map(r => {
    const questions: QuizQuestion[] = qqRows.filter(q => q.quiz_id === r.id).map(q => ({
      id: q.id, question: q.question, options: Array.isArray(q.options) ? q.options : [],
      correctOptionIndex: keys.has(q.id) ? keys.get(q.id) : -1, // الطالب لا يستلم الجواب الصحيح
      explanation: keys.has(q.id) ? q.explanation || '' : '', points: Number(q.points) || 1,
    }));
    return {
      id: r.id, class_id: r.class_id, class_title: classById.get(r.class_id)?.title || '',
      title: r.title, description: r.description, timeLimitMinutes: r.time_limit_minutes ?? 10,
      questions, isPublished: r.is_published, attemptsCount: attemptRows.filter(a => a.quiz_id === r.id).length,
      attempted: attemptRows.some(a => a.quiz_id === r.id && a.student_id === me.id),
      myScore: Number(attemptRows.find(a => a.quiz_id === r.id && a.student_id === me.id)?.score ?? 0),
    };
  });

  const posts: Post[] = postRows.map(r => {
    const comments: PostComment[] = commentRows.filter(c => c.post_id === r.id).map(c => ({
      id: c.id, post_id: c.post_id, author_id: c.author_id, author_name: nm(c.author_id),
      author_avatar: av(c.author_id), body: c.body, created_at: c.created_at,
    }));
    const likes = likeRows.filter(l => l.post_id === r.id);
    return {
      id: r.id, author_id: r.author_id, author_name: nm(r.author_id), author_role: rl(r.author_id),
      author_avatar: av(r.author_id), body: r.body, category: r.category || 'all',
      media_url: r.media_url || undefined, media_type: r.media_type || undefined, visibility: r.visibility,
      likes_count: likes.length, comments_count: comments.length, comments,
      is_liked: likes.some(l => l.user_id === me.id), is_saved: false, created_at: r.created_at,
    };
  });

  const stories: Story[] = storyRows.map(r => ({
    id: r.id, user_id: r.user_id, user_name: nm(r.user_id), user_role: rl(r.user_id), user_avatar: av(r.user_id),
    body: r.body, bgGradient: r.bg_gradient, created_at: r.created_at, expires_at: r.expires_at,
  }));

  const liveSessions: LiveSession[] = liveRows.map(r => ({
    id: r.id, host_id: r.host_id, host_name: nm(r.host_id), class_id: r.class_id || undefined,
    class_title: r.class_id ? classById.get(r.class_id)?.title : undefined, title: r.title,
    description: r.description, meeting_url: r.meeting_url || undefined, starts_at: r.starts_at,
    status: r.status, participants_count: 0,
  }));

  const messages: DirectMessage[] = [
    ...dmRows.map(r => ({
      id: r.id, sender_id: r.sender_id, sender_name: nm(r.sender_id), sender_role: rl(r.sender_id),
      recipient_id: r.recipient_id, recipient_name: nm(r.recipient_id), body: r.body,
      attachment: r.attachment_url ? attachmentOf(r.attachment_url, r.attachment_name, r.sender_id, r.created_at, nm) : undefined,
      reactions: {}, created_at: r.created_at, read_at: r.read_at || undefined,
    } as DirectMessage)),
    ...cmRows.map(r => ({
      id: r.id, sender_id: r.sender_id, sender_name: nm(r.sender_id), sender_role: rl(r.sender_id),
      recipient_id: r.class_id, recipient_name: classById.get(r.class_id)?.title || '', channel_id: r.class_id,
      body: r.body,
      attachment: r.attachment_url ? attachmentOf(r.attachment_url, r.attachment_name, r.sender_id, r.created_at, nm) : undefined,
      reactions: {}, created_at: r.created_at,
    } as DirectMessage)),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const notifications: NotificationItem[] = notifRows.map(r => ({
    id: r.id, title: r.payload?.title || 'إشعار', body: r.payload?.body || '',
    kind: (['academic', 'social', 'live', 'grade'].includes(r.kind) ? r.kind : 'academic') as NotificationItem['kind'],
    created_at: r.created_at, read: !!r.read_at,
  }));

  const reports: ContentReport[] = reportRows.map(r => ({
    id: r.id, target_id: r.target_id, target_type: r.target_type === 'profile' ? 'user' : r.target_type,
    reporter_name: nm(r.reporter_id), reason: r.reason,
    details: [r.details, r.snapshot ? `«${r.snapshot}»` : ''].filter(Boolean).join(' — '),
    status: r.status, created_at: r.created_at,
  }));

  const myTaught = new Set(classes.filter(c => c.teacher_id === me.id).map(c => c.id));
  const classMembers: ClassMemberInfo[] = memberRows
    .filter(r => myTaught.has(r.class_id))
    .map(r => ({ class_id: r.class_id, user_id: r.user_id, name: nm(r.user_id), member_role: r.member_role }));

  return { classes, courses, lessons, quizzes, assignments, submissions, posts, stories, liveSessions, messages, notifications, reports, contacts, classMembers };
}

function attachmentOf(url: string, name: string | null, by: string, at: string, nm: (id: string) => string) {
  const fname = name || url.split('/').pop() || 'ملف';
  const ext = (fname.split('.').pop() || '').toLowerCase();
  const type = ext === 'pdf' ? 'pdf' : ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? 'image'
    : ['ts', 'js', 'py', 'java', 'html', 'css', 'sql', 'txt'].includes(ext) ? 'code' : 'doc';
  return { id: url, name: fname, size: '', type: type as 'pdf' | 'image' | 'doc' | 'code', url, uploaded_by: nm(by), uploaded_at: at };
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export async function createClass(uid: string, c: ClassItem) {
  const { error } = await supabase.from('classes').insert({
    teacher_id: uid, title: c.title, subject: c.subject, grade_level: c.grade_level,
    description: c.description, class_type: c.class_type, color_theme: c.colorTheme,
  });
  fail(error);
}

export async function joinClass(code: string): Promise<boolean> {
  const { error } = await supabase.rpc('join_class_by_code', { p_join_code: code });
  return !error;
}

export async function createLesson(uid: string, l: Lesson) {
  const { error } = await supabase.from('lessons').insert({
    class_id: l.class_id, teacher_id: uid, title: l.title, content: l.content,
    video_url: l.video_url || null, duration: l.duration || null,
    attachment_url: l.attachment_url || null, attachment_name: l.attachment_name || null,
    position: l.position ?? 0, published_at: new Date().toISOString(),
  });
  fail(error);
}

export async function createQuiz(uid: string, q: Quiz) {
  const { data: quiz, error } = await supabase.from('quizzes').insert({
    class_id: q.class_id, teacher_id: uid, title: q.title, description: q.description,
    time_limit_minutes: q.timeLimitMinutes, is_published: q.isPublished,
  }).select('id').single();
  fail(error);
  const { data: qs, error: e2 } = await supabase.from('quiz_questions').insert(
    q.questions.map((qq, i) => ({
      quiz_id: quiz!.id, question: qq.question, options: qq.options, points: qq.points,
      explanation: qq.explanation || '', position: i,
    })),
  ).select('id, position');
  fail(e2);
  const { error: e3 } = await supabase.from('quiz_answer_keys').insert(
    (qs || []).map((row: Row) => ({ question_id: row.id, correct_option: q.questions[row.position].correctOptionIndex })),
  );
  fail(e3);
}

export interface QuizResult { score: number; total: number; key: Record<string, { correct: number; explanation: string }>; }
export async function submitQuiz(quizId: string, answers: Record<string, number>): Promise<QuizResult> {
  const { data, error } = await supabase.rpc('submit_quiz_attempt', { p_quiz_id: quizId, p_answers: answers });
  fail(error);
  return data as QuizResult;
}

export async function createAssignment(uid: string, a: { class_id: string; title: string; instructions: string; due_at: string; total_points: number }) {
  const { error } = await supabase.from('assignments').insert({ ...a, teacher_id: uid });
  fail(error);
}

export async function submitAssignment(uid: string, s: Submission) {
  const { error } = await supabase.from('submissions').upsert({
    assignment_id: s.assignment_id, student_id: uid, answer_text: s.answer_text,
    attachment_url: s.attachment_url || null,
  }, { onConflict: 'assignment_id,student_id' });
  fail(error);
}

export async function gradeSubmission(id: string, grade: number, feedback: string) {
  const { error } = await supabase.from('submissions').update({ grade, teacher_feedback: feedback }).eq('id', id);
  fail(error);
}

export async function createPost(uid: string, p: Post) {
  const { error } = await supabase.from('posts').insert({
    author_id: uid, body: p.body, category: p.category, visibility: p.visibility,
    media_url: p.media_url || null, media_type: p.media_type || null,
  });
  fail(error);
}

export async function setLike(uid: string, postId: string, liked: boolean) {
  const q = liked
    ? supabase.from('post_likes').insert({ post_id: postId, user_id: uid })
    : supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', uid);
  const { error } = await q;
  fail(error);
}

export async function addComment(uid: string, postId: string, body: string) {
  const { error } = await supabase.from('comments').insert({ post_id: postId, author_id: uid, body });
  fail(error);
}

export async function createStory(uid: string, s: Story) {
  const { error } = await supabase.from('stories').insert({ user_id: uid, body: s.body, bg_gradient: s.bgGradient });
  fail(error);
}

export async function createLive(uid: string, l: { title: string; description: string; class_id?: string; meeting_url: string; starts_at: string }) {
  const { error } = await supabase.from('live_sessions').insert({
    host_id: uid, title: l.title, description: l.description, class_id: l.class_id || null,
    meeting_url: l.meeting_url, starts_at: l.starts_at, status: 'scheduled',
  });
  fail(error);
}

export async function setLiveStatus(id: string, status: 'scheduled' | 'live' | 'ended' | 'cancelled') {
  const { error } = await supabase.from('live_sessions').update({ status }).eq('id', id);
  fail(error);
}

export async function sendMessage(uid: string, m: DirectMessage) {
  const att = m.attachment ? { attachment_url: m.attachment.url, attachment_name: m.attachment.name } : {};
  const { error } = m.channel_id
    ? await supabase.from('class_messages').insert({ class_id: m.channel_id, sender_id: uid, body: m.body, ...att })
    : await supabase.from('direct_messages').insert({ sender_id: uid, recipient_id: m.recipient_id, body: m.body, ...att });
  fail(error);
}

export async function markNotificationRead(id: string) {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
}

export async function createReport(uid: string, r: { target_type: 'post' | 'profile' | 'comment' | 'message'; target_id: string; reason: string; details?: string; snapshot?: string }) {
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: uid, target_type: r.target_type, target_id: r.target_id, reason: r.reason,
    details: r.details || '', snapshot: (r.snapshot || '').slice(0, 500),
  });
  fail(error);
}

export async function setReportStatus(id: string, status: 'resolved' | 'dismissed') {
  const { error } = await supabase.from('content_reports').update({ status }).eq('id', id);
  fail(error);
}

export async function deletePost(id: string) {
  const { error } = await supabase.from('posts').delete().eq('id', id);
  fail(error);
}

export async function adminStats(): Promise<Record<string, number> | null> {
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) return null;
  return data as Record<string, number>;
}

/* ------------------------------------------------------------------ */
/* Management actions                                                  */
/* ------------------------------------------------------------------ */

export async function deleteRow(table: 'lessons' | 'quizzes' | 'assignments' | 'classes' | 'live_sessions', id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  fail(error);
}

export async function leaveClass(uid: string, classId: string) {
  const { error } = await supabase.from('class_members').delete().eq('class_id', classId).eq('user_id', uid);
  fail(error);
}

export async function removeMember(classId: string, userId: string) {
  const { error } = await supabase.from('class_members').delete().eq('class_id', classId).eq('user_id', userId);
  fail(error);
}

export async function archiveClass(id: string, archived: boolean) {
  const { error } = await supabase.from('classes').update({ is_archived: archived }).eq('id', id);
  fail(error);
}

export async function markDmRead(ids: string[]) {
  if (!ids.length) return;
  await supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).in('id', ids);
}

export interface AdminUser { id: string; display_name: string; role: AppRole; is_suspended: boolean; created_at: string; }
export async function listUsers(q = ''): Promise<AdminUser[]> {
  let query = supabase.from('profiles').select('id, display_name, role, is_suspended, created_at').order('created_at', { ascending: false }).limit(100);
  if (q.trim()) query = query.ilike('display_name', `%${q.trim()}%`);
  const { data, error } = await query;
  if (error) { console.warn('[NEMVIA] users:', error.message); return []; }
  return (data || []) as AdminUser[];
}

export async function setUserRole(id: string, role: AppRole) {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  fail(error);
}

export async function setSuspended(id: string, suspended: boolean) {
  const { error } = await supabase.from('profiles').update({ is_suspended: suspended }).eq('id', id);
  fail(error);
}
