"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { sepolia, arcTestnet } from "viem/chains";
import { parseEventLogs, parseUnits, type Address, type Hex } from "viem";
import {
  ArcVaultFactoryAbi,
  ETHRegistrarAbi,
  MandateOrgFactoryAbi,
  Erc20Abi,
} from "@mandate/shared/abis";
import { fromErc20Usdc } from "@mandate/shared/decimals";
import { Button } from "@mandate/ui/components/Button";
import { Card } from "@mandate/ui/components/Card";
import { Field, Input } from "@mandate/ui/components/Field";
import { Display, Eyebrow, Lede, RuleLabel } from "@mandate/ui/components/Type";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { getDeployedAddresses } from "@/lib/addresses";
import { getPublicSepoliaAddresses, getPublicArcAddresses } from "@/lib/publicNetworkAddresses";
import { ConnectButton } from "@/app/_components/ConnectButton";

const LABEL_RE = /^[a-z0-9-]{3,63}$/;

/**
 * Self-serve org onboarding — HOW-IT-WORKS.md §4: "a button, not a script." Everything below maps
 * to a real, fork-tested call on `MandateOrgFactory`/`ArcVaultFactory`
 * (contracts/test/fork/MandateOrgFactoryFork.t.sol); nothing here is simulated. Built as a
 * progressive checklist rather than a rigid multi-page wizard specifically because step 4→5 has a
 * real, unavoidable wait (ENSv2's commit-reveal, MIN_COMMITMENT_AGE=60s on Sepolia,
 * MAX_COMMITMENT_AGE=86400s) — a page-per-step flow would strand the visitor on a blank
 * "please wait" screen instead of showing the whole shape of what's left.
 */
