import { useState, useCallback } from 'react';
import { getTravelAdvice, summarizeIncident } from '../services/geminiService';
import { TravelIncident, ChatMessage } from '../types';

export function useGemini() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "Namaste! I am your Himalayan AI guide. How can I help your journey through Nepal today?" }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const ask = useCallback(async (query: string, location: { lat: number; lng: number }, incidents: TravelIncident[], persona: string = 'safety', image?: string) => {
    setMessages(prev => [...prev, { role: 'user', text: query || "What's in this image?" }, { role: 'model', text: '' }]);
    setIsProcessing(true);

    try {
      const stream = await getTravelAdvice(query, location, incidents, persona, image);
      let fullText = '';

      for await (const chunk of stream.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'model', text: fullText };
          return updated;
        });
      }

      return fullText;
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'model', text: "I'm having trouble connecting to travel AI. Check the map manually." };
        return updated;
      });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const getSummary = useCallback(async (incident: TravelIncident) => await summarizeIncident(incident), []);
  const clearChat = useCallback(() => setMessages([{ role: 'model', text: "Chat cleared. How else can I assist?" }]), []);

  return { messages, isProcessing, ask, getSummary, clearChat };
}
