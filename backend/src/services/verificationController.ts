import type { Request, Response } from "express";
import { verificationService } from "@/services/verificationService.js";
import { logError } from "@logs/logs.js";
import { getCache } from "@/services/cacheService.js";

/**
 * Controller to handle public verification requests from QR codes.
 */
export const handleUserVerification = async (req: Request, res: Response) => {
    const { identifier } = req.params;

    try {
        // 1. Fetch user safety record (cached or from DB)
        // Placeholder: In production, this would query the users collection
        const record = await getCache(`user:safety:${identifier}`, async () => {
            throw new Error("Verification record not found");
        }, 3600);

        const html = verificationService.generateVerificationPage(record, 'user');
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
    } catch (err: any) {
        logError("[VerificationController] User verification failed", err.message);
        return res.status(404).send("Verification Record Not Found");
    }
};

export const handleTripVerification = async (req: Request, res: Response) => {
    const { tripId } = req.params;

    try {
        // Fetch trip details - placeholder implementation
        // In a real scenario, you'd fetch the trip record here
        const html = verificationService.generateVerificationPage({}, 'trip');
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
    } catch (err: any) {
        return res.status(404).send("Trip Record Not Found");
    }
};