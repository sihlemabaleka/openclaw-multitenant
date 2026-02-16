import { describe, expect, test } from "vitest";
import { detectPII, filterPII, type PIIFilterRule } from "./pii-filter.js";

describe("PII Filter", () => {
  describe("SSN Detection", () => {
    test("detects SSN with dashes", () => {
      const text = "My SSN is 123-45-6789";
      const rules: PIIFilterRule[] = [{ type: "ssn" }];
      const matches = detectPII(text, rules);

      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("ssn");
      expect(matches[0].value).toBe("123-45-6789");
    });

    test("detects SSN without dashes", () => {
      const text = "SSN: 123456789";
      const rules: PIIFilterRule[] = [{ type: "ssn" }];
      const matches = detectPII(text, rules);

      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe("123456789");
    });

    test("redacts SSN", () => {
      const text = "Contact me with SSN 123-45-6789 for verification";
      const rules: PIIFilterRule[] = [{ type: "ssn" }];
      const { redacted } = filterPII(text, rules);

      expect(redacted).toBe("Contact me with SSN [REDACTED_SSN] for verification");
    });
  });

  describe("Credit Card Detection", () => {
    test("detects valid Visa card number", () => {
      const text = "Card: 4532015112830366";
      const rules: PIIFilterRule[] = [{ type: "credit_card" }];
      const matches = detectPII(text, rules);

      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("credit_card");
    });

    test("detects card with spaces", () => {
      const text = "Card: 4532 0151 1283 0366";
      const rules: PIIFilterRule[] = [{ type: "credit_card" }];
      const matches = detectPII(text, rules);

      expect(matches).toHaveLength(1);
    });

    test("redacts credit card", () => {
      const text = "Pay with 4532015112830366";
      const rules: PIIFilterRule[] = [{ type: "credit_card" }];
      const { redacted } = filterPII(text, rules);

      expect(redacted).toBe("Pay with [REDACTED_CREDIT_CARD]");
    });
  });

  describe("Email Detection", () => {
    test("detects email addresses", () => {
      const text = "Contact me at user@example.com";
      const rules: PIIFilterRule[] = [{ type: "email" }];
      const matches = detectPII(text, rules);

      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("email");
      expect(matches[0].value).toBe("user@example.com");
    });

    test("detects multiple emails", () => {
      const text = "Email alice@test.com or bob@test.org";
      const rules: PIIFilterRule[] = [{ type: "email" }];
      const matches = detectPII(text, rules);

      expect(matches).toHaveLength(2);
    });

    test("redacts email", () => {
      const text = "My email is john.doe@company.com";
      const rules: PIIFilterRule[] = [{ type: "email" }];
      const { redacted } = filterPII(text, rules);

      expect(redacted).toBe("My email is [REDACTED_EMAIL]");
    });
  });

  describe("Phone Number Detection", () => {
    test("detects phone with parentheses", () => {
      const text = "Call (555) 123-4567";
      const rules: PIIFilterRule[] = [{ type: "phone" }];
      const matches = detectPII(text, rules);

      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("phone");
    });

    test("detects phone with dashes", () => {
      const text = "Phone: 555-123-4567";
      const rules: PIIFilterRule[] = [{ type: "phone" }];
      const matches = detectPII(text, rules);

      expect(matches).toHaveLength(1);
    });

    test("redacts phone number", () => {
      const text = "Contact at (555) 123-4567";
      const rules: PIIFilterRule[] = [{ type: "phone" }];
      const { redacted } = filterPII(text, rules);

      // Note: The opening paren is not part of the phone number pattern
      expect(redacted).toBe("Contact at ([REDACTED_PHONE]");
    });
  });

  describe("Custom Regex", () => {
    test("detects custom pattern", () => {
      const text = "Employee ID: EMP-12345";
      const rules: PIIFilterRule[] = [{ type: "custom_regex", customPattern: "EMP-\\d{5}" }];
      const matches = detectPII(text, rules);

      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("custom_regex");
      expect(matches[0].value).toBe("EMP-12345");
    });

    test("handles invalid regex gracefully", () => {
      const text = "Some text";
      const rules: PIIFilterRule[] = [{ type: "custom_regex", customPattern: "[invalid(" }];
      const matches = detectPII(text, rules);

      expect(matches).toHaveLength(0);
    });
  });

  describe("Multiple PII Types", () => {
    test("detects and redacts multiple PII types", () => {
      const text = "Contact John at john@example.com or (555) 123-4567. SSN: 123-45-6789";
      const rules: PIIFilterRule[] = [{ type: "email" }, { type: "phone" }, { type: "ssn" }];
      const { redacted, matches } = filterPII(text, rules);

      expect(matches).toHaveLength(3);
      expect(redacted).toBe(
        "Contact John at [REDACTED_EMAIL] or ([REDACTED_PHONE]. SSN: [REDACTED_SSN]",
      );
    });
  });

  describe("Edge Cases", () => {
    test("handles empty text", () => {
      const text = "";
      const rules: PIIFilterRule[] = [{ type: "email" }];
      const { redacted, matches } = filterPII(text, rules);

      expect(matches).toHaveLength(0);
      expect(redacted).toBe("");
    });

    test("handles text with no PII", () => {
      const text = "This is just normal text";
      const rules: PIIFilterRule[] = [{ type: "email" }, { type: "phone" }];
      const { redacted, matches } = filterPII(text, rules);

      expect(matches).toHaveLength(0);
      expect(redacted).toBe(text);
    });

    test("handles overlapping matches", () => {
      const text = "test@example.com is my email";
      const rules: PIIFilterRule[] = [{ type: "email" }];
      const matches = detectPII(text, rules);

      expect(matches).toHaveLength(1);
    });
  });
});
