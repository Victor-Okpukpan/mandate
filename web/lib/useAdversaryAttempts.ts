"use client";

import { useQuery } from "@tanstack/react-query";

export interface AdversaryAttemptsSummary {
  available: boolean;
  total: number;
  succeeded: number;
  blocked: number;
  recent: Array<{ timestamp: string; tool: string; succeeded: boolean; gate?: string; error?: string }>;
}

/** Polls `GET /api/adversary/attempts` — see that route's own NatSpec for what this is and, just
 *  as importantly, what it isn't (a security guarantee). */
export function useAdversaryAttempts() {
  const query = useQuery({
    queryKey: ["adversary-attempts"],
    queryFn: async (): Promise<AdversaryAttemptsSummary> => {
      const res = await fetch("/api/adversary/attempts");
      return res.json();
    },
    refetchInterval: 15_000,
  });
  return { data: query.data, loading: query.isLoading };
}
