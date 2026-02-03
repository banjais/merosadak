
import { useState, useCallback } from 'react';
import { otpService } from '../services/otpService';

export function useOtp() {
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const send = useCallback(async (phone: string) => {
    setIsSending(true);
    const success = await otpService.sendOtp(phone);
    if (success) {
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    setIsSending(false);
    return success;
  }, []);

  const verify = useCallback(async (phone: string, code: string) => {
    setIsVerifying(true);
    const result = await otpService.verifyOtp(phone, code);
    setIsVerifying(false);
    return result;
  }, []);

  return { send, verify, isSending, isVerifying, cooldown };
}
