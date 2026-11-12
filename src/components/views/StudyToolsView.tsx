import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  RotateCw, 
  Play, 
  Pause, 
  RotateCcw, 
  Award, 
  CheckCircle, 
  Volume2, 
  VolumeX, 
  Download, 
  Printer, 
  Plus, 
  Zap, 
  BrainCircuit, 
  Activity, 
  TrendingUp, 
  Check, 
  X,
  Clock,
  Layers,
  ChevronRight,
  ChevronLeft,
  Flame,
  Target
} from 'lucide-react';
import { Profile } from '../../types';

interface StudyToolsViewProps {
  currentProfile: Profile;
  onRewardXP: (xp: number) => void;
  initialTab?: 'flashcards' | 'pomodoro' | 'grapher' | 'certificate' | 'badges';
}

interface Flashcard {
  id: string;
  subject: string;
  front: string;
  back: string;
  hint?: string;
  category: 'math' | 'physics' | 'cs' | 'english';
}

const INITIAL_CARDS: Flashcard[] = [
  {
    id: 'c1',
    subject: 'الرياضيات المتقدمة',
    category: 'math',
    front: 'ما هو قانون المميز (Δ) في المعادلة التربيعية ax² + bx + c = 0 وما دلالته؟',
    back: 'Δ = b² - 4ac\n• إذا Δ > 0: يوجد حلان حقيقيان متمايزان.\n• إذا Δ = 0: يوجد حل وحيد مكرر.\n• إذا Δ < 0: لا توجد حلول حقيقية في ℝ (جذور مركبة).',
    hint: 'المميز يحدد عدد وطبيعة الجذور',
  },
  {
    id: 'c2',
    subject: 'الفيزياء الكلاسيكية',
    category: 'physics',
    front: 'ما هو القانون الثاني لنيوتن في الحركة؟ وما هي وحداته الدولية؟',
    back: 'F = m · a\n(القوة = الكتلة × التسارع)\n• القوة: نيوتن (N = kg·m/s²)\n• الكتلة: كيلوغرام (kg)\n• التسارع: م/ث² (m/s²)',
    hint: 'يربط بين القوة الصافية وتغير سرعة الجسم',
  },
  {
    id: 'c3',
    subject: 'علوم الحاسوب والبرمجة',
    category: 'cs',
    front: 'ما هو التعقيد الزمني (Time Complexity) لخوارزمية البحث الثنائي (Binary Search)؟',
    back: 'O(log n)\nلأن الخوارزمية تقسم نطاق البحث في المصفوفة المرتبة إلى النصف في كل خطوة.',
    hint: 'تتطلب مصفوفة مرتبة سلفاً',
  },
  {
    id: 'c4',
    subject: 'اللغة الإنجليزية الأكاديمية',
    category: 'english',
    front: 'ما معنى واستخدام المصطلح الأكاديمي: "Prerequisite"؟',
    back: 'المعنى: متطلب سابق إجباري.\nالاستخدام: كورس أو مهارة يجب إتمامها قبل التسجيل في مساق أعلى (e.g., "Calculus I is a prerequisite for Calculus II").',
    hint: 'Pre = مسبق',
  },
];

