export type ValidationStatus = 'pending' | 'validating' | 'valid' | 'warning' | 'error';

export interface ValidationResult {
  status: ValidationStatus;
  message: string;
  solution?: string;
  canProceed: boolean;
}

export interface CaptureValidation {
  captureId: string;
  status: ValidationStatus;
  result?: ValidationResult;
  lastChecked?: Date;
}

const GOOGLE_SHEETS_PATTERNS = [
  /docs\.google\.com\/spreadsheets/,
  /sheets\.google\.com/,
];

const GOOGLE_DOCS_PATTERNS = [
  /docs\.google\.com\/document/,
];

export function isGoogleSheetsUrl(url: string): boolean {
  return GOOGLE_SHEETS_PATTERNS.some(pattern => pattern.test(url));
}

export function isGoogleDocsUrl(url: string): boolean {
  return GOOGLE_DOCS_PATTERNS.some(pattern => pattern.test(url));
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

const SUPPORTED_FILE_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function validateFileType(file: File): ValidationResult {
  if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
    return {
      status: 'error',
      message: 'Unsupported file type',
      solution: `Supported formats: CSV, Excel, PNG, JPEG, GIF, WebP, PDF`,
      canProceed: false,
    };
  }
  return {
    status: 'valid',
    message: 'File type supported',
    canProceed: true,
  };
}

export function validateFileSize(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return {
      status: 'error',
      message: 'File too large',
      solution: `Maximum file size is 50MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
      canProceed: false,
    };
  }
  return {
    status: 'valid',
    message: 'File size acceptable',
    canProceed: true,
  };
}

export function validateFile(file: File): ValidationResult {
  const typeResult = validateFileType(file);
  if (typeResult.status === 'error') return typeResult;
  
  const sizeResult = validateFileSize(file);
  if (sizeResult.status === 'error') return sizeResult;
  
  return {
    status: 'valid',
    message: 'File is ready for upload',
    canProceed: true,
  };
}

export function validateUrlFormat(url: string): ValidationResult {
  if (!url.trim()) {
    return {
      status: 'error',
      message: 'URL is empty',
      solution: 'Please enter a valid URL',
      canProceed: false,
    };
  }
  
  if (!isValidUrl(url)) {
    return {
      status: 'error',
      message: 'Invalid URL format',
      solution: 'Please enter a valid URL starting with http:// or https://',
      canProceed: false,
    };
  }
  
  return {
    status: 'valid',
    message: 'URL format is valid',
    canProceed: true,
  };
}

export async function validateGoogleSheet(url: string): Promise<ValidationResult> {
  if (!isGoogleSheetsUrl(url)) {
    return {
      status: 'valid',
      message: 'Not a Google Sheet - basic URL validation passed',
      canProceed: true,
    };
  }
  
  try {
    const response = await fetch('/api/validate-google-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    
    const data = await response.json();
    
    if (data.isPublic) {
      return {
        status: 'valid',
        message: 'Google Sheet is publicly accessible',
        canProceed: true,
      };
    } else {
      return {
        status: 'warning',
        message: 'Google Sheet may not be publicly accessible',
        solution: 'Open your Google Sheet, click "Share", then change access to "Anyone with the link can view"',
        canProceed: true,
      };
    }
  } catch (error) {
    return {
      status: 'warning',
      message: 'Could not verify Google Sheet accessibility',
      solution: 'Make sure the sheet is shared publicly: Open the sheet, click "Share", then set "Anyone with the link" to "Viewer"',
      canProceed: true,
    };
  }
}

export async function validateLink(url: string): Promise<ValidationResult> {
  const formatResult = validateUrlFormat(url);
  if (formatResult.status === 'error') return formatResult;
  
  if (isGoogleSheetsUrl(url)) {
    return validateGoogleSheet(url);
  }
  
  return {
    status: 'valid',
    message: 'Link is ready for capture',
    canProceed: true,
  };
}

export function detectBlurLevel(imageData: ImageData): number {
  const gray = new Uint8Array(imageData.width * imageData.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    gray[i / 4] = Math.round(
      0.299 * imageData.data[i] +
      0.587 * imageData.data[i + 1] +
      0.114 * imageData.data[i + 2]
    );
  }
  
  let laplacianSum = 0;
  const width = imageData.width;
  const height = imageData.height;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian = 
        -4 * gray[idx] +
        gray[idx - 1] +
        gray[idx + 1] +
        gray[idx - width] +
        gray[idx + width];
      laplacianSum += laplacian * laplacian;
    }
  }
  
  return laplacianSum / ((width - 2) * (height - 2));
}

const BLUR_THRESHOLD = 100;

export function validateScreenshotBlur(imageData: ImageData): ValidationResult {
  const blurScore = detectBlurLevel(imageData);
  
  if (blurScore < BLUR_THRESHOLD) {
    return {
      status: 'warning',
      message: 'Screenshot appears blurry',
      solution: 'Consider recapturing with a clearer view of the content',
      canProceed: true,
    };
  }
  
  return {
    status: 'valid',
    message: 'Screenshot quality is good',
    canProceed: true,
  };
}

export function getValidationIcon(status: ValidationStatus): {
  color: string;
  bgColor: string;
} {
  switch (status) {
    case 'valid':
      return { color: '#22C55E', bgColor: 'rgba(34, 197, 94, 0.1)' };
    case 'warning':
      return { color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)' };
    case 'error':
      return { color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)' };
    case 'validating':
      return { color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.1)' };
    default:
      return { color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.1)' };
  }
}

export function hasValidationErrors(validations: Map<string, CaptureValidation>): boolean {
  return Array.from(validations.values()).some(v => v.status === 'error');
}

export function hasValidationWarnings(validations: Map<string, CaptureValidation>): boolean {
  return Array.from(validations.values()).some(v => v.status === 'warning');
}

export function getValidationSummary(validations: Map<string, CaptureValidation>): {
  hasErrors: boolean;
  hasWarnings: boolean;
  errorCount: number;
  warningCount: number;
  message: string;
} {
  let errorCount = 0;
  let warningCount = 0;
  
  validations.forEach(v => {
    if (v.status === 'error') errorCount++;
    if (v.status === 'warning') warningCount++;
  });
  
  let message = '';
  if (errorCount > 0) {
    message = `${errorCount} item${errorCount > 1 ? 's' : ''} cannot be processed`;
  } else if (warningCount > 0) {
    message = `${warningCount} item${warningCount > 1 ? 's' : ''} may have issues`;
  }
  
  return {
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0,
    errorCount,
    warningCount,
    message,
  };
}
