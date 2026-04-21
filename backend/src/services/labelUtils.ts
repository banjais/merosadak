import type { Label } from "@/types.js";

/**
 * Resolves a Label object or string into the requested language.
 * Defaults to English if the translation is missing.
 */
export function resolveLabel(label: string | Label | undefined | null, lang: string = "en"): string {
    if (!label) return "";

    // If it's already a string, return it
    if (typeof label === "string") return label;

    // If it's a Label object, try to get the specific language or fallback to English
    if (typeof label === "object") {
        return (label as any)[lang] || label.en || "";
    }

    return String(label);
}