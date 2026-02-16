# OpenClaw Guardrails Module

Tenant-aware guardrails for multi-tenant SaaS deployments of OpenClaw.

## Overview

This module provides three layers of protection for multi-tenant deployments:

1. **Pre-LLM Guardrails**: PII filtering on user input
2. **Post-LLM Guardrails**: Content moderation on AI responses
3. **Tool Restrictions**: Permission checks before tool execution

## Modules

### PII Filter (`pii-filter.ts`)

Detects and redacts personally identifiable information:

```typescript
import { filterPII } from "./pii-filter.js";

const rules = [{ type: "ssn" }, { type: "credit_card" }, { type: "email" }, { type: "phone" }];

const { redacted, matches } = filterPII(userMessage, rules);
console.log(`Found ${matches.length} PII instances`);
console.log(`Redacted: ${redacted}`);
```

**Supported PII Types**:

- `ssn` - US Social Security Numbers
- `credit_card` - Credit card numbers (with Luhn validation)
- `email` - Email addresses
- `phone` - Phone numbers (US formats)
- `custom_regex` - Custom regex patterns

### Content Moderation (`content-moderation.ts`)

Sends content to external moderation webhooks:

```typescript
import { moderateContent, shouldBlockContent } from "./content-moderation.js";

const config = {
  webhook: "https://api.example.com/moderate",
  enabled: true,
  timeoutMs: 5000,
};

const result = await moderateContent(llmResponse, config);

if (!result.safe && shouldBlockContent(result)) {
  console.log(`Blocked: ${result.violations.join(", ")}`);
}
```

**Features**:

- Webhook-based (OpenAI Moderation, Perspective API, custom)
- Configurable timeout (default 5s)
- Fail-open policy (errors don't block content)
- Category-based blocking with thresholds

### Integration Interface (`index.ts`)

Clean API for integrating guardrails into OpenClaw:

```typescript
import {
  applyPreLLMGuardrails,
  applyPostLLMGuardrails,
  checkToolAllowed,
  type GuardrailsConfig,
} from "./index.js";

const config: GuardrailsConfig = {
  piiFilters: [{ type: "ssn" }, { type: "email" }],
  moderation: {
    webhook: "https://api.example.com/moderate",
    enabled: true,
  },
  toolRestrictions: {
    blockedTools: ["bash", "exec"],
  },
};

// Before sending to LLM
const preResult = await applyPreLLMGuardrails(userInput, config);
const processedInput = preResult.modifiedContent || userInput;

// After receiving from LLM
const postResult = await applyPostLLMGuardrails(llmResponse, config);
if (!postResult.allowed) {
  console.log(`Blocked: ${postResult.blockReason}`);
}

// Before executing tool
const toolCheck = checkToolAllowed("bash", config);
if (!toolCheck.allowed) {
  throw new Error(toolCheck.blockReason);
}
```

## Configuration

Tenant configuration is loaded from `openclaw.json`:

```json
{
  "tenantOverrides": {
    "systemPrompt": "Custom instructions for this tenant",
    "piiFilters": ["ssn", "credit_card", "email"],
    "moderationWebhook": "https://api.example.com/moderate",
    "allowedTools": ["read", "write", "grep"],
    "blockedTools": ["bash", "exec"]
  }
}
```

## Testing

Run tests:

```bash
pnpm test src/agents/guardrails/
```

Test coverage:

- **PII Filter**: 18 tests (SSN, credit card, email, phone, custom regex)
- **Content Moderation**: 15 tests (webhook integration, fail-open, thresholds)
- **Tenant Config**: 16 tests (loading, validation, tool restrictions)

## Performance

- **PII Filtering**: <5ms per message
- **Content Moderation**: 100-500ms (webhook latency)
- **Tool Restrictions**: <1ms (hash lookup)

All guardrails follow **fail-open** policy for reliability.

## Integration

See `integration.md` for detailed integration instructions.

## License

MIT (same as OpenClaw)
