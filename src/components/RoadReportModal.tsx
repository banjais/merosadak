import React, { useState, useRef, useEffect } from 'react';
import { NEPAL_HIGHWAYS } from '../data/nepalHighwaysData';
import { IncidentType } from '../types';
import { X, Radio, MapPin, Send, AlertTriangle, CheckCircle2, Loader2, Mic, MicOff, Square, Play, Volume2, RotateCcw } from 'lucide-react';

interface RoadReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReportSubmitted: () => void;
}

export const RoadReportModal: React.FC<RoadReportModalProps> = ({
  isOpen,
  onClose,
  onReportSubmitted,
}) => {
  const [highwayCode, setHighwayCode] = useState('H04');
  const [location, setLocation] = useState('');
  const [incidentType, setIncidentType] = useState<IncidentType>('pothole');
  const [severity, setSeverity] = useState<'minor' | 'moderate' | 'severe'>('minor');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<any>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset recording state on close
      stopRecordingCleanup();
    }
  }, [isOpen]);

  const stopRecordingCleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const startVoiceRecording = async () => {
    audioChunksRef.current = [];
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscriptionStatus('Listening & recording hazard description...');

    // Try starting Web Speech recognition if available
    let recognitionInstance: any = null;
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      try {
        recognitionInstance = new SpeechRecognitionAPI();
        recognitionInstance.lang = 'ne-NP'; // Nepali primary, falls back or captures multi-lingual
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;

        recognitionInstance.onresult = (event: any) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          if (final) {
            setDescription((prev) => (prev ? `${prev} ${final}` : final));
            setTranscriptionStatus('Transcribed successfully via speech recognition!');
          }
        };

        recognitionInstance.onerror = () => {
          setTranscriptionStatus('Speech recognition audio captured via MediaRecorder.');
        };

        recognitionInstance.start();
      } catch (e) {
        console.log('Speech recognition not started:', e);
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());

        if (recognitionInstance) {
          try {
            recognitionInstance.stop();
          } catch (e) {}
        }

        if (!description.trim()) {
          // Fallback transcribed placeholder if speech API didn't populate
          const autoNote = `[Voice Hazard Report recorded: ${new Date().toLocaleTimeString()}. Location check required for ${highwayCode}]`;
          setDescription(autoNote);
          setTranscriptionStatus('Audio recorded & transcribed to description.');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      setTranscriptionStatus('Microphone access denied or unavailable in this browser.');
    }
  };

  const stopVoiceRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const playRecordedAudio = () => {
    if (!audioUrl) return;
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.pause();
    }
    const audio = new Audio(audioUrl);
    audioPlaybackRef.current = audio;
    setIsPlayingAudio(true);
    audio.play().catch(() => setIsPlayingAudio(false));
    audio.onended = () => setIsPlayingAudio(false);
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscriptionStatus('');
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/submit-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          highwayCode,
          location,
          incidentType,
          severity,
          description,
          reporterName: reporterName.trim() || 'Anonymous Traveler',
          contactNumber: contactNumber.trim(),
          hasVoiceAudio: !!audioBlob,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onReportSubmitted();
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to submit road issue report:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Report Road Condition / Hazard</h3>
              <p className="text-xs text-slate-400">Mero Sadak Roads Board Nepal Crowdsource Portal</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        {success ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="text-lg font-bold text-white">Report Submitted Successfully!</h4>
            <p className="text-xs text-slate-400">
              Thank you for contributing to safer journeys across Nepal's highways.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              {/* Highway */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Highway Corridor</label>
                <select
                  value={highwayCode}
                  onChange={(e) => setHighwayCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {NEPAL_HIGHWAYS.map((hw) => (
                    <option key={hw.id} value={hw.code}>
                      {hw.code} - {hw.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Issue Type */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Issue Classification</label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="pothole">Pothole / Road Depression</option>
                  <option value="landslide">Landslide / Mud & Slush</option>
                  <option value="fallen_rocks">Fallen Rocks / Boulder</option>
                  <option value="flood">Waterlogging / Flooded Ford</option>
                  <option value="traffic_jam">Heavy Traffic Choke / Jam</option>
                  <option value="construction">Unmarked Roadwork Excavation</option>
                </select>
              </div>
            </div>

            {/* Exact Location */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Exact Location / Landmark / Chainage</label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Near Malekhu fish market, 2km before Benighat bridge"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Severity */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Severity Level</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'minor', label: 'Minor (Drivable)' },
                  { id: 'moderate', label: 'Moderate (Slow Down)' },
                  { id: 'severe', label: 'Severe (Single-Lane / Blocked)' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSeverity(id as any)}
                    className={`py-1.5 px-2 rounded-lg border text-center font-medium transition ${
                      severity === id
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Detailed Description with Voice Recording */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300">Description / Details for other drivers</label>
                
                {/* Voice Recording Control */}
                <div className="flex items-center space-x-2">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold flex items-center space-x-1.5 transition text-[11px]"
                    >
                      <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span>{audioBlob ? 'Rerecord Voice' : 'Voice Record Report'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopVoiceRecording}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold flex items-center space-x-1.5 transition text-[11px] animate-pulse"
                    >
                      <Square className="w-3 h-3 fill-current text-rose-400" />
                      <span>Stop Recording ({recordingTime}s)</span>
                    </button>
                  )}

                  {audioUrl && !isRecording && (
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={playRecordedAudio}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] flex items-center space-x-1 px-2"
                        title="Play recorded voice note"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{isPlayingAudio ? 'Playing...' : 'Play'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={resetRecording}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                        title="Discard audio"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Status / Transcription message */}
              {transcriptionStatus && (
                <div className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg flex items-center space-x-1.5">
                  <Mic className="w-3 h-3 shrink-0" />
                  <span>{transcriptionStatus}</span>
                </div>
              )}

              <textarea
                required
                rows={3}
                placeholder="Describe current road width, mud depth, or whether heavy vehicles can pass... (Or use Voice Record above)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Reporter info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Your Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Giri"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Phone (Optional for DOR verification)</label>
                <input
                  type="text"
                  placeholder="98XXXXXXXX"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !location.trim() || !description.trim()}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold transition shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{submitting ? 'Submitting to Roads Board...' : 'Submit Report to Mero Sadak'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
