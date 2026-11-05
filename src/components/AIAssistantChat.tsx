import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Sparkles,
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  User,
  Copy,
  Check,
  RefreshCw,
  Palette,
  LogIn,
  ChevronLeft,
  AlertTriangle,
  MapPin,
  Fuel,
  Construction,
  CloudSun,
  Coins,
  Route as RouteIcon,
} from 'lucide-react';
import { fetchJson } from '../utils/apiConfig';
import { readLastKnownGps } from '../utils/gpsLocation';

/* ==================== PERSISTED PROFILE ==================== */

export interface AiProfile {
  /** Avatar style id — one of AVATAR_STYLES below. */
  avatar: string;
  /** Read-aloud voice for AI replies. */
  voice: 'female' | 'male' | 'off';
}

const AI_PROFILE_KEY = 'mero-sadak-ai-profile';
const AI_CHAT_KEY = 'mero-sadak-ai-chat-v1';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  at: number;
  /** Locally-rendered error bubble (offers retry, not sent to the API). */
  error?: boolean;
}

const DEFAULT_PROFILE: AiProfile = { avatar: 'aurora', voice: 'female' };

function loadProfile(): AiProfile {
  try {
    const raw = localStorage.getItem(AI_PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<AiProfile>;
    return {
      avatar: typeof parsed.avatar === 'string' ? parsed.avatar : DEFAULT_PROFILE.avatar,
      voice: parsed.voice === 'male' || parsed.voice === 'off' ? parsed.voice : 'female',
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function saveProfile(profile: AiProfile) {
  try {
    localStorage.setItem(AI_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable */
  }
}

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(AI_CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'model'))
      .slice(-40);
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(AI_CHAT_KEY, JSON.stringify(messages.slice(-40)));
  } catch {
    /* storage unavailable */
  }
}

/* ==================== AVATAR STYLES ==================== */

const AVATAR_STYLES: Array<{ id: string; label: string; gradient: string }> = [
  { id: 'aurora', label: 'Aurora', gradient: 'from-emerald-400 to-cyan-500' },
  { id: 'sunset', label: 'Sunset', gradient: 'from-rose-400 to-amber-500' },
  { id: 'ocean', label: 'Ocean', gradient: 'from-sky-400 to-indigo-500' },
  { id: 'forest', label: 'Forest', gradient: 'from-lime-400 to-green-600' },
  { id: 'royal', label: 'Royal', gradient: 'from-violet-400 to-fuchsia-500' },
  { id: 'slate', label: 'Slate', gradient: 'from-slate-400 to-slate-600' },
];

function avatarGradient(id: string): string {
  return (AVATAR_STYLES.find((s) => s.id === id) ?? AVATAR_STYLES[0]).gradient;
}

function userInitial(userEmail: string | null | undefined): string {
  const source = (userEmail ?? 'T').trim();
  return (source[0] ?? 'T').toUpperCase();
}

/* ==================== TEXT TO SPEECH ==================== */

/** Pick the best installed voice for the chosen gender. Nepali (ne-NP) voices
 * are rare on desktop, so this falls back gracefully to any English voice. */
function pickVoice(gender: 'female' | 'male'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const femaleHints = /female|zira|samantha|victoria|karen|moira|tessa|serena|allison|ava|susan|google uk english female|google us english/i;
  const maleHints = /male|david|daniel|alex|fred|oliver|thomas|rishi|arthur|google uk english male/i;
  const english = voices.filter((v) => /^en/i.test(v.lang));
  const pool = english.length ? english : voices;
  const hints = gender === 'female' ? femaleHints : maleHints;
  const antiHints = gender === 'female' ? maleHints : femaleHints;
  return (
    pool.find((v) => hints.test(v.name) && !antiHints.test(v.name)) ??
    pool.find((v) => hints.test(v.name)) ??
    (gender === 'female'
      ? pool.find((v) => /en-(IN|GB|US)/i.test(v.lang))
      : pool.find((v) => /en-(IN|GB|US)/i.test(v.lang))) ??
    pool[0] ??
    null
  );
}

function speak(text: string, gender: 'female' | 'male') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    // Strip markdown decorations so the spoken reply sounds natural.
    const clean = text.replace(/[*_#`>-]/g, ' ').replace(/\s+/g, ' ').trim();
    const utterance = new SpeechSynthesisUtterance(clean.slice(0, 600));
    const voice = pickVoice(gender);
    if (voice) utterance.voice = voice;
    utterance.rate = 1;
    utterance.pitch = gender === 'female' ? 1.08 : 0.92;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* TTS unavailable — silent fail */
  }
}

/* ==================== SPEECH RECOGNITION ==================== */

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function createRecognizer(lang: string): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognizer: SpeechRecognitionLike = new Ctor();
  recognizer.lang = lang;
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;
  return recognizer;
}

/* ==================== WELCOME + QUICK CHIPS ==================== */

function welcomeMessage(): ChatMessage {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return {
    role: 'model',
    text:
      `Namaste! ${greeting} — I'm Mero Sadak AI, your road-travel companion for Nepal. ` +
      'Ask me about routes, road conditions, landslides, fuel prices, tolls or weather on any highway, and I will help you plan a safe trip.',
    at: Date.now(),
  };
}

const QUICK_CHIPS: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; prompt: string }> = [
  { icon: Construction, label: 'Road conditions', prompt: 'What are the current road conditions and hazards on Nepal highways?' },
  { icon: RouteIcon, label: 'Plan a trip', prompt: 'Help me plan a trip from Kathmandu to Pokhara — route, distance and things to watch.' },
  { icon: Fuel, label: 'Fuel prices', prompt: 'What are the current fuel prices in Nepal?' },
  { icon: Coins, label: 'Toll rates', prompt: 'What are the current toll rates?' },
  { icon: CloudSun, label: 'Weather', prompt: 'How is the weather on the highways today?' },
];

