import cron from "node-cron";
import { type Config, type CronJob } from "../config/schema.js";
import { type LiveAgent, invokeAgent } from "../agent/core.js";

/**
 * Cron scheduler — equivalent to ZeroClaw's cron module.
 *
 * Reads jobs from config.cron.jobs and schedules them using node-cron.
 * Each job invokes the agent with its prompt on a dedicated thread ID
 * so it has its own conversation history.
 *
 * Example config.toml entry:
 *   [[cron.jobs]]
 *   name = "morning-briefing"
 *   schedule = "0 8 * * *"
 *   prompt = "Give me a brief morning summary."
 */
export function startCronScheduler(config: Config, agent: LiveAgent): void {
  if (!config.cron.enabled) return;

  const jobs = config.cron.jobs;
  if (jobs.length === 0) {
    console.log("[cron] No jobs configured — scheduler idle");
    return;
  }

  for (const job of jobs) {
    scheduleJob(job, agent);
  }

  console.log(`[cron] Scheduled ${jobs.length} job(s)`);
}

function scheduleJob(job: CronJob, agent: LiveAgent): void {
  if (!cron.validate(job.schedule)) {
    console.error(`[cron] Invalid schedule for job "${job.name}": ${job.schedule}`);
    return;
  }

  cron.schedule(job.schedule, async () => {
    console.log(`[cron] Running job "${job.name}"`);
    const threadId = `cron-${job.name}`;

    try {
      const reply = await invokeAgent(agent, job.prompt, threadId);
      console.log(`[cron] Job "${job.name}" result:\n${reply.slice(0, 500)}`);
    } catch (err) {
      console.error(`[cron] Job "${job.name}" failed:`, err);
    }
  });

  console.log(`[cron] Scheduled "${job.name}" → ${job.schedule}`);
}
