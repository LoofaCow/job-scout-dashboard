// API client — typed wrapper around the FastAPI backend.
// Uses Tauri's HTTP plugin so requests go through the Rust shell's
// permission system instead of the webview's plain fetch.

import { fetch } from '@tauri-apps/plugin-http';

const API_BASE = 'http://127.0.0.1:8000';

// ============================================================================
// Types — mirror the Pydantic models from app/api.py
// ============================================================================

export type ApplicationStatus =
  | 'not_applied'
  | 'interested'
  | 'applied'
  | 'interviewing'
  | 'rejected'
  | 'offer'
  | 'withdrawn'
  | 'archived';

export interface SurfacedJob {
  id: number;
  source: string;
  title: string;
  company: string;
  location: string;
  url: string;
  salary_text: string | null;
  is_remote: boolean | null;
  is_hybrid: boolean | null;
  posted_at: string | null;
  first_seen_at: string;
  status: ApplicationStatus;
  score: number;
  matched_skills: string[];
  rationale: string;
  evaluated_at: string;
}

export interface JobDetail extends SurfacedJob {
  description: string;
}

export interface RunSummary {
  id: number;
  started_at: string;
  finished_at: string | null;
  jobs_found: number;
  jobs_new: number;
  jobs_evaluated: number;
  jobs_surfaced: number;
  error: string | null;
}

export interface ScoutStatus {
  is_running: boolean;
  current_run_id: number | null;
}

// ============================================================================
// API calls
// ============================================================================

async function getJSON<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function postJSON<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`POST ${path} failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export const api = {
  health: () => getJSON<{ status: string; service: string }>('/health'),
  surfacedJobs: (limit = 50) => getJSON<SurfacedJob[]>(`/jobs/surfaced?limit=${limit}`),
  jobDetail: (id: number) => getJSON<JobDetail>(`/jobs/${id}`),
  updateStatus: (id: number, status: ApplicationStatus) =>
    postJSON<{ ok: boolean; job_id: number; status: string }>(
      `/jobs/${id}/status`,
      { status },
    ),
  recentRuns: (limit = 10) => getJSON<RunSummary[]>(`/runs?limit=${limit}`),
  scoutStatus: () => getJSON<ScoutStatus>('/scout/status'),
  triggerScout: () => postJSON<{ ok: boolean; message: string }>('/scout/run'),
};