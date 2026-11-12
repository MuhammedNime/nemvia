import React, { useState, useRef, useEffect } from 'react';
import { 
  Video, 
  Mic, 
  MicOff, 
  VideoOff, 
  Monitor, 
  Hand, 
  Send, 
  Users, 
  MessageSquare, 
  Palette, 
  Eraser, 
  RotateCcw, 
  Download, 
  Sparkles,
  Clock,
  Radio,
  Camera,
  AlertCircle,
  Share2,
  ExternalLink,
  Plus,
  X
} from 'lucide-react';
import { AppRole, LiveSession, ClassItem } from '../../types';

interface LiveClassroomViewProps {
  currentRole: AppRole;
  currentUserId: string;
  currentUserName: string;
  sessions: LiveSession[];
  classes: ClassItem[];
  onScheduleSession: (l: { title: string; description: string; class_id?: string; meeting_url: string; starts_at: string }) => Promise<boolean>;
  onSetStatus: (id: string, status: 'live' | 'ended' | 'cancelled') => Promise<boolean>;
}

export const LiveClassroomView: React.FC<LiveClassroomViewProps> = ({
  currentRole,
  currentUserId,
  currentUserName,
  sessions,
  classes,
  onScheduleSession,
  onSetStatus,
}) => {
  const [isInRoom, setIsInRoom] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [sTitle, setSTitle] = useState('');
  const [sDesc, setSDesc] = useState('');
  const [sClass, setSClass] = useState('');
  const [sWhen, setSWhen] = useState('');
  const [sProvider, setSProvider] = useState<'jitsi' | 'custom'>('jitsi');
  const [sLink, setSLink] = useState('');
  const myClasses = classes.filter(c => c.teacher_id === currentUserId);
  const canHost = currentRole === 'teacher' || currentRole === 'admin';

  const submitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    let url = sLink.trim();
    if (sProvider === 'jitsi') {
      const room = 'nemvia-' + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
      url = `https://meet.jit.si/${room}`;
    } else if (!/^https:\/\//i.test(url)) {
      alert('الصق رابط الاجتماع كاملاً (يبدأ بـ https://)');
      return;
    }
    const ok = await onScheduleSession({
      title: sTitle.trim(), description: sDesc.trim(), class_id: sClass || undefined, meeting_url: url,
      starts_at: sWhen ? new Date(sWhen).toISOString() : new Date().toISOString(),
    });
    if (ok) { setShowSchedule(false); setSTitle(''); setSDesc(''); setSLink(''); setSWhen(''); }
  };
  const [activeSession, setActiveSession] = useState<LiveSession | null>(sessions[0] || null);

  // Classroom WebRTC media controls
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'participants' | 'poll'>('chat');
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'active' | 'denied' | 'unsupported'>('idle');

  // Video and Media Streams refs
  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Whiteboard Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#1677c7');
  const [penWidth, setPenWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [savedNotesMessage, setSavedNotesMessage] = useState(false);

  // Live Chat inside room
  const [roomChat, setRoomChat] = useState<{ id: string; sender: string; text: string; isTeacher: boolean; time: string }[]>([]);
  const [chatMessage, setChatMessage] = useState('');

  // Live Poll state
  const [pollVoted, setPollVoted] = useState<number | null>(null);
  const [pollVotes, setPollVotes] = useState({ 0: 0, 1: 0, 2: 0 });

  // WebRTC Camera & Mic initialization
  const startCameraStream = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('unsupported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      });
      mediaStreamRef.current = stream;
      setCameraStatus('active');
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera/Mic permission not granted or device missing:', err);
      setCameraStatus('denied');
    }
  };

  const stopAllMediaStreams = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    setCameraStatus('idle');
  };

  // Toggle Camera
  const toggleCamera = async () => {
    if (mediaStreamRef.current) {
      const videoTracks = mediaStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !isCamOn;
        videoTracks.forEach(track => { track.enabled = nextState; });
        setIsCamOn(nextState);
      } else if (!isCamOn) {
        await startCameraStream();
        setIsCamOn(true);
      }
    } else {
      await startCameraStream();
      setIsCamOn(true);
    }
  };

  // Toggle Mic
  const toggleMic = () => {
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      const nextState = !isMicOn;
      audioTracks.forEach(track => { track.enabled = nextState; });
      setIsMicOn(nextState);
    } else {
      setIsMicOn(!isMicOn);
    }
  };

  // Toggle Screen Sharing via getDisplayMedia
  const toggleScreenSharing = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
    } else {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          alert('خاصية مشاركة الشاشة غير مدعومة في هذا المتصفح');
          return;
        }
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = screenStream;
        }
        // Handle user stopping share from browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
        };
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
        setIsScreenSharing(false);
      }
    }
  };

  // When room is entered, trigger camera start
  useEffect(() => {
    if (isInRoom) {
      startCameraStream();
    } else {
      stopAllMediaStreams();
    }
    return () => {
      stopAllMediaStreams();
    };
  }, [isInRoom]);

  // Keep userVideoRef synchronized when mediaStreamRef updates
  useEffect(() => {
    if (userVideoRef.current && mediaStreamRef.current) {
      userVideoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [cameraStatus, isCamOn]);

  // Canvas drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = isEraser ? '#ffffff' : penColor;
    ctx.lineWidth = isEraser ? penWidth * 5 : penWidth;
    ctx.lineCap = 'round';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Download Whiteboard as PNG
  const downloadWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `لوحة_شرح_NEMVIA_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
    setSavedNotesMessage(true);
    setTimeout(() => setSavedNotesMessage(false), 3000);
  };

  const handleSendRoomChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    const newMsg = {
      id: Date.now().toString(),
      sender: currentUserName,
      text: chatMessage.trim(),
      isTeacher: currentRole === 'teacher' || currentRole === 'admin',
      time: new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }),
    };
    setRoomChat([...roomChat, newMsg]);
    setChatMessage('');
  };

  const handleVote = (idx: number) => {
    if (pollVoted !== null) return;
    setPollVoted(idx);
    setPollVotes(prev => ({
      ...prev,
      [idx]: (prev[idx as keyof typeof prev] || 0) + 1
    }));
  };

  // If outside of the live room, show scheduled sessions & launch screen
  if (!isInRoom) {
    return (
      <div className="space-y-6 animate-in fade-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0f233a] via-[#164673] to-[#1677c7] text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="text-xs font-bold text-sky-200 bg-white/10 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              قاعات البث المباشر والسبورة التفاعلية
            </span>
            <h2 className="text-2xl sm:text-3xl font-black">
              حصص دراسية حية مع كاميرا ويب حقيقية، سبورة ذكية، ومشاركة شاشة
            </h2>
            <p className="text-xs sm:text-sm text-sky-100 leading-relaxed">
              انضم للقاعات الافتراضية مباشرة من متصفحك بدون برامج خارجية! استمتع برسم المعادلات على السبورة الرقمية، تشغيل كاميرا الويب الخاصة بك، مشاركة الشاشة، وحفظ لوحة الشرح كصورة PNG فوراً.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {canHost && (
              <button
                onClick={() => setShowSchedule(true)}
                className="px-6 py-3.5 bg-white/15 hover:bg-white/25 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>جدولة حصة جديدة</span>
              </button>
            )}
            <button
              onClick={() => {
                setActiveSession(sessions[0] ?? null);
                setIsInRoom(true);
              }}
              className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-900/20 text-sm flex items-center justify-center gap-2 transition-transform hover:scale-105 cursor-pointer"
            >
              <Radio className="w-4 h-4 animate-ping" />
              <span>فتح السبورة التفاعلية والكاميرا</span>
            </button>
          </div>
        </div>

        {showSchedule && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={submitSchedule} className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-3 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900">جدولة حصة مباشرة</h3>
                <button type="button" onClick={() => setShowSchedule(false)} className="p-1 text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <input value={sTitle} onChange={e => setSTitle(e.target.value)} placeholder="عنوان الحصة" required maxLength={120} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
              <textarea value={sDesc} onChange={e => setSDesc(e.target.value)} placeholder="وصف مختصر" rows={2} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
              <div className="grid grid-cols-2 gap-3">
                <select value={sClass} onChange={e => setSClass(e.target.value)} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <option value="">حصة عامة (للجميع)</option>
                  {myClasses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <input type="datetime-local" value={sWhen} onChange={e => setSWhen(e.target.value)} required className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <button type="button" onClick={() => setSProvider('jitsi')} className={`py-2.5 rounded-xl border cursor-pointer ${sProvider === 'jitsi' ? 'border-[#1677c7] bg-sky-50 text-[#1677c7]' : 'border-slate-200 text-slate-500'}`}>Jitsi (تلقائي ومجاني)</button>
                <button type="button" onClick={() => setSProvider('custom')} className={`py-2.5 rounded-xl border cursor-pointer ${sProvider === 'custom' ? 'border-[#1677c7] bg-sky-50 text-[#1677c7]' : 'border-slate-200 text-slate-500'}`}>رابط Google Meet / غيره</button>
              </div>
              {sProvider === 'custom' && (
                <input value={sLink} onChange={e => setSLink(e.target.value)} placeholder="https://meet.google.com/xxx-xxxx-xxx" dir="ltr" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
              )}
              <button type="submit" className="w-full py-3 bg-[#1677c7] text-white font-black rounded-xl text-sm cursor-pointer">جدولة الحصة</button>
            </form>
          </div>
        )}

        {/* Sessions Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-lg">الحصص المجدولة والمباشرة القادمة</h3>
            <span className="text-xs text-slate-500">{sessions.length} حصص متاحة</span>
          </div>

          {sessions.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              لا توجد حصص مجدولة حالياً.{canHost ? ' اضغط «جدولة حصة جديدة» لإنشاء أول حصة.' : ''}
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {sessions.map((s) => (
              <div 
                key={s.id} 
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-[#1677c7] transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full bg-rose-500 ${s.status === 'live' ? 'animate-ping' : ''}`} />
                      {s.status === 'live' ? 'بث حي الآن' : s.status === 'ended' ? 'انتهت' : 'مجدولة'}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(s.starts_at).toLocaleString('ar', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-slate-900 text-base leading-snug">{s.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{s.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-sky-100 text-[#1677c7] flex items-center justify-center font-bold text-xs">
                      {s.host_name.slice(0, 1)}
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block">{s.host_name}</span>
                      <span className="text-[10px] text-slate-400">{s.class_title || 'حصة عامة'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {s.host_id === currentUserId && s.status !== 'ended' && (
                      <>
                        {s.status === 'scheduled' && (
                          <button onClick={() => onSetStatus(s.id, 'live')} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl cursor-pointer">ابدأ</button>
                        )}
                        {s.status === 'live' && (
                          <button onClick={() => onSetStatus(s.id, 'ended')} className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer">إنهاء</button>
                        )}
                        <button onClick={() => { if (confirm('إلغاء هذه الحصة؟')) onSetStatus(s.id, 'cancelled'); }} className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl cursor-pointer">إلغاء</button>
                      </>
                    )}
                    {s.meeting_url && s.status !== 'ended' && (
                      <a
                        href={s.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-[#1677c7] hover:bg-[#125fa0] text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>انضم للحصة</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Inside Live Virtual Classroom Room
  return (
    <div className="space-y-4 animate-in zoom-in-95 duration-200">
      {/* Room Top Bar */}
      <div className="bg-[#0f233a] text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full text-xs font-bold border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>بث حي مباشر الآن</span>
          </div>
          <div>
            <h3 className="font-black text-sm sm:text-base text-white">{activeSession?.title}</h3>
            <span className="text-[11px] text-sky-200">{activeSession ? `الأستاذ: ${activeSession.host_name} · ` : ''}سبورة وكاميرا محلية للشرح</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setHandRaised(!handRaised)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              handRaised 
                ? 'bg-amber-400 text-slate-900 animate-bounce' 
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Hand className="w-4 h-4" />
            <span>{handRaised ? 'يدك مرفوعة ✋' : 'رفع اليد للاستئذان'}</span>
          </button>

          <button
            onClick={() => {
              stopAllMediaStreams();
              setIsInRoom(false);
            }}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            مغادرة الحصة
          </button>
        </div>
      </div>

      {/* Screen Sharing View when active */}
      {isScreenSharing && (
        <div className="bg-slate-900 p-3 rounded-2xl border-2 border-emerald-500/80 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-white px-2">
            <span className="font-bold flex items-center gap-2 text-emerald-400">
              <Monitor className="w-4 h-4 animate-pulse" />
              <span>أنت تشارك شاشتك الآن مع الحضور مباشرة</span>
            </span>
            <button
              onClick={toggleScreenSharing}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg cursor-pointer"
            >
              إيقاف مشاركة الشاشة
            </button>
          </div>
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-[360px] bg-black rounded-xl object-contain border border-slate-800"
          />
        </div>
      )}

      {/* Main Room Grid: Canvas Whiteboard + Video Screen on Left/Center, Side Panel on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Classroom Center: Interactive Whiteboard Canvas & Video Feed */}
        <div className="lg:col-span-8 space-y-3">
          {/* Whiteboard Toolbar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Palette className="w-4 h-4 text-[#1677c7]" />
                <span>السبورة الرقمية:</span>
              </span>

              {/* Color options */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {['#1677c7', '#dc2626', '#16a34a', '#9333ea', '#0f172a'].map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      setPenColor(color);
                      setIsEraser(false);
                    }}
                    className={`w-6 h-6 rounded-lg transition-transform ${
                      penColor === color && !isEraser ? 'scale-115 ring-2 ring-sky-400' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              {/* Eraser */}
              <button
                onClick={() => setIsEraser(!isEraser)}
                className={`p-1.5 rounded-xl border flex items-center gap-1 font-bold cursor-pointer transition-colors ${
                  isEraser ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Eraser className="w-4 h-4" />
                <span>الممحاة</span>
              </button>

              {/* Clear */}
              <button
                onClick={clearCanvas}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 border border-slate-200 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>مسح الكل</span>
              </button>

              {/* Download Notes PNG */}
              <button
                onClick={downloadWhiteboard}
                className="p-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#1677c7] border border-sky-200 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="تنزيل رسم السبورة كصورة PNG على جهازك"
              >
                <Download className="w-3.5 h-3.5" />
                <span>حفظ الشرح (PNG)</span>
              </button>
            </div>

            {savedNotesMessage && (
              <span className="text-[11px] text-emerald-600 font-bold animate-pulse">
                ✓ تم تحميل لوحة الشرح لجهازك بنجاح!
              </span>
            )}
          </div>

          {/* Interactive Canvas */}
          <div className="relative bg-white rounded-2xl border-2 border-slate-300 shadow-md overflow-hidden aspect-video cursor-crosshair">
            <canvas
              ref={canvasRef}
              width={900}
              height={500}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className="w-full h-full block bg-white"
            />

            {/* Real WebRTC User Video Camera Box (Floating Pip) */}
            <div className="absolute top-4 left-4 w-48 h-32 bg-slate-900 rounded-xl border-2 border-white/80 shadow-xl overflow-hidden flex flex-col justify-between p-2">
              <div className="flex items-center justify-between text-white text-[10px] z-10">
                <span className="font-bold flex items-center gap-1 drop-shadow">
                  <span className={`w-2 h-2 rounded-full ${cameraStatus === 'active' && isCamOn ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {currentUserName} (أنت)
                </span>
                <span className="bg-black/60 px-1.5 py-0.2 rounded font-mono text-[9px]">
                  {cameraStatus === 'active' ? 'HD بث حي' : 'كاميرا معطلة'}
                </span>
              </div>

              {/* The Video Element */}
              {cameraStatus === 'active' && isCamOn ? (
                <video
                  ref={userVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover -z-0"
                />
              ) : (
                <div className="my-auto text-center text-white/70 text-[10px] flex flex-col items-center gap-1 z-10">
                  <Camera className="w-5 h-5 text-slate-400" />
                  <span>{cameraStatus === 'denied' ? 'تم رفض إذن الكاميرا' : 'الكاميرا مغلقة'}</span>
                </div>
              )}

              <div className="flex justify-between items-center z-10">
                <span className="text-[9px] text-white/80 drop-shadow">
                  {isMicOn ? '🎙️ الصوت نشط' : '🔇 مكتوم'}
                </span>
                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] ${isMicOn ? 'bg-emerald-500/80 text-white' : 'bg-rose-500/80 text-white'}`}>
                  {isMicOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                </span>
              </div>
            </div>

            {/* Hand Raised Notification badge on canvas */}
            {handRaised && (
              <div className="absolute top-4 right-4 bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs shadow-lg flex items-center gap-2 animate-bounce z-20">
                <Hand className="w-4 h-4" />
                <span>أنت تستأذن للكلام (المعلم تلقى إشارتك)</span>
              </div>
            )}
          </div>

          {/* Bottom Room Media Controls */}
          <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-center gap-3">
            <button
              onClick={toggleMic}
              title={isMicOn ? 'كتم الميكروفون' : 'تشغيل الميكروفون'}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                isMicOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleCamera}
              title={isCamOn ? 'إيقاف كاميرا الويب' : 'تشغيل كاميرا الويب الحقيقية'}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                isCamOn && cameraStatus === 'active' ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              {isCamOn && cameraStatus === 'active' ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleScreenSharing}
              className={`px-4 py-3 rounded-xl transition-all font-bold text-xs flex items-center gap-2 cursor-pointer ${
                isScreenSharing ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              <Monitor className="w-5 h-5" />
              <span>{isScreenSharing ? 'إيقاف مشاركة الشاشة' : 'مشاركة الشاشة الحقيقية'}</span>
            </button>
          </div>
        </div>

        {/* Classroom Right Panel: Tabs for Chat / Poll / Participants */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between overflow-hidden h-[560px]">
          {/* Tabs */}
          <div className="p-2 border-b border-slate-200 flex bg-slate-50 gap-1 text-xs">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'chat' ? 'bg-white text-[#1677c7] shadow-xs' : 'text-slate-500'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>محادثة القاعة</span>
            </button>

            <button
              onClick={() => setActiveTab('poll')}
              className={`flex-1 py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'poll' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>استبيان فوري</span>
            </button>

            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'participants' ? 'bg-white text-purple-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>الحضور (28)</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
            {activeTab === 'chat' && (
              <div className="space-y-2.5">
                {roomChat.map((msg) => (
                  <div key={msg.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${msg.isTeacher ? 'text-[#1677c7]' : 'text-slate-800'}`}>
                        {msg.sender} {msg.isTeacher && '👨‍🏫'}
                      </span>
                      <span className="text-[10px] text-slate-400">{msg.time}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{msg.text}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'poll' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-[#0f233a] space-y-1">
                  <span className="font-black block">سؤال سريع من الأستاذ:</span>
                  <p>هل المعادلة 3x² + 2x + 1 = 0 لها حلول حقيقية؟</p>
                </div>

                <div className="space-y-2">
                  {[
                    { text: 'نعم، يوجد جذران حقيقيان', idx: 0 },
                    { text: 'لا، المميز سالب (Δ < 0)', idx: 1 },
                    { text: 'يوجد جذر مكرر واحد', idx: 2 },
                  ].map((opt) => {
                    const isSelected = pollVoted === opt.idx;
                    const votes = pollVotes[opt.idx as keyof typeof pollVotes] || 0;
                    return (
                      <button
                        key={opt.idx}
                        onClick={() => handleVote(opt.idx)}
                        className={`w-full p-2.5 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-400 font-bold text-emerald-950'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span>{opt.text}</span>
                        <span className="font-mono text-[11px] text-slate-500">{votes} تصويت</span>
                      </button>
                    );
                  })}
                </div>

                {pollVoted !== null && (
                  <p className="text-[11px] text-emerald-700 font-bold text-center">
                    ✓ تم تسجيل تصويتك بنجاح!
                  </p>
                )}
              </div>
            )}

            {activeTab === 'participants' && (
              <div className="space-y-2 text-xs">
                {activeSession && (
                  <div className="p-2 bg-slate-50 rounded-xl font-bold text-slate-700 flex items-center justify-between">
                    <span>المعلم: {activeSession.host_name}</span>
                    <span className="text-emerald-600">مضيف الحصة</span>
                  </div>
                )}
                <div className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                  <span>{currentUserName} (أنت)</span>
                  <span className="text-slate-400">{currentRole}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed pt-2">
                  هذه السبورة والكاميرا خاصتان بجهازك للشرح. للاجتماع الجماعي مع الطلاب استخدم زر «انضم للحصة» الذي يفتح غرفة الفيديو.
                </p>
              </div>
            )}
          </div>

          {/* Chat Form Bottom */}
          {activeTab === 'chat' && (
            <form onSubmit={handleSendRoomChat} className="p-2 border-t border-slate-200 flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                placeholder="اكتب تعليقك في الحصة..."
                className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1677c7]"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-[#1677c7] text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
