"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { sepolia, arcTestnet } from "viem/chains";
import { maxUint256, parseEventLogs, type Address, type Hex } from "viem";
import { ArcVaultFactoryAbi, ETHRegistrarAbi, MandateOrgFactoryAbi, Erc20Abi } from "@mandate/shared/abis";
import { fromErc20Usdc } from "@mandate/shared/decimals";
import type { OrgWithVault } from "@mandate/shared/orgs";
import { Button } from "@mandate/ui/components/Button";
import { Card } from "@mandate/ui/components/Card";
import { Field, Input } from "@mandate/ui/components/Field";
import { Display, Eyebrow } from "@mandate/ui/components/Type";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { getDeployedAddresses } from "@/lib/addresses";
import { getPublicSepoliaAddresses, getPublicArcAddresses } from "@/lib/publicNetworkAddresses";
import { useOrgs } from "@/lib/useOrgs";
import { useMandateGraph } from "@/lib/useMandateGraph";
import { formatTxError } from "@/lib/txError";
import { ConnectButton } from "@/app/_components/ConnectButton";
import { StepTimeline } from "./_components/StepTimeline";
import { RegisterAgentForm } from "./_components/RegisterAgentForm";

const LABEL_RE = /^[a-z0-9-]{3,63}$/;
const REGISTRATION_DURATION = 2_419_200n; // 28 days — matches MandateOrgFactory's default

const TIMELINE = [
  { id: "connect", label: "Connect" },
  { id: "name", label: "Name" },
  { id: "fund", label: "Add funds" },
  { id: "register", label: "Register" },
  { id: "vault", label: "Arc vault" },
  { id: "agent", label: "First agent" },
];
type StepId = (typeof TIMELINE)[number]["id"];

interface Reservation {
  commitment: Hex;
  orgRootNode: Hex;
  committedAt: number;
  label: string;
}

function storageKey(address?: string) {
  return address ? `mandate:onboard:${address.toLowerCase()}` : null;
}

/**
 * One gated flow, one horizontal timeline. The step is derived — never a free counter: the chain
 * (and `useOrgs`/`useMandateGraph` reading its logs) is the source of truth for what's done, and
 * localStorage only carries the one thing not yet on-chain, the commit secret between `beginOrg`
 * and `finalizeOrg`. Refreshing mid-flow lands you back on the right step. Finishing sends you to
 * the dashboard with a live agent already in the tree.
 */
