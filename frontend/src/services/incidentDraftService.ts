// frontend/src/services/incidentDraftService.ts
// Saves unsaved incident reports as drafts (survives connection loss)

const STORAGE_KEY = 'merosadak_incident_drafts';
const MAX_DRAFTS = 5;
const DRAFT_EXPIRY_HOURS = 24;

export interface IncidentDraft {
  id: string;
  type: string;
  title: string;
  description: string;
  lat?: number;
  lng?: number;
  severity: 'low' | 'medium' | 'high';
  savedAt: string;
  locationName?: string;
  photos?: string[]; // base64 or URLs
  contactInfo?: string;
}

function getDrafts(): IncidentDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const drafts: IncidentDraft[] = JSON.parse(raw);

    // Filter out expired drafts
    const now = Date.now();
    const valid = drafts.filter(d => {
      const age = now - new Date(d.savedAt).getTime();
      return age < DRAFT_EXPIRY_HOURS * 60 * 60 * 1000;
    });

    if (valid.length !== drafts.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }

    return valid;
  } catch {
    return [];
  }
}

function saveDrafts(drafts: IncidentDraft[]): void {
  try {
    const trimmed = drafts.slice(-MAX_DRAFTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('[IncidentDraft] Failed to save:', e);
  }
}

export const incidentDraftService = {
  /** Save a draft incident report */
  saveDraft(draft: Omit<IncidentDraft, 'id' | 'savedAt'>): IncidentDraft {
    const incident: IncidentDraft = {
      ...draft,
      id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      savedAt: new Date().toISOString(),
    };

    const drafts = getDrafts();
    drafts.push(incident);
    saveDrafts(drafts);
    return incident;
  },

  /** Get all valid drafts */
  getDrafts(): IncidentDraft[] {
    return getDrafts();
  },

  /** Get a specific draft */
  getDraft(id: string): IncidentDraft | undefined {
    return getDrafts().find(d => d.id === id);
  },

  /** Update an existing draft */
  updateDraft(id: string, updates: Partial<IncidentDraft>): void {
    const drafts = getDrafts().map(d =>
      d.id === id ? { ...d, ...updates, savedAt: new Date().toISOString() } : d
    );
    saveDrafts(drafts);
  },

  /** Delete a draft */
  deleteDraft(id: string): void {
    const drafts = getDrafts().filter(d => d.id !== id);
    saveDrafts(drafts);
  },

  /** Check if there are any drafts */
  hasDrafts(): boolean {
    return getDrafts().length > 0;
  },

  /** Get draft count */
  getCount(): number {
    return getDrafts().length;
  },

  /** Clear all drafts */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  /** Auto-save helper (for form inputs) */
  autoSave(data: Partial<IncidentDraft>): IncidentDraft | null {
    const drafts = getDrafts();

    // Find the most recent draft to update
    const latest = drafts[drafts.length - 1];

    if (latest) {
      // Update existing draft
      const updated = {
        ...latest,
        ...data,
        savedAt: new Date().toISOString(),
      };
      saveDrafts(drafts.map(d => d.id === latest.id ? updated : d));
      return updated;
    } else {
      // Create new draft only if we have enough data
      if (data.type && data.title) {
        return this.saveDraft({
          type: data.type,
          title: data.title,
          description: data.description || '',
          severity: data.severity || 'medium',
          lat: data.lat,
          lng: data.lng,
          locationName: data.locationName,
          photos: data.photos,
          contactInfo: data.contactInfo,
        });
      }
      return null;
    }
  },
};
