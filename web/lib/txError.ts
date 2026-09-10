import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

/**
 * Turns a thrown wallet/RPC error into one short sentence a person can act on. viem errors carry
 * a readable `shortMessage` plus a wall of `metaMessages`, `details`, docs links, and the raw
 * calldata — surfacing all of that (the default `err.message`) is noise. This keeps the one line
 * that matters and names the common cases plainly.
 */
export function formatTxError(err: unknown): string {
  if (err instanceof BaseError) {
    const rejected = err.walk((e) => e instanceof UserRejectedRequestError);
    if (rejected) return "Cancelled in your wallet.";

    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      return name ? `Rejected on-chain: ${name}` : reverted.shortMessage;
    }

    if (/chain (of the wallet|mismatch)|does not match the target chain/i.test(err.message)) {
      return "Wrong network — switching now, try again in a moment.";
    }
    if (/insufficient funds/i.test(err.message)) return "Not enough balance for this transaction.";

    return err.shortMessage || err.message.split("\n")[0]!;
  }

  if (err instanceof Error) return err.message.split("\n")[0]!;
  return String(err);
}
