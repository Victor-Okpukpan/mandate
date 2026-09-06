"use client";

import Link from "next/link";
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
 */
export default function OrgDirectoryPage() {
  const { orgs, loading, factoryConfigured } = useOrgs();

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
        <motion.div variants={fadeUp} className="mt-6">
          <Link href="/onboard">
            <Button>Create an organisation →</Button>
          </Link>
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
        ) : (
          <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2">
            {orgs.map((org) => (
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
