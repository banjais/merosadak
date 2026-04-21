import { useState, useCallback, useEffect } from 'react';
import { 
  sendMessage, 
  startConversation, 
  endConversation,
  summarizeIncident,
  getConversationHistory,
  getQuickAdvice,
  speakText,
  stopSpeaking,
  getTTSSettings,
  setVoiceGender,
  setTTSEnabled,
  getVoicesList,
  type Emotion
} from '../services/geminiService';
import { TravelIncident, ChatMessage } from '../types';

export function useGemini() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsSettings, setTtsSettings] = useState(getTTSSettings());

  // Initialize voices on mount
  useEffect(() => {
    // Try to load voices - may need multiple attempts
    const initVoices = () => {
      const voices = getVoicesList();
      if (voices.length > 0) {
        // Voices loaded
      }
    };
    
    // Chrome needs this delay
    setTimeout(initVoices, 100);
    setTimeout(initVoices, 500);
    setTimeout(initVoices, 1000);
    
    speechSynthesis.onvoiceschanged = initVoices;
  }, []);

  const initialize = useCallback((location?: { lat: number; lng: number }) => {
    const welcome = startConversation(location);
    setMessages([{ role: 'model', text: welcome.text }]);
    
    // Auto-speak welcome if enabled
    if (ttsSettings.enabled) {
      setIsSpeaking(true);
      speakText(welcome.text).then(() => setIsSpeaking(false));
    }
    
    return welcome;
  }, []);

  const ask = useCallback(async (
    query: string, 
    location?: { lat: number; lng: number },
    incidents: TravelIncident[] = []
  ) => {
    setMessages(prev => [...prev, { role: 'user', text: query }]);
    setIsProcessing(true);

    try {
      const result = await sendMessage(query);
      setMessages(prev => [...prev, { role: 'model', text: result.text }]);
      
      // Speak response if enabled
      if (ttsSettings.enabled && result.shouldSpeak) {
        setIsSpeaking(true);
        await speakText(result.text);
        setIsSpeaking(false);
      }
      
      return result.text;
    } catch {
      setMessages(prev => [...prev, { role: 'model', text: "im here to help check the map or try again" }]);
      return "";
    } finally {
      setIsProcessing(false);
    }
  }, [ttsSettings.enabled]);

  const speak = useCallback(async (text: string) => {
    setIsSpeaking(true);
    await speakText(text);
    setIsSpeaking(false);
  }, []);

  const stopSpeaking = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
  }, []);

  const changeVoice = useCallback((gender: "male" | "female") => {
    setVoiceGender(gender);
    setTtsSettings({ ...getTTSSettings(), gender });
  }, []);

  const getVoices = useCallback(() => {
    return getAvailableVoices();
  }, []);

  const toggleTTS = useCallback(() => {
    setTtsSettings(prev => ({ ...prev, enabled: !prev.enabled }));
    if (ttsSettings.enabled) {
      stopSpeaking();
    }
  }, []);

  const clearChat = useCallback(() => {
    stopSpeaking();
    const farewell = endConversation();
    setMessages([{ role: 'model', text: farewell.text }]);
    return farewell;
  }, []);

  const getHistory = useCallback(() => getConversationHistory(), []);

  return { 
    messages, 
    isProcessing, 
    isSpeaking,
    ttsSettings,
    initialize, 
    ask, 
    speak,
    stopSpeaking,
    changeVoice,
    getVoices,
    toggleTTS,
    clearChat,
    getHistory
  };
}