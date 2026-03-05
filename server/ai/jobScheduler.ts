/**
 * Job Scheduler
 *
 * Polls for due scheduled jobs and executes the associated skill.
 * Manages job lifecycle, updates nextRunAt, and records run history.
 */

import { storage } from "../storage";
import { chat, type ChatMessage } from "./gemini";
import { CronExpressionParser } from "cron-parser";
import type { ScheduledJob, AgentSkill } from "../../shared/schema";

const SCHEDULER_INTERVAL_MS = 60_000; // Check every minute
const MAX_CONCURRENT_SCHEDULED = 2;

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
const activeRuns = new Set<string>();

const log = (level: 'info' | 'warn' | 'error', message: string, data?: Record<string, any>) => {
  const timestamp = new Date().toISOString();
  const prefix = `[Scheduler ${timestamp}]`;
  if (level === 'error') console.error(prefix, message, data || '');
  else if (level === 'warn') console.warn(prefix, message, data || '');
  else console.log(prefix, message, data || '');
};

/**
 * Compute the next run time from a cron expression
 */
export function computeNextRun(cronExpression: string, timezone = 'UTC'): Date | null {
  try {
    const expression = CronExpressionParser.parse(cronExpression, {
      tz: timezone,
      currentDate: new Date(),
    });
    const next = expression.next();
    return next.toDate();
  } catch {
    return null;
  }
}

/**
 * Gather workspace sheet data for skill execution context
 */
async function gatherSkillData(job: ScheduledJob): Promise<string> {
  try {
    // Get sheets for the workspace (or space if no workspace)
    const sheets = job.workspaceId
      ? await storage.getSheetsByWorkspace(job.workspaceId)
      : await storage.getSheets(job.spaceId);

    if (!sheets || sheets.length === 0) {
      return 'No data available.';
    }

    const dataParts: string[] = [];
    for (const sheet of sheets.slice(0, 5)) { // Limit to 5 sheets
      const rows = sheet.cleanedData || sheet.rawData;
      if (rows && Array.isArray(rows)) {
        dataParts.push(`--- ${sheet.name || 'Sheet'} ---`);
        const limited = rows.slice(0, 50);
        dataParts.push(JSON.stringify(limited, null, 2));
      }
    }

    return dataParts.join('\n') || 'No data available.';
  } catch (err) {
    log('warn', 'Failed to gather skill data', { jobId: job.id, error: String(err) });
    return 'Error gathering data.';
  }
}

/**
 * Execute a single scheduled job
 */
async function executeJob(job: ScheduledJob & { skill: AgentSkill }): Promise<void> {
  if (activeRuns.has(job.id)) return;
  activeRuns.add(job.id);

  const startTime = Date.now();
  log('info', 'Executing scheduled job', { jobId: job.id, jobName: job.name, skill: job.skill.name });

  // Create a run record
  const run = await storage.createJobRun({
    jobId: job.id,
    status: 'running',
  });

  try {
    // Gather data
    const data = await gatherSkillData(job);

    // Build prompt from skill template
    let prompt = job.skill.promptTemplate || 'Analyze the following data:\n\n{{data}}';
    prompt = prompt.replace(/\{\{data\}\}/g, data);

    // Replace config placeholders
    const config = { ...(job.skill.config || {}), ...(job.config || {}) };
    for (const [key, value] of Object.entries(config)) {
      prompt = prompt.replace(new RegExp(`\\{\\{config\\.${key}\\}\\}`, 'g'), String(value));
    }

    // Execute via Gemini
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
    const response = await chat(messages, 'You are an AI data analyst running a scheduled analysis job. Provide clear, actionable insights.');
    const result = response.response;

    const durationMs = Date.now() - startTime;

    // Update run as success
    await storage.updateJobRun(run.id, {
      status: 'success',
      completedAt: new Date(),
      result: result,
      durationMs,
    });

    // Update job's lastRunAt and compute nextRunAt
    const nextRun = computeNextRun(job.cronExpression, job.timezone || 'UTC');
    await storage.updateScheduledJob(job.id, {
      lastRunAt: new Date(),
      nextRunAt: nextRun,
    });

    log('info', 'Job completed successfully', { jobId: job.id, durationMs });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    await storage.updateJobRun(run.id, {
      status: 'failed',
      completedAt: new Date(),
      error: errorMsg,
      durationMs,
    });

    // Still update nextRunAt so we don't retry endlessly
    const nextRun = computeNextRun(job.cronExpression, job.timezone || 'UTC');
    await storage.updateScheduledJob(job.id, {
      lastRunAt: new Date(),
      nextRunAt: nextRun,
    });

    log('error', 'Job failed', { jobId: job.id, error: errorMsg });
  } finally {
    activeRuns.delete(job.id);
  }
}

/**
 * Main tick: find and execute due jobs
 */
async function tick(): Promise<void> {
  if (activeRuns.size >= MAX_CONCURRENT_SCHEDULED) return;

  try {
    const now = new Date();
    const dueJobs = await storage.getDueJobs(now);

    if (dueJobs.length > 0) {
      log('info', `Found ${dueJobs.length} due job(s)`);
    }

    const slotsAvailable = MAX_CONCURRENT_SCHEDULED - activeRuns.size;
    const jobsToRun = dueJobs.slice(0, slotsAvailable);

    for (const job of jobsToRun) {
      executeJob(job).catch((err) => {
        log('error', 'Unhandled error in job execution', { jobId: job.id, error: String(err) });
      });
    }
  } catch (err) {
    log('error', 'Scheduler tick error', { error: String(err) });
  }
}

/**
 * Start the job scheduler polling loop
 */
export function startJobScheduler(): void {
  if (isRunning) return;
  isRunning = true;
  log('info', 'Job scheduler started');

  intervalId = setInterval(() => {
    tick().catch((err) => log('error', 'Tick failed', { error: String(err) }));
  }, SCHEDULER_INTERVAL_MS);

  // Run once immediately
  tick().catch((err) => log('error', 'Initial tick failed', { error: String(err) }));
}

/**
 * Stop the job scheduler
 */
export function stopJobScheduler(): void {
  if (!isRunning) return;
  isRunning = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  log('info', 'Job scheduler stopped');
}