/* ==================== COMPONENT ==================== */

interface AIAssistantChatProps {
  userEmail?: string | null;
  isSignedIn: boolean;
  /** App language for voice input ('EN' | 'NE'). */
  uiLanguage?: 'EN' | 'NE';
  /** Currently planned route label, so the AI knows what trip is on screen. */
  activeRouteLabel?: string | null;
  onClose: () => void;
  onOpenLogin?: () => void;
}

export const AIAssistantChat: React.FC<AIAssistantChatProps> = ({
  userEmail,
  isSignedIn,
  uiLanguage = 'EN',
  activeRouteLabel,
  onClose,
  onOpenLogin,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const stored = loadMessages();
    return stored.length ? stored : [welcomeMessage()];
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [profile, setProfile] = useState<AiProfile>(loadProfile);
  const [showProfile, setShowProfile] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [ttsAvailable] = useState(() => typeof window !== 'undefined' && !!window.speechSynthesis);
  const [micAvailable] = useState(
    () => typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);

  // Persist the conversation (capped) after every change.
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // Focus the composer when the panel opens.
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 350);
    return () => window.clearTimeout(t);
  }, []);

  // Stop any ongoing speech when the panel closes/unmounts.
  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const updateProfile = useCallback((patch: Partial<AiProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveProfile(next);
      return next;
    });
  }, []);

  const speakReply = useCallback(
    (text: string) => {
      if (profile.voice === 'off') return;
      speak(text, profile.voice);
    },
    [profile.voice]
  );

  /** Send the conversation to the worker and append the reply. */
  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || sending) return;

      const userMessage: ChatMessage = { role: 'user', text, at: Date.now() };
      const history = [...messages, userMessage];
      setMessages(history);
      setInput('');
      setSending(true);
      try {
        const lastFix = readLastKnownGps();
        const data = await fetchJson<{ reply?: string; error?: string }>('/api/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history
              .filter((m) => !m.error)
              .slice(-14)
              .map((m) => ({ role: m.role, text: m.text })),
            profile: { avatar: profile.avatar, voice: profile.voice, email: userEmail ?? undefined },
            context: {
              app: 'Mero Sadak web',
              location: lastFix ? { lat: Number(lastFix.lat.toFixed(4)), lng: Number(lastFix.lng.toFixed(4)) } : undefined,
              activeRoute: activeRouteLabel ?? undefined,
              time: new Date().toISOString(),
            },
          }),
        });
        const reply = (data?.reply ?? '').trim();
        if (!reply) throw new Error((data as any)?.error || 'Empty reply');
        const aiMessage: ChatMessage = { role: 'model', text: reply, at: Date.now() };
        setMessages((prev) => [...prev, aiMessage]);
        speakReply(reply);
      } catch (err) {
        const note = err instanceof Error ? err.message : 'The assistant could not be reached.';
        setMessages((prev) => [
          ...prev,
          {
            role: 'model',
            at: Date.now(),
            error: true,
            text:
              'Sorry — I could not reach the AI service just now. ' +
              (note.includes('Failed') ? 'Check your connection and try again.' : note),
          },
        ]);
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [messages, sending, profile.avatar, profile.voice, userEmail, activeRouteLabel, speakReply]
  );

  const handleRetry = useCallback(
    (index: number) => {
      // Drop the error bubble and re-send the last user turn.
      let lastUserText = '';
      for (let i = index - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          lastUserText = messages[i].text;
          break;
        }
      }
      setMessages((prev) => prev.filter((_, i) => i !== index));
      if (lastUserText) window.setTimeout(() => sendMessage(lastUserText), 60);
    },
    [messages, sendMessage]
  );

  const toggleMic = useCallback(() => {
    if (listening) {
      recognizerRef.current?.stop();
      return;
    }
    const recognizer = createRecognizer(uiLanguage === 'NE' ? 'ne-NP' : 'en-US');
    if (!recognizer) return;
    recognizerRef.current = recognizer;
    recognizer.onresult = (event: any) => {
      const spoken = event?.results?.[0]?.[0]?.transcript ?? '';
      if (spoken) setInput((prev) => (prev ? `${prev} ${spoken}` : spoken));
    };
    recognizer.onerror = () => setListening(false);
    recognizer.onend = () => setListening(false);
    setListening(true);
    try {
      recognizer.start();
    } catch {
      setListening(false);
    }
  }, [listening, uiLanguage]);

  const copyReply = useCallback(async (index: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  const greetingName = useMemo(() => (isSignedIn && userEmail ? userEmail.split('@')[0] : null), [isSignedIn, userEmail]);

  return (
    <div className="fixed inset-0 z-[720] flex flex-col bg-slate-950 text-slate-100" data-testid="ai-chat-panel">
      {/* Header */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-3 sm:px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="sm:hidden p-2 -ml-1 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close AI assistant"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
            <Sparkles className="w-5 h-5 text-slate-950" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-black text-white font-display tracking-tight flex items-center gap-2">
              Mero Sadak AI
              <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-900/40 border border-emerald-500/30 rounded-full px-1.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 truncate">
              {greetingName ? `Travelling with ${greetingName}` : 'Ask anything about Nepal roads & travel'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {ttsAvailable && (
            <button
              onClick={() => {
                if (profile.voice === 'off') updateProfile({ voice: 'female' });
                else {
                  try {
                    window.speechSynthesis?.cancel();
                  } catch { /* ignore */ }
                  updateProfile({ voice: 'off' });
                }
              }}
              title={profile.voice === 'off' ? 'Read replies aloud (off)' : `Reads replies aloud (${profile.voice} voice)`}
              className={`p-2 rounded-xl transition border ${
                profile.voice !== 'off'
                  ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800/70 text-slate-400 border-slate-700/50 hover:text-white'
              }`}
              aria-label="Toggle read-aloud"
            >
              {profile.voice !== 'off' ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => setShowProfile((prev) => !prev)}
            title="AI profile — avatar & voice"
            className={`p-2 rounded-xl transition border ${
              showProfile
                ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800/70 text-slate-400 border-slate-700/50 hover:text-white'
            }`}
            aria-label="AI profile"
          >
            <User className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="hidden sm:flex px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition text-sm font-medium"
          >
            Close
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Conversation */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-4 space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.at}-${index}`}
                className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                data-testid={message.role === 'user' ? 'ai-message-user' : 'ai-message-ai'}
              >
                {message.role === 'model' && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                    message.error
                      ? 'bg-rose-950/50 border border-rose-500/30 text-rose-200'
                      : message.role === 'user'
                        ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-br-md'
                        : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-md'
                  }`}
                >
                  {message.text}
                  {message.error && (
                    <button
                      onClick={() => handleRetry(index)}
                      className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-900/40 border border-rose-500/40 text-[11px] font-bold text-rose-200 hover:bg-rose-900/60 transition"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  )}
                  {!message.error && message.role === 'model' && index > 0 && (
                    <button
                      onClick={() => copyReply(index, message.text)}
                      title="Copy reply"
                      className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition"
                    >
                      {copiedIndex === index ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedIndex === index ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className={`w-7 h-7 rounded-xl bg-gradient-to-br ${avatarGradient(profile.avatar)} flex items-center justify-center shrink-0 shadow-sm text-[11px] font-black text-slate-950`}>
                    {userInitial(userEmail)}
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex items-end gap-2" data-testid="ai-typing">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Quick prompts */}
          {messages.filter((m) => m.role === 'user').length === 0 && !sending && (
            <div className="px-3 sm:px-6 pb-2 flex flex-wrap gap-1.5" data-testid="ai-quick-chips">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => sendMessage(chip.prompt)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300 hover:text-white hover:border-emerald-500/40 hover:bg-slate-800 transition"
                >
                  <chip.icon className="w-3 h-3 text-emerald-400" />
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="p-3 sm:px-6 sm:py-3 border-t border-slate-800 bg-slate-900/60 shrink-0">
            <div className="flex items-end gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 focus-within:border-emerald-500/60 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                rows={1}
                placeholder="Ask about routes, hazards, fuel, tolls, weather..."
                className="flex-1 bg-transparent text-[13px] text-slate-100 placeholder-slate-500 resize-none focus:outline-none max-h-24 py-0.5"
                data-testid="ai-chat-input"
              />
              {micAvailable && (
                <button
                  onClick={toggleMic}
                  title={listening ? 'Stop voice input' : 'Voice input'}
                  className={`p-1.5 rounded-xl transition ${
                    listening ? 'bg-rose-900/40 text-rose-400 animate-pulse' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  aria-label="Voice input"
                >
                  {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || sending}
                className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed hover:from-emerald-400 hover:to-emerald-500 transition"
                aria-label="Send message"
                data-testid="ai-chat-send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[9px] text-slate-600 text-center">
              Grounded in live app data — hazards, fuel &amp; tolls. Always verify road status before you travel.
            </p>
          </div>
        </div>

        {/* Profile drawer */}
        {showProfile && (
          <aside className="w-full sm:w-80 border-l border-slate-800 bg-slate-900/80 overflow-y-auto custom-scrollbar p-4 space-y-5 shrink-0" data-testid="ai-profile-drawer">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white">Your AI profile</h4>
              <button
                onClick={() => setShowProfile(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition sm:hidden"
                aria-label="Close profile"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isSignedIn ? (
              <>
                {/* Identity */}
                <div className="flex items-center gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${avatarGradient(profile.avatar)} flex items-center justify-center text-base font-black text-slate-950 shadow-md`}>
                    {userInitial(userEmail)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{userEmail}</p>
                    <p className="text-[10px] text-slate-500">Signed in — profile saved on this device</p>
                  </div>
                </div>

                {/* Avatar styles */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Palette className="w-3 h-3" /> Avatar style
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {AVATAR_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => updateProfile({ avatar: style.id })}
                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition ${
                          profile.avatar === style.id
                            ? 'border-emerald-500/60 bg-emerald-900/20'
                            : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-xl bg-gradient-to-br ${style.gradient} shadow-sm`} />
                        <span className={`text-[9px] font-bold ${profile.avatar === style.id ? 'text-emerald-300' : 'text-slate-400'}`}>
                          {style.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voice */}
                {ttsAvailable && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Volume2 className="w-3 h-3" /> Assistant voice
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: 'female', label: 'Female' },
                        { id: 'male', label: 'Male' },
                        { id: 'off', label: 'Silent' },
                      ] as const).map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            updateProfile({ voice: option.id });
                            if (option.id !== 'off') {
                              speak(
                                option.id === 'female'
                                  ? 'Namaste! I will read my replies in this voice.'
                                  : 'Namaste! I will read my replies in this voice.',
                                option.id
                              );
                            } else {
                              try {
                                window.speechSynthesis?.cancel();
                              } catch { /* ignore */ }
                            }
                          }}
                          className={`py-2 rounded-xl text-[11px] font-bold border transition ${
                            profile.voice === option.id
                              ? 'border-emerald-500/60 bg-emerald-900/20 text-emerald-300'
                              : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-600 mt-1.5">
                      Uses your device's built-in voices. "Silent" turns read-aloud off.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl text-center space-y-3">
                <LogIn className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-xs text-slate-300 font-medium">Sign in to personalize your AI assistant</p>
                <p className="text-[10px] text-slate-500">
                  Pick an avatar style and choose between a female or male assistant voice. Your choices stay on this device.
                </p>
                {onOpenLogin && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenLogin();
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition"
                  >
                    Sign in with Google
                  </button>
                )}
              </div>
            )}

            {/* What the AI knows */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">What I can help with</p>
              <ul className="space-y-1.5 text-[11px] text-slate-400">
                {[
                  { icon: MapPin, text: 'Routes, distances & trip planning' },
                  { icon: AlertTriangle, text: 'Live hazard reports & road closures' },
                  { icon: Fuel, text: 'Current fuel prices' },
                  { icon: Coins, text: 'Toll rates for your vehicle' },
                  { icon: CloudSun, text: 'Weather affecting the highways' },
                ].map((row) => (
                  <li key={row.text} className="flex items-center gap-2">
                    <row.icon className="w-3 h-3 text-emerald-400 shrink-0" />
                    {row.text}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
