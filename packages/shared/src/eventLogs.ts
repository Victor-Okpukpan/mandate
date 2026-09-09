/**
 * `eth_getLogs` on every public RPC this project uses (publicnode.com, Arc's own endpoint) caps
 * the block range of a single call — publicnode.com's Sepolia endpoint enforces 50,000 blocks,
 * confirmed live ("exceed maximum block range: 50000"). `viem`'s `getContractEvents` does not
 * chunk large ranges itself; a caller that passes a fixed `fromBlock` and `toBlock: "latest"`
 * works only until `latest - fromBlock` exceeds the cap, then fails on every future call —
 * inevitable given a fixed `fromBlock`, since `latest` only grows. At Sepolia's ~7,200 blocks/day,
 * that is a matter of days, not "eventually" — this was found live, not theorized.
 *
 * This is the one place that calls `getContractEvents` with a range wide enough to matter; every
 * caller (`orgs.ts`, `web/lib/useMandateGraph.ts`, `web/lib/useOrgs.ts`, `web/lib/useJobsFeed.ts`,
 * `enforcer/src/watcher.ts`) should go through this instead of calling `getContractEvents`
 * directly whenever the range isn't already known to be small.
 */
import type { Abi, Address, ContractEventName, GetContractEventsParameters, GetContractEventsReturnType, PublicClient } from "viem";

const DEFAULT_CHUNK_BLOCKS = 45_000n; // under the observed 50k cap, with margin for a stricter provider

export async function getContractEventsChunked<
  const abi extends Abi | readonly unknown[],
  eventName extends ContractEventName<abi> | undefined = undefined,
>(
  client: PublicClient,
  params: Omit<GetContractEventsParameters<abi, eventName>, "fromBlock" | "toBlock"> & {
    address: Address;
    /** `"earliest"` is accepted but discouraged — prefer the real deployment/creation block of
     *  the contract being read; genesis-to-latest on a multi-million-block chain is exactly the
     *  range this function exists to avoid needing in the first place. */
    fromBlock: bigint | "earliest";
    chunkBlocks?: bigint;
  },
): Promise<GetContractEventsReturnType<abi, eventName>> {
  const { fromBlock, chunkBlocks = DEFAULT_CHUNK_BLOCKS, ...rest } = params;
  const latest = await client.getBlockNumber();
  let from = fromBlock === "earliest" ? 0n : fromBlock;
  if (from > latest) return [] as GetContractEventsReturnType<abi, eventName>;

  const allLogs: GetContractEventsReturnType<abi, eventName> = [];
  while (from <= latest) {
    const to = from + chunkBlocks - 1n > latest ? latest : from + chunkBlocks - 1n;
    const logs = await client.getContractEvents({
      ...rest,
      fromBlock: from,
      toBlock: to,
    } as GetContractEventsParameters<abi, eventName>);
    allLogs.push(...(logs as GetContractEventsReturnType<abi, eventName>));
    from = to + 1n;
  }
  return allLogs;
}
