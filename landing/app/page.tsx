"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Nav } from "./_components/Nav";
import { Footer } from "./_components/Footer";
import { AnnouncementBar } from "./_components/AnnouncementBar";
import { ProductShot } from "./_components/ProductShot";
import { PlaneCard } from "./_components/PlaneCard";
import { ProofCard } from "./_components/ProofCard";
import { StepCard } from "./_components/StepCard";
import { Card } from "@mandate/ui/components/Card";
import { Display, Eyebrow, Lede } from "@mandate/ui/components/Type";
import { fadeUp, stagger, VIEWPORT } from "@mandate/ui/lib/motion";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.runmandate.xyz";

const BUILT_ON = ["ENSv2", "Arc", "Privy", "ERC-8004", "ERC-8183"];

/** A section heading that rises into view once, on scroll — the product's one recurring gesture. */
function SectionHeading({
  eyebrow,
  children,
  lede,
}: {
  eyebrow?: string;
  children: React.ReactNode;
  lede?: React.ReactNode;
}) {
  return (
    <motion.div variants={stagger()} initial="hidden" whileInView="visible" viewport={VIEWPORT}>
      {eyebrow ? (
        <motion.div variants={fadeUp}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </motion.div>
      ) : null}
      <motion.div variants={fadeUp} className={eyebrow ? "mt-3" : ""}>
        <Display as="h2" size="sm">
          {children}
        </Display>
      </motion.div>
      {lede ? (
        <motion.div variants={fadeUp} className="mt-4">
          <Lede>{lede}</Lede>
        </motion.div>
      ) : null}
    </motion.div>
  );
}

