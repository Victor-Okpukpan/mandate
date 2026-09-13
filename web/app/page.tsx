"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { motion } from "motion/react";
import { Button } from "@mandate/ui/components/Button";
import { Card } from "@mandate/ui/components/Card";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { Display, Eyebrow, Lede } from "@mandate/ui/components/Type";
import { SkeletonRows } from "@mandate/ui/components/Skeleton";
import { fadeUp, stagger } from "@mandate/ui/lib/motion";
import { useOrgs } from "@/lib/useOrgs";

/**
 * The org directory — every organisation `MandateOrgFactory` has ever created, read live from its
 * own `OrgCreated` logs (see `useOrgs`). This is what HOW-IT-WORKS.md §4 means by "a public
 * directory of orgs... the 'authority is a public lookup' thesis made visible at the top level" —
 * before self-serve onboarding existed, `/` was one org's own dashboard; now it's the index that
 * lets a visitor find (or create) theirs.
 *
 * Every org here stays visible to everyone, deliberately — that's the whole point of a public,
 * ENS-based authority record, not an oversight to lock down. The "Mine" filter below is purely a
 * client-side convenience for an admin with several orgs to find their own faster; it changes
 * nothing about who can see or read what.
 */
export default function OrgDirectoryPage() {
  const { orgs, loading, factoryConfigured } = useOrgs();
  const { address } = useAccount();
  const [mineOnly, setMineOnly] = useState(false);

  const visibleOrgs = useMemo(() => {
    if (!mineOnly || !address) return orgs;
    return orgs.filter((org) => org.admin.toLowerCase() === address.toLowerCase());
  }, [orgs, mineOnly, address]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <motion.div variants={stagger()} initial="hidden" animate="visible">
        <motion.div variants={fadeUp}>
          <Eyebrow>Every organisation, public</Eyebrow>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Display as="h1" size="md" className="mt-2">
            Organisations
          </Display>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Lede className="mt-3">
            Each org owns its own registry, independently — nobody else, including this site, can
            issue a mandate under it. Connect a wallet, pick a name, and yours joins this list.
          </Lede>
        </motion.div>
        <motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center gap-4">
          <Link href="/onboard">
            <Button>Create an organisation →</Button>
          </Link>
          {!loading && orgs.length > 0 ? (
            <div className="inline-flex rounded-lg border border-border-subtle p-0.5">
              {(
                [
                  ["all", "All"],
                  ["mine", "Mine"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMineOnly(id === "mine")}
                  disabled={id === "mine" && !address}
                  title={id === "mine" && !address ? "Connect a wallet to filter to your own orgs" : undefined}
                  className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                    (id === "mine") === mineOnly ? "bg-surface-2 text-primary" : "text-tertiary hover:text-secondary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </motion.div>
      </motion.div>

      <div className="mt-10">
        {loading ? (
          <Card padding="lg">
            <SkeletonRows rows={4} />
          </Card>
        ) : !factoryConfigured && orgs.length === 0 ? (
          <Card padding="lg" className="border-dashed text-center">
            <p className="text-[14px] font-medium text-primary">No org factory configured</p>
            <p className="mt-2 text-[13px] leading-relaxed text-tertiary">
              Set{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">
                NEXT_PUBLIC_MANDATE_ORG_FACTORY
              </code>{" "}
              once the platform factories have been deployed — see{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">contracts/README.md</code>.
            </p>
          </Card>
        ) : orgs.length === 0 ? (
          <Card padding="lg" className="border-dashed text-center">
            <p className="text-[14px] font-medium text-primary">No organisations yet</p>
            <p className="mt-2 text-[13px] text-tertiary">Be the first — it takes one wallet and one name.</p>
          </Card>
        ) : visibleOrgs.length === 0 ? (
          <Card padding="lg" className="border-dashed text-center">
            <p className="text-[14px] font-medium text-primary">You don&rsquo;t administer any organisations</p>
            <p className="mt-2 text-[13px] text-tertiary">
              None of the {orgs.length} organisation{orgs.length === 1 ? "" : "s"} here have this
              wallet as their admin.
            </p>
          </Card>
        ) : (
          <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2">
            {visibleOrgs.map((org) => (
              <motion.div key={org.registrar} variants={fadeUp}>
                <Link href={`/org/${org.orgEnsName}`} className="block h-full">
                  <Card padding="lg" className="h-full transition-shadow duration-300 hover:shadow-md">
                    <p className="font-mono text-[15px] font-medium text-primary">{org.orgEnsName}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-[12px] text-tertiary">
                      admin
                      <MonoValue value={org.admin} className="text-secondary" />
                    </p>
                    <p className="mt-3 flex items-center gap-1.5 text-[11px]">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${org.vault ? "bg-live" : "bg-stale"}`}
                        aria-hidden
                      />
                      <span className={org.vault ? "text-live" : "text-tertiary"}>
                        {org.vault ? "Arc vault live" : "No Arc vault yet"}
                      </span>
                    </p>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
