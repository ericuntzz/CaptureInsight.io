/**
 * Data Validation Service
 * 
 * Pre-validates data BEFORE expensive AI processing to:
 * - Detect empty/blank screenshots
 * - Check image quality and text density
 * - Validate file formats and sizes
 * - Provide early feedback to users
 * 
 * This saves API costs and provides instant user feedback.
 */

export interface ValidationResult {
  isValid: boolean;
  failureType?: 'empty_image' | 'low_quality' | 'unsupported_format' | 'no_data_found' | 'file_too_small';
  message?: string;
  warnings?: string[];
  details?: {
    textDensity?: number;
    contrast?: number;
    fileSize?: number;
    dimensions?: { width: number; height: number };
    colorVariance?: number;
  };
}

export interface QualityScore {
  overall: number; // 0-100
  confidence: number; // 0-100
  completeness: number; // 0-100
  dataRichness: number; // 0-100
  issues: string[];
}

const MIN_IMAGE_SIZE_BYTES = 1000; // 1KB minimum for a valid screenshot
const MIN_TEXT_DENSITY = 0.05; // Minimum 5% of pixels should have variance (text/data)
const MIN_CONTRAST_SCORE = 10; // Minimum contrast variance for readable content

/**
 * Validate screenshot before AI processing
 * Uses lightweight image analysis to detect blank/empty images
 */
export async function validateScreenshot(imageInput: string): Promise<ValidationResult> {
  try {
    let base64Data: string;
    let mimeType = "image/png";
    
    // Handle different input formats
    if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
      // Fetch image from URL for validation
      const response = await fetch(imageInput);
      if (!response.ok) {
        return {
          isValid: false,
          failureType: 'empty_image',
          message: 'Could not access the image. Please try uploading again.',
        };
      }
      
      const contentType = response.headers.get('content-type') || 'image/png';
      mimeType = contentType;
      const arrayBuffer = await response.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString('base64');
    } else if (imageInput.startsWith("data:image")) {
      // Extract base64 from data URL
      const parts = imageInput.split(",");
      base64Data = parts[1] || "";
      const mimeMatch = parts[0]?.match(/data:(image\/[^;]+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    } else {
      // Assume it's already base64
      base64Data = imageInput;
    }

    if (!base64Data) {
      return {
        isValid: false,
        failureType: 'empty_image',
        message: 'No image data found. Please upload a valid screenshot.',
      };
    }

    // Check file size
    const fileSize = Buffer.from(base64Data, 'base64').length;
    if (fileSize < MIN_IMAGE_SIZE_BYTES) {
      return {
        isValid: false,
        failureType: 'file_too_small',
        message: 'The image file is too small to contain meaningful data. Please upload a clearer screenshot.',
        details: { fileSize },
      };
    }

    // Analyze image content for emptiness
    const analysisResult = analyzeImageContent(base64Data);
    
    if (analysisResult.isEmpty) {
      return {
        isValid: false,
        failureType: 'empty_image',
        message: 'This screenshot appears to be blank or contains very little content. Please upload a screenshot with visible data.',
        details: {
          textDensity: analysisResult.textDensity,
          contrast: analysisResult.contrast,
          fileSize,
          colorVariance: analysisResult.colorVariance,
        },
      };
    }

    if (analysisResult.isLowQuality) {
      return {
        isValid: true, // Allow but warn
        warnings: ['This image has low contrast or limited visible content. Results may be limited.'],
        details: {
          textDensity: analysisResult.textDensity,
          contrast: analysisResult.contrast,
          fileSize,
          colorVariance: analysisResult.colorVariance,
        },
      };
    }

    return {
      isValid: true,
      details: {
        textDensity: analysisResult.textDensity,
        contrast: analysisResult.contrast,
        fileSize,
        colorVariance: analysisResult.colorVariance,
      },
    };
  } catch (error) {
    console.error('[DataValidation] Screenshot validation error:', error);
    return {
      isValid: false,
      failureType: 'unsupported_format',
      message: 'Could not process this image. Please ensure it is a valid PNG, JPEG, or WebP file.',
    };
  }
}

/**
 * Analyze image content to detect empty/blank screenshots
 * Uses statistical analysis of pixel data
 */
function analyzeImageContent(base64Data: string): {
  isEmpty: boolean;
  isLowQuality: boolean;
  textDensity: number;
  contrast: number;
  colorVariance: number;
} {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Sample the image data to check for content
    // We analyze raw bytes since we can't use canvas in Node.js
    // This is a heuristic approach based on byte distribution
    
    const sampleSize = Math.min(buffer.length, 10000);
    const samples: number[] = [];
    
    // Sample bytes evenly across the image
    for (let i = 0; i < sampleSize; i++) {
      const idx = Math.floor((i / sampleSize) * buffer.length);
      samples.push(buffer[idx]);
    }
    
    // Calculate statistics
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / samples.length;
    const stdDev = Math.sqrt(variance);
    
    // Count unique byte values (indicates color variety)
    const uniqueValues = new Set(samples).size;
    const colorVariance = (uniqueValues / 256) * 100;
    
    // Estimate contrast based on standard deviation
    const contrast = Math.min(100, (stdDev / 128) * 100);
    
    // Check for runs of identical bytes (indicates solid colors/empty areas)
    let maxRun = 0;
    let currentRun = 1;
    for (let i = 1; i < samples.length; i++) {
      if (Math.abs(samples[i] - samples[i - 1]) < 5) {
        currentRun++;
        maxRun = Math.max(maxRun, currentRun);
      } else {
        currentRun = 1;
      }
    }
    const runRatio = maxRun / samples.length;
    
    // Text density estimation based on variance patterns
    // Higher variance in small regions indicates text/data
    const textDensity = Math.min(100, contrast * (1 - runRatio) * 2);
    
    // Determine if image is empty
    // An empty image has very low variance, low color variety, or long runs of same value
    const isEmpty = 
      colorVariance < 5 || // Almost all same color
      stdDev < 10 || // Very little variation
      runRatio > 0.8; // Mostly solid color runs
    
    const isLowQuality = 
      !isEmpty && (
        colorVariance < 15 ||
        stdDev < 25 ||
        textDensity < 15
      );
    
    return {
      isEmpty,
      isLowQuality,
      textDensity: Math.round(textDensity),
      contrast: Math.round(contrast),
      colorVariance: Math.round(colorVariance),
    };
  } catch (error) {
    console.error('[DataValidation] Image analysis error:', error);
    // If analysis fails, assume it's valid and let AI handle it
    return {
      isEmpty: false,
      isLowQuality: false,
      textDensity: 50,
      contrast: 50,
      colorVariance: 50,
    };
  }
}

