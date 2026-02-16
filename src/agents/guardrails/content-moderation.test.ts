import { describe, expect, test, vi } from "vitest";
import {
  createModerationConfig,
  formatModerationMessage,
  moderateContent,
  shouldBlockContent,
  type ModerationConfig,
} from "./content-moderation.js";

describe("Content Moderation", () => {
  describe("moderateContent", () => {
    test("passes through when disabled", async () => {
      const config: ModerationConfig = {
        enabled: false,
        webhook: "https://example.com/moderate",
      };

      const result = await moderateContent("test content", config);

      expect(result.safe).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test("passes through when no webhook configured", async () => {
      const config: ModerationConfig = {
        enabled: true,
      };

      const result = await moderateContent("test content", config);

      expect(result.safe).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test("calls webhook and returns result", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          flagged: true,
          categories: ["hate", "violence"],
          scores: { hate: 0.8, violence: 0.6 },
        }),
      });

      const config: ModerationConfig = {
        enabled: true,
        webhook: "https://example.com/moderate",
      };

      const result = await moderateContent("offensive content", config);

      expect(result.safe).toBe(false);
      expect(result.violations).toEqual(["hate", "violence"]);
      expect(result.categories).toEqual({ hate: 0.8, violence: 0.6 });
    });

    test("fails open on webhook error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const config: ModerationConfig = {
        enabled: true,
        webhook: "https://example.com/moderate",
      };

      const result = await moderateContent("test content", config);

      expect(result.safe).toBe(true);
      expect(result.error).toContain("500");
    });

    test("fails open on timeout", async () => {
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ flagged: false, categories: [] }),
                }),
              10000,
            ),
          ),
      );

      const config: ModerationConfig = {
        enabled: true,
        webhook: "https://example.com/moderate",
        timeoutMs: 100,
      };

      const result = await moderateContent("test content", config);

      expect(result.safe).toBe(true);
      expect(result.error).toBeDefined();
    });
  });

  describe("shouldBlockContent", () => {
    test("does not block safe content", () => {
      const result = {
        safe: true,
        violations: [],
      };

      expect(shouldBlockContent(result)).toBe(false);
    });

    test("blocks flagged content without scores", () => {
      const result = {
        safe: false,
        violations: ["hate"],
      };

      expect(shouldBlockContent(result)).toBe(true);
    });

    test("blocks content with high scores", () => {
      const result = {
        safe: false,
        violations: ["hate"],
        categories: { hate: 0.9 },
      };

      expect(shouldBlockContent(result, 0.5)).toBe(true);
    });

    test("does not block content with low scores", () => {
      const result = {
        safe: false,
        violations: ["hate"],
        categories: { hate: 0.3 },
      };

      expect(shouldBlockContent(result, 0.5)).toBe(false);
    });

    test("respects custom threshold", () => {
      const result = {
        safe: false,
        violations: ["violence"],
        categories: { violence: 0.6 },
      };

      expect(shouldBlockContent(result, 0.7)).toBe(false);
      expect(shouldBlockContent(result, 0.5)).toBe(true);
    });
  });

  describe("formatModerationMessage", () => {
    test("formats empty violations", () => {
      const message = formatModerationMessage([]);
      expect(message).toBe("Content flagged by moderation system");
    });

    test("formats single violation", () => {
      const message = formatModerationMessage(["hate"]);
      expect(message).toBe("Content flagged: hate");
    });

    test("formats multiple violations", () => {
      const message = formatModerationMessage(["hate", "violence", "harassment"]);
      expect(message).toBe("Content flagged: hate, violence, harassment");
    });
  });

  describe("createModerationConfig", () => {
    test("creates config with defaults", () => {
      const config = createModerationConfig("https://example.com/moderate");

      expect(config).toEqual({
        webhook: "https://example.com/moderate",
        enabled: true,
        timeoutMs: 5000,
      });
    });

    test("creates disabled config when no webhook", () => {
      const config = createModerationConfig();

      expect(config.enabled).toBe(false);
    });

    test("respects custom timeout", () => {
      const config = createModerationConfig("https://example.com/moderate", true, 10000);

      expect(config.timeoutMs).toBe(10000);
    });

    test("respects explicit disabled flag", () => {
      const config = createModerationConfig("https://example.com/moderate", false);

      expect(config.enabled).toBe(false);
    });
  });
});
