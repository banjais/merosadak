// backend/src/services/roadQualityService.ts
import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "../config/paths.js";
import { logInfo, logError } from "../logs/logs.js";

// ────────────────────────────────
// Crowdsourced Road Quality Scoring Service
// Users rate road conditions, creating a quality heatmap
// ────────────────────────────────

interface Location {
  lat: number;
  lng: number;
}

interface QualityReport {
  id: string;
  userId: string;
  location: Location;
  roadCode?: string;
  roadName?: string;
  overallScore: number; // 1-5
  surfaceQuality: number; // 1-5
  safetyScore: number; // 1-5
  trafficFlow: number; // 1-5
  comments: string;
  timestamp: string;
  upvotes: number;
  downvotes: number;
  verified: boolean;
}

interface RoadQualitySegment {
  roadCode: string;
  roadName: string;
  location: Location;
  avgScore: number;
  reportCount: number;
  lastUpdated: string;
  trend: "improving" | "stable" | "declining";
}

// In-memory store (replace with DB in production)
const reports: QualityReport[] = [];
const REPORTS_FILE = path.join(DATA_DIR, "road_quality_reports.json");

/**
 * Initialize road quality service
 */
export async function initializeRoadQuality(): Promise<void> {
  try {
    const data = await fs.readFile(REPORTS_FILE, "utf-8");
    const parsed = JSON.parse(data) as QualityReport[];
    reports.push(...parsed);
    logInfo("[RoadQuality] Loaded reports", { count: reports.length });
  } catch {
    logInfo("[RoadQuality] No existing reports found");
  }
}

/**
 * Save reports to disk
 */
async function saveReports(): Promise<void> {
  try {
    await fs.writeFile(REPORTS_FILE, JSON.stringify(reports, null, 2));
  } catch (err: any) {
    logError("[RoadQuality] Failed to save reports", err.message);
  }
}

/**
 * Submit a road quality report
 */
