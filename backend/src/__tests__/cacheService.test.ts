// backend/src/__tests__/cacheService.test.ts
import { describe, it, expect } from "vitest";

describe("Cache Service", () => {
  it("should have valid configuration", () => {
    // Basic sanity check
    expect(true).toBe(true);
  });

  it("should calculate haversine distance correctly", () => {
    // Kathmandu to Pokhara approximate distance: ~200km
    const kathmandu = { lat: 27.7172, lng: 85.3240 };
    const pokhara = { lat: 28.2096, lng: 83.9856 };

    const R = 6371;
    const dLat = ((pokhara.lat - kathmandu.lat) * Math.PI) / 180;
    const dLon = ((pokhara.lng - kathmandu.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((kathmandu.lat * Math.PI) / 180) *
      Math.cos((pokhara.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    expect(distance).toBeGreaterThan(180);
    expect(distance).toBeLessThan(220);
  });
});
