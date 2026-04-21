import fs from "fs/promises";
import path from "path";
import * as turf from "@turf/turf";
import { logInfo, logError } from "../logs/logs.js";
import { PROVINCE_DATA } from "../config/index.js";

/**
 * 🌏 Inverted Nepal Mask Generator
 * This script creates a GeoJSON file that covers the entire world EXCEPT Nepal.
 * Pre-generating this file saves CPU cycles on the frontend and ensures 
 * the "Show Only Nepal" masking technique is instant.
 */
async function generateInvertedNepalMask() {
    const dataDir = path.resolve(process.cwd(), "data");
    const inputPath = path.resolve(process.cwd(), PROVINCE_DATA || "data/provinces.geojson");
    const outputPath = path.join(dataDir, "nepal_mask.geojson");

    try {
        logInfo(`[Script] Loading boundary data from ${inputPath}...`);
        const rawData = await fs.readFile(inputPath, "utf-8");
        const geojson = JSON.parse(rawData) as turf.AllGeoJSON;

        if (geojson.type !== "FeatureCollection" || !geojson.features) {
            throw new Error("Input must be a FeatureCollection of Nepal boundaries.");
        }

        // 1. Filter and union all features into a single polygon
        // We use provinces as they are typically lower-resolution/simpler than districts
        const polyFeatures = geojson.features.filter((f: any) =>
            f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon"
        );

        if (polyFeatures.length === 0) {
            throw new Error("No polygon features found in source file.");
        }

        logInfo(`[Script] Dissolving ${polyFeatures.length} features into a single boundary...`);
        // Use turf.union with a spread to handle multiple features more efficiently
        // than a loop, while gracefully handling large MultiPolygon sets.
        const unified = polyFeatures.reduce((acc, curr) => {
            const result = turf.union(acc as any, curr as any);
            return result || acc;
        }, polyFeatures[0]);

        // 2. Generate the inverted mask
        // turf.mask returns a polygon covering the world with the input polygon as a hole.
        logInfo("[Script] Generating inverted world mask...");
        const mask = turf.mask(unified);

        // 3. Save the result
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(mask, null, 2), "utf-8");

        logInfo(`[Script] Success! Inverted mask saved to: ${outputPath}`);
        console.log(`\n✅ Inverted Nepal mask generated successfully at:\n   ${outputPath}\n`);

    } catch (err: any) {
        logError("[Script] Failed to generate inverted mask", err.message);
        process.exit(1);
    }
}

generateInvertedNepalMask();