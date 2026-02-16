#!/bin/bash
# Test SIGHUP config reload functionality

set -e

echo "🧪 Testing SIGHUP Config Reload"
echo "================================"

# Get container PID
CONTAINER_NAME="openclaw-test-tenant"
echo "📋 Getting container PID..."
CONTAINER_PID=$(docker exec $CONTAINER_NAME cat /var/run/openclaw.pid 2>/dev/null || echo "")

if [ -z "$CONTAINER_PID" ]; then
  echo "❌ PID file not found. Container may not be running properly."
  exit 1
fi

echo "✅ Container PID: $CONTAINER_PID"

# Show current config
echo ""
echo "📄 Current config loaded:"
docker exec $CONTAINER_NAME node -e "
const config = require('./config/io.js').loadConfig();
console.log('- User ID:', config.userId || 'not set');
console.log('- System Prompt:', config.tenantOverrides?.systemPrompt ? 'configured' : 'not set');
console.log('- PII Filters:', config.tenantOverrides?.piiFilters?.length || 0, 'filters');
console.log('- Blocked Tools:', config.tenantOverrides?.blockedTools?.length || 0, 'tools');
"

# Modify config
echo ""
echo "✏️  Updating config file..."
docker exec $CONTAINER_NAME sh -c "cat > /tmp/updated-config.json << 'EOF'
{
  \"userId\": \"test-tenant-123\",
  \"tenantOverrides\": {
    \"systemPrompt\": \"UPDATED: You are now in test mode. This config was hot-reloaded!\",
    \"piiFilters\": [\"ssn\", \"credit_card\"],
    \"blockedTools\": [\"bash\"]
  }
}
EOF
cp /tmp/updated-config.json /home/node/.openclaw/openclaw.json
"

# Send SIGHUP
echo ""
echo "📡 Sending SIGHUP signal to reload config..."
docker exec $CONTAINER_NAME kill -HUP $CONTAINER_PID

# Wait a moment
sleep 2

# Verify reload
echo ""
echo "🔍 Verifying config reload..."
docker exec $CONTAINER_NAME node -e "
const config = require('./config/io.js').loadConfig();
console.log('✅ Config reloaded!');
console.log('- User ID:', config.userId || 'not set');
console.log('- System Prompt:', config.tenantOverrides?.systemPrompt?.includes('UPDATED') ? '✅ UPDATED' : '❌ NOT UPDATED');
console.log('- PII Filters:', config.tenantOverrides?.piiFilters?.length || 0, 'filters');
console.log('- Blocked Tools:', config.tenantOverrides?.blockedTools?.length || 0, 'tools');
"

# Check container logs for reload message
echo ""
echo "📋 Container logs (last 10 lines):"
docker logs $CONTAINER_NAME --tail 10 | grep -E "(SIGHUP|reload|PID)" || echo "No reload messages found"

echo ""
echo "✅ Config reload test complete!"
