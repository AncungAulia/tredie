"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCandidates, approveCandidate, rejectCandidate, pollTrending, updateOracles } from "@/src/lib/api";
import type { MarketCandidate, CandidateVerdict } from "@/src/types/admin";
import { CheckCircle, XCircle, RefreshCw, Zap, ChevronDown, ChevronUp } from "lucide-react";

const VERDICT_TABS: { label: string; value: string | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Pending", value: "pending" },
  { label: "Spawn", value: "spawn" },
  { label: "Skip", value: "skip" },
  { label: "Approved", value: "manual_approve" },
  { label: "Rejected", value: "manual_reject" },
  { label: "Failed", value: "spawn_failed" },
];

const ASSET_CLASS: Record<number, string> = {
  0: "Crypto", 1: "DEX", 2: "Equity", 3: "Commodity", 4: "FX", 5: "CA", 6: "Topic",
};

const SOURCE_KIND: Record<string, string> = {
  narrative: "Narrative",
  token: "Token",
  ca_twitter: "CA (Twitter)",
  ca_telegram: "CA (Telegram)",
  user_search: "User Search",
  user_link_paste: "User Link",
};

const VERDICT_STYLE: Record<CandidateVerdict, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  spawn: { label: "Spawn", color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  skip: { label: "Skip", color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  merge: { label: "Merge", color: "text-white/40", bg: "bg-white/[0.05] border-white/10" },
  manual_approve: { label: "Approved", color: "text-[#9C93E8]", bg: "bg-[rgba(156,147,232,0.12)] border-[rgba(156,147,232,0.25)]" },
  manual_reject: { label: "Rejected", color: "text-red-300", bg: "bg-red-900/20 border-red-800/30" },
  spawn_failed: { label: "Failed", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
};

function VerdictBadge({ verdict }: { verdict: CandidateVerdict }) {
  const s = VERDICT_STYLE[verdict] ?? VERDICT_STYLE.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${s.color} ${s.bg}`}>
      {s.label}
    </span>
  );
}

function ConfidenceBar({ bps }: { bps: number }) {
  const pct = Math.round(bps / 100);
  const color = pct >= 70 ? "#22C55E" : pct >= 40 ? "#EAB308" : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono text-white/50">{pct}%</span>
    </div>
  );
}

function CandidateRow({ candidate, onApprove, onReject, approving, rejecting }: {
  candidate: MarketCandidate;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
  rejecting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const canApprove = ["skip", "pending", "spawn_failed", "manual_reject"].includes(candidate.verdict);
  const canReject = ["skip", "pending", "spawn"].includes(candidate.verdict);

  const ts = candidate.decided_at ?? candidate.created_at;
  const date = new Date(Number(ts)).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
        {/* Source */}
        <td className="px-4 py-3 align-top">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-white/30 uppercase tracking-wider">
              {SOURCE_KIND[candidate.source_kind] ?? candidate.source_kind}
            </span>
            <span className="text-sm text-white/80 font-mono truncate max-w-[180px]" title={candidate.source_key}>
              {candidate.source_key}
            </span>
          </div>
        </td>

        {/* AI Decision */}
        <td className="px-4 py-3 align-top">
          {candidate.ai_identifier ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-mono font-bold text-white">{candidate.ai_identifier}</span>
              {candidate.ai_display_name && (
                <span className="text-xs text-white/40">{candidate.ai_display_name}</span>
              )}
              {candidate.ai_asset_class !== null && (
                <span className="text-[11px] text-white/30">{ASSET_CLASS[candidate.ai_asset_class] ?? candidate.ai_asset_class}</span>
              )}
            </div>
          ) : (
            <span className="text-white/20 text-xs">—</span>
          )}
        </td>

        {/* Confidence */}
        <td className="px-4 py-3 align-top">
          {candidate.ai_confidence_bps !== null ? (
            <ConfidenceBar bps={candidate.ai_confidence_bps} />
          ) : (
            <span className="text-white/20 text-xs">—</span>
          )}
        </td>

        {/* Verdict */}
        <td className="px-4 py-3 align-top">
          <VerdictBadge verdict={candidate.verdict} />
        </td>

        {/* Date */}
        <td className="px-4 py-3 align-top">
          <span className="text-xs text-white/30 font-mono whitespace-nowrap">{date}</span>
        </td>

        {/* Actions */}
        <td className="px-4 py-3 align-top">
          <div className="flex items-center gap-2">
            {canApprove && (
              <button
                onClick={onApprove}
                disabled={approving || rejecting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-green-400 bg-green-400/10 border border-green-400/20 hover:bg-green-400/20 disabled:opacity-40 transition-colors"
              >
                {approving ? <RefreshCw size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                Approve
              </button>
            )}
            {canReject && (
              <button
                onClick={onReject}
                disabled={approving || rejecting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-red-400 bg-red-400/10 border border-red-400/20 hover:bg-red-400/20 disabled:opacity-40 transition-colors"
              >
                {rejecting ? <RefreshCw size={10} className="animate-spin" /> : <XCircle size={10} />}
                Reject
              </button>
            )}
            {candidate.ai_reason && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="p-1 rounded text-white/20 hover:text-white/50 transition-colors"
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </td>
      </tr>

      {expanded && candidate.ai_reason && (
        <tr className="border-b border-white/[0.04]">
          <td colSpan={6} className="px-4 pb-3">
            <div className="bg-white/[0.03] rounded-lg px-3 py-2 text-xs text-white/50 font-mono leading-relaxed">
              {candidate.ai_reason}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function CandidatesPage() {
  const [activeVerdict, setActiveVerdict] = useState<string | undefined>(undefined);
  const [pollingAction, setPollingAction] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["candidates", activeVerdict],
    queryFn: () => getCandidates(activeVerdict),
  });

  const approveMutation = useMutation({
    mutationFn: approveCandidate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectCandidate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
  });

  async function handlePollTrending() {
    setPollingAction("poll");
    try { await pollTrending(); } finally { setPollingAction(null); refetch(); }
  }

  async function handleUpdateOracles() {
    setPollingAction("oracle");
    try { await updateOracles(); } finally { setPollingAction(null); }
  }

  const candidates = data?.candidates ?? [];

  return (
    <div className="flex flex-col gap-6 px-6 py-6 max-w-7xl mx-auto w-full">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Candidates</h1>
          <p className="text-white/30 text-sm mt-1">
            Markets judged by Gemini from Elfa trending data.
            {data && <span className="ml-2 text-white/50">{data.count} total</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleUpdateOracles}
            disabled={!!pollingAction}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 text-xs transition-colors disabled:opacity-40"
          >
            {pollingAction === "oracle" ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Update Oracles
          </button>
          <button
            onClick={handlePollTrending}
            disabled={!!pollingAction}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(156,147,232,0.12)] border border-[rgba(156,147,232,0.25)] text-[#9C93E8] hover:bg-[rgba(156,147,232,0.20)] text-xs font-medium transition-colors disabled:opacity-40"
          >
            {pollingAction === "poll" ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
            Poll Trending Now
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 text-xs transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Verdict filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {VERDICT_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setActiveVerdict(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeVerdict === tab.value
                ? "bg-[rgba(156,147,232,0.15)] border border-[rgba(156,147,232,0.30)] text-[#9C93E8]"
                : "border border-white/[0.07] text-white/40 hover:text-white hover:border-white/20"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-white/30">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-sm">Loading candidates…</span>
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-white/20 text-sm">
            No candidates found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Source", "AI Decision", "Confidence", "Verdict", "Date", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-medium text-white/30 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <CandidateRow
                    key={c.id}
                    candidate={c}
                    onApprove={() => approveMutation.mutate(c.id)}
                    onReject={() => rejectMutation.mutate(c.id)}
                    approving={approveMutation.isPending && approveMutation.variables === c.id}
                    rejecting={rejectMutation.isPending && rejectMutation.variables === c.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
