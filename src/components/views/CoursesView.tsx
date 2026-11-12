import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Play, 
  FileText, 
  CheckCircle, 
  Award, 
  Clock, 
  HelpCircle, 
  Plus, 
  ChevronRight, 
  Sparkles,
  Download,
  AlertCircle
} from 'lucide-react';
import { AppRole, Course, Lesson, Quiz, QuizAnswerValue, QuizQuestion, QuizQuestionGrade } from '../../types';

import { LessonBuilderModal, QuizBuilderModal } from '../ContentBuilder';
import { QuizResult, UploadedFile } from '../../lib/api';
import { ClassItem } from '../../types';
import { QuizAttemptReview } from '../QuizAttemptReview';

interface CoursesViewProps {
  currentRole: AppRole;
  currentUserName: string;
  courses: Course[];
  lessons: Lesson[];
  quizzes: Quiz[];
  currentUserId: string;
  classes: ClassItem[];
  onSubmitQuiz: (quizId: string, answers: Record<string, QuizAnswerValue>) => Promise<QuizResult>;
  onGradeQuizAttempt: (attemptId: string, grades: Record<string, QuizQuestionGrade>, feedback: string) => Promise<boolean>;
  onUpload: (f: File, folder: string) => Promise<UploadedFile>;
  onDeleteLesson: (id: string) => void;
  onDeleteQuiz: (id: string) => void;
  onAddQuiz: (quiz: Quiz) => void;
  onAddLesson: (lesson: Lesson) => void;
  onRewardPoints: (points: number) => void;
}

