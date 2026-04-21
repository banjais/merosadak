import { useState, useCallback, useRef, useEffect } from 'react';
import { reportVoiceIncident, quickReportIncident, type VoiceReportResult } from '../services/incidentReporter';
import type { TravelIncident } from '../types';

interface UseIncidentReporter {
  isRecording: boolean;
  transcript: string;
  result: VoiceReportResult | null;
  error: string;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  submitQuickReport: (category: string, description: string, location?: { lat: number; lng: number }) => Promise<void>;
  clearResult: () => void;
  isProcessing: boolean;
}

export function useIncidentReporter(userLocation?: { lat: number; lng: number }): UseIncidentReporter {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<VoiceReportResult | null>(null);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log("Speech recognition not available");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN"; // Support Indian English + Nepali

    recognition.onstart = () => {
      setIsRecording(true);
      setError("");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
      } else if (interimTranscript) {
        setTranscript(interimTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      // Auto-submit when recording ends
      if (transcript.trim()) {
        handleSubmit(transcript);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [transcript]);

  const handleSubmit = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    setTranscript(text);
    
    try {
      const reportResult = await reportVoiceIncident(text, userLocation);
      setResult(reportResult);
    } catch (err: any) {
      setError(err.message || "could not understand. try again");
    } finally {
      setIsProcessing(false);
    }
  }, [userLocation]);

  const startRecording = useCallback(async () => {
    if (!recognitionRef.current) {
      setError("voice not available. use quick buttons instead");
      return;
    }

    setTranscript("");
    setResult(null);
    setError("");

    try {
      recognitionRef.current.start();
    } catch (err: any) {
      setError("could not start voice. check microphone permission");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const submitQuickReport = useCallback(async (
    category: string,
    description: string,
    location?: { lat: number; lng: number }
  ) => {
    setIsProcessing(true);
    try {
      const reportResult = await quickReportIncident(
        category as any,
        description,
        location || userLocation
      );
      setResult({
        category: category as any,
        confidence: 1,
        description,
        location: location || userLocation,
        severity: "medium",
        success: reportResult.success,
        message: reportResult.message
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [userLocation]);

  const clearResult = useCallback(() => {
    setResult(null);
    setTranscript("");
    setError("");
  }, []);

  return {
    isRecording,
    transcript,
    result,
    error,
    startRecording,
    stopRecording,
    submitQuickReport,
    clearResult,
    isProcessing
  };
}

// Quick report button configurations
export const QUICK_REPORT_BUTTONS = [
  { id: "blocked", emoji: "🚫", label: "Blocked", color: "bg-red-500" },
  { id: "landslide", emoji: "⛰️", label: "Landslide", color: "bg-amber-600" },
  { id: "accident", emoji: "💥", label: "Accident", color: "bg-orange-500" },
  { id: "flood", emoji: "🌊", label: "Flood", color: "bg-blue-500" },
  { id: "road_damage", emoji: "�️", label: "Damage", color: "bg-yellow-600" }
];

// Type declaration for speech recognition
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}