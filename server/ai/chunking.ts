export interface ChunkOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  preserveSentences?: boolean;
}

export interface ChunkMetadata {
  totalChunks: number;
  isJsonData?: boolean;
  isTabularData?: boolean;
  hasHeader?: boolean;
  headerContent?: string;
}

export interface Chunk {
  content: string;
  index: number;
  start: number;
  end: number;
  metadata: ChunkMetadata;
}

const DEFAULT_MAX_CHUNK_SIZE = 1500;
const DEFAULT_OVERLAP_SIZE = 150;
const DEFAULT_PRESERVE_SENTENCES = true;

const SENTENCE_ENDINGS = /[.!?][\s\n]/g;
const PARAGRAPH_BREAK = /\n\n+/g;
const WORD_BOUNDARY = /\s+/g;

function isJsonData(text: string): boolean {
  const trimmed = text.trim();
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function isTabularData(text: string): boolean {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) return false;
  
  const firstLine = lines[0];
  const hasColumnSeparators = firstLine.includes('\t') || 
                               firstLine.includes('|') || 
                               (firstLine.match(/,/g)?.length || 0) >= 2;
  
  if (!hasColumnSeparators) return false;
  
  const separator = firstLine.includes('\t') ? '\t' : 
                    firstLine.includes('|') ? '|' : ',';
  const headerCols = firstLine.split(separator).length;
  
  const consistentColumns = lines.slice(1, 4).every(line => {
    const cols = line.split(separator).length;
    return cols === headerCols || Math.abs(cols - headerCols) <= 1;
  });
  
  return consistentColumns;
}

function extractTableHeader(text: string): string | null {
  const lines = text.split('\n');
  if (lines.length < 1) return null;
  
  const headerLine = lines[0];
  
  if (lines.length > 1 && /^[-=|+\s]+$/.test(lines[1].trim())) {
    return headerLine + '\n' + lines[1];
  }
  
  return headerLine;
}

function findSentenceBoundary(text: string, maxPos: number): number {
  let lastBoundary = -1;
  SENTENCE_ENDINGS.lastIndex = 0;
  
  let match;
  while ((match = SENTENCE_ENDINGS.exec(text)) !== null) {
    if (match.index + 1 <= maxPos) {
      lastBoundary = match.index + 1;
    } else {
      break;
    }
  }
  
  return lastBoundary;
}

function findParagraphBoundary(text: string, maxPos: number): number {
  let lastBoundary = -1;
  PARAGRAPH_BREAK.lastIndex = 0;
  
  let match;
  while ((match = PARAGRAPH_BREAK.exec(text)) !== null) {
    if (match.index <= maxPos) {
      lastBoundary = match.index;
    } else {
      break;
    }
  }
  
  return lastBoundary;
}

function findWordBoundary(text: string, maxPos: number): number {
  let lastBoundary = -1;
  WORD_BOUNDARY.lastIndex = 0;
  
  let match;
  while ((match = WORD_BOUNDARY.exec(text)) !== null) {
    if (match.index <= maxPos) {
      lastBoundary = match.index;
    } else {
      break;
    }
  }
  
  return lastBoundary;
}

function findBestSplitPoint(text: string, maxSize: number, preserveSentences: boolean): number {
  if (text.length <= maxSize) {
    return text.length;
  }
  
  if (preserveSentences) {
    const sentenceBoundary = findSentenceBoundary(text, maxSize);
    if (sentenceBoundary > maxSize * 0.5) {
      return sentenceBoundary;
    }
  }
  
  const paragraphBoundary = findParagraphBoundary(text, maxSize);
  if (paragraphBoundary > maxSize * 0.3) {
    return paragraphBoundary;
  }
  
  const wordBoundary = findWordBoundary(text, maxSize);
  if (wordBoundary > 0) {
    return wordBoundary;
  }
  
  return maxSize;
}

function chunkJsonData(text: string, options: Required<ChunkOptions>): Chunk[] {
  const { maxChunkSize, overlapSize } = options;
  const chunks: Chunk[] = [];
  
  try {
    const parsed = JSON.parse(text.trim());
    
    if (Array.isArray(parsed)) {
      let currentChunkItems: any[] = [];
      let currentSize = 2;
      let startIndex = 0;
      
      for (let i = 0; i < parsed.length; i++) {
        const itemStr = JSON.stringify(parsed[i]);
        const itemSize = itemStr.length + (currentChunkItems.length > 0 ? 1 : 0);
        
        if (currentSize + itemSize > maxChunkSize && currentChunkItems.length > 0) {
          const chunkContent = JSON.stringify(currentChunkItems);
          chunks.push({
            content: chunkContent,
            index: chunks.length,
            start: startIndex,
            end: i,
            metadata: {
              totalChunks: 0,
              isJsonData: true,
            },
          });
          
          const overlapItems = Math.max(1, Math.floor(currentChunkItems.length * (overlapSize / maxChunkSize)));
          currentChunkItems = currentChunkItems.slice(-overlapItems);
          currentSize = JSON.stringify(currentChunkItems).length;
          startIndex = i - overlapItems + 1;
        }
        
        currentChunkItems.push(parsed[i]);
        currentSize = JSON.stringify(currentChunkItems).length;
      }
      
      if (currentChunkItems.length > 0) {
        chunks.push({
          content: JSON.stringify(currentChunkItems),
          index: chunks.length,
          start: startIndex,
          end: parsed.length,
          metadata: {
            totalChunks: 0,
            isJsonData: true,
          },
        });
      }
      
      chunks.forEach(chunk => {
        chunk.metadata.totalChunks = chunks.length;
      });
      
      return chunks;
    }
  } catch {
  }
  
  return chunkPlainText(text, options);
}

