import Link from "next/link";
import { Card } from "@mandate/ui/components/Card";

/**
 * Distinct from `NotDeployed`: that component means "the platform's contracts aren't set up
 * yet." This means "the platform is fine, but no org named this exists in its directory" — a
 * mistyped URL or a deleted bookmark, not a deployment problem, so the copy and the fix differ.
 */
export function OrgNotFound({ orgEnsName }: { orgEnsName: string }) {
  return (
    <Card padding="lg" className="max-w-md border-dashed text-center">
      <span className="mx-auto mb-3 block h-2 w-2 rounded-full bg-stale" aria-hidden />
      <p className="text-[14px] font-medium text-primary">No org named &ldquo;{orgEnsName}&rdquo;</p>
      <p className="mt-2 text-[13px] leading-relaxed text-tertiary">
        Nothing in the org directory matches this name — check the link, or{" "}
        <Link href="/" className="text-accent hover:underline">
          browse every org
        </Link>
        .
      </p>
    </Card>
  );
}
