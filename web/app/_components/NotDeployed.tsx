import { Card } from "@mandate/ui/components/Card";

export function NotDeployed({ what }: { what: string }) {
  return (
    <Card padding="lg" className="max-w-md border-dashed text-center">
      <span className="mx-auto mb-3 block h-2 w-2 rounded-full bg-stale" aria-hidden />
      <p className="text-[14px] font-medium text-primary">{what} not yet deployed</p>
      <p className="mt-2 text-[13px] leading-relaxed text-tertiary">
        This organisation completed onboarding on Sepolia but never created its Arc vault — step 5
        of the onboarding wizard. Its admin can finish that from the onboarding flow.
      </p>
    </Card>
  );
}