export default function LandingPage() {
  return (
    <>
      <Nav />
      <AnnouncementBar />
      <main>
        {/* ---------------------------------------------------------------- HERO
            Centered stack — eyebrow, headline, subtext, one CTA — then the product shot below,
            floating on its own. Matches safe.global's structure: this page had a two-column,
            diagonal-screenshot hero before, which is a different shape entirely. */}
        <section className="relative overflow-hidden">
          <div className="bg-grid-texture bg-radial-wash absolute inset-0" aria-hidden />
          <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-20 text-center sm:pt-28">
            <motion.div variants={stagger()} initial="hidden" animate="visible">
              <motion.div variants={fadeUp}>
                <Eyebrow className="text-center text-[12px]">
                  Agent identity &amp; spend control · ENSv2 + Arc + Privy
                </Eyebrow>
              </motion.div>
              <motion.div variants={fadeUp}>
                <Display as="h1" size="lg" className="mt-5">
                  ENS subnames are revocable powers of attorney for AI agents.
                  <span className="text-tertiary"> Arc is where they spend.</span>
                </Display>
              </motion.div>
              <motion.div variants={fadeUp}>
                <Lede className="mx-auto mt-6 max-w-2xl">
                  A company issues each of its AI agents an ENS subname — think
                  research.acme.eth. That name&rsquo;s records are the agent&rsquo;s entire
                  spending authority: how much, to whom, until when. The agent can read its own
                  limits but cannot edit them. Revoke the name, and its very next payment is
                  refused — before it signs, and again on-chain if it somehow tried.
                </Lede>
              </motion.div>
              <motion.div variants={fadeUp} className="mt-9 flex items-center justify-center">
                <a
                  href={APP_URL}
                  className="inline-flex h-12 items-center rounded-lg bg-accent px-6 text-[15px] font-medium text-on-accent shadow-sm transition-colors hover:bg-accent-strong"
                >
                  Launch app →
                </a>
              </motion.div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="relative px-6 pb-28 pt-6 sm:pb-36"
          >
            <ProductShot />
          </motion.div>
        </section>

        {/* ------------------------------------------------------------ BUILT ON */}
        <section className="border-y border-border-subtle bg-surface-2/50 py-10">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6">
            <Eyebrow className="text-[11px]">Built on</Eyebrow>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {BUILT_ON.map((name) => (
                <span key={name} className="font-mono text-[16px] font-medium text-secondary">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- THREE PLANES */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeading
              lede="Identity and permissions belong on Ethereum, where they're portable and legible.
              High-frequency machine payments belong on a chain where gas is USDC and settlement is
              deterministic. Splitting the two is the design, not a compromise."
            >
              Three planes, one source of truth
            </SectionHeading>
            <motion.div
              variants={stagger(0.1)}
              initial="hidden"
              whileInView="visible"
              viewport={VIEWPORT}
              className="mt-12 grid gap-5 sm:grid-cols-3"
            >
              <motion.div variants={fadeUp}>
                <PlaneCard
                  index="01"
                  chain="Sepolia"
                  title="Authority"
                  accentClass="bg-live"
                  description="ENSv2 holds what each agent is allowed to do. Nothing else is authoritative — amending a mandate means writing an ENS record, on a name the org's own registry controls."
                />
              </motion.div>
              <motion.div variants={fadeUp}>
                <PlaneCard
                  index="02"
                  chain="Off-chain"
                  title="Enforcement"
                  accentClass="bg-accent"
                  description="The Enforcer watches Sepolia and compiles each mandate into a Privy policy and a signed Arc anchor. A propagator, not an authority — it can only ever narrow, never widen."
                />
              </motion.div>
              <motion.div variants={fadeUp}>
                <PlaneCard
                  index="03"
                  chain="Arc"
                  title="Money"
                  accentClass="bg-expiring"
                  description="Where value actually moves, checked against the anchor on every spend. Gas is USDC, settlement is deterministic, and the agent's own wallet holds almost nothing."
                />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ---------------------------------------------------------- HOW IT WORKS (dark turn) */}
        <section data-theme="dark" className="bg-base py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeading eyebrow="Inside the observatory">How a mandate moves</SectionHeading>
            <motion.div
              variants={stagger(0.1)}
              initial="hidden"
              whileInView="visible"
              viewport={VIEWPORT}
              className="mt-12 grid gap-5 sm:grid-cols-2"
            >
              <motion.div variants={fadeUp}>
                <StepCard
                  step={1}
                  title="Issue"
                  description="The org composes a mandate live: budget, per-tx cap, allowlist, expiry, sub-delegation depth. One ENS subname is minted with its own dedicated resolver — no hard-coded values, ever."
                />
              </motion.div>
              <motion.div variants={fadeUp}>
                <StepCard
                  step={2}
                  title="Attenuate"
                  description="An agent can delegate a strictly narrower slice of its own mandate to a sub-agent. Never wider — enforced by the contract's own math, not by convention or trust."
                />
              </motion.div>
              <motion.div variants={fadeUp}>
                <StepCard
                  step={3}
                  title="Spend"
                  description="Every payment checks the anchor first: revoked? expired? over the per-tx cap? off the allowlist? stale? Five ways to fail closed, one to succeed."
                />
              </motion.div>
              <motion.div variants={fadeUp}>
                <StepCard
                  step={4}
                  title="Revoke"
                  description="One transaction on Sepolia. The Enforcer tears down the Privy policy and flips the Arc anchor — the agent's next payment is refused mid-flight, on-chain."
                />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* --------------------------------------------------------------- PROOF */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeading lede="A fair question if you already use Privy for wallet policies. Three concrete limits, straight from Privy's own documentation, and what adding a chain removes.">
              &ldquo;Privy already handles permissions — why add a blockchain?&rdquo;
            </SectionHeading>
            <motion.div
              variants={stagger(0.1)}
              initial="hidden"
              whileInView="visible"
              viewport={VIEWPORT}
              className="mt-12 grid gap-5 sm:grid-cols-3"
            >
              <motion.div variants={fadeUp}>
                <ProofCard
                  stat="Public"
                  label="not private"
                  detail="Privy's controls are internal to one app. A vendor can resolve research.acme.eth and check an agent's authority before accepting a job — Privy has no equivalent for a counterparty."
                />
              </motion.div>
              <motion.div variants={fadeUp}>
                <ProofCard
                  stat="~10"
                  label="rolling budgets, per app"
                  detail="Privy's stateful policies cap at roughly ten aggregations per app, can't partition by wallet, and top out at a 72-hour window. The chain has no such ceiling."
                />
              </motion.div>
              <motion.div variants={fadeUp}>
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
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* -------------------------------------------------------- FAIL CLOSED */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={VIEWPORT}
            >
              <Card padding="lg" elevated className="relative overflow-hidden sm:p-12">
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-stale opacity-[0.08] blur-3xl"
                  aria-hidden
                />
                <p className="relative font-mono text-[12px] font-medium uppercase tracking-label text-stale">
                  The Enforcer trust model
                </p>
                <h2 className="relative mt-4 max-w-2xl font-sans text-[28px] font-semibold leading-[1.15] tracking-tight text-primary sm:text-[34px]">
                  A dead or censored Enforcer freezes every agent. It doesn&rsquo;t free them.
                </h2>
                <p className="relative mt-5 max-w-2xl text-[15px] leading-relaxed text-secondary">
                  <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[13px] text-primary">
                    assertSpend
                  </code>{" "}
                  reverts if the anchor hasn&rsquo;t been synced or heartbeat-ed within its
                  staleness window — on purpose. Most systems that watch a chain fail open when
                  the watcher goes down. This one doesn&rsquo;t.
                </p>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* ------------------------------------------------------------- TRACKS */}
        <section className="border-t border-border-subtle bg-surface-2/50 py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeading>Built on, not decorated with</SectionHeading>
            <motion.div
              variants={stagger(0.1)}
              initial="hidden"
              whileInView="visible"
              viewport={VIEWPORT}
              className="mt-12 grid gap-5 sm:grid-cols-3"
            >
              {[
                {
                  href: "/docs/ens",
                  title: "ENSv2",
                  body: "Delete the ENS layer and there is no product left. Own registries, per-key resolver rights, and the role-omission table that makes a name soulbound.",
                  cta: "Read the ENS docs →",
                },
                {
                  href: "/docs/arc",
                  title: "Arc",
                  body: "A revolving USDC credit facility, ERC-8004 reputation, and ERC-8183 job escrow — agents transact unattended, within their mandate.",
                  cta: "Read the Arc docs →",
                },
                {
                  href: "/docs/privy",
                  title: "Privy",
                  body: "Organization wallets, conditional policies, and intents. Remove Privy and agents cannot sign at all — it's one of two enforcement gates, not a convenience.",
                  cta: "Read the Privy docs →",
                },
              ].map((track) => (
                <motion.div key={track.href} variants={fadeUp}>
                  <Link href={track.href} className="group block h-full">
                    <Card padding="lg" className="h-full transition-shadow duration-300 hover:shadow-md">
                      <h3 className="font-sans text-[22px] font-semibold tracking-tight text-primary">
                        {track.title}
                      </h3>
                      <p className="mt-3 text-[15px] leading-relaxed text-secondary">{track.body}</p>
                      <span className="mt-5 inline-block text-[13px] font-medium text-accent group-hover:underline">
                        {track.cta}
                      </span>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ------------------------------------------------------------- CTA */}
        <section className="bg-mint-grid py-24 sm:py-28">
          <motion.div
            variants={stagger()}
            initial="hidden"
            whileInView="visible"
            viewport={VIEWPORT}
            className="mx-auto max-w-2xl px-6 text-center"
          >
            <motion.div variants={fadeUp}>
              <Display as="h2" size="md">
                Issue your first mandate.
              </Display>
            </motion.div>
            <motion.div variants={fadeUp}>
              <Lede className="mx-auto mt-4 max-w-lg">
                Sign in, provision an agent wallet, and watch a real mandate go live on Sepolia —
                no seed phrase, no testnet faucet hunting.
              </Lede>
            </motion.div>
            <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center">
              <a
                href={APP_URL}
                className="inline-flex h-12 items-center rounded-lg bg-accent px-6 text-[15px] font-medium text-on-accent shadow-sm transition-colors hover:bg-accent-strong"
              >
                Launch app →
              </a>
            </motion.div>
          </motion.div>
        </section>
      </main>
      <Footer />
    </>
  );
}
