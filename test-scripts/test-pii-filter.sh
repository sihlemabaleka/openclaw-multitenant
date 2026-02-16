#!/bin/bash
# Test PII filtering functionality

set -e

echo "🧪 Testing PII Filter"
echo "====================="

CONTAINER_NAME="openclaw-test-tenant"

echo "📋 Testing PII detection and redaction..."
echo ""

# Test SSN detection
echo "1️⃣ Testing SSN detection:"
docker exec $CONTAINER_NAME node -e "
const { detectPII, filterPII } = require('./agents/guardrails/pii-filter.js');

const text = 'My SSN is 123-45-6789 and my friend\\'s is 987654321';
const rules = [{ type: 'ssn' }];
const result = filterPII(text, rules);

console.log('Original:', text);
console.log('Redacted:', result.redacted);
console.log('Matches:', result.matches.length, 'SSNs found');
console.log(result.matches.length === 2 ? '✅ PASS' : '❌ FAIL');
"
echo ""

# Test credit card detection
echo "2️⃣ Testing Credit Card detection:"
docker exec $CONTAINER_NAME node -e "
const { filterPII } = require('./agents/guardrails/pii-filter.js');

const text = 'My Visa card is 4532015112830366';
const rules = [{ type: 'credit_card' }];
const result = filterPII(text, rules);

console.log('Original:', text);
console.log('Redacted:', result.redacted);
console.log('Matches:', result.matches.length, 'card(s) found');
console.log(result.matches.length === 1 ? '✅ PASS' : '❌ FAIL');
"
echo ""

# Test email detection
echo "3️⃣ Testing Email detection:"
docker exec $CONTAINER_NAME node -e "
const { filterPII } = require('./agents/guardrails/pii-filter.js');

const text = 'Contact me at john.doe@example.com or jane@test.org';
const rules = [{ type: 'email' }];
const result = filterPII(text, rules);

console.log('Original:', text);
console.log('Redacted:', result.redacted);
console.log('Matches:', result.matches.length, 'email(s) found');
console.log(result.matches.length === 2 ? '✅ PASS' : '❌ FAIL');
"
echo ""

# Test phone detection
echo "4️⃣ Testing Phone detection:"
docker exec $CONTAINER_NAME node -e "
const { filterPII } = require('./agents/guardrails/pii-filter.js');

const text = 'Call me at (555) 123-4567 or 555-987-6543';
const rules = [{ type: 'phone' }];
const result = filterPII(text, rules);

console.log('Original:', text);
console.log('Redacted:', result.redacted);
console.log('Matches:', result.matches.length, 'phone(s) found');
console.log(result.matches.length === 2 ? '✅ PASS' : '❌ FAIL');
"
echo ""

# Test multiple PII types
echo "5️⃣ Testing Multiple PII types:"
docker exec $CONTAINER_NAME node -e "
const { filterPII } = require('./agents/guardrails/pii-filter.js');

const text = 'John (SSN: 123-45-6789) can be reached at john@example.com or (555) 123-4567. His Visa is 4532015112830366.';
const rules = [
  { type: 'ssn' },
  { type: 'email' },
  { type: 'phone' },
  { type: 'credit_card' }
];
const result = filterPII(text, rules);

console.log('Original:', text);
console.log('Redacted:', result.redacted);
console.log('Total matches:', result.matches.length);
console.log('- SSN:', result.matches.filter(m => m.type === 'ssn').length);
console.log('- Email:', result.matches.filter(m => m.type === 'email').length);
console.log('- Phone:', result.matches.filter(m => m.type === 'phone').length);
console.log('- Card:', result.matches.filter(m => m.type === 'credit_card').length);
console.log(result.matches.length === 4 ? '✅ PASS' : '❌ FAIL');
"
echo ""

echo "✅ PII filter test complete!"
