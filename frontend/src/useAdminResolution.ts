import { useCallback } from 'react';
import { apiFetch } from './api';
import { useTranslation } from './i18n';
import type { SearchResult } from './services/enhancedSearchService';

export interface ExtendedSearchResult extends SearchResult {
    address?: { state?: string; province?: string; city?: string; municipality?: string; town?: string };
    extra?: any;
    geometry?: any;
}

export const useAdminResolution = () => {
    const { i18n } = useTranslation();

    const resolveAdminInfo = useCallback(async (result: ExtendedSearchResult) => {
        const isNepali = i18n.language === 'ne';

        const province = (isNepali && (result.extra?.province_ne || result.extra?.provinceNe)) ||
            result.extra?.province ||
            result.extra?.address?.state ||
            result.address?.state ||
            result.address?.province ||
            "Unknown Province";

        const localBody = (isNepali && (result.extra?.localBodyNameNe || result.extra?.localBody_ne)) ||
            result.extra?.localBodyName ||
            result.extra?.address?.city ||
            result.address?.city ||
            result.address?.municipality ||
            "Unknown Local Body";

        let geometry = result.geometry;

        // If it's a local body search result without geometry, fetch the exact boundary
        if ((result.source === 'local-body' || result.type === 'location') && !geometry && result.id) {
            try {
                const localId = result.id.replace('local-', '');
                const res = await apiFetch<any>(`/v1/boundaries/local/${localId}`);
                if (res?.data?.geometry) geometry = res.data.geometry;
            } catch (err) {
                console.warn("[AdminResolution] Failed to fetch boundary geometry", err);
            }
        }

        return { province, localBody, geometry };
    }, [i18n.language]);

    return { resolveAdminInfo };
};