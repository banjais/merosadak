// backend/src/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  incidentSchema,
  requestOTPSchema,
  loginOTPSchema,
  searchQuerySchema,
} from "../middleware/validation.js";

describe("Validation Schemas", () => {
  describe("incidentSchema", () => {
    it("should validate a valid incident report", () => {
      const validIncident = {
        type: "blockage",
        description: "This is a test incident description that is long enough",
        lat: 27.7172,
        lng: 85.3240,
      };

      const result = incidentSchema.safeParse(validIncident);
      expect(result.success).toBe(true);
    });

    it("should reject invalid incident type", () => {
      const invalidIncident = {
        type: "invalid_type",
        description: "This is a test incident description that is long enough",
        lat: 27.7172,
        lng: 85.3240,
      };

      const result = incidentSchema.safeParse(invalidIncident);
      expect(result.success).toBe(false);
    });

    it("should reject short descriptions", () => {
      const invalidIncident = {
        type: "blockage",
        description: "Short",
        lat: 27.7172,
        lng: 85.3240,
      };

      const result = incidentSchema.safeParse(invalidIncident);
      expect(result.success).toBe(false);
    });

    it("should reject invalid coordinates", () => {
      const invalidIncident = {
        type: "blockage",
        description: "This is a test incident description that is long enough",
        lat: 100, // Invalid latitude
        lng: 85.3240,
      };

      const result = incidentSchema.safeParse(invalidIncident);
      expect(result.success).toBe(false);
    });
  });

  describe("requestOTPSchema", () => {
    it("should validate valid OTP request", () => {
      const validRequest = {
        email: "test@example.com",
      };

      const result = requestOTPSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const invalidRequest = {
        email: "not-an-email",
      };

      const result = requestOTPSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe("loginOTPSchema", () => {
    it("should validate valid login", () => {
      const validLogin = {
        email: "test@example.com",
        otp: "123456",
      };

      const result = loginOTPSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    it("should reject invalid OTP format", () => {
      const invalidLogin = {
        email: "test@example.com",
        otp: "abc123", // Contains letters
      };

      const result = loginOTPSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });

    it("should reject OTP with wrong length", () => {
      const invalidLogin = {
        email: "test@example.com",
        otp: "12345", // Only 5 digits
      };

      const result = loginOTPSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });
  });

  describe("searchQuerySchema", () => {
    it("should validate valid search query", () => {
      const validQuery = {
        q: "Kathmandu",
      };

      const result = searchQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it("should accept optional parameters", () => {
      const queryWithExtras = {
        q: "Road",
        limit: 20,
        lat: 27.7172,
        lng: 85.3240,
        type: "road",
      };

      const result = searchQuerySchema.safeParse(queryWithExtras);
      expect(result.success).toBe(true);
    });
  });
});
