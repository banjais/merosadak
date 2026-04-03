// frontend/src/services/boundaryService.ts
import { api } from './apiService';

export const boundaryService = {
  getNepalBoundary: async () => {
    try {
      const data = await api.getBoundary();
      return data;
    } catch (err) {
      console.error("Failed to fetch boundary:", err);
      return null;
    }
  }
};
