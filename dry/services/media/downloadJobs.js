const jobs = new Map();

const normalizeId = (id) => String(id);

const registerJob = (id, payload) => {
  const key = normalizeId(id);
  const existing = jobs.get(key) || {};
  jobs.set(key, { ...existing, ...payload });
};

const getJob = (id) => jobs.get(normalizeId(id));

const clearJob = (id) => {
  const key = normalizeId(id);
  const job = jobs.get(key);
  if (job && job.cleanupTimer) {
    clearTimeout(job.cleanupTimer);
  }
  jobs.delete(key);
};

const scheduleCleanup = (id, fn, delayMs) => {
  const key = normalizeId(id);
  const job = jobs.get(key) || {};
  if (job.cleanupTimer) {
    clearTimeout(job.cleanupTimer);
  }
  job.cleanupTimer = setTimeout(async () => {
    try {
      await fn();
    } finally {
      clearJob(key);
    }
  }, delayMs);
  jobs.set(key, job);
  return job.cleanupTimer;
};

module.exports = { registerJob, getJob, clearJob, scheduleCleanup };
