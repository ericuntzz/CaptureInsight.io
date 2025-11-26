interface PIIPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

const PII_PATTERNS: PIIPattern[] = [
  {
    name: "email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    replacement: "[EMAIL_REDACTED]",
  },
  {
    name: "phone_us",
    pattern: /\b(?:\+?1[-.]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    replacement: "[PHONE_REDACTED]",
  },
  {
    name: "phone_intl",
    pattern: /\b\+[1-9][0-9]{7,14}\b/g,
    replacement: "[PHONE_REDACTED]",
  },
  {
    name: "ssn",
    pattern: /\b[0-9]{3}[-\s]?[0-9]{2}[-\s]?[0-9]{4}\b/g,
    replacement: "[SSN_REDACTED]",
  },
  {
    name: "credit_card",
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    replacement: "[CARD_REDACTED]",
  },
  {
    name: "credit_card_formatted",
    pattern: /\b[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}\b/g,
    replacement: "[CARD_REDACTED]",
  },
  {
    name: "ip_address",
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: "[IP_REDACTED]",
  },
  {
    name: "api_key",
    pattern: /\b(?:sk|pk|api|key|token|secret|password|auth)[-_]?[a-zA-Z0-9]{20,}\b/gi,
    replacement: "[API_KEY_REDACTED]",
  },
  {
    name: "bearer_token",
    pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi,
    replacement: "[BEARER_TOKEN_REDACTED]",
  },
  {
    name: "jwt",
    pattern: /\beyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*\b/g,
    replacement: "[JWT_REDACTED]",
  },
  {
    name: "aws_key",
    pattern: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
    replacement: "[AWS_KEY_REDACTED]",
  },
  {
    name: "private_key",
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    replacement: "[PRIVATE_KEY_REDACTED]",
  },
  {
    name: "password_field",
    pattern: /(?:password|passwd|pwd|secret)["']?\s*[:=]\s*["']?[^\s"',;]{3,}/gi,
    replacement: "[PASSWORD_REDACTED]",
  },
  {
    name: "date_of_birth",
    pattern: /\b(?:DOB|date of birth|birthday|born)[:.\s]*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi,
    replacement: "[DOB_REDACTED]",
  },
];

export interface PIIFilterOptions {
  enabled: boolean;
  patterns?: string[];
  customPatterns?: PIIPattern[];
}

export interface PIIFilterResult {
  text: string;
  redactedCount: number;
  redactedTypes: string[];
}

export function filterPII(text: string, options?: PIIFilterOptions): PIIFilterResult {
  if (!options?.enabled) {
    return { text, redactedCount: 0, redactedTypes: [] };
  }

  const allowedPatterns = options.patterns || PII_PATTERNS.map(p => p.name);
  const patternsToApply = [
    ...PII_PATTERNS.filter(p => allowedPatterns.includes(p.name)),
    ...(options.customPatterns || []),
  ];

  let filteredText = text;
  let totalRedactions = 0;
  const redactedTypes: Set<string> = new Set();

  for (const { name, pattern, replacement } of patternsToApply) {
    const matches = filteredText.match(pattern);
    if (matches) {
      totalRedactions += matches.length;
      redactedTypes.add(name);
      filteredText = filteredText.replace(pattern, replacement);
    }
  }

  return {
    text: filteredText,
    redactedCount: totalRedactions,
    redactedTypes: Array.from(redactedTypes),
  };
}

export function filterPIIFromData(
  data: any[],
  options?: PIIFilterOptions
): { data: any[]; redactedCount: number; redactedTypes: string[] } {
  if (!options?.enabled) {
    return { data, redactedCount: 0, redactedTypes: [] };
  }

  let totalRedactions = 0;
  const allRedactedTypes: Set<string> = new Set();

  const filterValue = (value: any): any => {
    if (typeof value === "string") {
      const result = filterPII(value, options);
      totalRedactions += result.redactedCount;
      result.redactedTypes.forEach(t => allRedactedTypes.add(t));
      return result.text;
    }
    if (Array.isArray(value)) {
      return value.map(filterValue);
    }
    if (typeof value === "object" && value !== null) {
      const filtered: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        filtered[key] = filterValue(val);
      }
      return filtered;
    }
    return value;
  };

  const filteredData = data.map(filterValue);

  return {
    data: filteredData,
    redactedCount: totalRedactions,
    redactedTypes: Array.from(allRedactedTypes),
  };
}

export function filterPIIFromMessages(
  messages: Array<{ role: string; content: string }>,
  options?: PIIFilterOptions
): { messages: Array<{ role: string; content: string }>; redactedCount: number; redactedTypes: string[] } {
  if (!options?.enabled) {
    return { messages, redactedCount: 0, redactedTypes: [] };
  }

  let totalRedactions = 0;
  const allRedactedTypes: Set<string> = new Set();

  const filteredMessages = messages.map(msg => {
    const result = filterPII(msg.content, options);
    totalRedactions += result.redactedCount;
    result.redactedTypes.forEach(t => allRedactedTypes.add(t));
    return { ...msg, content: result.text };
  });

  return {
    messages: filteredMessages,
    redactedCount: totalRedactions,
    redactedTypes: Array.from(allRedactedTypes),
  };
}

export function getAvailablePIIPatterns(): string[] {
  return PII_PATTERNS.map(p => p.name);
}