function chunkTabularData(text: string, options: Required<ChunkOptions>): Chunk[] {
  const { maxChunkSize, overlapSize } = options;
  const chunks: Chunk[] = [];
  
  const header = extractTableHeader(text);
  const headerSize = header ? header.length + 1 : 0;
  const effectiveMaxSize = maxChunkSize - headerSize;
  
  const lines = text.split('\n');
  const headerLines = header?.includes('\n') ? 2 : 1;
  const dataLines = lines.slice(headerLines);
  
  let currentChunkLines: string[] = [];
  let currentSize = 0;
  let startLineIndex = headerLines;
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const lineSize = line.length + 1;
    
    if (currentSize + lineSize > effectiveMaxSize && currentChunkLines.length > 0) {
      const chunkContent = header 
        ? header + '\n' + currentChunkLines.join('\n')
        : currentChunkLines.join('\n');
      
      chunks.push({
        content: chunkContent,
        index: chunks.length,
        start: startLineIndex,
        end: headerLines + i,
        metadata: {
          totalChunks: 0,
          isTabularData: true,
          hasHeader: !!header,
          headerContent: header || undefined,
        },
      });
      
      const overlapLines = Math.max(1, Math.floor(currentChunkLines.length * (overlapSize / maxChunkSize)));
      currentChunkLines = currentChunkLines.slice(-overlapLines);
      currentSize = currentChunkLines.reduce((sum, l) => sum + l.length + 1, 0);
      startLineIndex = headerLines + i - overlapLines + 1;
    }
    
    currentChunkLines.push(line);
    currentSize += lineSize;
  }
  
  if (currentChunkLines.length > 0) {
    const chunkContent = header 
      ? header + '\n' + currentChunkLines.join('\n')
      : currentChunkLines.join('\n');
    
    chunks.push({
      content: chunkContent,
      index: chunks.length,
      start: startLineIndex,
      end: lines.length,
      metadata: {
        totalChunks: 0,
        isTabularData: true,
        hasHeader: !!header,
        headerContent: header || undefined,
      },
    });
  }
  
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = chunks.length;
  });
  
  return chunks;
}

function chunkPlainText(text: string, options: Required<ChunkOptions>): Chunk[] {
  const { maxChunkSize, overlapSize, preserveSentences } = options;
  const chunks: Chunk[] = [];
  
  let position = 0;
  
  while (position < text.length) {
    const remaining = text.slice(position);
    const splitPoint = findBestSplitPoint(remaining, maxChunkSize, preserveSentences);
    
    const chunkContent = remaining.slice(0, splitPoint).trim();
    
    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        index: chunks.length,
        start: position,
        end: position + splitPoint,
        metadata: {
          totalChunks: 0,
        },
      });
    }
    
    let nextPosition = position + splitPoint;
    
    if (overlapSize > 0 && nextPosition < text.length) {
      const overlapStart = Math.max(position, nextPosition - overlapSize);
      const overlapText = text.slice(overlapStart, nextPosition);
      
      const overlapSentenceBoundary = findSentenceBoundary(overlapText, overlapText.length);
      if (overlapSentenceBoundary > 0 && preserveSentences) {
        nextPosition = overlapStart + overlapSentenceBoundary;
      } else {
        const overlapWordBoundary = findWordBoundary(overlapText, overlapText.length);
        if (overlapWordBoundary > 0) {
          nextPosition = overlapStart + overlapWordBoundary;
        } else {
          nextPosition = overlapStart;
        }
      }
    }
    
    if (nextPosition <= position) {
      nextPosition = position + splitPoint;
    }
    
    position = nextPosition;
    
    while (position < text.length && /\s/.test(text[position])) {
      position++;
    }
  }
  
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = chunks.length;
  });
  
  return chunks;
}

export function chunkText(text: string, options?: ChunkOptions): Chunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  const resolvedOptions: Required<ChunkOptions> = {
    maxChunkSize: options?.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE,
    overlapSize: options?.overlapSize ?? DEFAULT_OVERLAP_SIZE,
    preserveSentences: options?.preserveSentences ?? DEFAULT_PRESERVE_SENTENCES,
  };
  
  if (resolvedOptions.maxChunkSize <= 0) {
    throw new Error("maxChunkSize must be positive");
  }
  
  if (resolvedOptions.overlapSize < 0) {
    throw new Error("overlapSize cannot be negative");
  }
  
  if (resolvedOptions.overlapSize >= resolvedOptions.maxChunkSize) {
    throw new Error("overlapSize must be less than maxChunkSize");
  }
  
  if (text.length <= resolvedOptions.maxChunkSize) {
    return [{
      content: text.trim(),
      index: 0,
      start: 0,
      end: text.length,
      metadata: {
        totalChunks: 1,
      },
    }];
  }
  
  if (isJsonData(text)) {
    return chunkJsonData(text, resolvedOptions);
  }
  
  if (isTabularData(text)) {
    return chunkTabularData(text, resolvedOptions);
  }
  
  return chunkPlainText(text, resolvedOptions);
}

export function estimateChunkCount(textLength: number, options?: ChunkOptions): number {
  const maxChunkSize = options?.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
  const overlapSize = options?.overlapSize ?? DEFAULT_OVERLAP_SIZE;
  
  if (textLength <= maxChunkSize) return 1;
  
  const effectiveChunkSize = maxChunkSize - overlapSize;
  return Math.ceil(textLength / effectiveChunkSize);
}

export function getChunkingDefaults(): Required<ChunkOptions> {
  return {
    maxChunkSize: DEFAULT_MAX_CHUNK_SIZE,
    overlapSize: DEFAULT_OVERLAP_SIZE,
    preserveSentences: DEFAULT_PRESERVE_SENTENCES,
  };
}
