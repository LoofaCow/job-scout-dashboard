<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
  import { api, type SurfacedJob, type RunSummary, type ScoutStatus, type ApplicationStatus } from '../lib/api';
  import '../styles.css';

  // === State ===
  let jobs: SurfacedJob[] = $state([]);
  let runs: RunSummary[] = $state([]);
  let scoutStatus: ScoutStatus = $state({ is_running: false, current_run_id: null });
  let loading = $state(true);
  let error: string | null = $state(null);
  let expandedJobId: number | null = $state(null);
  let lastSeenSurfacedIds = new Set<number>();

  // === Polling ===
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  async function refreshAll() {
    try {
      const [j, r, s] = await Promise.all([
        api.surfacedJobs(),
        api.recentRuns(5),
        api.scoutStatus(),
      ]);

      if (lastSeenSurfacedIds.size > 0) {
        const newIds = j.filter(job => !lastSeenSurfacedIds.has(job.id));
        if (newIds.length > 0) {
          await fireNewJobsNotification(newIds);
        }
      }
      lastSeenSurfacedIds = new Set(j.map(job => job.id));

      jobs = j;
      runs = r;
      scoutStatus = s;
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function triggerRun() {
    try {
      await api.triggerScout();
      scoutStatus = { ...scoutStatus, is_running: true };
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function setStatus(jobId: number, status: ApplicationStatus) {
    try {
      await api.updateStatus(jobId, status);
      jobs = jobs.map(j => j.id === jobId ? { ...j, status } : j);
      if (status === 'archived') {
        jobs = jobs.filter(j => j.id !== jobId);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  function toggleExpand(jobId: number) {
    expandedJobId = expandedJobId === jobId ? null : jobId;
  }

  async function fireNewJobsNotification(newJobs: SurfacedJob[]) {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }
    if (!granted) return;

    const top = newJobs[0];
    const extra = newJobs.length - 1;
    const title = newJobs.length === 1
      ? `New job (${top.score}/100): ${top.title}`
      : `${newJobs.length} new jobs surfaced`;
    const body = newJobs.length === 1
      ? `${top.company} — ${top.location}`
      : `Top: ${top.title} @ ${top.company} (${top.score}/100)${extra > 0 ? `, +${extra} more` : ''}`;

    sendNotification({ title, body });
  }

  onMount(() => {
    refreshAll();
    refreshInterval = setInterval(refreshAll, 30000);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });

  const lastRun = $derived(runs[0]);
  const formatRelative = (iso: string | null) => {
    if (!iso) return '—';
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const scoreColor = (score: number) => {
    if (score >= 90) return '#22c55e';
    if (score >= 70) return '#84cc16';
    if (score >= 50) return '#eab308';
    if (score >= 30) return '#f97316';
    return '#ef4444';
  };
</script>

<main>
  <header>
    <div class="header-left">
      <h1>Job Scout</h1>
      <span class="subtitle">
        {jobs.length} surfaced job{jobs.length === 1 ? '' : 's'}
      </span>
    </div>
    <div class="header-right">
      {#if lastRun}
        <div class="last-run">
          <span class="label">Last run:</span>
          <span>{formatRelative(lastRun.finished_at ?? lastRun.started_at)}</span>
          <span class="muted">
            ({lastRun.jobs_found} found, {lastRun.jobs_new} new, {lastRun.jobs_evaluated} scored)
          </span>
        </div>
      {/if}
      <button
        class="primary"
        onclick={triggerRun}
        disabled={scoutStatus.is_running}
      >
        {scoutStatus.is_running ? 'Running…' : 'Run Scout Now'}
      </button>
    </div>
  </header>

  {#if error}
    <div class="error">
      ⚠ {error}
      <button onclick={() => { error = null; refreshAll(); }}>Dismiss</button>
    </div>
  {/if}

  {#if loading}
    <p class="empty">Loading…</p>
  {:else if jobs.length === 0}
    <div class="empty">
      <h2>No surfaced jobs yet.</h2>
      <p>Click <strong>Run Scout Now</strong> to start the pipeline, or wait for the nightly run.</p>
    </div>
  {:else}
    <ul class="jobs">
      {#each jobs as job (job.id)}
        <li class="job">
          <div class="job-row">
            <div
              class="score"
              style="background: {scoreColor(job.score)};"
            >
              {job.score}
            </div>
            <div class="job-main">
              <div class="job-title-row">
                <h3>{job.title}</h3>
                <a href={job.url} target="_blank" rel="noopener">↗</a>
              </div>
              <div class="job-meta">
                <span><strong>{job.company}</strong></span>
                <span class="muted">·</span>
                <span>{job.location}</span>
                {#if job.salary_text}
                  <span class="muted">·</span>
                  <span>{job.salary_text}</span>
                {/if}
                <span class="muted">·</span>
                <span class="muted">{formatRelative(job.first_seen_at)}</span>
              </div>
              <div class="rationale">{job.rationale}</div>
              {#if job.matched_skills.length > 0}
                <div class="skills">
                  {#each job.matched_skills as skill}
                    <span class="skill">{skill}</span>
                  {/each}
                </div>
              {/if}
            </div>
            <div class="actions">
              <button onclick={() => setStatus(job.id, 'interested')}
                class:active={job.status === 'interested'}>★</button>
              <button onclick={() => setStatus(job.id, 'applied')}
                class:active={job.status === 'applied'}>Applied</button>
              <button onclick={() => setStatus(job.id, 'archived')}>✕</button>
              <button onclick={() => toggleExpand(job.id)}>
                {expandedJobId === job.id ? 'Less' : 'More'}
              </button>
            </div>
          </div>
          {#if expandedJobId === job.id}
            <div class="expanded">
              <a href={job.url} target="_blank" rel="noopener">Open full listing →</a>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 1px solid #2a2a2a;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .header-left h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 500;
  }
  .subtitle {
    color: #888;
    font-size: 14px;
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .last-run {
    font-size: 13px;
    color: #aaa;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .last-run .label { color: #666; }
  .last-run .muted { color: #666; font-size: 12px; }

  .error {
    background: #3a1a1a;
    border: 1px solid #7f1d1d;
    color: #fecaca;
    padding: 10px 14px;
    border-radius: 6px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .empty {
    text-align: center;
    color: #888;
    padding: 60px 20px;
  }

  .jobs {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .job {
    background: #232323;
    border: 1px solid #2e2e2e;
    border-radius: 8px;
    overflow: hidden;
  }
  .job-row {
    display: grid;
    grid-template-columns: 60px 1fr auto;
    gap: 16px;
    padding: 14px 16px;
    align-items: start;
  }

  .score {
    font-size: 22px;
    font-weight: 600;
    color: #111;
    border-radius: 6px;
    padding: 8px 0;
    text-align: center;
    min-width: 56px;
  }

  .job-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .job-main h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    color: #f4f4f4;
  }
  .job-meta {
    margin-top: 4px;
    font-size: 13px;
    color: #b8b8b8;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .job-meta .muted { color: #555; }
  .rationale {
    margin-top: 8px;
    font-size: 13px;
    color: #c0c0c0;
    line-height: 1.5;
  }
  .skills {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .skill {
    font-size: 11px;
    background: #1e3a5f;
    color: #93c5fd;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: stretch;
  }
  .actions button {
    font-size: 12px;
    padding: 4px 10px;
    min-width: 70px;
  }
  .actions button.active {
    background: #1e3a5f;
    border-color: #2563eb;
    color: #93c5fd;
  }

  .expanded {
    padding: 12px 16px;
    border-top: 1px solid #2e2e2e;
    background: #1c1c1c;
    font-size: 13px;
  }
</style>