/**
 * Background Processor
 * 
 * Processes ingestion jobs from the queue with automatic retry support.
 * Uses the ETL worker for actual job processing and manages job lifecycle.
 */

import { storage } from "../storage";
import { processIngestionJob, type ETLResult } from "./etlWorker";
import { getRetryDelay, isRetryable, type ETLError } from "../utils/etlErrors";
import type { IngestionJob } from "../../shared/schema";

const PROCESSING_INTERVAL_MS = 30000;
const MAX_CONCURRENT_JOBS = 3;
const SHUTDOWN_TIMEOUT_MS = 30000;

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
const activeJobs = new Map<string, Promise<ETLResult>>();
let shutdownPromise: Promise<void> | null = null;

interface ProcessorMetrics {
  jobsProcessed: number;
  jobsSucceeded: number;
  jobsFailed: number;
  totalDurationMs: number;
  lastRunAt: Date | null;
}

const metrics: ProcessorMetrics = {
  jobsProcessed: 0,
  jobsSucceeded: 0,
  jobsFailed: 0,
  totalDurationMs: 0,
  lastRunAt: null,
};

const log = (level: 'info' | 'warn' | 'error', message: string, data?: Record<string, any>) => {
  const timestamp = new Date().toISOString();
  const prefix = `[ETL ${timestamp}]`;
  if (level === 'error') console.error(prefix, message, data || '');
  else if (level === 'warn') console.warn(prefix, message, data || '');
  else console.log(prefix, message, data || '');
};