/**
 * Validate tabular data (Google Sheets, CSV)
 */
export function validateTabularData(data: any): ValidationResult {
  if (!data) {
    return {
      isValid: false,
      failureType: 'no_data_found',
      message: 'No data found in the source. Please check the link and ensure the data is accessible.',
    };
  }

  const rows = Array.isArray(data) ? data : [data];
  
  if (rows.length === 0) {
    return {
      isValid: false,
      failureType: 'no_data_found',
      message: 'The data source appears to be empty. Please add data and try again.',
    };
  }

  // Check for meaningful content
  const hasContent = rows.some(row => {
    if (typeof row === 'object' && row !== null) {
      return Object.values(row).some(val => 
        val !== null && val !== undefined && String(val).trim() !== ''
      );
    }
    return row !== null && row !== undefined && String(row).trim() !== '';
  });

  if (!hasContent) {
    return {
      isValid: false,
      failureType: 'no_data_found',
      message: 'The data source contains only empty values. Please add meaningful data.',
    };
  }

  // Check for very sparse data
  const avgFieldsPerRow = rows.reduce((acc, row) => {
    if (typeof row === 'object' && row !== null) {
      const filledFields = Object.values(row).filter(v => 
        v !== null && v !== undefined && String(v).trim() !== ''
      ).length;
      return acc + filledFields;
    }
    return acc + (row ? 1 : 0);
  }, 0) / rows.length;

  const warnings: string[] = [];
  if (avgFieldsPerRow < 2) {
    warnings.push('Data appears sparse with few filled fields per row.');
  }

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    details: {
      fileSize: JSON.stringify(data).length,
    },
  };
}

/**
 * Validate document/file content
 */
export function validateDocumentData(content: string, contentType?: string): ValidationResult {
  if (!content || content.trim().length === 0) {
    return {
      isValid: false,
      failureType: 'no_data_found',
      message: 'The document appears to be empty. Please upload a file with content.',
    };
  }

  const trimmedContent = content.trim();
  const fileSize = trimmedContent.length;

  if (fileSize < 50) {
    return {
      isValid: false,
      failureType: 'no_data_found',
      message: 'The document contains very little content. Please upload a more substantial file.',
      details: { fileSize },
    };
  }

  // Check for binary/garbage content
  const printableRatio = (trimmedContent.match(/[\x20-\x7E\n\r\t]/g)?.length || 0) / trimmedContent.length;
  if (printableRatio < 0.7) {
    return {
      isValid: false,
      failureType: 'unsupported_format',
      message: 'This file format is not supported or the content could not be read. Please try a different format.',
      details: { fileSize },
    };
  }

  return {
    isValid: true,
    details: { fileSize },
  };
}

