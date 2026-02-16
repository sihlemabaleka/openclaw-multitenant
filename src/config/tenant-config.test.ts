import { describe, expect, test } from "vitest";
import {
  applySystemPromptOverride,
  getModerationConfig,
  getPIIFilterRules,
  isToolAllowed,
  validateTenantConfig,
  type TenantConfig,
} from "./tenant-config.js";

describe("Tenant Config", () => {
  describe("getPIIFilterRules", () => {
    test("returns empty array for no filters", () => {
      const config: TenantConfig = {};
      const rules = getPIIFilterRules(config);

      expect(rules).toEqual([]);
    });

    test("returns rules for configured filters", () => {
      const config: TenantConfig = {
        piiFilters: ["ssn", "credit_card", "email"],
      };
      const rules = getPIIFilterRules(config);

      expect(rules).toHaveLength(3);
      expect(rules).toEqual([{ type: "ssn" }, { type: "credit_card" }, { type: "email" }]);
    });
  });

  describe("getModerationConfig", () => {
    test("returns disabled config when no webhook", () => {
      const config: TenantConfig = {};
      const moderationConfig = getModerationConfig(config);

      expect(moderationConfig.enabled).toBe(false);
      expect(moderationConfig.webhook).toBeUndefined();
    });

    test("returns enabled config with webhook", () => {
      const config: TenantConfig = {
        moderationWebhook: "https://example.com/moderate",
      };
      const moderationConfig = getModerationConfig(config);

      expect(moderationConfig.enabled).toBe(true);
      expect(moderationConfig.webhook).toBe("https://example.com/moderate");
      expect(moderationConfig.timeoutMs).toBe(5000);
    });
  });

  describe("isToolAllowed", () => {
    test("allows all tools by default", () => {
      const config: TenantConfig = {};

      expect(isToolAllowed("bash", config)).toBe(true);
      expect(isToolAllowed("web_search", config)).toBe(true);
    });

    test("blocks tools in blockedTools", () => {
      const config: TenantConfig = {
        blockedTools: ["bash", "exec"],
      };

      expect(isToolAllowed("bash", config)).toBe(false);
      expect(isToolAllowed("exec", config)).toBe(false);
      expect(isToolAllowed("web_search", config)).toBe(true);
    });

    test("enforces allowlist when present", () => {
      const config: TenantConfig = {
        allowedTools: ["read", "write", "grep"],
      };

      expect(isToolAllowed("read", config)).toBe(true);
      expect(isToolAllowed("write", config)).toBe(true);
      expect(isToolAllowed("bash", config)).toBe(false);
    });

    test("blocklist takes precedence over allowlist", () => {
      const config: TenantConfig = {
        allowedTools: ["bash", "read", "write"],
        blockedTools: ["bash"],
      };

      expect(isToolAllowed("bash", config)).toBe(false);
      expect(isToolAllowed("read", config)).toBe(true);
    });
  });

  describe("applySystemPromptOverride", () => {
    test("returns base prompt when no override", () => {
      const config: TenantConfig = {};
      const basePrompt = "You are a helpful assistant";
      const result = applySystemPromptOverride(basePrompt, config);

      expect(result).toBe(basePrompt);
    });

    test("prepends tenant prompt to base", () => {
      const config: TenantConfig = {
        systemPrompt: "You are a customer service agent for Acme Corp.",
      };
      const basePrompt = "You are a helpful assistant";
      const result = applySystemPromptOverride(basePrompt, config);

      expect(result).toContain("You are a customer service agent for Acme Corp.");
      expect(result).toContain("You are a helpful assistant");
      expect(result.indexOf("Acme Corp")).toBeLessThan(result.indexOf("helpful assistant"));
    });
  });

  describe("validateTenantConfig", () => {
    test("validates valid config", () => {
      const config: TenantConfig = {
        userId: "user123",
        systemPrompt: "Custom prompt",
        piiFilters: ["ssn", "email"],
        moderationWebhook: "https://example.com/moderate",
        allowedTools: ["read", "write"],
      };

      const errors = validateTenantConfig(config);
      expect(errors).toHaveLength(0);
    });

    test("detects invalid webhook URL", () => {
      const config: TenantConfig = {
        moderationWebhook: "not-a-valid-url",
      };

      const errors = validateTenantConfig(config);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Invalid moderation webhook URL");
    });

    test("detects invalid PII filter type", () => {
      const config: TenantConfig = {
        piiFilters: ["ssn", "invalid_type" as any],
      };

      const errors = validateTenantConfig(config);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Invalid PII filter type");
    });

    test("detects conflicting tool restrictions", () => {
      const config: TenantConfig = {
        allowedTools: ["bash", "read"],
        blockedTools: ["bash", "write"],
      };

      const errors = validateTenantConfig(config);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("cannot be in both allowedTools and blockedTools");
      expect(errors[0]).toContain("bash");
    });

    test("accepts empty config", () => {
      const config: TenantConfig = {};

      const errors = validateTenantConfig(config);
      expect(errors).toHaveLength(0);
    });
  });
});