export default function OnboardPage() {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const sepoliaClient = usePublicClient({ chainId: sepolia.id });
  const arcClient = usePublicClient({ chainId: arcTestnet.id });

  const platform = getDeployedAddresses();
  const sepoliaAddrs = getPublicSepoliaAddresses();
  const arcAddrs = getPublicArcAddresses();
  const orgFactory = platform.mandateOrgFactory;
  const vaultFactory = platform.arcVaultFactory;

  // ---- resume state -------------------------------------------------------------------------
  const [reservation, setReservation] = useState<Reservation | null>(null);
  useEffect(() => {
    const key = storageKey(address);
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      setReservation(raw ? (JSON.parse(raw) as Reservation) : null);
    } catch {
      setReservation(null);
    }
  }, [address]);

  const persistReservation = useCallback(
    (r: Reservation | null) => {
      const key = storageKey(address);
      if (!key) return;
      try {
        if (r) localStorage.setItem(key, JSON.stringify(r));
        else localStorage.removeItem(key);
      } catch {
        /* private mode — in-memory state still carries the flow */
      }
      setReservation(r);
    },
    [address],
  );

  // ---- what's already on-chain for this admin -----------------------------------------------
  // An org this admin abandoned half-built (registered, no vault) still shows up here forever —
  // it's in the factory's own OrgCreated log, which is the whole point of event-sourced discovery.
  // "Start a new one instead" adds its registrar here so the wizard stops trying to resume it.
  const [ignoredRegistrars, setIgnoredRegistrars] = useState<string[]>([]);
  const { orgs } = useOrgs();
  const myOrg = useMemo(() => {
    if (!address) return undefined;
    const mine = orgs.filter(
      (o) =>
        o.admin.toLowerCase() === address.toLowerCase() &&
        !ignoredRegistrars.includes(o.registrar.toLowerCase()),
    );
    return mine.length > 0 ? mine[mine.length - 1] : undefined;
  }, [orgs, address, ignoredRegistrars]);

  // `useOrgs` briefly returns [] while it re-backfills, and wagmi's `isConnected` flickers during
  // Privy hydration — either would bounce the wizard back a step for a frame. Latch the org we've
  // seen (respecting the ignore list) and gate on `address`, which is stable, so the step only
  // ever moves forward on its own.
  const [sawOrg, setSawOrg] = useState<OrgWithVault>();
  useEffect(() => {
    if (myOrg) setSawOrg(myOrg);
  }, [myOrg]);
  const org =
    myOrg ??
    (sawOrg && !ignoredRegistrars.includes(sawOrg.registrar.toLowerCase()) ? sawOrg : undefined);

  const { nodes: mandateNodes } = useMandateGraph(org?.registrar, org?.createdAtBlock);
  const agentIssued = mandateNodes.length > 0;

  // Once the org is confirmed by its own OrgCreated log, the local commit secret is dead weight.
  useEffect(() => {
    if (org && reservation) persistReservation(null);
  }, [org, reservation, persistReservation]);

  // ---- step derivation --------------------------------------------------------------------
  const [preReserveStep, setPreReserveStep] = useState<"name" | "fund">("name");

  const step: StepId = useMemo(() => {
    if (!address) return "connect";
    if (org && org.vault) return "agent";
    if (org) return "vault";
    if (reservation) return "register";
    return preReserveStep;
  }, [address, org, reservation, preReserveStep]);

  const activeIndex = TIMELINE.findIndex((s) => s.id === step);

  useEffect(() => {
    // A real browser navigation, not `router.replace` — the wizard's own polling (`useOrgs`,
    // `useMandateGraph`) can leave Next's client router cache holding a stuck or errored entry for
    // this exact URL from an earlier prefetch, which makes `router.replace` silently hang: the page
    // stays on "Registering…" forever with a mandate that's already live on-chain, recoverable only
    // by closing the tab and reopening it — found live, not theorized. A full navigation can't get
    // stuck the same way; the one extra page load is invisible at the end of a multi-step wizard.
    if (org && org.vault && agentIssued) {
      window.location.assign(`/org/${encodeURIComponent(org.orgEnsName)}`);
    }
  }, [org, agentIssued]);

  if (!orgFactory) {
    return (
      <Shell activeIndex={0}>
        <Card padding="lg" className="border-dashed text-center">
          <p className="text-[14px] font-medium text-primary">Platform not configured</p>
          <p className="mt-2 text-[13px] text-tertiary">
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">NEXT_PUBLIC_MANDATE_ORG_FACTORY</code> is unset.
          </p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell activeIndex={activeIndex}>
      {step === "connect" ? <ConnectStep /> : null}
      {step === "name" ? (
        <NameStep
          registrar={sepoliaAddrs.ethRegistrar}
          usdc={sepoliaAddrs.usdc}
          onContinue={() => setPreReserveStep("fund")}
        />
      ) : null}
      {step === "fund" ? (
        <FundStep
          address={address!}
          sepoliaUsdc={sepoliaAddrs.usdc}
          arcUsdc={arcAddrs.usdc}
          registrar={sepoliaAddrs.ethRegistrar}
          orgFactory={orgFactory}
          onBack={() => setPreReserveStep("name")}
          onReserved={persistReservation}
        />
      ) : null}
      {step === "register" && reservation ? (
        <RegisterStep
          reservation={reservation}
          orgFactory={orgFactory}
          usdc={sepoliaAddrs.usdc}
          registrar={sepoliaAddrs.ethRegistrar}
        />
      ) : null}
      {step === "vault" && org ? (
        <VaultStep
          org={org}
          vaultFactory={vaultFactory}
          enforcer={(process.env.NEXT_PUBLIC_ENFORCER_ADDRESS ?? "") as Address}
          currentChainId={chainId}
          switchChain={switchChainAsync}
          arcClient={arcClient}
          onStartFresh={() => {
            setIgnoredRegistrars((prev) => [...prev, org.registrar.toLowerCase()]);
            setSawOrg(undefined);
            setPreReserveStep("name");
          }}
        />
      ) : null}
      {step === "agent" && org && org.vault ? (
        <div>
          <Display as="h1" size="sm">Register your first agent</Display>
          <p className="mt-2 text-[13px] text-secondary">One signature. The agent&rsquo;s wallet is created for you.</p>
          <Card padding="lg" className="mt-6">
            <RegisterAgentForm
              org={org}
              submitLabel="Register agent"
              onDone={() => window.location.assign(`/org/${encodeURIComponent(org.orgEnsName)}`)}
            />
          </Card>
        </div>
      ) : null}
    </Shell>
  );
}

