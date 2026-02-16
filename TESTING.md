# OpenClaw Multi-Tenant Fork - Docker Testing Guide

This guide walks through testing the multi-tenant features in a Docker container.

---

## Quick Start

### 1. Build the Docker Image

```bash
# Build from the Dockerfile
docker build -t openclaw-multitenant:test .
```

**Expected time**: 5-10 minutes (depending on network speed)

### 2. Set Up Environment Variables

```bash
# Copy the test environment template
cp test.env .env

# Edit .env and add your API keys:
# - OPENROUTER_API_KEY (required for AI)
# - TELEGRAM_BOT_TOKEN (optional, for Telegram testing)
# - OPENCLAW_GATEWAY_TOKEN (any string, e.g., "test-token-123")
nano .env
```

### 3. Start the Container

```bash
# Start with docker-compose
docker-compose -f docker-compose.test.yml up -d

# Or start manually
docker run -d \
  --name openclaw-test-tenant \
  --env-file .env \
  -v $(pwd)/test-tenant-config.json:/home/node/.openclaw/openclaw.json:ro \
  -p 3000:3000 \
  openclaw-multitenant:test
```

### 4. Run the Test Suite

```bash
# Run all tests
docker exec openclaw-test-tenant bash /test-scripts/run-all-tests.sh
```

---

## What Gets Tested

### ✅ Feature 1: Tenant Configuration Loading

- Loads `openclaw.json` with tenant-specific settings
- Verifies `tenantOverrides` section is parsed correctly
- Checks PII filters, tool restrictions, system prompt, etc.

### ✅ Feature 2: PII Detection & Redaction

Tests all PII filter types:

- **SSN**: `123-45-6789` → `[REDACTED_SSN]`
- **Credit Cards**: `4532015112830366` → `[REDACTED_CREDIT_CARD]`
- **Emails**: `user@example.com` → `[REDACTED_EMAIL]`
- **Phone Numbers**: `(555) 123-4567` → `[REDACTED_PHONE]`

### ✅ Feature 3: Tool Restriction Enforcement

- Tests `allowedTools` and `blockedTools` configuration
- Verifies `bash` is blocked when in `blockedTools`
- Verifies `read` is allowed when in `allowedTools`

### ✅ Feature 4: SIGHUP Config Hot-Reload

- Writes PID file to `/var/run/openclaw.pid`
- Modifies config file
- Sends `SIGHUP` signal
- Verifies config reloads without container restart

### ✅ Feature 5: BYOC Channel Configuration

- Verifies Telegram account-specific bot tokens load correctly
- Tests multi-account structure for channels

---

## Test Configuration

The `test-tenant-config.json` includes:

```json
{
  "userId": "test-tenant-123",
  "tenantOverrides": {
    "systemPrompt": "You are a helpful AI assistant for Acme Corp...",
    "piiFilters": ["ssn", "credit_card", "email", "phone"],
    "moderationWebhook": "https://httpbin.org/post",
    "allowedTools": ["read", "write", "grep", "glob"],
    "blockedTools": ["bash", "exec"]
  },
  "channels": {
    "telegram": {
      "accounts": {
        "test-tenant-123": {
          "botToken": "${TELEGRAM_BOT_TOKEN}",
          "enabled": true
        }
      }
    }
  }
}
```

---

## Individual Test Scripts

### PII Filter Test

```bash
docker exec openclaw-test-tenant bash /test-scripts/test-pii-filter.sh
```

Tests 5 scenarios:

1. SSN detection
2. Credit card detection
3. Email detection
4. Phone detection
5. Multiple PII types simultaneously

### Config Reload Test

```bash
docker exec openclaw-test-tenant bash /test-scripts/test-config-reload.sh
```

Steps:

1. Reads current config
2. Modifies `openclaw.json`
3. Sends SIGHUP signal
4. Verifies new config loaded

---

## Viewing Logs

### Container Logs

```bash
# View all logs
docker logs openclaw-test-tenant

# Follow logs in real-time
docker logs -f openclaw-test-tenant

# View last 50 lines
docker logs openclaw-test-tenant --tail 50
```

### Look for Key Messages

```bash
# PID file creation
docker logs openclaw-test-tenant | grep "PID file written"

# Config reload
docker logs openclaw-test-tenant | grep "SIGHUP"

# Tenant config loading
docker logs openclaw-test-tenant | grep "tenant"
```

---

## Manual Testing

### Check PID File

```bash
docker exec openclaw-test-tenant cat /var/run/openclaw.pid
```

### Inspect Loaded Config

