// frontend/src/services/superadminService.ts
import { apiFetch } from '../api';

export const superadminService = {
  broadcastSystemUpdate: async (message: string) => {
    try {
      await apiFetch('/superadmin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      console.log(`[Superadmin] Broadcast sent: ${message}`);
    } catch (err: any) {
      console.error(`[Superadmin] Failed to send broadcast: ${err.message}`);
    }
  },

  purgeCache: async () => {
    localStorage.clear();
    console.log('[Superadmin] System cache purged successfully.');
  },

  overrideRoadStatus: async (incidentId: string, status: string) => {
    console.log(`[Superadmin] Overriding status for ${incidentId} to ${status}`);
    return true;
  }
};