export async function submitQualityReport(
  report: Omit<QualityReport, "id" | "timestamp" | "upvotes" | "downvotes" | "verified">
): Promise<QualityReport | null> {
  try {
    // Validate scores
    if (
      report.overallScore < 1 || report.overallScore > 5 ||
      report.surfaceQuality < 1 || report.surfaceQuality > 5 ||
      report.safetyScore < 1 || report.safetyScore > 5 ||
      report.trafficFlow < 1 || report.trafficFlow > 5
    ) {
      return null;
    }

    const newReport: QualityReport = {
      ...report,
      id: `rq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      upvotes: 0,
      downvotes: 0,
      verified: false,
    };

    reports.push(newReport);
    await saveReports();

    logInfo("[RoadQuality] New report submitted", {
      id: newReport.id,
      location: report.location,
      score: report.overallScore,
    });

    return newReport;
  } catch (err: any) {
    logError("[RoadQuality] Failed to submit report", err.message);
    return null;
  }
}

/**
 * Vote on a quality report
 */
export async function voteOnReport(
  reportId: string,
  vote: "up" | "down"
): Promise<boolean> {
  const report = reports.find((r) => r.id === reportId);
  if (!report) return false;

  if (vote === "up") {
    report.upvotes++;
  } else {
    report.downvotes++;
  }

  // Auto-verify reports with 5+ upvotes
  if (report.upvotes >= 5 && !report.verified) {
    report.verified = true;
  }

  await saveReports();
  return true;
}

/**
 * Get quality reports near a location
 */
export function getReportsNearby(
  location: Location,
  radiusKm: number = 10,
  limit: number = 20
): QualityReport[] {
  const R = 6371;

  const nearby = reports
    .map((report) => {
      const dLat = ((report.location.lat - location.lat) * Math.PI) / 180;
      const dLon = ((report.location.lng - location.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((location.lat * Math.PI) / 180) *
        Math.cos((report.location.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      return { report, distance };
    })
    .filter(({ distance }) => distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ report }) => report);

  return nearby;
}

/**
 * Get average quality for a road segment
 */
export function getRoadQualityForRoad(
  roadCode: string
): {
  avgScore: number;
  reportCount: number;
  surfaceQuality: number;
  safetyScore: number;
  trafficFlow: number;
  trend: "improving" | "stable" | "declining";
} | null {
  const roadReports = reports.filter((r) => r.roadCode === roadCode);

  if (roadReports.length === 0) return null;

  const avgScore = roadReports.reduce((sum, r) => sum + r.overallScore, 0) / roadReports.length;
  const avgSurface = roadReports.reduce((sum, r) => sum + r.surfaceQuality, 0) / roadReports.length;
  const avgSafety = roadReports.reduce((sum, r) => sum + r.safetyScore, 0) / roadReports.length;
  const avgTraffic = roadReports.reduce((sum, r) => sum + r.trafficFlow, 0) / roadReports.length;

  // Calculate trend (compare recent vs older reports)
  const sortedByTime = [...roadReports].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const recentCount = Math.max(1, Math.floor(sortedByTime.length / 2));
  const recent = sortedByTime.slice(0, recentCount);
  const older = sortedByTime.slice(recentCount);

  const recentAvg = recent.reduce((sum, r) => sum + r.overallScore, 0) / recent.length;
  const olderAvg = older.length > 0
    ? older.reduce((sum, r) => sum + r.overallScore, 0) / older.length
    : recentAvg;

  let trend: "improving" | "stable" | "declining";
  const diff = recentAvg - olderAvg;
  if (diff > 0.3) trend = "improving";
  else if (diff < -0.3) trend = "declining";
  else trend = "stable";

  return {
    avgScore: Math.round(avgScore * 10) / 10,
    reportCount: roadReports.length,
    surfaceQuality: Math.round(avgSurface * 10) / 10,
    safetyScore: Math.round(avgSafety * 10) / 10,
    trafficFlow: Math.round(avgTraffic * 10) / 10,
    trend,
  };
}

/**
 * Get quality heatmap data (grid-based)
 */
export function getQualityHeatmap(
  bounds: { north: number; south: number; east: number; west: number },
  gridSize: number = 0.1 // degrees
): Array<{
  center: Location;
  avgScore: number;
  reportCount: number;
}> {
  const grid: Map<string, { total: number; count: number; lat: number; lng: number }> = new Map();

  for (const report of reports) {
    if (
      report.location.lat < bounds.south ||
      report.location.lat > bounds.north ||
      report.location.lng < bounds.west ||
      report.location.lng > bounds.east
    ) {
      continue;
    }

    const gridLat = Math.round(report.location.lat / gridSize) * gridSize;
    const gridLng = Math.round(report.location.lng / gridSize) * gridSize;
    const key = `${gridLat},${gridLng}`;

    const cell = grid.get(key) || { total: 0, count: 0, lat: gridLat, lng: gridLng };
    cell.total += report.overallScore;
    cell.count++;
    grid.set(key, cell);
  }

  return Array.from(grid.values()).map((cell) => ({
    center: { lat: cell.lat, lng: cell.lng },
    avgScore: Math.round((cell.total / cell.count) * 10) / 10,
    reportCount: cell.count,
  }));
}

/**
 * Get worst road segments (lowest quality)
 */
export function getWorstRoads(limit: number = 10): Array<{
  roadCode: string;
  roadName?: string;
  avgScore: number;
  reportCount: number;
}> {
  const roadScores: Map<string, { total: number; count: number; name?: string }> = new Map();

  for (const report of reports) {
    if (!report.roadCode) continue;

    const road = roadScores.get(report.roadCode) || { total: 0, count: 0, name: report.roadName };
    road.total += report.overallScore;
    road.count++;
    roadScores.set(report.roadCode, road);
  }

  return Array.from(roadScores.entries())
    .map(([code, data]) => ({
      roadCode: code,
      roadName: data.name,
      avgScore: Math.round((data.total / data.count) * 10) / 10,
      reportCount: data.count,
    }))
    .filter((r) => r.reportCount >= 3) // Minimum 3 reports
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, limit);
}

/**
 * Get best road segments (highest quality)
 */
export function getBestRoads(limit: number = 10): Array<{
  roadCode: string;
  roadName?: string;
  avgScore: number;
  reportCount: number;
}> {
  const roadScores: Map<string, { total: number; count: number; name?: string }> = new Map();

  for (const report of reports) {
    if (!report.roadCode) continue;

    const road = roadScores.get(report.roadCode) || { total: 0, count: 0, name: report.roadName };
    road.total += report.overallScore;
    road.count++;
    roadScores.set(report.roadCode, road);
  }

  return Array.from(roadScores.entries())
    .map(([code, data]) => ({
      roadCode: code,
      roadName: data.name,
      avgScore: Math.round((data.total / data.count) * 10) / 10,
      reportCount: data.count,
    }))
    .filter((r) => r.reportCount >= 3)
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, limit);
}

/**
 * Get report stats
 */
export function getQualityStats(): {
  totalReports: number;
  avgScore: number;
  topContributors: Map<string, number>;
} {
  const avgScore = reports.length > 0
    ? reports.reduce((sum, r) => sum + r.overallScore, 0) / reports.length
    : 0;

  const topContributors: Map<string, number> = new Map();
  for (const report of reports) {
    topContributors.set(
      report.userId,
      (topContributors.get(report.userId) || 0) + 1
    );
  }

  return {
    totalReports: reports.length,
    avgScore: Math.round(avgScore * 10) / 10,
    topContributors,
  };
}
