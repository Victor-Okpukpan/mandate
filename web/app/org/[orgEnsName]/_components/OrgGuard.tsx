"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { SkeletonRows } from "@mandate/ui/components/Skeleton";
import { useSelectedOrg } from "@/lib/useSelectedOrg";

/**
 * Hard gate on every `/org/[orgEnsName]/*` route: an org is only usable once its Arc vault exists.
 * A half-built org (registered on ENS, no vault — onboarding abandoned partway) bounces back to
 * `/onboard`, which resumes at the vault step. `notFound` is left alone — the page itself renders
 * `OrgNotFound` for that.
 */
export function OrgGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams<{ orgEnsName: string }>();
  const orgEnsName = decodeURIComponent(params.orgEnsName);
  const { org, loading, notFound } = useSelectedOrg(orgEnsName);

  const halfBuilt = Boolean(org && !org.vault);

  useEffect(() => {
    if (halfBuilt) router.replace("/onboard");
  }, [halfBuilt, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <SkeletonRows rows={5} />
      </div>
    );
  }

  if (halfBuilt) return null;
  if (notFound) return <>{children}</>;

  return <>{children}</>;
}