function Shell({ activeIndex, children }: { activeIndex: number; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
      <Eyebrow>Set up MANDATE</Eyebrow>
      <div className="mt-6 overflow-x-auto">
        <StepTimeline steps={TIMELINE} activeIndex={activeIndex < 0 ? 0 : activeIndex} />
      </div>
      <div className="mt-10">{children}</div>
    </div>
  );
}

// -------------------------------------------------------------------------------------------
// Steps
// -------------------------------------------------------------------------------------------

function ConnectStep() {
  return (
    <div>
      <Display as="h1" size="sm">Connect a wallet</Display>
      <p className="mt-2 text-[13px] text-secondary">This wallet becomes the org admin — the only one that can issue or revoke mandates.</p>
      <div className="mt-6">
        <ConnectButton />
      </div>
    </div>
  );
}

function NameStep({
  registrar,
  usdc,
  onContinue,
}: {
  registrar: Address;
  usdc: Address;
  onContinue: () => void;
}) {
  const [label, setLabel] = useState("");
  const valid = LABEL_RE.test(label);
  const { data: available, isLoading: checking } = useReadContract({
    address: registrar,
    abi: ETHRegistrarAbi,
    functionName: "isAvailable",
    args: [label],
    chainId: sepolia.id,
    query: { enabled: valid },
  });
  const { data: price } = useReadContract({
    address: registrar,
    abi: ETHRegistrarAbi,
    functionName: "getRegisterPrice",
    args: [label, REGISTRATION_DURATION, usdc],
    chainId: sepolia.id,
    query: { enabled: valid && available === true },
  });

  // The typed label isn't persisted — nothing is on-chain yet — so hand it to the next step via
  // sessionStorage so a mid-flow refresh on the fund step still knows which name to reserve.
  useEffect(() => {
    if (valid && available) sessionStorage.setItem("mandate:onboard:label", label);
  }, [valid, available, label]);

  return (
    <div>
      <Display as="h1" size="sm">Name your organisation</Display>
      <p className="mt-2 text-[13px] text-secondary">A real ENS name. Your agents are subnames of it.</p>
      <Card padding="lg" className="mt-6">
        <Field label="Name" hint="Lowercase letters, digits, hyphens">
          <div className="flex items-center gap-2">
            <Input value={label} onChange={(e) => setLabel(e.target.value.toLowerCase())} placeholder="acme" autoFocus />
            <span className="shrink-0 font-mono text-[13px] text-tertiary">.eth</span>
          </div>
        </Field>
        {valid ? (
          <p className="mt-2 text-[12px]">
            {checking ? (
              <span className="text-tertiary">checking…</span>
            ) : available ? (
              <span className="text-live">available{price ? ` — ${fromErc20Usdc(price)} USDC / 28 days` : ""}</span>
            ) : (
              <span className="text-revoked">taken</span>
            )}
          </p>
        ) : label.length > 0 ? (
          <p className="mt-2 text-[12px] text-revoked-strong">3–63 lowercase letters, digits, or hyphens</p>
        ) : null}
        <div className="mt-5">
          <Button onClick={onContinue} disabled={!valid || available !== true}>
            Continue
          </Button>
        </div>
      </Card>
    </div>
  );
}

