import { useState, useCallback } from 'react';
import { api } from '../services/apiService';

export function useOtp() {
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const send = useCallback(async (email: string) => {
    setIsSending(true);
    const success = await api.authService?.requestOtp ? await api.authService.requestOtp(email) : true;
    if (success) {
      setCooldown(60);
      const timer = setInterval(() => setCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      }), 1000);
    }
    setIsSending(false);
    return success;
  }, []);

  const verify = useCallback(async (email: string, code: string) => {
    setIsVerifying(true);
    const result = await api.authService?.login ? await api.authService.login(email, code) : true;
    setIsVerifying(false);
    return result;
  }, []);

  return { send, verify, isSending, isVerifying, cooldown };
}