export default function OnboardPage() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const arcPublicClient = usePublicClient({ chainId: arcTestnet.id });
  const router = useRouter();

  const platform = getDeployedAddresses();
  const sepoliaAddrs = getPublicSepoliaAddresses();
  const arcAddrs = getPublicArcAddresses();
  const orgFactory = platform.mandateOrgFactory;
  const vaultFactory = platform.arcVaultFactory;

  // ---- 1. name ------------------------------------------------------------------------------
  const [label, setLabel] = useState("");
  const labelValid = LABEL_RE.test(label);
  const { data: isAvailable, isLoading: checkingAvailability } = useReadContract({
    address: sepoliaAddrs.ethRegistrar,
    abi: ETHRegistrarAbi,
    functionName: "isAvailable",
    args: [label],
    chainId: sepolia.id,
    query: { enabled: labelValid },
  });
  const REGISTRATION_DURATION = 2_419_200n; // 28 days, matches MandateOrgFactory's default
  const { data: quotedPrice } = useReadContract({
    address: sepoliaAddrs.ethRegistrar,
    abi: ETHRegistrarAbi,
    functionName: "getRegisterPrice",
    args: [label, REGISTRATION_DURATION, sepoliaAddrs.usdc],
    chainId: sepolia.id,
    query: { enabled: labelValid && isAvailable === true },
  });

  // ---- 2. preflight ---------------------------------------------------------------------------
  const { data: sepoliaEth } = useBalance({ address, chainId: sepolia.id, query: { enabled: isConnected } });
  const { data: sepoliaUsdc } = useReadContract({
    address: sepoliaAddrs.usdc,
    abi: Erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: { enabled: isConnected },
  });
  const { data: arcUsdc } = useReadContract({
    address: arcAddrs.usdc,
    abi: Erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: isConnected },
  });

  const hasGas = Boolean(sepoliaEth && sepoliaEth.value > 0n);
  const hasSepoliaUsdc = Boolean(quotedPrice && sepoliaUsdc !== undefined && (sepoliaUsdc as bigint) >= quotedPrice);
  const hasArcUsdc = Boolean(arcUsdc && (arcUsdc as bigint) > 0n);

  // ---- 3. reserve (beginOrg) ------------------------------------------------------------------
  interface Reservation {
    commitment: Hex;
    registrar: Address;
    orgRootRegistry: Address;
    orgRootNode: Hex;
    committedAt: number;
  }
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [reserveError, setReserveError] = useState<string | undefined>();
  const { writeContractAsync: writeBeginOrg, isPending: reserving } = useWriteContract();

  const { data: minCommitmentAge } = useReadContract({
    address: sepoliaAddrs.ethRegistrar,
    abi: ETHRegistrarAbi,
    functionName: "MIN_COMMITMENT_AGE",
    chainId: sepolia.id,
  });
  const { data: maxCommitmentAge } = useReadContract({
    address: sepoliaAddrs.ethRegistrar,
    abi: ETHRegistrarAbi,
    functionName: "MAX_COMMITMENT_AGE",
    chainId: sepolia.id,
  });

  async function handleReserve() {
    if (!orgFactory || !address || !publicClient) return;
    setReserveError(undefined);
    try {
      const secretSalt = crypto.getRandomValues(new Uint8Array(32));
      const secretSaltHex = `0x${Array.from(secretSalt).map((b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;

      const hash = await writeBeginOrg({
        address: orgFactory,
        abi: MandateOrgFactoryAbi,
        functionName: "beginOrg",
        args: [label, address, secretSaltHex],
        chainId: sepolia.id,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const [event] = parseEventLogs({
        abi: MandateOrgFactoryAbi,
        eventName: "OrgCommitted",
        logs: receipt.logs,
      });
      if (!event) throw new Error("OrgCommitted event not found in receipt — reservation may have failed.");
      const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
      setReservation({
        commitment: event.args.commitment,
        registrar: event.args.registrar,
        orgRootRegistry: event.args.orgRootRegistry,
        orgRootNode: event.args.orgRootNode,
        committedAt: Number(block.timestamp),
      });
    } catch (err) {
      setReserveError(err instanceof Error ? err.message : String(err));
    }
  }

  // Live countdown, re-rendered every second while a reservation is pending.
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!reservation) return;
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [reservation]);

  const elapsedSinceCommit = reservation ? now - reservation.committedAt : 0;
  const canFinalize = reservation && minCommitmentAge !== undefined && elapsedSinceCommit >= Number(minCommitmentAge);
  const expiresIn =
    reservation && maxCommitmentAge !== undefined ? Number(maxCommitmentAge) - elapsedSinceCommit : undefined;
  const reservationExpired = expiresIn !== undefined && expiresIn <= 0;

  // ---- 4. finalize (approve + finalizeOrg) -----------------------------------------------------
  interface CreatedOrg {
    registrar: Address;
    orgEnsName: string;
    pricePaid: bigint;
  }
  const [createdOrg, setCreatedOrg] = useState<CreatedOrg | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | undefined>();
  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writeFinalize, isPending: finalizing } = useWriteContract();

  async function handleFinalize() {
    if (!reservation || !orgFactory || !quotedPrice || !publicClient) return;
    setFinalizeError(undefined);
    try {
      const approveHash = await writeApprove({
        address: sepoliaAddrs.usdc,
        abi: Erc20Abi,
        functionName: "approve",
        args: [orgFactory, quotedPrice],
        chainId: sepolia.id,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const finalizeHash = await writeFinalize({
        address: orgFactory,
        abi: MandateOrgFactoryAbi,
        functionName: "finalizeOrg",
        args: [reservation.commitment],
        chainId: sepolia.id,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: finalizeHash });
      const [event] = parseEventLogs({ abi: MandateOrgFactoryAbi, eventName: "OrgCreated", logs: receipt.logs });
      if (!event) throw new Error("OrgCreated event not found in receipt.");
      setCreatedOrg({
        registrar: event.args.registrar,
        orgEnsName: event.args.orgEnsName,
        pricePaid: event.args.pricePaid,
      });
    } catch (err) {
      setFinalizeError(err instanceof Error ? err.message : String(err));
    }
  }

  // ---- 5. Arc vault -----------------------------------------------------------------------------
  const [enforcerAddress, setEnforcerAddress] = useState(process.env.NEXT_PUBLIC_ENFORCER_ADDRESS ?? "");
  const [vaultError, setVaultError] = useState<string | undefined>();
  const [vaultCreated, setVaultCreated] = useState(false);
  const { writeContractAsync: writeCreateVault, isPending: creatingVault } = useWriteContract();

  async function handleCreateVault() {
    if (!vaultFactory || !address || !reservation || !arcPublicClient) return;
    setVaultError(undefined);
    try {
      if (chainId !== arcTestnet.id) await switchChainAsync({ chainId: arcTestnet.id });
      const hash = await writeCreateVault({
        address: vaultFactory,
        abi: ArcVaultFactoryAbi,
        functionName: "createVaultFor",
        args: [address, enforcerAddress as Address, reservation.orgRootNode],
        chainId: arcTestnet.id,
      });
      await arcPublicClient.waitForTransactionReceipt({ hash });
      setVaultCreated(true);
    } catch (err) {
      setVaultError(err instanceof Error ? err.message : String(err));
    }
  }

  const orgEnsName = createdOrg?.orgEnsName;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
      <Eyebrow>Self-serve onboarding</Eyebrow>
      <Display as="h1" size="sm" className="mt-2">
        Create your organisation
      </Display>
      <Lede className="mt-3">
        Two signatures, one approval, and one unavoidable wait — ENSv2&rsquo;s own commit-reveal.
        Nobody touches Foundry. When this finishes, the connected wallet owns a registry nobody
        else, including this site, can issue mandates under.
      </Lede>

      {!orgFactory ? (
        <Card padding="lg" className="mt-8 border-dashed text-center">
          <p className="text-[14px] font-medium text-primary">Org factory not configured</p>
          <p className="mt-2 text-[13px] text-tertiary">
            Set <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">NEXT_PUBLIC_MANDATE_ORG_FACTORY</code>{" "}
            once <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">DeployFactories.s.sol</code> has run.
          </p>
        </Card>
      ) : (
        <div className="mt-8 flex flex-col gap-5">
          {/* Step 1 — connect */}
          <Card padding="lg">
            <RuleLabel>1 · Connect</RuleLabel>
            <div className="mt-4 flex items-center justify-between gap-4">
              {isConnected ? (
                <MonoValue value={address!} className="text-secondary" />
              ) : (
                <p className="text-[13px] text-tertiary">Sign in to reserve a name with this wallet.</p>
              )}
              <ConnectButton />
            </div>
          </Card>

          {/* Step 2 — name */}
          <Card padding="lg" className={!isConnected ? "opacity-50" : ""}>
            <RuleLabel>2 · Choose a name</RuleLabel>
            <div className="mt-4">
              <Field label="Label" hint="Lowercase letters, digits, hyphens — becomes label.eth">
                <div className="flex items-center gap-2">
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value.toLowerCase())}
                    placeholder="acme"
                    disabled={!isConnected || Boolean(reservation)}
                  />
                  <span className="shrink-0 font-mono text-[13px] text-tertiary">.eth</span>
                </div>
              </Field>
              {labelValid ? (
                <p className="mt-2 text-[12px]">
                  {checkingAvailability ? (
                    <span className="text-tertiary">checking…</span>
                  ) : isAvailable ? (
                    <span className="text-live">
                      available{quotedPrice ? ` — ${fromErc20Usdc(quotedPrice)} USDC for 28 days` : ""}
                    </span>
                  ) : (
                    <span className="text-revoked">taken</span>
                  )}
                </p>
              ) : label.length > 0 ? (
                <p className="mt-2 text-[12px] text-revoked-strong">3-63 lowercase letters, digits, or hyphens</p>
              ) : null}
            </div>
          </Card>

          {/* Step 3 — preflight */}
          {labelValid && isAvailable && !reservation ? (
            <Card padding="lg">
              <RuleLabel>3 · Preflight</RuleLabel>
              <p className="mt-2 text-[12px] text-tertiary">
                Nothing here is minted by this site — every balance and every payment is real,
                including Sepolia USDC: Circle's real testnet token, confirmed accepted by ENSv2's
                own registrar, not a token only this site can produce.
              </p>
              <div className="mt-4 flex flex-col gap-2.5">
                <PreflightRow
                  ok={hasGas}
                  label="Sepolia ETH"
                  hint="gas for two transactions"
                  action={
                    <a
                      href="https://sepoliafaucet.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] text-accent hover:underline"
                    >
                      faucet →
                    </a>
                  }
                />
                <PreflightRow
                  ok={hasSepoliaUsdc}
                  label="Sepolia USDC"
                  hint={quotedPrice ? `${fromErc20Usdc(quotedPrice)} USDC needed` : "checking price…"}
                  action={
                    <a
                      href="https://faucet.circle.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] text-accent hover:underline"
                    >
                      faucet →
                    </a>
                  }
                />
                <PreflightRow
                  ok={hasArcUsdc}
                  label="Arc USDC"
                  hint="gas + treasury funding, needed later"
                  action={
                    <a
                      href="https://faucet.circle.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] text-accent hover:underline"
                    >
                      faucet →
                    </a>
                  }
                />
              </div>
              <div className="mt-5">
                <Button onClick={handleReserve} disabled={!hasGas || !hasSepoliaUsdc || reserving}>
                  {reserving ? "Reserving…" : "Reserve this name"}
                </Button>
                {reserveError ? <p className="mt-2 text-[12px] text-revoked-strong">{reserveError}</p> : null}
              </div>
            </Card>
          ) : null}

          {/* Step 4 — reveal wait + finalize */}
          {reservation && !createdOrg ? (
            <Card padding="lg">
              <RuleLabel>4 · Create organisation</RuleLabel>
              <p className="mt-3 text-[13px] text-secondary">
                Reserved. ENSv2&rsquo;s own commit-reveal requires a real wait before this can be
                revealed — it reads as deliberate, not slow.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${canFinalize ? "bg-live" : "bg-expiring animate-pulse-live"}`} />
                <span className="font-mono text-[13px] tnum text-primary">
                  {canFinalize
                    ? "Ready"
                    : `${Math.max(0, Number(minCommitmentAge ?? 60n) - elapsedSinceCommit)}s remaining`}
                </span>
              </div>
              {reservationExpired ? (
                <p className="mt-3 text-[12px] text-revoked-strong">
                  This reservation has expired (24h commit window elapsed). Reserve the name again.
                </p>
              ) : expiresIn !== undefined && expiresIn < 3600 ? (
                <p className="mt-2 text-[11px] text-expiring">
                  Expires in {Math.floor(expiresIn / 60)}m — don&rsquo;t leave this tab idle much longer.
                </p>
              ) : null}
              <div className="mt-5">
                <Button onClick={handleFinalize} disabled={!canFinalize || reservationExpired || finalizing}>
                  {finalizing ? "Creating…" : "Create organisation"}
                </Button>
                {finalizeError ? <p className="mt-2 text-[12px] text-revoked-strong">{finalizeError}</p> : null}
              </div>
            </Card>
          ) : null}

          {/* Step 5 — Arc vault */}
          {createdOrg && !vaultCreated ? (
            <Card padding="lg">
              <RuleLabel>5 · Create your Arc vault</RuleLabel>
              <p className="mt-3 text-[13px] text-secondary">
                {createdOrg.orgEnsName} is live on Sepolia. Now deploy its own money-plane
                anchor and treasury on Arc, signed for by an Enforcer key.
              </p>
              <div className="mt-4">
                <Field label="Enforcer address" hint="The platform default works unless you're running your own">
                  <Input
                    mono
                    value={enforcerAddress}
                    onChange={(e) => setEnforcerAddress(e.target.value)}
                    placeholder="0x…"
                  />
                </Field>
              </div>
              <div className="mt-5">
                <Button onClick={handleCreateVault} disabled={!vaultFactory || creatingVault}>
                  {creatingVault ? "Creating vault…" : "Create vault on Arc"}
                </Button>
                {!vaultFactory ? (
                  <p className="mt-2 text-[12px] text-tertiary">
                    Vault factory not configured — you can add this later from the org page.
                  </p>
                ) : null}
                {vaultError ? <p className="mt-2 text-[12px] text-revoked-strong">{vaultError}</p> : null}
              </div>
            </Card>
          ) : null}

          {/* Done */}
          {createdOrg && (vaultCreated || !vaultFactory) ? (
            <Card padding="lg" className="border-live/30 bg-live-subtle">
              <p className="text-[14px] font-medium text-primary">{createdOrg.orgEnsName} is live</p>
              <p className="mt-2 text-[13px] text-secondary">
                Issue its first mandate, fund the treasury, and watch it in the tree.
              </p>
              <div className="mt-4">
                <Button onClick={() => router.push(`/org/${orgEnsName}`)}>Go to {orgEnsName} →</Button>
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PreflightRow({
  ok,
  label,
  hint,
  action,
}: {
  ok: boolean;
  label: string;
  hint: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-surface-2 px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-live" : "bg-revoked"}`} aria-hidden />
        <div>
          <p className="text-[13px] text-primary">{label}</p>
          <p className="text-[11px] text-tertiary">{hint}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