export const StudyToolsView: React.FC<StudyToolsViewProps> = ({
  currentProfile,
  onRewardXP,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<'flashcards' | 'pomodoro' | 'grapher' | 'certificate' | 'badges'>(
    initialTab || 'flashcards'
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // FLASHCARDS STATE
  const [cards, setCards] = useState<Flashcard[]>(() => {
    try {
      const raw = localStorage.getItem(`nemvia-cards-${currentProfile.id}`);
      if (raw) return JSON.parse(raw) as Flashcard[];
    } catch { /* تجاهل */ }
    return INITIAL_CARDS;
  });
  useEffect(() => {
    try { localStorage.setItem(`nemvia-cards-${currentProfile.id}`, JSON.stringify(cards)); } catch { /* تجاهل */ }
  }, [cards]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [reviewedCount, setReviewedCount] = useState(0);

  const filteredCards = cards.filter(c => selectedCategory === 'all' || c.category === selectedCategory);
  const activeCard = filteredCards[currentCardIndex] || filteredCards[0];

  const handleNextCard = (difficulty: 'easy' | 'medium' | 'hard') => {
    setIsFlipped(false);
    setReviewedCount(prev => prev + 1);
    if (difficulty === 'easy') onRewardXP(15);
    else onRewardXP(25);

    setTimeout(() => {
      setCurrentCardIndex((currentCardIndex + 1) % filteredCards.length);
    }, 200);
  };

  // POMODORO TIMER STATE
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<'work' | 'break'>('work');
  const [ambientSound, setAmbientSound] = useState<'none' | 'rain' | 'library' | 'waves'>('none');
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundNodeRef = useRef<AudioNode | null>(null);

  // Timer Tick
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(sec => sec - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
      if (timerMode === 'work') {
        onRewardXP(50);
        setTimerMode('break');
        setTimerSeconds(5 * 60);
      } else {
        setTimerMode('work');
        setTimerSeconds(25 * 60);
      }
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds, timerMode]);

  // Web Audio Synthesizer for ambient sounds (100% offline, pure Web Audio)
  const stopAmbientSound = () => {
    if (soundNodeRef.current) {
      try {
        (soundNodeRef.current as any).stop?.();
        soundNodeRef.current.disconnect();
      } catch (e) {}
      soundNodeRef.current = null;
    }
    setAmbientSound('none');
  };

  const playAmbientSound = (type: 'rain' | 'library' | 'waves') => {
    stopAmbientSound();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = audioContextRef.current || new AudioCtx();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();

      // Synthesize pink/brown relaxing noise buffer
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Low pass filtering for warm ambient sound
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 0.4;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      if (type === 'rain') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);
      } else if (type === 'waves') {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(450, ctx.currentTime);
      } else {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime);
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      soundNodeRef.current = noise;
      setAmbientSound(type);
    } catch (err) {
      console.warn('Audio synthesis not supported:', err);
    }
  };

  // MATHEMATICAL GRAPHER STATE
  const graphCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [graphFunction, setGraphFunction] = useState<'sin' | 'parabola' | 'cubic' | 'linear'>('parabola');

  useEffect(() => {
    if (activeTab !== 'grapher') return;
    const canvas = graphCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Draw coordinate grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x <= width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Axes
    const originX = width / 2;
    const originY = height / 2;
    ctx.strokeStyle = '#0f233a';
    ctx.lineWidth = 2;
    // X Axis
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();
    // Y Axis
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    // Plot Function curve
    ctx.strokeStyle = '#1677c7';
    ctx.lineWidth = 3;
    ctx.beginPath();

    const scale = 30; // 30px per unit
    let isFirst = true;

    for (let px = 0; px <= width; px += 2) {
      const mathX = (px - originX) / scale;
      let mathY = 0;

      if (graphFunction === 'sin') mathY = Math.sin(mathX);
      else if (graphFunction === 'parabola') mathY = 0.5 * mathX * mathX - 2;
      else if (graphFunction === 'cubic') mathY = 0.15 * mathX * mathX * mathX;
      else if (graphFunction === 'linear') mathY = 0.8 * mathX + 1;

      const py = originY - (mathY * scale);
      if (isFirst) {
        ctx.moveTo(px, py);
        isFirst = false;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }, [activeTab, graphFunction]);

  // CERTIFICATE DOWNLOAD / PRINT
  const handlePrintCertificate = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#0f233a] via-[#164673] to-[#1677c7] text-white p-6 sm:p-7 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="text-xs font-bold text-sky-200 bg-white/10 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>مختبر وأدوات التفوق الأكاديمي الذكية NEMVIA Toolkit</span>
          </span>
          <h2 className="text-2xl sm:text-3xl font-black">
            بطاقات مراجعة ذكية، غرفة بومودورو، محاكي الرياضيات، والشهادات المعتمدة
          </h2>
          <p className="text-xs sm:text-sm text-sky-100 leading-relaxed">
            مجموعة أدوات متكاملة طُورت لتعزيز تركيزك وحفظك للقوانين، مع مؤقت دراسة عالمي وأصوات بيئية هادئة، ومحاكي رسومي تفاعلي، وشهادات إتمام بتوقيع مؤسس المنصة.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white/10 p-3 rounded-2xl border border-white/20 text-xs shrink-0">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-black text-base shadow-md">
            XP
          </div>
          <div>
            <span className="font-bold text-white block">رصيد نقاطك الحالي:</span>
            <span className="font-black text-amber-300 text-sm">{currentProfile.points} نقطة خبرة</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs for Tools */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'flashcards', label: 'بطاقات المراجعة (Flashcards) 🧠', icon: Layers },
          { id: 'pomodoro', label: 'مؤقت التركيز بومودورو ⏱️', icon: Clock },
          { id: 'grapher', label: 'محاكي الدوال والمنحنيات 📐', icon: Activity },
          { id: 'certificate', label: 'الشهادة الأكاديمية الرسمية 🎓', icon: Award },
          { id: 'badges', label: 'الأوسمة ولوحة الشرف 🏆', icon: Zap },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-[#1677c7] text-white shadow-md shadow-sky-950/10'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: 3D FLASHCARDS ENGINE */}
      {activeTab === 'flashcards' && (
        <div className="space-y-6">
          {/* Categories Filter */}
          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
              {[
                { id: 'all', label: 'كل المواد' },
                { id: 'math', label: 'رياضيات 📐' },
                { id: 'physics', label: 'فيزياء ⚡' },
                { id: 'cs', label: 'برمجة 💻' },
                { id: 'english', label: 'إنجليزية 📖' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setCurrentCardIndex(0);
                    setIsFlipped(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    selectedCategory === cat.id ? 'bg-white text-[#1677c7] shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <span className="text-slate-500 font-bold">
              البطاقة {currentCardIndex + 1} من {filteredCards.length} · تم مراجعة {reviewedCount} بطاقة
            </span>
          </div>

          {/* Interactive 3D Flip Flashcard */}
          {activeCard && (
            <div className="max-w-xl mx-auto space-y-4">
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="relative min-h-[280px] sm:min-h-[320px] rounded-3xl p-6 sm:p-8 cursor-pointer select-none transition-all duration-300 transform perspective-1000 shadow-xl border-2 border-slate-200 flex flex-col justify-between text-center overflow-hidden bg-white hover:border-[#1677c7]"
              >
                {/* Header of Card */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="px-2.5 py-1 bg-sky-50 text-[#1677c7] font-bold rounded-lg border border-sky-100">
                    {activeCard.subject}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold">
                    <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                    <span>انقر على البطاقة لقلبها</span>
                  </span>
                </div>

                {/* Content: Front or Back */}
                <div className="my-auto py-4 space-y-3">
                  <span className="text-xs font-black uppercase text-slate-400 tracking-wider block">
                    {isFlipped ? 'الإجابة والقانون والشرح 💡' : 'السؤال أو المفهوم الأساسي ❓'}
                  </span>
                  <p className={`font-black text-slate-900 leading-relaxed whitespace-pre-wrap ${
                    isFlipped ? 'text-base sm:text-lg text-emerald-950 font-sans' : 'text-lg sm:text-xl'
                  }`}>
                    {isFlipped ? activeCard.back : activeCard.front}
                  </p>
                  {!isFlipped && activeCard.hint && (
                    <span className="text-[11px] text-slate-400 block">
                      تلميح: {activeCard.hint}
                    </span>
                  )}
                </div>

                {/* Card Footer */}
                <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-2">
                  نظام التكرار المتباعد (Spaced Repetition) الذكي
                </div>
              </div>

              {/* Action Buttons for Card Spaced Repetition */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => handleNextCard('hard')}
                  className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-2xl border border-rose-200 transition-colors cursor-pointer"
                >
                  صعب / يحتاج مراجعة (0 XP)
                </button>
                <button
                  onClick={() => handleNextCard('medium')}
                  className="flex-1 py-3 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-2xl border border-amber-200 transition-colors cursor-pointer"
                >
                  متوسط الصعوبة (+15 XP)
                </button>
                <button
                  onClick={() => handleNextCard('easy')}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl shadow-md shadow-emerald-900/10 transition-colors cursor-pointer"
                >
                  سهل وحفظته تماماً! (+25 XP)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: POMODORO FOCUS ROOM & SOOTHING AMBIENT SOUNDS */}
      {activeTab === 'pomodoro' && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm text-center space-y-6">
            <div className="flex items-center justify-center gap-2">
              <span className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                timerMode === 'work' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {timerMode === 'work' ? '🔥 جلسة تركيز مكثفة (25 دقيقة)' : '☕ وقت استراحة قصيرة (5 دقائق)'}
              </span>
            </div>

            {/* Giant Digital Clock */}
            <div className="text-6xl sm:text-7xl font-black text-slate-900 font-mono tracking-tight">
              {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
              {String(timerSeconds % 60).padStart(2, '0')}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={`px-8 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                  isTimerRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-900/20'
                    : 'bg-[#1677c7] hover:bg-[#125fa0] text-white shadow-sky-950/20'
                }`}
              >
                {isTimerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                <span>{isTimerRunning ? 'إيقاف مؤقت' : 'بدء التركيز الآن'}</span>
              </button>

              <button
                onClick={() => {
                  setIsTimerRunning(false);
                  setTimerSeconds(timerMode === 'work' ? 25 * 60 : 5 * 60);
                }}
                className="p-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                title="إعادة ضبط المؤقت"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>

            {/* Ambient Sound Generator for Deep Focus */}
            <div className="pt-6 border-t border-slate-100 space-y-3">
              <span className="text-xs font-bold text-slate-600 block">
                أصوات بيئية مهدئة ومحفزة للتركيز (توليد صوتي نقي بدون إنترنت):
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                  { id: 'none', label: 'صامت 🔇' },
                  { id: 'rain', label: 'صوت المطر الهادئ 🌧️' },
                  { id: 'waves', label: 'أمواج البحر الهادئة 🌊' },
                  { id: 'library', label: 'مكتبة هادئة (Noise) 📚' },
                ].map(snd => (
                  <button
                    key={snd.id}
                    onClick={() => {
                      if (snd.id === 'none') stopAmbientSound();
                      else playAmbientSound(snd.id as any);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      ambientSound === snd.id
                        ? 'bg-[#0f233a] text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {snd.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MATHEMATICAL LAB & FUNCTION GRAPHER */}
      {activeTab === 'grapher' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">اختر الدالة الرياضية لرسمها:</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'parabola', label: 'قطع مكافئ f(x) = 0.5x² - 2' },
                  { id: 'sin', label: 'دالة الجيب f(x) = sin(x)' },
                  { id: 'cubic', label: 'دالة تكعيبية f(x) = 0.15x³' },
                  { id: 'linear', label: 'دالة خطية f(x) = 0.8x + 1' },
                ].map(fn => (
                  <button
                    key={fn.id}
                    onClick={() => setGraphFunction(fn.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      graphFunction === fn.id ? 'bg-white text-[#1677c7] shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {fn.label}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-slate-400 font-mono text-[11px]">مقياس الرسم: 1 unit = 30px</span>
          </div>

          <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-md p-4 overflow-hidden flex justify-center">
            <canvas
              ref={graphCanvasRef}
              width={800}
              height={450}
              className="max-w-full rounded-2xl bg-white border border-slate-100"
            />
          </div>
        </div>
      )}

      {/* TAB 4: OFFICIAL CERTIFICATE WITH FOUNDER MOHAMMED JAMAL NIME */}
      {activeTab === 'certificate' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">شهادة إتمام معتمدة قابلة للطباعة والتنزيل:</span>
            <button
              onClick={handlePrintCertificate}
              className="px-4 py-2 bg-[#1677c7] hover:bg-[#125fa0] text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / حفظ الشهادة PDF</span>
            </button>
          </div>

          {/* Luxury Academic Certificate Preview */}
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-amber-50/60 via-white to-sky-50/50 border-8 border-double border-amber-600/40 shadow-2xl relative overflow-hidden space-y-8 text-center print:border-none print:shadow-none">
            {/* Watermark Logo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-900/5 font-black text-9xl pointer-events-none select-none">
              NEMVIA
            </div>

            {/* Header */}
            <div className="space-y-2">
              <div className="inline-block p-2 rounded-2xl bg-gradient-to-br from-[#0f233a] to-[#1677c7] text-white font-black text-2xl shadow-lg">
                NEMVIA
              </div>
              <h3 className="text-xs uppercase tracking-widest font-black text-amber-700 pt-2">
                شهادة مشاركة وإنجاز · CERTIFICATE OF ACHIEVEMENT
              </h3>
            </div>

            {/* Certificate Body */}
            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-slate-500">
                تشهد إدارة منصة <strong>NEMVIA التعليمية</strong> بأن الطالب(ـة) المتميز(ة):
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 underline decoration-amber-400 decoration-2 underline-offset-8">
                {currentProfile.display_name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed pt-2">
                شارك(ت) في منصة NEMVIA التعليمية وحصل(ت) على رصيد إنجاز <strong>{currentProfile.points} XP</strong> من خلال الاختبارات والمراجعة والنشاط. شهادة تحفيزية داخل المنصة.
              </p>
            </div>

            {/* Signatures & Seal */}
            <div className="pt-8 border-t border-amber-900/10 flex items-center justify-between text-xs px-4">
              <div className="text-right space-y-1">
                <span className="text-[10px] text-slate-400 block font-mono">رقم المرجع:</span>
                <span className="font-mono font-bold text-slate-700 text-xs">NEMVIA-{currentProfile.id.slice(0, 8).toUpperCase()}</span>
                <span className="text-[10px] text-slate-400 block">التاريخ: {new Date().toLocaleDateString('ar')}</span>
              </div>

              {/* Gold Seal */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white flex flex-col items-center justify-center shadow-lg border-2 border-white ring-4 ring-amber-200">
                <Award className="w-6 h-6 text-white" />
                <span className="text-[8px] font-black uppercase">NEMVIA</span>
              </div>

              {/* Founder Signature with exact spelling: محمد جمال نعمه */}
              <div className="text-left space-y-1">
                <span className="font-bold text-[#0f233a] block text-sm">محمد جمال نعمه</span>
                <span className="text-[10px] text-slate-500 block">مؤسس المنصة ورئيس الهيئة التعليمية</span>
                <span className="text-[9px] text-emerald-600 font-bold block">✓ توقيع رقمي موثق</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: BADGES & LEADERBOARD */}
      {activeTab === 'badges' && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: 'بطل المواظبة', desc: 'استمرار المذاكرة 7 أيام متتالية', icon: Flame, unlocked: true, color: 'text-orange-500 bg-orange-50' },
              { title: 'عبقري الرياضيات', desc: 'الحصول على درجة كاملة في الكويز', icon: Award, unlocked: true, color: 'text-amber-500 bg-amber-50' },
              { title: 'المشارك النشط', desc: 'نشر 5 مشاركات مفيدة في المجتمع', icon: Sparkles, unlocked: true, color: 'text-sky-500 bg-sky-50' },
              { title: 'خبير الخوارزميات', desc: 'حل واجب البرمجة في الوقت المحدد', icon: BrainCircuit, unlocked: false, color: 'text-purple-500 bg-purple-50' },
            ].map((badge, idx) => {
              const Icon = badge.icon;
              return (
                <div
                  key={idx}
                  className={`p-5 rounded-2xl border text-center space-y-3 transition-all ${
                    badge.unlocked 
                      ? 'bg-white border-slate-200 shadow-xs' 
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${badge.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">{badge.title}</h4>
                    <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">{badge.desc}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                    badge.unlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {badge.unlocked ? '✓ تم الحصول عليه' : '🔒 قيد الإنجاز'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
