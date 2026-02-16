/**
 * Content Moderation Module
 * Sends content to external moderation webhooks for safety checks
 */

export interface ModerationConfig {
  webhook?: string;
  timeoutMs?: number;
  enabled?: boolean;
}

export interface ModerationResult {
  safe: boolean;
  violations: string[];
  categories?: Record<string, number>;
  error?: string;
}

export interface ModerationWebhookRequest {
  text: string;
  metadata?: {
    userId?: string;
    channelId?: string;
    timestamp?: string;
  };
}

export interface ModerationWebhookResponse {
  flagged: boolean;
  categories: string[];
  scores?: Record<string, number>;
}

/**
 * Moderate content using external webhook
 * @param content - The content to moderate
 * @param config - Moderation configuration
 * @returns Moderation result indicating safety and violations
 */
export async function moderateContent(
  content: string,
  config: ModerationConfig,
): Promise<ModerationResult> {
  // If moderation is disabled or no webhook configured, pass through
  if (!config.enabled || !config.webhook) {
    return {
      safe: true,
      violations: [],
    };
  }

  const timeoutMs = config.timeoutMs ?? 5000; // Default 5 second timeout

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const payload: ModerationWebhookRequest = {
      text: content,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };

    const response = await fetch(config.webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        safe: true, // Fail open - don't block on moderation errors
        violations: [],
        error: `Moderation webhook returned ${response.status}`,
      };
    }

    const result = (await response.json()) as ModerationWebhookResponse;

    return {
      safe: !result.flagged,
      violations: result.categories || [],
      categories: result.scores,
    };
  } catch (error) {
    // Log error but don't block the content (fail open)
    console.warn("Content moderation error:", error);

    return {
      safe: true,
      violations: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if content should be blocked based on moderation result
 * @param result - Moderation result
 * @param threshold - Minimum violation score to block (0-1)
 * @returns true if content should be blocked
 */
export function shouldBlockContent(result: ModerationResult, threshold = 0.5): boolean {
  if (result.safe) {
    return false;
  }

  // If we have category scores, check against threshold
  if (result.categories) {
    return Object.values(result.categories).some((score) => score >= threshold);
  }

  // If flagged but no scores, block
  return !result.safe;
}

/**
 * Format moderation violations into a user-friendly message
 * @param violations - Array of violation categories
 * @returns Formatted message string
 */
export function formatModerationMessage(violations: string[]): string {
  if (violations.length === 0) {
    return "Content flagged by moderation system";
  }

  if (violations.length === 1) {
    return `Content flagged: ${violations[0]}`;
  }

  return `Content flagged: ${violations.join(", ")}`;
}

/**
 * Create a moderation config from tenant settings
 * @param webhookUrl - Webhook URL for moderation
 * @param enabled - Whether moderation is enabled
 * @param timeoutMs - Timeout in milliseconds
 * @returns Moderation config object
 */
export function createModerationConfig(
  webhookUrl?: string,
  enabled = true,
  timeoutMs = 5000,
): ModerationConfig {
  return {
    webhook: webhookUrl,
    enabled: enabled && !!webhookUrl,
    timeoutMs,
  };
}
