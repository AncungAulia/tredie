import type { CandidatesResponse } from "@/src/types/admin";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

export function getCandidates(verdict?: string): Promise<CandidatesResponse> {
  const qs = verdict ? `?verdict=${verdict}&limit=200` : "?limit=200";
  return req(`/api/admin/candidates${qs}`);
}

export function approveCandidate(id: string): Promise<{ ok: boolean }> {
  return req(`/api/admin/candidates/${id}/approve`, { method: "POST" });
}

export function rejectCandidate(id: string): Promise<{ ok: boolean }> {
  return req(`/api/admin/candidates/${id}/reject`, { method: "POST" });
}

export function pollTrending(): Promise<{ ok: boolean; elapsedMs: number }> {
  return req("/api/admin/poll-trending", { method: "POST" });
}

export function updateOracles(): Promise<{ ok: boolean; elapsedMs: number }> {
  return req("/api/admin/update-oracles", { method: "POST" });
}