/**
 * Calculate quality score from cleaned data result
 */
export function calculateQualityScore(
  cleanedData: {
    type: string;
    data: any[];
    title?: string;
    description?: string;
    metadata?: any;
  },
  validationDetails?: ValidationResult['details']
): QualityScore {
  const issues: string[] = [];
  
  // Calculate confidence based on data structure
  let confidence = 70; // Base confidence
  
  if (cleanedData.title && cleanedData.title.length > 5) {
    confidence += 10;
  }
  if (cleanedData.description && cleanedData.description.length > 20) {
    confidence += 10;
  }
  if (cleanedData.type && ['tabular', 'document', 'metrics', 'mixed'].includes(cleanedData.type)) {
    confidence += 5;
  }
  
  // Validation details boost
  if (validationDetails?.textDensity && validationDetails.textDensity > 50) {
    confidence += 5;
  }
  
  confidence = Math.min(100, confidence);
  
  // Calculate completeness based on null/undefined values
  let completeness = 100;
  const data = cleanedData.data;
  
  if (Array.isArray(data) && data.length > 0) {
    let totalFields = 0;
    let nullFields = 0;
    
    data.forEach(row => {
      if (typeof row === 'object' && row !== null) {
        const entries = Object.entries(row);
        totalFields += entries.length;
        nullFields += entries.filter(([_, v]) => v === null || v === undefined || v === '').length;
      }
    });
    
    if (totalFields > 0) {
      completeness = Math.round(((totalFields - nullFields) / totalFields) * 100);
    }
    
    if (completeness < 50) {
      issues.push('Many fields have missing values');
    }
  }
  
  // Calculate data richness based on amount and variety
  let dataRichness = 50; // Base richness
  
  if (Array.isArray(data)) {
    // Row count factor
    if (data.length >= 100) dataRichness += 25;
    else if (data.length >= 20) dataRichness += 15;
    else if (data.length >= 5) dataRichness += 10;
    else if (data.length === 1) issues.push('Only single row of data found');
    
    // Column/field variety factor
    if (data.length > 0 && typeof data[0] === 'object') {
      const fieldCount = Object.keys(data[0]).length;
      if (fieldCount >= 10) dataRichness += 15;
      else if (fieldCount >= 5) dataRichness += 10;
      else if (fieldCount >= 3) dataRichness += 5;
      else issues.push('Limited number of data fields');
    }
    
    // Data type variety
    const types = new Set<string>();
    data.slice(0, 10).forEach(row => {
      if (typeof row === 'object' && row !== null) {
        Object.values(row).forEach(val => types.add(typeof val));
      }
    });
    if (types.size >= 3) dataRichness += 10;
  }
  
  dataRichness = Math.min(100, dataRichness);
  
  // Calculate overall score (weighted average)
  const overall = Math.round(
    confidence * 0.4 +
    completeness * 0.3 +
    dataRichness * 0.3
  );
  
  return {
    overall,
    confidence,
    completeness,
    dataRichness,
    issues,
  };
}

/**
 * Create user-friendly error message for validation failures
 */
export function getValidationErrorMessage(
  result: ValidationResult,
  sourceName?: string,
  index?: number
): string {
  const sourceIdentifier = index !== undefined 
    ? `Screenshot #${index + 1}${sourceName ? ` (${sourceName})` : ''}`
    : sourceName || 'This upload';
  
  switch (result.failureType) {
    case 'empty_image':
      return `${sourceIdentifier} appears to be blank or empty. Please upload a screenshot with visible data.`;
    case 'low_quality':
      return `${sourceIdentifier} has very low quality or contrast. Please upload a clearer image.`;
    case 'unsupported_format':
      return `${sourceIdentifier} is in an unsupported format. Please use PNG, JPEG, or WebP images.`;
    case 'no_data_found':
      return `${sourceIdentifier} contains no extractable data. Please ensure the source has content.`;
    case 'file_too_small':
      return `${sourceIdentifier} is too small to contain meaningful data. Please upload a larger image.`;
    default:
      return result.message || `${sourceIdentifier} could not be validated. Please try again.`;
  }
}