export const CoursesView: React.FC<CoursesViewProps> = ({
  currentRole,
  currentUserName,
  courses,
  lessons,
  quizzes,
  currentUserId,
  classes,
  onSubmitQuiz,
  onGradeQuizAttempt,
  onUpload,
  onDeleteLesson,
  onDeleteQuiz,
  onAddQuiz,
  onAddLesson,
  onRewardPoints,
}) => {
  const [activeTab, setActiveTab] = useState<'courses' | 'lessons' | 'quizzes'>('quizzes');
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  // Active Quiz Taking Mode State
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, QuizAnswerValue>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);

  // Teacher builders
  const [showQuizBuilder, setShowQuizBuilder] = useState(false);
  const [showLessonBuilder, setShowLessonBuilder] = useState(false);
  const myClasses = classes.filter(c => c.teacher_id === currentUserId);
  const canBuild = (currentRole === 'teacher' || currentRole === 'admin') && myClasses.length > 0;

  // Server-side grading result
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const answersRef = useRef<Record<string, QuizAnswerValue>>({});
  const finishingRef = useRef(false);

  // Quiz Timer
  useEffect(() => {
    if (!activeQuiz || quizSubmitted || activeQuiz.timeLimitMinutes <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleFinishQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeQuiz, quizSubmitted]);

  const handleStartQuiz = (q: Quiz) => {
    setActiveQuiz(q);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    answersRef.current = {};
    finishingRef.current = false;
    setQuizResult(null);
    setQuizSubmitted(false);
    setTimeLeft(q.timeLimitMinutes * 60);
  };

  const handleSelectOption = (questionId: string, answer: QuizAnswerValue) => {
    if (quizSubmitted) return;
    answersRef.current = { ...answersRef.current, [questionId]: answer };
    setSelectedAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleFinishQuiz = async () => {
    if (!activeQuiz || finishingRef.current) return;
    finishingRef.current = true;
    try {
      const res = await onSubmitQuiz(activeQuiz.id, answersRef.current);
      setQuizResult(res);
      setQuizScore(res.score);
      setQuizSubmitted(true);
      if (!res.pendingReview) onRewardPoints(res.score * 10);
    } catch {
      finishingRef.current = false;
      setActiveQuiz(null); // رسالة الخطأ تظهر من الواجهة الرئيسية
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Quiz Active Taking Modal / Fullscreen Simulator */}
      {activeQuiz && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Quiz Modal Header */}
            <div className="bg-gradient-to-r from-[#0f233a] to-[#1677c7] text-white p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] text-sky-200 font-bold uppercase tracking-wider block">
                  اختبار تقييم مستوى فوري · NEMVIA Quiz Engine
                </span>
                <h3 className="font-black text-base sm:text-lg">{activeQuiz.title}</h3>
              </div>

              {!quizSubmitted ? (
                <div className="bg-white/15 px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-300" />
                  <span>
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              ) : (
                <div className="bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1">
                  <Award className="w-4 h-4" />
                  <span>اكتمل الاختبار</span>
                </div>
              )}
            </div>

            {/* Quiz Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
              {!quizSubmitted ? (
                // In Progress
                <div className="space-y-5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-2 border-b border-slate-100">
                    <span>السؤال {currentQuestionIndex + 1} من {activeQuiz.questions.length}</span>
                    <span>الدرجة: {activeQuiz.questions[currentQuestionIndex].points} نقاط</span>
                  </div>

                  <h4 className="font-extrabold text-base sm:text-lg text-slate-900 leading-relaxed">
                    {activeQuiz.questions[currentQuestionIndex].question}
                  </h4>

                  <div className="space-y-3">
                    {activeQuiz.questions[currentQuestionIndex].options.map((opt, idx) => {
                      const isSelected = selectedAnswers[activeQuiz.questions[currentQuestionIndex].id] === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectOption(activeQuiz.questions[currentQuestionIndex].id, idx)}
                          className={`w-full p-4 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer text-sm font-semibold ${
                            isSelected
                              ? 'bg-sky-50 border-[#1677c7] text-[#0f233a] shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isSelected ? 'bg-[#1677c7] text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {['أ', 'ب', 'ج', 'د'][idx]}
                          </span>
                          <span className="flex-1">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Quiz Results & Certificate
                <div className="space-y-6 text-center animate-in zoom-in-95">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
                    🎉
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900">أحسنت عملاً يا {currentUserName}!</h3>
                    <p className="text-xs text-slate-500">تم تصحيح إجاباتك تلقائياً وحساب نتيجتك</p>
                  </div>

                  {/* Score Card */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 max-w-sm mx-auto flex items-center justify-around">
                    <div>
                      <span className="text-xs text-slate-400 block font-bold">النتيجة النهائية</span>
                      <span className="text-3xl font-black text-emerald-600">
                        {quizScore} <span className="text-sm font-normal text-slate-400">/ {quizResult?.total ?? 0}</span>
                      </span>
                    </div>
                    <div className="h-10 w-px bg-slate-200" />
                    <div>
                      <span className="text-xs text-slate-400 block font-bold">نقاط المكافأة</span>
                      <span className="text-2xl font-black text-amber-500">+{Math.min(quizScore * 10, 100)} XP</span>
                    </div>
                  </div>

                  {/* Generated Certificate Card */}
                  <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl text-amber-950 text-right space-y-2 relative overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <span className="text-xs font-black uppercase text-amber-800">شهادة إتمام اختبار مصدقة · NEMVIA</span>
                      <Award className="w-5 h-5 text-amber-600" />
                    </div>
                    <p className="text-xs leading-relaxed">
                      تشهد منصة <strong>NEMVIA</strong> بأن الطالب/ـة <strong>{currentUserName}</strong> قد اجتاز بنجاح اختبار <em>"{activeQuiz.title}"</em> بدرجة تميز وتفوق.
                    </p>
                    <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between text-[11px] text-amber-900">
                      <span>التحقق: NEMVIA-CERT-PASS</span>
                      <span className="font-bold">توقيع المؤسس: محمد جمال نعمه ✍️</span>
                    </div>
                  </div>

                  {/* Questions explanations */}
                  <div className="text-right space-y-3 pt-2">
                    <h5 className="font-bold text-xs text-slate-700">مراجعة الإجابات النموذجية:</h5>
                    {activeQuiz.questions.map((q, i) => {
                      const userChoice = selectedAnswers[q.id];
                      const k = quizResult?.key?.[q.id];
                      const isCorrect = k ? userChoice === k.correct : false;
                      return (
                        <div key={q.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-slate-900">{i + 1}. {q.question}</span>
                            <span className={`text-[11px] ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isCorrect ? '✓ إجابة صحيحة' : '✗ إجابة خاطئة'}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px] leading-relaxed">
                            <strong>التفسير العلمي:</strong> {k?.explanation || '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quiz Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              {!quizSubmitted ? (
                <>
                  <button
                    onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs disabled:opacity-40 cursor-pointer"
                  >
                    السابق
                  </button>

                  {currentQuestionIndex < activeQuiz.questions.length - 1 ? (
                    <button
                      onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                      className="px-5 py-2 bg-[#1677c7] text-white font-bold rounded-xl text-xs cursor-pointer"
                    >
                      التالي ←
                    </button>
                  ) : (
                    <button
                      onClick={handleFinishQuiz}
                      className="px-6 py-2 bg-emerald-600 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-700/20 cursor-pointer"
                    >
                      تسليم الإجابات وإنهاء الاختبار ✓
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setActiveQuiz(null)}
                  className="w-full py-2.5 bg-[#0f233a] text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  إغلاق ومتابعة الدروس
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">المحتوى الأكاديمي واختبارات المستوى</h2>
          <p className="text-xs text-slate-500">دروس فيديو، شروحات مفصلة، واختبارات ذكية مع تصحيح فوري</p>
        </div>

        {canBuild && (
          <div className="flex items-center gap-2 text-xs font-bold">
            <button onClick={() => setShowLessonBuilder(true)} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl cursor-pointer">+ درس</button>
            <button onClick={() => setShowQuizBuilder(true)} className="px-3 py-2 bg-[#1677c7] hover:bg-[#125fa0] text-white rounded-xl cursor-pointer">+ اختبار</button>
          </div>
        )}

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('quizzes')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'quizzes' ? 'bg-white text-[#1677c7] shadow-xs' : 'text-slate-600'
            }`}
          >
            الاختبارات الذكية ({quizzes.length})
          </button>
          <button
            onClick={() => setActiveTab('lessons')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'lessons' ? 'bg-white text-[#1677c7] shadow-xs' : 'text-slate-600'
            }`}
          >
            الدروس والشروحات ({lessons.length})
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'courses' ? 'bg-white text-[#1677c7] shadow-xs' : 'text-slate-600'
            }`}
          >
            الدورات التعليمية ({courses.length})
          </button>
        </div>
      </div>

      {showLessonBuilder && (
        <LessonBuilderModal classes={myClasses} teacherName={currentUserName} onClose={() => setShowLessonBuilder(false)} onSubmit={onAddLesson} onUpload={onUpload} />
      )}
      {showQuizBuilder && (
        <QuizBuilderModal classes={myClasses} onClose={() => setShowQuizBuilder(false)} onSubmit={onAddQuiz} />
      )}

      {((activeTab === 'quizzes' && quizzes.length === 0) || (activeTab === 'lessons' && lessons.length === 0) || (activeTab === 'courses' && courses.length === 0)) && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          لا يوجد محتوى هنا بعد. انضم إلى صف باستخدام رمز الانضمام{canBuild ? '، أو أضف درساً أو اختباراً من الأزرار أعلاه' : ' ليظهر لك محتواه'}.
        </div>
      )}

      {/* QUIZZES TAB */}
      {activeTab === 'quizzes' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {quizzes.map((q) => (
              <div 
                key={q.id} 
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-[#1677c7] transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      تصحيح تلقائي فوري
                    </span>
                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {q.timeLimitMinutes} دقائق
                    </span>
                  </div>

                  <h3 className="font-extrabold text-slate-900 text-base">{q.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{q.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    عدد الأسئلة: <strong>{q.questions.length}</strong> · إنجاز: <strong>{q.attemptsCount} طالب</strong>
                  </span>
                  {(currentRole === 'admin' || classes.find(c => c.id === q.class_id)?.teacher_id === currentUserId) && (
                    <button onClick={() => onDeleteQuiz(q.id)} className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl cursor-pointer">حذف</button>
                  )}
                  {q.attempted ? (
                    <span className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-xl">
                      تم الحل ✓ · نتيجتك {q.myScore}
                    </span>
                  ) : q.questions.length === 0 ? (
                    <span className="text-slate-400">لا توجد أسئلة</span>
                  ) : (
                  <button
                    onClick={() => handleStartQuiz(q)}
                    className="px-4 py-2 bg-[#1677c7] hover:bg-[#125fa0] text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>ابدأ الاختبار الآن</span>
                  </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LESSONS TAB */}
      {activeTab === 'lessons' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {lessons.map((ls) => (
              <div key={ls.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
                    درس تفاعلي
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{ls.duration || ''}</span>
                </div>

                <h3 className="font-extrabold text-slate-900 text-base">{ls.title}</h3>
                <p className={`text-xs text-slate-600 leading-relaxed whitespace-pre-line ${selectedLesson?.id === ls.id ? '' : 'line-clamp-3'}`}>
                  {ls.content}
                </p>
                {selectedLesson?.id === ls.id && ls.video_url && (
                  <div className="aspect-video rounded-xl overflow-hidden bg-slate-900">
                    <iframe src={ls.video_url} title={ls.title} className="w-full h-full" allowFullScreen
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" />
                  </div>
                )}
                {selectedLesson?.id === ls.id && ls.attachment_url && (
                  <a href={ls.attachment_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-sky-50 text-[#1677c7] font-bold rounded-xl text-xs">
                    <Download className="w-3.5 h-3.5" /> تحميل المرفق: {ls.attachment_name}
                  </a>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">الأستاذ: {ls.teacher_name}</span>
                  <div className="flex items-center gap-2">
                    {(ls.teacher_id === currentUserId || currentRole === 'admin') && (
                      <button onClick={() => onDeleteLesson(ls.id)} className="text-rose-600 font-bold cursor-pointer">حذف</button>
                    )}
                    <button onClick={() => setSelectedLesson(selectedLesson?.id === ls.id ? null : ls)} className="text-[#1677c7] font-bold cursor-pointer">
                      {selectedLesson?.id === ls.id ? 'إخفاء' : 'فتح الدرس'}
                    </button>
                  </div>
                  {ls.attachment_name && (
                    <span className="text-[11px] text-[#1677c7] font-bold flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      {ls.attachment_name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COURSES TAB */}
      {activeTab === 'courses' && (
        <div className="grid md:grid-cols-2 gap-4">
          {courses.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col justify-between">
              <div className="h-40 relative overflow-hidden bg-slate-100">
                <img src={c.image_url} alt={c.title} className="w-full h-full object-cover" />
                <span className="absolute top-3 right-3 bg-[#0f233a]/80 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                  {c.category}
                </span>
              </div>

              <div className="p-5 space-y-2.5">
                <h3 className="font-extrabold text-slate-900 text-base">{c.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{c.description}</p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>{c.lessons_count} دروس · {c.students_count} طالب مسجل</span>
                  <span className="font-bold text-amber-500">★ {c.rating}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
