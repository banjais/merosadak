
import { useState, useCallback } from 'react';
import { getTravelAdvice, summarizeIncident } from '../services/geminiService';
import { TravelIncident, ChatMessage } from '../types';

export function useGemini() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "Namaste! I am your Himalayan AI guide. How can I help your journey through Nepal today?" }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const ask = useCallback(async (query: string, location: { lat: number, lng: number }, incidents: TravelIncident[]) => {
    // Add User Message
    setMessages(prev => [...prev, { role: 'user', text: query }]);
    
    // Add Empty Model Message for Streaming
    setMessages(prev => [...prev, { role: 'model', text: '' }]);
    setIsProcessing(true);
    
    try {
      const stream = await getTravelAdvice(query, location, incidents);
      let fullText = '';
      
      for await (const chunk of stream.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        
        // Update the last message (the model's response) in real-time
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'model', text: fullText };
          return updated;
        });
      }
      
      return fullText;
    } catch (error) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { 
          role: 'model', 
          text: "I'm having trouble connecting to my travel intelligence center. Please check the map for manual updates." 
        };
        return updated;
      });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const getSummary = useCallback(async (incident: TravelIncident) => {
    return await summarizeIncident(incident);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([{ role: 'model', text: "Chat history cleared. How else can I assist your travels?" }]);
  }, []);

  return { messages, isProcessing, ask, getSummary, clearChat };
}
