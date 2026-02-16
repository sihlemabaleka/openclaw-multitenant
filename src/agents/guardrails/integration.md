# Guardrails Integration Guide

This document describes how to integrate the guardrails module into OpenClaw's agent execution pipeline.

## Overview

The guardrails module provides three main integration points:

1. **Pre-LLM Guardrails** - Applied to user input before sending to LLM (PII filtering)
2. **Post-LLM Guardrails** - Applied to LLM responses before sending to user (content moderation)
3. **Tool Restrictions** - Check if a tool is allowed before execution

## Integration Points

### 1. User Input Processing (Pre-LLM)

**Location**: `src/agents/pi-embedded-runner/run.ts` or message processing pipeline

**Before**: User message → LLM
**After**: User message → **applyPreLLMGuardrails** → LLM

```typescript
import { processUserInput } from '../guardrails/index.js';
import { loadTenantConfig, getPIIFilterRules } from '../../config/tenant-config.js';

// Load tenant configuration
const tenantConfig = await loadTenantConfig();

// Build guardrails config
const guardrailsConfig = {
  piiFilters: getPIIFilterRules(tenantConfig),
};

// Process user input (applies PII filtering)
const processedContent = await processUserInput(userMessage, guardrailsConfig);

// Send to LLM
const response = await llm.complete(processedContent, ...);
```

### 2. LLM Response Processing (Post-LLM)

**Location**: `src/agents/pi-embedded-subscribe.ts` or response streaming handlers

**Before**: LLM response → User
**After**: LLM response → **applyPostLLMGuardrails** → User (or block)

```typescript
import { processLLMResponse } from "../guardrails/index.js";
import { loadTenantConfig, getModerationConfig } from "../../config/tenant-config.js";

// Load tenant configuration
const tenantConfig = await loadTenantConfig();

// Build guardrails config
const guardrailsConfig = {
  moderation: getModerationConfig(tenantConfig),
};

// Check if response should be blocked
const { allowed, reason } = await processLLMResponse(llmResponse, guardrailsConfig);

if (!allowed) {
  // Block the response and notify user
  await sendMessage(channelId, `Response blocked: ${reason}`);
  return;
}

// Send response to user
await sendMessage(channelId, llmResponse);
```

### 3. Tool Execution Check

**Location**: `src/agents/pi-tools.ts` or tool execution pipeline

**Before**: Execute tool
**After**: **checkToolAllowed** → Execute tool (or deny)

```typescript
import { checkToolAllowed } from "../guardrails/index.js";
import { loadTenantConfig } from "../../config/tenant-config.js";

// Load tenant configuration
const tenantConfig = await loadTenantConfig();

// Build guardrails config
const guardrailsConfig = {
  toolRestrictions: {
    allowedTools: tenantConfig.allowedTools,
    blockedTools: tenantConfig.blockedTools,
  },
};

// Check if tool is allowed
const toolCheck = checkToolAllowed(toolName, guardrailsConfig);

if (!toolCheck.allowed) {
  return {
    error: toolCheck.blockReason,
    blocked: true,
  };
}

// Execute tool
const result = await executeTool(toolName, args);
```

## System Prompt Override

System prompts should be overridden when initializing the agent:

**Location**: `src/agents/pi-embedded-runner/system-prompt.ts`

```typescript
import { applySystemPromptOverride } from "../../config/tenant-config.js";

// Load tenant configuration
const tenantConfig = await loadTenantConfig();

// Apply tenant system prompt override
const finalSystemPrompt = applySystemPromptOverride(baseSystemPrompt, tenantConfig);
```

## Configuration Loading

Tenant configuration should be loaded once per session/container:

```typescript
import { loadTenantConfig } from "../config/tenant-config.js";

// Load configuration (reads from openclaw.json)
const tenantConfig = await loadTenantConfig();

// Cache for session
session.tenantConfig = tenantConfig;
```

## Environment Variables

For R2 backup functionality, ensure these environment variables are set:

- `R2_ENDPOINT` - Cloudflare R2 endpoint URL
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret key
- `R2_BUCKET_NAME` - R2 bucket name

## Testing Integration

1. **Test PII Filtering**:
   - Set `tenantOverrides.piiFilters = ["ssn", "email"]` in openclaw.json
   - Send message with SSN or email
   - Verify redaction in logs

2. **Test Content Moderation**:
   - Set `tenantOverrides.moderationWebhook` in openclaw.json
   - Send message that triggers moderation
   - Verify webhook is called and response is blocked

3. **Test Tool Restrictions**:
   - Set `tenantOverrides.blockedTools = ["bash"]` in openclaw.json
   - Trigger tool execution
   - Verify tool is blocked

## Performance Considerations

- **PII Filtering**: Regex-based, minimal overhead (<5ms per message)
- **Content Moderation**: Webhook call, 100-500ms latency (async recommended)
- **Tool Restrictions**: Hash lookup, negligible overhead (<1ms)

## Error Handling

All guardrails follow a **fail-open** policy:

- If PII filtering fails, send original message
- If moderation webhook fails, allow response
- If config loading fails, apply no restrictions

This ensures guardrail failures don't break core functionality.

## Logging

Guardrails log to console with `[guardrails]` prefix:

- `[guardrails] Redacted N PII instances from user input`
- `[guardrails] Blocked LLM response due to moderation: hate, violence`
- `[guardrails] Blocked tool execution: bash (in blocklist)`

## Next Steps

1. Integrate `applyPreLLMGuardrails` into message preprocessing
2. Integrate `applyPostLLMGuardrails` into response streaming
3. Integrate `checkToolAllowed` into tool execution
4. Add R2 backup cron job (see `src/backup/r2-backup.ts`)
5. Test end-to-end with sample tenant configuration
