// frontend/src/services/superadminService.ts
import { apiFetch, alertService } from './apiService';

export const superadminService = {
  broadcastSystemUpdate: async (message: string) => {
    try {
      await apiFetch('/superadmin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      alertService.notify('success', `Broadcast sent: ${message}`);
    } catch (err: any) {
      alertService.notify('error', `Failed to send broadcast: ${err.message}`);
    }
  },

  purgeCache: async () => {
    localStorage.clear();
    alertService.notify('success', 'System cache purged successfully.');
  },

  overrideRoadStatus: async (incidentId: string, status: string) => {
    alertService.notify('warning', `Overriding status for ${incidentId} to ${status}`);
    return true;
  }
};
