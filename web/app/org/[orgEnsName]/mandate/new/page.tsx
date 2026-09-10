"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import type { OrgWithVault } from "@mandate/shared/orgs";
import { Card } from "@mandate/ui/components/Card";
import { Display, Eyebrow } from "@mandate/ui/components/Type";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { SkeletonRows } from "@mandate/ui/components/Skeleton";
import { useSelectedOrg } from "@/lib/useSelectedOrg";
import { useIsOrgAdmin } from "@/lib/useIsOrgAdmin";
import { OrgNotFound } from "@/app/_components/OrgNotFound";
import { RegisterAgentForm } from "@/app/onboard/_components/RegisterAgentForm";

function RegisterAgent({ org }: { org: OrgWithVault }) {
  const router = useRouter();
  const { isAdmin, owner, isConnected, loading } = useIsOrgAdmin(org.registrar);

  if (!loading && !isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Eyebrow>Admin only</Eyebrow>
        <Display as="h1" size="sm" className="mt-2">
          Not this org&rsquo;s admin
        </Display>
        <Card padding="lg" className="mt-6">
          <p className="text-[14px] text-secondary">
            {isConnected
              ? "The connected wallet isn't this org's admin — only its admin can register an agent."
              : "Connect this org's admin wallet."}
          </p>
          {owner ? (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-tertiary">
              admin
              <MonoValue value={owner} className="text-secondary" />
            </p>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-10 sm:py-14">
      <Display as="h1" size="sm">
        Register an agent
      </Display>
      <p className="mt-2 text-[13px] text-secondary">One signature. The agent&rsquo;s wallet is created for you.</p>
      <Card padding="lg" className="mt-6">
        <RegisterAgentForm
          org={org}
          onDone={() => router.push(`/org/${encodeURIComponent(org.orgEnsName)}`)}
        />
      </Card>
    </div>
  );
}

export default function RegisterAgentPage({ params }: { params: Promise<{ orgEnsName: string }> }) {
  const { orgEnsName } = use(params);
  const { org, loading, notFound } = useSelectedOrg(decodeURIComponent(orgEnsName));

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-6 py-10 sm:py-14">
        <SkeletonRows rows={3} />
      </div>
    );
  }

  if (notFound || !org) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6">
        <OrgNotFound orgEnsName={decodeURIComponent(orgEnsName)} />
      </div>
    );
  }

  return <RegisterAgent org={org} />;
}
