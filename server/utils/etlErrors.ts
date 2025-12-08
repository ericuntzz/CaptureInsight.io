export enum ETLErrorCode {
  PARSE_ERROR = 'PARSE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SIZE_LIMIT_EXCEEDED = 'SIZE_LIMIT_EXCEEDED',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AI_ERROR = 'AI_ERROR',
  EMBEDDING_ERROR = 'EMBEDDING_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  TEMPLATE_ERROR = 'TEMPLATE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export enum ETLStage {
  PARSING = 'PARSING',
  VALIDATING = 'VALIDATING',
  TEMPLATE_MATCHING = 'TEMPLATE_MATCHING',
  CLEANING = 'CLEANING',
  QUALITY_SCORING = 'QUALITY_SCORING',
  EMBEDDING = 'EMBEDDING',
  FINALIZING = 'FINALIZING',
}

export class ETLError extends Error {
  constructor(
    message: string,
    public readonly code: ETLErrorCode,
    public readonly stage: ETLStage,
    public readonly retryable: boolean = false,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ETLError';
    Object.setPrototypeOf(this, ETLError.prototype);
  }
}

export function isRetryable(error: ETLError): boolean {
  return error.code === ETLErrorCode.RATE_LIMIT_ERROR || error.code === ETLErrorCode.TIMEOUT_ERROR;
}

export function getRetryDelay(error: ETLError, retryCount: number): number {
  return Math.min(1000 * Math.pow(2, retryCount), 60000);
}

export function toUserMessage(error: ETLError): string {
  switch (error.code) {
    case ETLErrorCode.PARSE_ERROR:
      return 'Unable to read the file. Please check that the file format is supported and the file is not corrupted.';
    case ETLErrorCode.VALIDATION_ERROR:
      return 'The data failed validation checks. Please review the data format and ensure it meets the requirements.';
    case ETLErrorCode.SIZE_LIMIT_EXCEEDED:
      return 'The file or data exceeds the allowed size limits. Please try with a smaller file or dataset.';
    case ETLErrorCode.RATE_LIMIT_ERROR:
      return 'The service is temporarily busy. Please wait a moment and try again.';
    case ETLErrorCode.AI_ERROR:
      return 'An error occurred while processing your data with AI. Please try again.';
    case ETLErrorCode.EMBEDDING_ERROR:
      return 'Failed to generate data embeddings. Please try again or contact support if the issue persists.';
    case ETLErrorCode.STORAGE_ERROR:
      return 'A database error occurred while saving your data. Please try again.';
    case ETLErrorCode.TEMPLATE_ERROR:
      return 'Failed to match or apply a data template. Please check the data format or select a different template.';
    case ETLErrorCode.TIMEOUT_ERROR:
      return 'The operation took too long and was cancelled. Please try again with a smaller dataset.';
    case ETLErrorCode.UNKNOWN_ERROR:
    default:
      return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
  }
}

export function fromUnknownError(error: unknown, stage: ETLStage): ETLError {
  if (error instanceof ETLError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const details: Record<string, any> = {};

  if (error instanceof Error) {
    details.originalName = error.name;
    details.stack = error.stack;
  }

  if (message.includes('429') || 
      message.toLowerCase().includes('rate limit') || 
      message.toLowerCase().includes('quota') ||
      message.includes('RATELIMIT_EXCEEDED')) {
    return new ETLError(
      message,
      ETLErrorCode.RATE_LIMIT_ERROR,
      stage,
      true,
      details
    );
  }

  if (message.toLowerCase().includes('timeout') || 
      message.toLowerCase().includes('timed out') ||
      message.includes('ETIMEDOUT')) {
    return new ETLError(
      message,
      ETLErrorCode.TIMEOUT_ERROR,
      stage,
      true,
      details
    );
  }

  return new ETLError(
    message,
    ETLErrorCode.UNKNOWN_ERROR,
    stage,
    false,
    details
  );
}

export function createParseError(message: string, details?: Record<string, any>): ETLError {
  return new ETLError(
    message,
    ETLErrorCode.PARSE_ERROR,
    ETLStage.PARSING,
    false,
    details
  );
}

export function createSizeLimitError(message: string, details?: Record<string, any>): ETLError {
  return new ETLError(
    message,
    ETLErrorCode.SIZE_LIMIT_EXCEEDED,
    ETLStage.VALIDATING,
    false,
    details
  );
}

export function createRateLimitError(message: string): ETLError {
  return new ETLError(
    message,
    ETLErrorCode.RATE_LIMIT_ERROR,
    ETLStage.CLEANING,
    true
  );
}

export function createAIError(message: string, details?: Record<string, any>): ETLError {
  return new ETLError(
    message,
    ETLErrorCode.AI_ERROR,
    ETLStage.CLEANING,
    false,
    details
  );
}

export function createEmbeddingError(message: string, details?: Record<string, any>): ETLError {
  return new ETLError(
    message,
    ETLErrorCode.EMBEDDING_ERROR,
    ETLStage.EMBEDDING,
    false,
    details
  );
}
