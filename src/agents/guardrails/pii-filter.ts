/**
 * PII Detection and Redaction Module
 * Detects and redacts personally identifiable information (PII) from text
 */

export type PIIFilterType = "ssn" | "credit_card" | "email" | "phone" | "custom_regex";

export interface PIIMatch {
  type: PIIFilterType;
  value: string;
  start: number;
  end: number;
  pattern?: string;
}

export interface PIIFilterRule {
  type: PIIFilterType;
  customPattern?: string;
}

/**
 * Regex patterns for detecting different types of PII
 */
const PII_PATTERNS: Record<Exclude<PIIFilterType, "custom_regex">, RegExp> = {
  // US Social Security Number: 123-45-6789 or 123456789
  ssn: /\b(?:\d{3}-\d{2}-\d{4}|\d{9})\b/g,

  // Credit card numbers (Visa, MasterCard, Amex, Discover)
  // Matches 13-19 digit sequences with optional spaces or dashes
  credit_card: /\b(?:\d{4}[\s-]?){3}\d{4}(?:\d{3})?\b|\b(?:3[47]\d{2}[\s-]?\d{6}[\s-]?\d{5})\b/g,

  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Phone numbers (various formats)
  // Matches: (123) 456-7890, 123-456-7890, 123.456.7890, +1 123 456 7890, etc.
  phone: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
};

/**
 * Detect PII patterns in text
 * @param text - The text to scan for PII
 * @param rules - Array of PII filter rules to apply
 * @returns Array of detected PII matches
 */
export function detectPII(text: string, rules: PIIFilterRule[]): PIIMatch[] {
  const matches: PIIMatch[] = [];

  for (const rule of rules) {
    if (rule.type === "custom_regex") {
      if (!rule.customPattern) {
        continue;
      }

      try {
        const customRegex = new RegExp(rule.customPattern, "g");
        let match: RegExpExecArray | null;

        while ((match = customRegex.exec(text)) !== null) {
          matches.push({
            type: "custom_regex",
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
            pattern: rule.customPattern,
          });
        }
      } catch (error) {
        // Invalid regex pattern, skip
        console.warn(`Invalid custom regex pattern: ${rule.customPattern}`, error);
      }
    } else {
      const pattern = PII_PATTERNS[rule.type];
      let match: RegExpExecArray | null;

      // Reset lastIndex to ensure we scan from the beginning
      pattern.lastIndex = 0;

      while ((match = pattern.exec(text)) !== null) {
        // Additional validation for credit cards (Luhn algorithm)
        if (rule.type === "credit_card") {
          const cleaned = match[0].replace(/[\s-]/g, "");
          if (!validateLuhn(cleaned)) {
            continue; // Skip invalid credit card numbers
          }
        }

        matches.push({
          type: rule.type,
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  return matches;
}

/**
 * Redact detected PII from text
 * @param text - The original text
 * @param matches - Array of PII matches to redact
 * @returns Text with PII redacted
 */
export function redactPII(text: string, matches: PIIMatch[]): string {
  if (matches.length === 0) {
    return text;
  }

  let redacted = "";
  let lastEnd = 0;

  for (const match of matches) {
    // Add text before the match
    redacted += text.substring(lastEnd, match.start);

    // Add redaction placeholder
    redacted += `[REDACTED_${match.type.toUpperCase()}]`;

    lastEnd = match.end;
  }

  // Add remaining text
  redacted += text.substring(lastEnd);

  return redacted;
}

/**
 * Validate credit card number using Luhn algorithm
 * @param cardNumber - Credit card number (digits only)
 * @returns true if valid, false otherwise
 */
function validateLuhn(cardNumber: string): boolean {
  if (!/^\d{13,19}$/.test(cardNumber)) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  // Loop through values from right to left
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Convenience function to detect and redact PII in one call
 * @param text - The text to process
 * @param rules - Array of PII filter rules to apply
 * @returns Object containing redacted text and detected matches
 */
export function filterPII(
  text: string,
  rules: PIIFilterRule[],
): { redacted: string; matches: PIIMatch[] } {
  const matches = detectPII(text, rules);
  const redacted = redactPII(text, matches);

  return { redacted, matches };
}
