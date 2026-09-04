import Link from "next/link";
import { Nav } from "./_components/Nav";
import { Footer } from "./_components/Footer";
import { KillSequenceHero } from "./_components/KillSequenceHero";
import { PlaneCard } from "./_components/PlaneCard";
import { ProofCard } from "./_components/ProofCard";
import { StepCard } from "./_components/StepCard";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.runmandate.xyz";

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        {/* ---------------------------------------------------------------- HERO */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16">
            <div className="animate-rise-in">
              <p className="font-mono text-[13px] uppercase tracking-wide text-tertiary">
                Agent identity &amp; spend control · ENSv2 + Arc + Privy
              </p>
              <h1 className="mt-4 text-[2.5rem] font-medium leading-[1.08] tracking-tight text-primary sm:text-5xl">
                ENS subnames are revocable powers of attorney for AI agents.
                <span className="text-tertiary"> Arc is where they spend.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-secondary">
                An organization issues each agent a subname that is non-transferable, self-expiring, and
                instantly revocable. The subname&rsquo;s resolver records <em className="text-primary not-italic">are</em>{" "}
                the mandate — its budget, its allowlist, its expiry. Revoke the role, and the agent&rsquo;s next
                payment dies mid-flight.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={APP_URL}
                  className="inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-strong"
                >
                  Launch the observatory →
                </a>
                <Link
                  href="/docs/architecture"
                  className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-medium text-secondary transition-colors hover:border-border-strong hover:text-primary"
                >
                  Read the architecture
                </Link>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="rounded-2xl border border-border-subtle bg-surface p-8">
                <KillSequenceHero />
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- THREE PLANES */}
        <section className="border-t border-border-subtle bg-surface/40 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-xl font-medium text-primary">Three planes, one source of truth</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
              Identity and permissions belong on Ethereum, where they&rsquo;re portable and legible.
              High-frequency machine payments belong on a chain where gas is USDC and settlement is
              deterministic. Splitting the two is the design, not a compromise.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <PlaneCard
                index="01"
                chain="Sepolia"
                title="Authority"
                accentClass="bg-live"
                description="ENSv2 holds what each agent is allowed to do. Nothing else is authoritative — amending a mandate means writing an ENS record, on a name the org's own registry controls."
              />
              <PlaneCard
                index="02"
                chain="Off-chain"
                title="Enforcement"
                accentClass="bg-accent"
                description="The Enforcer watches Sepolia and compiles each mandate into a Privy policy and a signed Arc anchor. A propagator, not an authority — it can only ever narrow, never widen."
              />
              <PlaneCard
                index="03"
                chain="Arc"
                title="Money"
                accentClass="bg-expiring"
                description="Where value actually moves, checked against the anchor on every spend. Gas is USDC, settlement is deterministic, and the agent's own wallet holds almost nothing."
              />
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- PROOF */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-xl font-medium text-primary">
              &ldquo;Privy already does scoped permissions — why a chain?&rdquo;
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
              The question every judge who knows Privy will ask. Three answers, all citable against
              Privy&rsquo;s own documentation.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <ProofCard
                stat="Public"
                label="not private"
                detail="Privy's controls are internal to one app. A vendor can resolve research.acme.eth and check an agent's authority before accepting a job — Privy has no equivalent for a counterparty."
              />
              <ProofCard
                stat="~10"
                label="rolling budgets, per app"
                detail="Privy's stateful policies cap at roughly ten aggregations per app, can't partition by wallet, and top out at a 72-hour window. The chain has no such ceiling."
              />
              <ProofCard
                stat="Race-free"
                label="by construction"
                detail={
                  <>
                    Privy&rsquo;s own docs: aggregation values update{" "}
                    <em className="text-primary not-italic">after</em> a request is signed, not before —
                    concurrent spends can both pass. The on-chain ledger closes that window.
                  </>
                }
              />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- HOW IT WORKS */}
        <section className="border-t border-border-subtle bg-surface/40 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-xl font-medium text-primary">How a mandate moves</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <StepCard
                step={1}
                title="Issue"
                description="The org composes a mandate live: budget, per-tx cap, allowlist, expiry, sub-delegation depth. One ENS subname is minted with its own dedicated resolver — no hard-coded values, ever."
              />
              <StepCard
                step={2}
                title="Attenuate"
                description="An agent can delegate a strictly narrower slice of its own mandate to a sub-agent. Never wider — enforced by the contract's own math, not by convention or trust."
              />
              <StepCard
                step={3}
                title="Spend"
                description="Every payment checks the anchor first: revoked? expired? over the per-tx cap? off the allowlist? stale? Five ways to fail closed, one to succeed."
              />
              <StepCard
                step={4}
                title="Revoke"
                description="One transaction on Sepolia. The Enforcer tears down the Privy policy and flips the Arc anchor — the agent's next payment is refused mid-flight, on-chain."
              />
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- FAIL CLOSED */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="rounded-2xl border border-border bg-surface p-8 sm:p-10">
              <p className="font-mono text-[13px] uppercase tracking-wide text-stale">The Enforcer trust model</p>
              <h2 className="mt-3 text-xl font-medium leading-snug text-primary sm:max-w-xl">
                A dead or censored Enforcer freezes every agent. It doesn&rsquo;t free them.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-secondary">
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-primary">
                  assertSpend
                </code>{" "}
                reverts if the anchor hasn&rsquo;t been synced or heartbeat-ed within its staleness window —
                on purpose. Most systems that watch a chain fail open when the watcher goes down.
                This one doesn&rsquo;t.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- TRACKS */}
        <section className="border-t border-border-subtle py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-xl font-medium text-primary">Built on, not decorated with</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Link
                href="/docs/ens"
                className="group rounded-xl border border-border bg-surface p-6 transition-colors hover:border-border-strong"
              >
                <h3 className="text-[15px] font-medium text-primary">ENSv2</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">
                  Delete the ENS layer and there is no product left. Own registries, per-key
                  resolver rights, and the role-omission table that makes a name soulbound.
                </p>
                <span className="mt-3 inline-block text-[13px] text-accent group-hover:underline">
                  Read the ENS docs →
                </span>
              </Link>
              <Link
                href="/docs/arc"
                className="group rounded-xl border border-border bg-surface p-6 transition-colors hover:border-border-strong"
              >
                <h3 className="text-[15px] font-medium text-primary">Arc</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">
                  A revolving USDC credit facility, ERC-8004 reputation, and ERC-8183 job escrow —
                  agents transact unattended, within their mandate.
                </p>
                <span className="mt-3 inline-block text-[13px] text-accent group-hover:underline">
                  Read the Arc docs →
                </span>
              </Link>
              <Link
                href="/docs/privy"
                className="group rounded-xl border border-border bg-surface p-6 transition-colors hover:border-border-strong"
              >
                <h3 className="text-[15px] font-medium text-primary">Privy</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">
                  Organization wallets, conditional policies, and intents. Remove Privy and agents
                  cannot sign at all — it's one of two enforcement gates, not a convenience.
                </p>
                <span className="mt-3 inline-block text-[13px] text-accent group-hover:underline">
                  Read the Privy docs →
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