```bash
docker exec openclaw-test-tenant node -e "
const { loadTenantConfig } = require('./config/tenant-config.js');
const config = loadTenantConfig();
console.log(JSON.stringify(config, null, 2));
"
```

### Test PII Filter Manually

```bash
docker exec -it openclaw-test-tenant node

# Inside Node REPL:
const { filterPII } = require('./agents/guardrails/pii-filter.js');
const result = filterPII('My SSN is 123-45-6789', [{ type: 'ssn' }]);
console.log(result);
```

### Send SIGHUP Manually

```bash
PID=$(docker exec openclaw-test-tenant cat /var/run/openclaw.pid)
docker exec openclaw-test-tenant kill -HUP $PID
docker logs openclaw-test-tenant --tail 10
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check container status
docker ps -a | grep openclaw-test-tenant

# View logs for errors
docker logs openclaw-test-tenant

# Common issues:
# - Missing API keys in .env
# - Invalid config JSON syntax
# - Port 3000 already in use
```

### PID File Missing

```bash
# Check if process is running
docker exec openclaw-test-tenant ps aux | grep node

# Check permissions
docker exec openclaw-test-tenant ls -la /var/run/
```

### SIGHUP Not Working

```bash
# Verify PID is correct
docker exec openclaw-test-tenant cat /var/run/openclaw.pid
docker exec openclaw-test-tenant ps aux | grep node

# Check if process is owned by node user
docker exec openclaw-test-tenant ps -o user,pid,comm | grep node
```

### Tests Failing

```bash
# Run individual tests to isolate issue
docker exec openclaw-test-tenant bash /test-scripts/test-pii-filter.sh
docker exec openclaw-test-tenant bash /test-scripts/test-config-reload.sh

# Check Node.js version (should be 22+)
docker exec openclaw-test-tenant node --version
```

---

## Cleanup

### Stop Container

```bash
docker-compose -f docker-compose.test.yml down
```

### Remove Container and Image

```bash
docker stop openclaw-test-tenant
docker rm openclaw-test-tenant
docker rmi openclaw-multitenant:test
```

### Remove Persistent Data

```bash
docker volume rm openclaw_openclaw-test-data
```

---

## Next Steps After Testing

Once all tests pass:

### 1. Tag and Push Image

```bash
# Tag for registry
docker tag openclaw-multitenant:test registry.glue.africa/openclaw-fork:latest
docker tag openclaw-multitenant:test registry.glue.africa/openclaw-fork:v1.0.0

# Push to registry
docker push registry.glue.africa/openclaw-fork:latest
docker push registry.glue.africa/openclaw-fork:v1.0.0
```

### 2. Integrate with openclaw-host

Refer to `OPENCLAW_HOST_CHANGES.md` for:

- Database schema extensions
- API endpoint implementation
- Dashboard UI development
- Pool manager configuration

---

## Test Results Reference

**Expected Output** from `run-all-tests.sh`:

```
🚀 OpenClaw Multi-Tenant Fork - Test Suite
===========================================

✅ Container is running
✅ Container is healthy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test 1: SIGHUP Handler & PID File
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ PID file exists
✅ PID file contains valid process ID

Test 2: Tenant Configuration Loading
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Tenant config loaded successfully
   - User ID: test-tenant-123
   - System Prompt: configured
   - PII Filters: 4 filters
   - Moderation Webhook: configured
   - Allowed Tools: 4 tools
   - Blocked Tools: 2 tools

Test 3: PII Detection & Redaction
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ Testing SSN detection:
✅ PASS

2️⃣ Testing Credit Card detection:
✅ PASS

3️⃣ Testing Email detection:
✅ PASS

4️⃣ Testing Phone detection:
✅ PASS

5️⃣ Testing Multiple PII types:
✅ PASS

Test 4: Tool Restriction Enforcement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Testing tool restrictions:
  - read tool (should be allowed): ✅ PASS
  - bash tool (should be blocked): ✅ PASS

Test 5: Hot Config Reload (SIGHUP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Config reloaded!
- System Prompt: ✅ UPDATED
✅ Config reload test complete!

Test 6: BYOC Channel Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Telegram BYOC configured
   - Accounts: 1
   - Account IDs: test-tenant-123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Multi-Tenant Feature Test Suite Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Support

For issues or questions:

- Check `WORKFLOW.md` for git workflow
- Check `MVP_STATUS.md` for implementation status
- Check `OPENCLAW_HOST_CHANGES.md` for integration guide
- Review container logs: `docker logs openclaw-test-tenant`