function FundStep({
  address,
  sepoliaUsdc,
  arcUsdc,
  registrar,
  orgFactory,
  onBack,
  onReserved,
}: {
  address: Address;
  sepoliaUsdc: Address;
  arcUsdc: Address;
  registrar: Address;
  orgFactory: Address;
  onBack: () => void;
  onReserved: (r: Reservation) => void;
}) {
  const label = typeof window !== "undefined" ? sessionStorage.getItem("mandate:onboard:label") ?? "" : "";
  const sepoliaClient = usePublicClient({ chainId: sepolia.id });

  const { data: eth } = useBalance({ address, chainId: sepolia.id });
  const { data: usdcBal } = useReadContract({
    address: sepoliaUsdc,
    abi: Erc20Abi,
    functionName: "balanceOf",
    args: [address],
    chainId: sepolia.id,
  });
  const { data: arcBal } = useReadContract({
    address: arcUsdc,
    abi: Erc20Abi,
    functionName: "balanceOf",
    args: [address],
    chainId: arcTestnet.id,
  });
  const { data: price } = useReadContract({
    address: registrar,
    abi: ETHRegistrarAbi,
    functionName: "getRegisterPrice",
    args: [label, REGISTRATION_DURATION, sepoliaUsdc],
    chainId: sepolia.id,
    query: { enabled: LABEL_RE.test(label) },
  });

  const hasGas = Boolean(eth && eth.value > 0n);
  const hasUsdc = Boolean(price !== undefined && usdcBal !== undefined && (usdcBal as bigint) >= price);
  const hasArc = Boolean(arcBal !== undefined && (arcBal as bigint) > 0n);
  const ready = hasGas && hasUsdc && hasArc && LABEL_RE.test(label);

  const { writeContractAsync, isPending } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const { chainId } = useAccount();
  const [error, setError] = useState<string | undefined>();

  async function reserve() {
    setError(undefined);
    if (!sepoliaClient) return;
    try {
      if (chainId !== sepolia.id) await switchChainAsync({ chainId: sepolia.id });
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const saltHex = `0x${Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
      const hash = await writeContractAsync({
        address: orgFactory,
        abi: MandateOrgFactoryAbi,
        functionName: "beginOrg",
        args: [label, address, saltHex],
        chainId: sepolia.id,
      });
      const receipt = await sepoliaClient.waitForTransactionReceipt({ hash });
      const [event] = parseEventLogs({ abi: MandateOrgFactoryAbi, eventName: "OrgCommitted", logs: receipt.logs });
      if (!event) throw new Error("Reservation didn't confirm — try again.");
      const block = await sepoliaClient.getBlock({ blockNumber: receipt.blockNumber });
      onReserved({
        commitment: event.args.commitment,
        orgRootNode: event.args.orgRootNode,
        committedAt: Number(block.timestamp),
        label,
      });
    } catch (err) {
      setError(formatTxError(err));
    }
  }

  return (
    <div>
      <Display as="h1" size="sm">Add funds</Display>
      <p className="mt-2 text-[13px] text-secondary">
        Testnet only. {label ? <span className="font-mono">{label}.eth</span> : "Your name"} needs a one-off USDC fee; both chains need a little gas.
      </p>
      <Card padding="lg" className="mt-6 flex flex-col gap-2.5">
        <FundRow ok={hasGas} label="Sepolia ETH" hint="gas" href="https://sepoliafaucet.com" />
        <FundRow
          ok={hasUsdc}
          label="Sepolia USDC"
          hint={price !== undefined ? `${fromErc20Usdc(price)} needed` : "checking price…"}
          href="https://faucet.circle.com"
        />
        <FundRow ok={hasArc} label="Arc USDC" hint="gas + treasury" href="https://faucet.circle.com" />
      </Card>
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={reserve} disabled={!ready || isPending}>
          {isPending ? "Reserving…" : "Reserve name"}
        </Button>
        <button type="button" onClick={onBack} className="text-[12px] text-tertiary hover:text-secondary">
          ← Back
        </button>
      </div>
      {!label ? <p className="mt-2 text-[12px] text-expiring">Go back and pick a name first.</p> : null}
      {error ? <p className="mt-2 text-[12px] text-revoked-strong">{error}</p> : null}
    </div>
  );
}

function FundRow({ ok, label, hint, href }: { ok: boolean; label: string; hint: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-surface-2 px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-live" : "bg-revoked"}`} aria-hidden />
        <div>
          <p className="text-[13px] text-primary">{label}</p>
          <p className="text-[11px] text-tertiary">{hint}</p>
        </div>
      </div>
      <a href={href} target="_blank" rel="noreferrer" className="text-[12px] text-accent hover:underline">
        faucet →
      </a>
    </div>
  );
}

