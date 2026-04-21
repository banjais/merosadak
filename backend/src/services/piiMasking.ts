/**
 * Masks PII (Personally Identifiable Information) for safe logging.
 */
export function maskEmail(email: string): string {
    if (!email || typeof email !== "string" || !email.includes("@")) {
        return "****@****.***";
    }

    const [local, domain] = email.split("@");
    if (local.length <= 2) return `*@${domain}`;
    return `${local.substring(0, 2)}***@${domain}`;
}