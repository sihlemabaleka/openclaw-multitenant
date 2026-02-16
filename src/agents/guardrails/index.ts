/**
 * Guardrails Integration Module
 * Provides a clean interface for applying tenant-level restrictions
 */

export * from "./pii-filter.js";
export * from "./content-moderation.js";

import {
  moderateContent,
  shouldBlockContent,
  formatModerationMessage,
  type ModerationConfig,
  type ModerationResult,
} from "./content-moderation.js";
import { filterPII, type PIIFilterRule, type PIIMatch } from "./pii-filter.js";

export interface GuardrailsConfig {
  piiFilters?: PIIFilterRule[];
  moderation?: ModerationConfig;
  toolRestrictions?: {
    allowedTools?: string[];
    blockedTools?: string[];
  };
}

export interface GuardrailResult {
  allowed: boolean;
  modifiedContent?: string;
  piiMatches?: PIIMatch[];
  moderationResult?: ModerationResult;
  blockReason?: string;
}

/**
 * Apply pre-LLM guardrails (PII filtering)
 * Called before sending user input to the LLM
 *
 * @param content - User message content
 * @param config - Guardrails configuration
 * @returns Result with potentially redacted content
 */
export async function applyPreLLMGuardrails(
  content: string,
  config: GuardrailsConfig,
): Promise<GuardrailResult> {
  // Apply PII filtering if configured
  if (config.piiFilters && config.piiFilters.length > 0) {
    const { redacted, matches } = filterPII(content, config.piiFilters);

    if (matches.length > 0) {
      console.log(`[guardrails] Redacted ${matches.length} PII instances from user input`);
    }

    return {
      allowed: true,
      modifiedContent: redacted,
      piiMatches: matches,
    };
  }

  // No modifications needed
  return {
    allowed: true,
  };
}

/**
 * Apply post-LLM guardrails (content moderation)
 * Called after receiving LLM response before sending to user
 *
 * @param content - LLM response content
 * @param config - Guardrails configuration
 * @returns Result indicating if content should be blocked
 */
export async function applyPostLLMGuardrails(
  content: string,
  config: GuardrailsConfig,
): Promise<GuardrailResult> {
  // Apply content moderation if configured
  if (config.moderation?.enabled) {
    const moderationResult = await moderateContent(content, config.moderation);

    if (!moderationResult.safe) {
      const shouldBlock = shouldBlockContent(moderationResult);

      if (shouldBlock) {
        console.warn(
          `[guardrails] Blocked LLM response due to moderation: ${moderationResult.violations.join(", ")}`,
        );

        return {
          allowed: false,
          moderationResult,
          blockReason: formatModerationMessage(moderationResult.violations),
        };
      }
    }

    return {
      allowed: true,
      moderationResult,
    };
  }

  // No restrictions
  return {
    allowed: true,
  };
}

/**
 * Check if a tool is allowed to be executed
 * Called before tool execution
 *
 * @param toolName - Name of the tool to check
 * @param config - Guardrails configuration
 * @returns Result indicating if tool execution is allowed
 */
export function checkToolAllowed(toolName: string, config: GuardrailsConfig): GuardrailResult {
  const restrictions = config.toolRestrictions;

  if (!restrictions) {
    return { allowed: true };
  }

  // Check blocklist first
  if (restrictions.blockedTools?.includes(toolName)) {
    console.warn(`[guardrails] Blocked tool execution: ${toolName} (in blocklist)`);
    return {
      allowed: false,
      blockReason: `Tool "${toolName}" is blocked by tenant policy`,
    };
  }

  // Check allowlist if present
  if (restrictions.allowedTools && restrictions.allowedTools.length > 0) {
    if (!restrictions.allowedTools.includes(toolName)) {
      console.warn(`[guardrails] Blocked tool execution: ${toolName} (not in allowlist)`);
      return {
        allowed: false,
        blockReason: `Tool "${toolName}" is not in the allowed tools list`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Apply all guardrails to a user message before sending to LLM
 * Convenience wrapper for applyPreLLMGuardrails
 *
 * @param content - User message content
 * @param config - Guardrails configuration
 * @returns Processed content (with PII redacted if applicable)
 */
export async function processUserInput(content: string, config: GuardrailsConfig): Promise<string> {
  const result = await applyPreLLMGuardrails(content, config);
  return result.modifiedContent ?? content;
}

/**
 * Apply all guardrails to an LLM response before sending to user
 * Convenience wrapper for applyPostLLMGuardrails
 *
 * @param content - LLM response content
 * @param config - Guardrails configuration
 * @returns Result with allowed flag and potential block reason
 */
export async function processLLMResponse(
  content: string,
  config: GuardrailsConfig,
): Promise<{ allowed: boolean; reason?: string }> {
  const result = await applyPostLLMGuardrails(content, config);
  return {
    allowed: result.allowed,
    reason: result.blockReason,
  };
}
