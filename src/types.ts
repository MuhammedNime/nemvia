export type AppRole = 'student' | 'teacher' | 'admin';
export type AccountVisibility = 'public' | 'private';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url?: string;
  role: AppRole;
  visibility: AccountVisibility;
  points: number;
  streakDays: number;
  joinedDate: string;
  is_suspended?: boolean;
}

export interface ClassItem {
  id: string;
  teacher_id: string;
  teacher_name: string;
  title: string;
  subject: string;
  grade_level: string;
  join_code: string;
  description: string;
  class_type: 'class' | 'study';
  is_archived: boolean;
  members_count: number;
  colorTheme: string;
  created_at: string;
}

export interface Lesson {
  id: string;
  class_id: string;
  teacher_id: string;
  teacher_name: string;
  title: string;
  content: string;
  video_url?: string;
  duration?: string;
  attachment_url?: string;
  attachment_name?: string;
  position: number;
  published_at: string;
}

export interface Assignment {
  id: string;
  class_id: string;
  class_title: string;
  teacher_id: string;
  teacher_name: string;
  title: string;
  instructions: string;
  due_at: string;
  total_points: number;
  submissions_count: number;
  created_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  answer_text: string;
  attachment_url?: string;
  submitted_at: string;
  grade?: number;
  teacher_feedback?: string;
  graded_at?: string;
}

export type QuizQuestionType = 'single_choice' | 'true_false' | 'short_answer' | 'essay';
export type QuizAnswerValue = string | number | boolean;

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  question: string;
  options: string[];
  correctOptionIndex: number;
  correctAnswer?: string;
  acceptedAnswers?: string[];
  explanation: string;
  points: number;
}

export interface QuizQuestionGrade {
  score: number | null;
  feedback?: string;
  pending?: boolean;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  student_name: string;
  answers: Record<string, QuizAnswerValue>;
  score: number;
  totalPoints: number;
  gradingStatus: 'pending' | 'graded';
  questionGrades: Record<string, QuizQuestionGrade>;
  teacherFeedback?: string;
  submitted_at: string;
  graded_at?: string;
}

export interface Quiz {
  id: string;
  class_id: string;
  class_title: string;
  title: string;
  description: string;
  timeLimitMinutes: number;
  passPercentage: number;
  questions: QuizQuestion[];
  isPublished: boolean;
  attemptsCount: number;
  attempted?: boolean;
  myScore?: number;
  myGradingStatus?: 'pending' | 'graded';
  myTeacherFeedback?: string;
  attempts?: QuizAttempt[];
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  body: string;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  author_name: string;
  author_role: AppRole;
  author_avatar?: string;
  body: string;
  category: 'all' | 'questions' | 'notes' | 'announcements';
  media_url?: string;
  media_type?: 'image' | 'video' | 'document';
  visibility: 'public' | 'followers' | 'private';
  likes_count: number;
  comments_count: number;
  comments: PostComment[];
  is_liked?: boolean;
  is_saved?: boolean;
  created_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  user_name: string;
  user_role: AppRole;
  user_avatar?: string;
  body: string;
  bgGradient: string;
  created_at: string;
  expires_at: string;
}

export interface LiveSession {
  id: string;
  host_id: string;
  host_name: string;
  class_id?: string;
  class_title?: string;
  title: string;
  description: string;
  meeting_url?: string;
  starts_at: string;
  status: 'scheduled' | 'live' | 'ended';
  participants_count: number;
}

export interface ChatAttachment {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'image' | 'doc' | 'code';
  url: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role?: AppRole;
  recipient_id: string;
  recipient_name: string;
  channel_id?: string;
  body: string;
  attachment?: ChatAttachment;
  reactions?: Record<string, number>;
  created_at: string;
  read_at?: string;
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  category: string;
  avatar_icon: string;
  members_count: number;
  unread_count: number;
  is_official?: boolean;
}

export interface Course {
  id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  description: string;
  category: string;
  lessons_count: number;
  students_count: number;
  rating: number;
  image_url: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  kind: 'academic' | 'social' | 'live' | 'grade';
  created_at: string;
  read: boolean;
}

export interface ContentReport {
  id: string;
  target_id: string;
  target_type: 'post' | 'comment' | 'user' | 'message';
  reporter_name: string;
  reason: string;
  details: string;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface ContactInfo {
  id: string;
  name: string;
  role: AppRole;
  avatar_url?: string;
}

export interface ClassMemberInfo {
  class_id: string;
  user_id: string;
  name: string;
  member_role: 'student' | 'assistant';
}
