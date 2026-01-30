/**
 * =============================================================================
 * LLM CALL VALIDATOR
 * =============================================================================
 * 
 * Ensures proper separation of system prompts from message history.
 * Prevents system instructions from being embedded in message contents.
 * 
 * ISSUE FIXED: System prompts were sometimes included in message history
 * SOLUTION: Validate all LLM calls to ensure clean separation
 * =============================================================================
 */

// Configuration constants
const MIN_SYSTEM_INSTRUCTION_LENGTH = 50; // Minimum length to flag as potential system instruction
const MIN_TEXT_LENGTH_FOR_PATTERN_CHECK = 20; // Minimum text length to check for patterns

/**
 * Validate that a message history array contains only user/model messages
 * and does NOT contain embedded system instructions
 */
export function validateMessageHistory(
  contents: Array<{ role: string; parts: Array<{ text?: string; [key: string]: any }> }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(contents)) {
    errors.push("Contents must be an array");
    return { valid: false, errors };
  }

  for (let i = 0; i < contents.length; i++) {
    const message = contents[i];

    // Check role is valid
    if (!message.role) {
      errors.push(`Message ${i}: Missing 'role' field`);
      continue;
    }

    if (message.role !== "user" && message.role !== "model") {
      errors.push(
        `Message ${i}: Invalid role '${message.role}'. Only 'user' and 'model' are allowed in message history.`
      );
    }

    // Check for embedded system instructions (common patterns)
    if (Array.isArray(message.parts)) {
      for (let j = 0; j < message.parts.length; j++) {
        const part = message.parts[j];
        if (part.text && typeof part.text === "string") {
          const text = part.text.toLowerCase();

          // Common system instruction patterns
          const systemPatterns = [
            "you are a ",
            "you are an ",
            "act as a ",
            "act as an ",
            "system:",
            "system instruction",
            "your role is to",
            "your task is to",
            "behave as a",
            "respond as a",
            "simulate being",
          ];

          // Check if text starts with common system instruction patterns
          const startsWithSystemPattern = systemPatterns.some((pattern) =>
            text.trim().startsWith(pattern)
          );

          if (startsWithSystemPattern && text.length > MIN_SYSTEM_INSTRUCTION_LENGTH) {
            // Only flag if it's substantial (>50 chars) to avoid false positives
            errors.push(
              `Message ${i}, part ${j}: Potential system instruction detected in message content. ` +
                `System instructions should use the 'systemInstruction' parameter, not be embedded in message history. ` +
                `Text starts with: "${text.substring(0, 60)}..."`
            );
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an LLM call configuration to ensure proper structure
 */
export function validateLLMCall(config: {
  model: string;
  contents: any;
  config?: {
    systemInstruction?: string;
    [key: string]: any;
  };
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate model
  if (!config.model || typeof config.model !== "string") {
    errors.push("Model must be a non-empty string");
  }

  // Validate contents is an array or string
  if (!config.contents) {
    errors.push("Contents is required");
  } else if (
    !Array.isArray(config.contents) &&
    typeof config.contents !== "string"
  ) {
    errors.push("Contents must be an array or string");
  }

  // If contents is an array, validate message history
  if (Array.isArray(config.contents)) {
    const historyValidation = validateMessageHistory(config.contents);
    if (!historyValidation.valid) {
      errors.push(...historyValidation.errors);
    }
  }

  // Check if systemInstruction is in the right place
  if (config.config?.systemInstruction) {
    // Good - system instruction is properly separated
    if (typeof config.config.systemInstruction !== "string") {
      errors.push("systemInstruction must be a string");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Wrapper for generateContent that validates inputs before calling
 */
export async function safeGenerateContent(
  models: any,
  config: {
    model: string;
    contents: any;
    config?: any;
  }
): Promise<any> {
  // Validate the call
  const validation = validateLLMCall(config);

  if (!validation.valid) {
    console.error("[LLM Call Validation] Errors detected:");
    validation.errors.forEach((error) => console.error(`  - ${error}`));

    // In development, throw an error to catch issues early
    if (process.env.NODE_ENV === "development") {
      throw new Error(
        `LLM call validation failed:\n${validation.errors.join("\n")}`
      );
    } else {
      // In production, log warnings but allow the call
      console.warn("[LLM Call Validation] Proceeding despite warnings");
    }
  }

  // Make the actual call
  return models.generateContent(config);
}

/**
 * Wrapper for generateContentStream that validates inputs before calling
 */
export async function safeGenerateContentStream(
  models: any,
  config: {
    model: string;
    contents: any;
    config?: any;
  }
): Promise<any> {
  // Validate the call
  const validation = validateLLMCall(config);

  if (!validation.valid) {
    console.error("[LLM Call Validation] Errors detected:");
    validation.errors.forEach((error) => console.error(`  - ${error}`));

    // In development, throw an error to catch issues early
    if (process.env.NODE_ENV === "development") {
      throw new Error(
        `LLM call validation failed:\n${validation.errors.join("\n")}`
      );
    } else {
      // In production, log warnings but allow the call
      console.warn("[LLM Call Validation] Proceeding despite warnings");
    }
  }

  // Make the actual call
  return models.generateContentStream(config);
}

/**
 * Helper to detect if a string likely contains system instructions
 */
export function looksLikeSystemInstruction(text: string): boolean {
  if (!text || typeof text !== "string" || text.length < MIN_TEXT_LENGTH_FOR_PATTERN_CHECK) {
    return false;
  }

  const lowercaseText = text.toLowerCase().trim();

  const systemPatterns = [
    "you are a ",
    "you are an ",
    "act as a ",
    "act as an ",
    "system:",
    "system instruction",
    "your role is to",
    "your task is to",
    "behave as a",
    "respond as a",
    "simulate being",
  ];

  return systemPatterns.some((pattern) => lowercaseText.startsWith(pattern));
}