async function processJob(job: IngestionJob): Promise<void> {
  const startTime = Date.now();
  
  log('info', 'Job started', {
    jobId: job.id,
    sheetId: job.sheetId,
    retryCount: job.retryCount ?? 0,
    currentStage: job.currentStage,
  });

  const jobPromise = processIngestionJob(job.id);
  activeJobs.set(job.id, jobPromise);

  try {
    const result = await jobPromise;
    const durationMs = Date.now() - startTime;
    
    metrics.jobsProcessed++;
    metrics.totalDurationMs += durationMs;

    if (result.success) {
      metrics.jobsSucceeded++;
      log('info', 'Job completed', {
        jobId: job.id,
        sheetId: job.sheetId,
        stagesCompleted: result.stagesCompleted,
        durationMs,
        metadata: result.metadata,
      });
    } else {
      metrics.jobsFailed++;
      
      const error = result.error;
      log('error', 'Job failed', {
        jobId: job.id,
        sheetId: job.sheetId,
        errorCode: error?.code,
        errorMessage: error?.message,
        retryCount: job.retryCount ?? 0,
        stagesCompleted: result.stagesCompleted,
        durationMs,
      });

      if (error && isRetryable(error)) {
        const retryCount = (job.retryCount ?? 0) + 1;
        const maxRetries = job.maxRetries ?? 3;
        
        if (retryCount < maxRetries) {
          const delayMs = getRetryDelay(error, retryCount);
          const nextRetryAt = new Date(Date.now() + delayMs);
          
          await storage.incrementJobRetry(job.id, nextRetryAt);
          
          log('info', 'Retry scheduled', {
            jobId: job.id,
            nextRetryAt: nextRetryAt.toISOString(),
            retryCount,
            maxRetries,
            delayMs,
          });
        } else {
          log('warn', 'Max retries exceeded', {
            jobId: job.id,
            retryCount,
            maxRetries,
          });
        }
      }
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    metrics.jobsProcessed++;
    metrics.jobsFailed++;
    metrics.totalDurationMs += durationMs;

    log('error', 'Job processing threw exception', {
      jobId: job.id,
      sheetId: job.sheetId,
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    });
  } finally {
    activeJobs.delete(job.id);
  }
}

async function processingLoop(): Promise<void> {
  if (!isRunning) return;
  
  metrics.lastRunAt = new Date();
  
  try {
    const availableSlots = MAX_CONCURRENT_JOBS - activeJobs.size;
    if (availableSlots <= 0) {
      log('info', 'All processing slots busy', { activeJobs: activeJobs.size });
      return;
    }
    
    const retryableJobs = await storage.getRetryableJobs(availableSlots);
    
    if (retryableJobs.length > 0) {
      log('info', 'Found retryable jobs', { count: retryableJobs.length });
      
      for (const job of retryableJobs) {
        if (activeJobs.has(job.id)) continue;
        
        log('info', 'Stage transition', {
          jobId: job.id,
          previousStage: job.currentStage,
          currentStage: 'retry_processing',
        });
        
        processJob(job).catch(err => {
          log('error', 'Unhandled error in retry job', {
            jobId: job.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    }
    
    const remainingSlots = MAX_CONCURRENT_JOBS - activeJobs.size;
    if (remainingSlots > 0) {
      const pendingJobs = await storage.getPendingIngestionJobs(remainingSlots);
      
      if (pendingJobs.length > 0) {
        log('info', 'Found pending jobs', { count: pendingJobs.length });
        
        for (const job of pendingJobs) {
          if (activeJobs.has(job.id)) continue;
          
          log('info', 'Stage transition', {
            jobId: job.id,
            previousStage: job.currentStage || 'pending',
            currentStage: 'processing',
          });
          
          processJob(job).catch(err => {
            log('error', 'Unhandled error in pending job', {
              jobId: job.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }
      }
    }
  } catch (error) {
    log('error', 'Error in processing loop', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startBackgroundProcessor(): void {
  if (isRunning) {
    log('info', 'Background processor already running');
    return;
  }
  
  isRunning = true;
  shutdownPromise = null;
  
  log('info', 'Starting background processor', {
    intervalMs: PROCESSING_INTERVAL_MS,
    maxConcurrentJobs: MAX_CONCURRENT_JOBS,
  });
  
  processingLoop();
  
  intervalId = setInterval(() => {
    processingLoop();
  }, PROCESSING_INTERVAL_MS);
}

export async function stopBackgroundProcessor(): Promise<void> {
  if (!isRunning) {
    log('info', 'Background processor not running');
    return;
  }
  
  isRunning = false;
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  log('info', 'Stopping background processor', {
    activeJobCount: activeJobs.size,
  });
  
  if (activeJobs.size > 0) {
    log('info', 'Waiting for active jobs to complete', {
      jobIds: Array.from(activeJobs.keys()),
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    
    shutdownPromise = new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => {
        log('warn', 'Shutdown timeout reached, forcing stop', {
          remainingJobs: activeJobs.size,
        });
        resolve();
      }, SHUTDOWN_TIMEOUT_MS);
      
      Promise.allSettled(Array.from(activeJobs.values()))
        .then(() => {
          clearTimeout(timeoutId);
          log('info', 'All active jobs completed during shutdown');
          resolve();
        });
    });
    
    await shutdownPromise;
  }
  
  log('info', 'Background processor stopped', {
    metrics: {
      jobsProcessed: metrics.jobsProcessed,
      jobsSucceeded: metrics.jobsSucceeded,
      jobsFailed: metrics.jobsFailed,
      avgDurationMs: metrics.jobsProcessed > 0 
        ? Math.round(metrics.totalDurationMs / metrics.jobsProcessed) 
        : 0,
    },
  });
}

export function getProcessorStatus(): { 
  isRunning: boolean; 
  processingCount: number;
  activeJobIds: string[];
} {
  return { 
    isRunning, 
    processingCount: activeJobs.size,
    activeJobIds: Array.from(activeJobs.keys()),
  };
}

export function getProcessorMetrics(): ProcessorMetrics {
  return { ...metrics };
}

export function resetProcessorMetrics(): void {
  metrics.jobsProcessed = 0;
  metrics.jobsSucceeded = 0;
  metrics.jobsFailed = 0;
  metrics.totalDurationMs = 0;
  metrics.lastRunAt = null;
  
  log('info', 'Processor metrics reset');
}
