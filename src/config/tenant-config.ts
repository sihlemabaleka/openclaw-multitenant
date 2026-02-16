/**
 * Tenant Configuration Module
 * Loads and merges tenant-specific configuration overrides
 */

import type { ModerationConfig } from "../agents/guardrails/content-moderation.js";
import type { PIIFilterType } from "../agents/guardrails/pii-filter.js";
import { loadConfig } from "./io.js";

export interface TenantConfig {
  userId?: string;
  systemPrompt?: string;
  piiFilters?: PIIFilterType[];
  moderationWebhook?: string;
  allowedTools?: string[];
  blockedTools?: string[];
}

export interface TenantChannelCredentials {
  telegram?: {
    botToken?: string;
  };
  whatsapp?: {
    authStateDir?: string;
  };
  slack?: {
    botToken?: string;
    appToken?: string;
  };
}

export interface FullTenantConfig extends TenantConfig {
  channels: TenantChannelCredentials;
}

/**
 * Load tenant configuration from openclaw.json
 * Merges base config with tenant overrides
 *
 * @param configPath - Optional path to config file
 * @returns Tenant configuration object
 */
export async function loadTenantConfig(configPath?: string): Promise<FullTenantConfig> {
  const baseConfig = await loadConfig({ configPath });

  // Extract tenant overrides
  const tenantOverrides = baseConfig.tenantOverrides || {};

  // Extract channel credentials
  const channels: TenantChannelCredentials = {
    telegram: baseConfig.channels?.telegram?.botToken
      ? {
          botToken: baseConfig.channels.telegram.botToken,
        }
      : undefined,
    whatsapp: baseConfig.channels?.whatsapp
      ? {
          authStateDir: baseConfig.channels.whatsapp.authStateDir,
        }
      : undefined,
    slack:
      baseConfig.channels?.slack?.botToken || baseConfig.channels?.slack?.appToken
        ? {
            botToken: baseConfig.channels.slack.botToken,
            appToken: baseConfig.channels.slack.appToken,
          }
        : undefined,
  };

  return {
    userId: tenantOverrides.userId,
    systemPrompt: tenantOverrides.systemPrompt,
    piiFilters: tenantOverrides.piiFilters,
    moderationWebhook: tenantOverrides.moderationWebhook,
    allowedTools: tenantOverrides.allowedTools,
    blockedTools: tenantOverrides.blockedTools,
    channels,
  };
}

/**
 * Get PII filter rules from tenant config
 * @param config - Tenant configuration
 * @returns Array of PII filter rules
 */
export function getPIIFilterRules(config: TenantConfig) {
  if (!config.piiFilters || config.piiFilters.length === 0) {
    return [];
  }

  return config.piiFilters.map((type) => ({
    type,
  }));
}

/**
 * Get moderation config from tenant settings
 * @param config - Tenant configuration
 * @returns Moderation configuration
 */
export function getModerationConfig(config: TenantConfig): ModerationConfig {
  return {
    webhook: config.moderationWebhook,
    enabled: !!config.moderationWebhook,
    timeoutMs: 5000,
  };
}

/**
 * Check if a tool is allowed for the tenant
 * @param toolName - Name of the tool to check
 * @param config - Tenant configuration
 * @returns true if tool is allowed, false otherwise
 */
export function isToolAllowed(toolName: string, config: TenantConfig): boolean {
  // If tool is explicitly blocked, deny
  if (config.blockedTools?.includes(toolName)) {
    return false;
  }

  // If allowlist exists and tool is not in it, deny
  if (config.allowedTools && config.allowedTools.length > 0) {
    return config.allowedTools.includes(toolName);
  }

  // No restrictions, allow by default
  return true;
}

/**
 * Apply tenant system prompt override to base prompt
 * @param basePrompt - Base system prompt
 * @param config - Tenant configuration
 * @returns Final system prompt with tenant overrides applied
 */
export function applySystemPromptOverride(basePrompt: string, config: TenantConfig): string {
  if (!config.systemPrompt) {
    return basePrompt;
  }

  // If tenant prompt exists, prepend it to base prompt
  // This allows tenant-specific instructions while keeping base functionality
  return `${config.systemPrompt}\n\n${basePrompt}`;
}

/**
 * Validate tenant configuration
 * @param config - Tenant configuration to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateTenantConfig(config: TenantConfig): string[] {
  const errors: string[] = [];

  // Validate moderation webhook URL
  if (config.moderationWebhook) {
    try {
      new URL(config.moderationWebhook);
    } catch {
      errors.push(`Invalid moderation webhook URL: ${config.moderationWebhook}`);
    }
  }

  // Validate PII filters
  const validPIIFilters = new Set<PIIFilterType>([
    "ssn",
    "credit_card",
    "email",
    "phone",
    "custom_regex",
  ]);
  if (config.piiFilters) {
    for (const filter of config.piiFilters) {
      if (!validPIIFilters.has(filter)) {
        errors.push(`Invalid PII filter type: ${filter}`);
      }
    }
  }

  // Validate tool restrictions
  if (config.allowedTools && config.blockedTools) {
    const overlap = config.allowedTools.filter((tool) => config.blockedTools?.includes(tool));
    if (overlap.length > 0) {
      errors.push(`Tools cannot be in both allowedTools and blockedTools: ${overlap.join(", ")}`);
    }
  }

  return errors;
}

/**
 * Get default tenant configuration
 * @returns Default tenant config with no restrictions
 */
export function getDefaultTenantConfig(): TenantConfig {
  return {
    userId: undefined,
    systemPrompt: undefined,
    piiFilters: [],
    moderationWebhook: undefined,
    allowedTools: undefined,
    blockedTools: [],
  };
}
