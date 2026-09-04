"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { StatusPill, type MandateState } from "@mandate/ui/components/StatusPill";
import { Countdown } from "@mandate/ui/components/Countdown";
import { MonoValue } from "@mandate/ui/components/MonoValue";

export interface MandateNodeCardData extends Record<string, unknown> {
  label: string;
  agentWallet: string;
  expiry: number;
  state: MandateState;
  onRevoke: () => void;
  revoking: boolean;
}

const RING_CLASS: Record<MandateState, string> = {
  live: "border-live/50",
  expiring: "border-expiring/50",
  revoked: "border-revoked/50",
  stale: "border-stale/50",
};

export function MandateNodeCard({ data }: NodeProps & { data: MandateNodeCardData }) {
  return (
    <div
      className={`w-56 rounded-xl border bg-surface p-4 shadow-lg shadow-black/20 transition-colors ${RING_CLASS[data.state]}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-border-strong" />
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[13px] font-medium text-primary">{data.label}</p>
        <StatusPill state={data.state} pulse={data.state === "live"} />
      </div>
      <MonoValue value={data.agentWallet} className="mt-2 block text-tertiary" />
      <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-tertiary">Expires in</p>
          <Countdown expiresAt={data.expiry} className="text-[13px] text-secondary" />
        </div>
        {data.state !== "revoked" && (
          <button
            onClick={data.onRevoke}
            disabled={data.revoking}
            className="rounded-md border border-revoked/30 px-2 py-1 text-[11px] font-medium text-revoked transition-colors hover:bg-revoked-subtle disabled:opacity-40"
          >
            {data.revoking ? "Revoking…" : "Revoke"}
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-border-strong" />
    </div>
  );
}
