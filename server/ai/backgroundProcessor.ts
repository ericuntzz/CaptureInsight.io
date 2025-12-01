/**
 * Background Processor
 * 
 * Automatically processes any sheets that are stuck in "pending" status.
 * Runs on a periodic interval to ensure all data sources get processed
 * without requiring user interaction.
 */

import { db } from "../db";
import { sheets } from "../../shared/schema";
import { eq, or, isNull, and, lt } from "drizzle-orm";
import { triggerDataCleaning } from "./dataCleaning";

const PROCESSING_INTERVAL_MS = 30000; // Check every 30 seconds
const MAX_CONCURRENT_JOBS = 3; // Limit concurrent processing to avoid overload
const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // Consider "processing" status stuck after 5 minutes

let isRunning = false;
let processingCount = 0;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Find sheets that need processing:
 * - Status is "pending" (never started)
 * - Status is "processing" but stuck (started more than 5 minutes ago)
 */
async function findPendingSheets(): Promise<Array<{ id: string; name: string; cleaningStatus: string | null }>> {
  try {
    const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MS);
    
    // Use Drizzle's column references properly
    const pendingSheets = await db
      .select({
        id: sheets.id,
        name: sheets.name,
        cleaningStatus: sheets.cleaningStatus,
        lastModified: sheets.lastModified,
      })
      .from(sheets)
      .where(
        or(
          eq(sheets.cleaningStatus, "pending"),
          isNull(sheets.cleaningStatus),
          // Also catch sheets stuck in "processing" for too long
          and(
            eq(sheets.cleaningStatus, "processing"),
            lt(sheets.lastModified, stuckThreshold)
          )
        )
      )
      .limit(MAX_CONCURRENT_JOBS);

    console.log(`[BackgroundProcessor] Found ${pendingSheets.length} sheets needing processing`);
    return pendingSheets;
  } catch (error) {
    console.error("[BackgroundProcessor] Error finding pending sheets:", error);
    return [];
  }
}

/**
 * Process a single sheet
 */
async function processSheet(sheetId: string, sheetName: string): Promise<void> {
  processingCount++;
  console.log(`[BackgroundProcessor] Starting processing for sheet: ${sheetName} (${sheetId})`);
  
  try {
    await triggerDataCleaning(sheetId);
    console.log(`[BackgroundProcessor] Successfully triggered processing for sheet: ${sheetName}`);
  } catch (error) {
    console.error(`[BackgroundProcessor] Failed to process sheet ${sheetName}:`, error);
  } finally {
    processingCount--;
  }
}

/**
 * Main processing loop - finds and processes pending sheets
 */
async function processingLoop(): Promise<void> {
  if (!isRunning) return;
  
  try {
    // Only process if we have capacity
    const availableSlots = MAX_CONCURRENT_JOBS - processingCount;
    if (availableSlots <= 0) {
      console.log("[BackgroundProcessor] All processing slots busy, waiting...");
      return;
    }
    
    const pendingSheets = await findPendingSheets();
    
    if (pendingSheets.length > 0) {
      console.log(`[BackgroundProcessor] Found ${pendingSheets.length} sheets to process`);
      
      // Process sheets (up to available slots)
      const sheetsToProcess = pendingSheets.slice(0, availableSlots);
      
      for (const sheet of sheetsToProcess) {
        // Don't await - process in parallel
        processSheet(sheet.id, sheet.name).catch(err => {
          console.error(`[BackgroundProcessor] Unhandled error processing ${sheet.name}:`, err);
        });
      }
    }
  } catch (error) {
    console.error("[BackgroundProcessor] Error in processing loop:", error);
  }
}

/**
 * Start the background processor
 */
export function startBackgroundProcessor(): void {
  if (isRunning) {
    console.log("[BackgroundProcessor] Already running");
    return;
  }
  
  isRunning = true;
  console.log("[BackgroundProcessor] Starting background processor");
  console.log(`[BackgroundProcessor] Checking for pending sheets every ${PROCESSING_INTERVAL_MS / 1000}s`);
  
  // Run immediately on start
  processingLoop();
  
  // Then run on interval and track the interval ID
  intervalId = setInterval(() => {
    processingLoop();
  }, PROCESSING_INTERVAL_MS);
}

/**
 * Stop the background processor
 */
export function stopBackgroundProcessor(): void {
  isRunning = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  console.log("[BackgroundProcessor] Stopped background processor");
}

/**
 * Get current processor status
 */
export function getProcessorStatus(): { isRunning: boolean; processingCount: number } {
  return { isRunning, processingCount };
}