function RegisterStep({
  reservation,
  orgFactory,
  usdc,
  registrar,
}: {
  reservation: Reservation;
  orgFactory: Address;
  usdc: Address;
  registrar: Address;
}) {
  const sepoliaClient = usePublicClient({ chainId: sepolia.id });
  const { data: minAge } = useReadContract({
    address: registrar,
    abi: ETHRegistrarAbi,
    functionName: "MIN_COMMITMENT_AGE",
    chainId: sepolia.id,
  });

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const waited = now - reservation.committedAt;
  const remaining = Math.max(0, Number(minAge ?? 60n) - waited);
  const canRegister = remaining === 0 && minAge !== undefined;

  const { writeContractAsync, isPending } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const { chainId } = useAccount();
  const [error, setError] = useState<string | undefined>();
  const [finalized, setFinalized] = useState(false);

  async function register() {
    setError(undefined);
    if (!sepoliaClient) return;
    try {
      if (chainId !== sepolia.id) await switchChainAsync({ chainId: sepolia.id });
      const approveHash = await writeContractAsync({
        address: usdc,
        abi: Erc20Abi,
        functionName: "approve",
        args: [orgFactory, maxUint256],
        chainId: sepolia.id,
      });
      await sepoliaClient.waitForTransactionReceipt({ hash: approveHash });
      const finalizeHash = await writeContractAsync({
        address: orgFactory,
        abi: MandateOrgFactoryAbi,
        functionName: "finalizeOrg",
        args: [reservation.commitment],
        chainId: sepolia.id,
      });
      await sepoliaClient.waitForTransactionReceipt({ hash: finalizeHash });
      setFinalized(true);
      // useOrgs' live watch picks up OrgCreated and advances the flow to the vault step.
    } catch (err) {
      setError(formatTxError(err));
    }
  }

  return (
    <div>
      <Display as="h1" size="sm">Register on ENS</Display>
      <p className="mt-2 text-[13px] text-secondary">
        <span className="font-mono">{reservation.label}.eth</span> is reserved. ENS enforces a short wait before it can be claimed.
      </p>
      <Card padding="lg" className="mt-6">
        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full ${canRegister ? "bg-live" : "bg-expiring animate-pulse-live"}`} />
          <span className="font-mono text-[13px] tnum text-primary">{canRegister ? "Ready" : `${remaining}s`}</span>
        </div>
        <div className="mt-5">
          {finalized ? (
            <p className="text-[13px] text-live">Registered — finishing…</p>
          ) : (
            <Button onClick={register} disabled={!canRegister || isPending}>
              {isPending ? "Registering…" : "Register — approve + claim"}
            </Button>
          )}
          {error ? <p className="mt-2 text-[12px] text-revoked-strong">{error}</p> : null}
        </div>
      </Card>
    </div>
  );
}

function VaultStep({
  org,
  vaultFactory,
  enforcer,
  currentChainId,
  switchChain,
  arcClient,
  onStartFresh,
}: {
  org: { orgEnsName: string; admin: Address; orgRootNode: Hex };
  vaultFactory: Address | undefined;
  enforcer: Address;
  currentChainId?: number;
  switchChain: (args: { chainId: number }) => Promise<unknown>;
  arcClient: ReturnType<typeof usePublicClient>;
  onStartFresh: () => void;
}) {
  const { writeContractAsync, isPending } = useWriteContract();
  const [error, setError] = useState<string | undefined>();

  async function create() {
    setError(undefined);
    if (!vaultFactory || !arcClient) return;
    try {
      if (currentChainId !== arcTestnet.id) await switchChain({ chainId: arcTestnet.id });
      const hash = await writeContractAsync({
        address: vaultFactory,
        abi: ArcVaultFactoryAbi,
        functionName: "createVaultFor",
        args: [org.admin, enforcer, org.orgRootNode],
        chainId: arcTestnet.id,
      });
      await arcClient.waitForTransactionReceipt({ hash });
      // useOrgs' VaultCreated watch advances the flow to the agent step.
    } catch (err) {
      setError(formatTxError(err));
    }
  }

  return (
    <div>
      <Display as="h1" size="sm">Create the Arc vault</Display>
      <p className="mt-2 text-[13px] text-secondary">
        <span className="font-mono">{org.orgEnsName}</span> is live on Sepolia. This deploys its treasury on Arc, where agents actually spend.
      </p>
      <Card padding="lg" className="mt-6">
        {!vaultFactory ? (
          <p className="text-[13px] text-revoked-strong">Vault factory not configured — set NEXT_PUBLIC_ARC_VAULT_FACTORY.</p>
        ) : (
          <>
            <p className="flex items-center gap-1.5 text-[12px] text-tertiary">
              enforcer <MonoValue value={enforcer} className="text-secondary" />
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={create} disabled={isPending}>
                {isPending ? "Creating…" : "Create vault on Arc"}
              </Button>
              <button type="button" onClick={onStartFresh} className="text-[12px] text-tertiary hover:text-secondary">
                Start a new organisation instead
              </button>
            </div>
            {error ? <p className="mt-2 text-[12px] text-revoked-strong">{error}</p> : null}
          </>
        )}
      </Card>
    </div>
  );
}
