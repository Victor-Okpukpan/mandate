import Link from "next/link";
import { Nav } from "./_components/Nav";
import { Footer } from "./_components/Footer";
import { KillSequenceHero } from "./_components/KillSequenceHero";
import { PlaneCard } from "./_components/PlaneCard";
import { ProofCard } from "./_components/ProofCard";
import { StepCard } from "./_components/StepCard";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.runmandate.xyz";

const BUILT_ON = ["ENSv2", "Arc", "Privy", "ERC-8004", "ERC-8183"];

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        {/* ---------------------------------------------------------------- HERO */}
        <section className="relative overflow-hidden">
          <div className="bg-grid-texture bg-radial-wash absolute inset-0" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28">
            <div className="grid gap-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
              <div className="animate-rise-in">
                <p className="font-mono text-[13px] uppercase tracking-wide text-tertiary">
                  Agent identity &amp; spend control · ENSv2 + Arc + Privy
                </p>
                <h1 className="mt-5 text-display-lg font-semibold leading-[1.04] tracking-display text-primary">
                  ENS subnames are revocable powers of attorney for AI agents.
                  <span className="text-tertiary"> Arc is where they spend.</span>
                </h1>
                <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-secondary">
                  An organization issues each agent a subname that is non-transferable,
                  self-expiring, and instantly revocable. The subname&rsquo;s resolver records{" "}
                  <em className="text-primary not-italic">are</em> the mandate — its budget, its
                  allowlist, its expiry. Revoke the role, and the agent&rsquo;s next payment dies
                  mid-flight.
                </p>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <a
                    href={APP_URL}
                    className="inline-flex h-12 items-center rounded-lg bg-accent px-6 text-[15px] font-medium text-on-accent shadow-sm transition-colors hover:bg-accent-strong"
                  >
                    Launch the observatory →
                  </a>
                  <Link
                    href="/docs/architecture"
                    className="inline-flex h-12 items-center rounded-lg border border-border px-6 text-[15px] font-medium text-secondary transition-colors hover:border-border-strong hover:text-primary"
                  >
                    Read the architecture
                  </Link>
                </div>
              </div>

              {/* The dark observatory, floating as a product shot — the light/dark split IS the
                  pitch: Safe floats screenshots on a light hero, and MANDATE's real dark app is
                  exactly that asset. */}
              <div
                data-theme="dark"
                className="relative mx-auto w-full max-w-md rotate-1 rounded-2xl border border-border bg-surface p-2 shadow-xl transition-transform hover:rotate-0"
              >
                <div className="flex items-center gap-1.5 px-3 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-revoked/60" aria-hidden />
                  <span className="h-2.5 w-2.5 rounded-full bg-expiring/60" aria-hidden />
                  <span className="h-2.5 w-2.5 rounded-full bg-live/60" aria-hidden />
                  <span className="ml-2 font-mono text-[11px] text-tertiary">
                    app.runmandate.xyz
                  </span>
                </div>
                <div className="rounded-xl bg-base p-6">
                  <KillSequenceHero />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ BUILT ON */}
        <section className="border-y border-border-subtle bg-surface-2/50 py-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6">
            <span className="font-mono text-[11px] uppercase tracking-wide text-tertiary">
              Built on
            </span>
            {BUILT_ON.map((name) => (
              <span key={name} className="font-mono text-sm font-medium text-tertiary">
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- THREE PLANES */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-display-sm font-semibold tracking-tight text-primary">
              Three planes, one source of truth
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-secondary">
              Identity and permissions belong on Ethereum, where they&rsquo;re portable and
              legible. High-frequency machine payments belong on a chain where gas is USDC and
              settlement is deterministic. Splitting the two is the design, not a compromise.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
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

        {/* ---------------------------------------------------------- HOW IT WORKS (dark turn) */}
        <section data-theme="dark" className="bg-base py-24">
          <div className="mx-auto max-w-6xl px-6">
            <p className="font-mono text-[13px] uppercase tracking-wide text-accent">
              Inside the observatory
            </p>
            <h2 className="mt-3 text-display-sm font-semibold tracking-tight text-primary">
              How a mandate moves
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
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

        {/* --------------------------------------------------------------- PROOF */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-display-sm font-semibold tracking-tight text-primary">
              &ldquo;Privy already does scoped permissions — why a chain?&rdquo;
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-secondary">
              The question every judge who knows Privy will ask. Three answers, all citable
              against Privy&rsquo;s own documentation.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
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
                    <em className="text-primary not-italic">after</em> a request is signed, not
                    before — concurrent spends can both pass. The on-chain ledger closes that
                    window.
                  </>
                }
              />
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- FAIL CLOSED */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="relative overflow-hidden rounded-2xl border border-stale/30 bg-stale-subtle p-9 shadow-md sm:p-12">
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-stale opacity-[0.12] blur-3xl"
                aria-hidden
              />
              <p className="relative font-mono text-[13px] font-medium uppercase tracking-wide text-stale-strong">
                The Enforcer trust model
              </p>
              <h2 className="relative mt-4 max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-primary sm:text-3xl">
                A dead or censored Enforcer freezes every agent. It doesn&rsquo;t free them.
              </h2>
              <p className="relative mt-5 max-w-2xl text-[15px] leading-relaxed text-secondary">
                <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[13px] text-primary">
                  assertSpend
                </code>{" "}
                reverts if the anchor hasn&rsquo;t been synced or heartbeat-ed within its staleness
                window — on purpose. Most systems that watch a chain fail open when the watcher
                goes down. This one doesn&rsquo;t.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- TRACKS */}
        <section className="border-t border-border-subtle bg-surface-2/50 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-display-sm font-semibold tracking-tight text-primary">
              Built on, not decorated with
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              <Link
                href="/docs/ens"
                className="group rounded-2xl border border-border bg-surface p-7 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="text-lg font-semibold tracking-tight text-primary">ENSv2</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-secondary">
                  Delete the ENS layer and there is no product left. Own registries, per-key
                  resolver rights, and the role-omission table that makes a name soulbound.
                </p>
                <span className="mt-4 inline-block text-[13px] font-medium text-accent group-hover:underline">
                  Read the ENS docs →
                </span>
              </Link>
              <Link
                href="/docs/arc"
                className="group rounded-2xl border border-border bg-surface p-7 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="text-lg font-semibold tracking-tight text-primary">Arc</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-secondary">
                  A revolving USDC credit facility, ERC-8004 reputation, and ERC-8183 job escrow —
                  agents transact unattended, within their mandate.
                </p>
                <span className="mt-4 inline-block text-[13px] font-medium text-accent group-hover:underline">
                  Read the Arc docs →
                </span>
              </Link>
              <Link
                href="/docs/privy"
                className="group rounded-2xl border border-border bg-surface p-7 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="text-lg font-semibold tracking-tight text-primary">Privy</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-secondary">
                  Organization wallets, conditional policies, and intents. Remove Privy and agents
                  cannot sign at all — it&rsquo;s one of two enforcement gates, not a convenience.
                </p>
                <span className="mt-4 inline-block text-[13px] font-medium text-accent group-hover:underline">
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
