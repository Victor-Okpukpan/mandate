/**
 * ENSv2 Enhanced Access Control role constants — pulled verbatim from the real ENSv2 source
 * (ensdomains/contracts-v2, main branch: `src/registry/libraries/RegistryRolesLib.sol` and
 * `src/resolver/libraries/PermissionedResolverLib.sol`), not from the ENS docs site, which states
 * "not yet final and may change prior to mainnet deployment." These values MUST mirror
 * `contracts/src/libraries/ENSRoles.sol` exactly — that is the on-chain source of truth this
 * file exists to stay in sync with.
 *
 * Each role occupies one nybble (4 bits); its admin counterpart is the same bit shifted 128 higher.
 * Only regular (non-admin) roles can be granted after a name's registration — admin roles are
 * registration-time only.
 */

// --- PermissionedRegistry roles ---
export const ROLE_REGISTRAR = 1n << 0n;
export const ROLE_REGISTRAR_ADMIN = ROLE_REGISTRAR << 128n;
export const ROLE_REGISTER_RESERVED = 1n << 4n;
export const ROLE_REGISTER_RESERVED_ADMIN = ROLE_REGISTER_RESERVED << 128n;
export const ROLE_SET_PARENT = 1n << 8n;
export const ROLE_SET_PARENT_ADMIN = ROLE_SET_PARENT << 128n;
export const ROLE_UNREGISTER = 1n << 12n;
export const ROLE_UNREGISTER_ADMIN = ROLE_UNREGISTER << 128n;
export const ROLE_RENEW = 1n << 16n;
export const ROLE_RENEW_ADMIN = ROLE_RENEW << 128n;
export const ROLE_SET_SUBREGISTRY = 1n << 20n;
export const ROLE_SET_SUBREGISTRY_ADMIN = ROLE_SET_SUBREGISTRY << 128n;
export const ROLE_SET_RESOLVER = 1n << 24n;
export const ROLE_SET_RESOLVER_ADMIN = ROLE_SET_RESOLVER << 128n;
/** Admin-only — there is no regular variant. Never grant this to an agent: it is what makes a mandate soulbound. */
export const ROLE_CAN_TRANSFER_ADMIN = (1n << 28n) << 128n;
/** Non-revokable tag set by the registry itself; never pass this in a caller-supplied roleBitmap. */
export const ROLE_WAS_RESERVED = 1n << 32n;
export const ROLE_SET_URI = 1n << 36n;
export const ROLE_SET_URI_ADMIN = ROLE_SET_URI << 128n;
export const ROLE_CAN_NAME = 1n << 120n;
export const ROLE_CAN_NAME_ADMIN = ROLE_CAN_NAME << 128n;
export const ROLE_UPGRADE = 1n << 124n;
export const ROLE_UPGRADE_ADMIN = ROLE_UPGRADE << 128n;

// --- PermissionedResolver roles ---
export const ROLE_SET_ADDR = 1n << 0n;
export const ROLE_SET_ADDR_ADMIN = ROLE_SET_ADDR << 128n;
export const ROLE_SET_TEXT = 1n << 4n;
export const ROLE_SET_TEXT_ADMIN = ROLE_SET_TEXT << 128n;
export const ROLE_SET_CONTENTHASH = 1n << 8n;
export const ROLE_SET_CONTENTHASH_ADMIN = ROLE_SET_CONTENTHASH << 128n;
export const ROLE_SET_PUBKEY = 1n << 12n;
export const ROLE_SET_PUBKEY_ADMIN = ROLE_SET_PUBKEY << 128n;
export const ROLE_SET_ABI = 1n << 16n;
export const ROLE_SET_ABI_ADMIN = ROLE_SET_ABI << 128n;
export const ROLE_SET_INTERFACE = 1n << 20n;
export const ROLE_SET_INTERFACE_ADMIN = ROLE_SET_INTERFACE << 128n;
export const ROLE_SET_NAME = 1n << 24n;
export const ROLE_SET_NAME_ADMIN = ROLE_SET_NAME << 128n;
/** Root-only, never granted per-name. */
export const ROLE_SET_ALIAS = 1n << 28n;
export const ROLE_SET_ALIAS_ADMIN = ROLE_SET_ALIAS << 128n;
export const ROLE_CLEAR = 1n << 32n;
export const ROLE_CLEAR_ADMIN = ROLE_CLEAR << 128n;
export const ROLE_SET_DATA = 1n << 36n;
export const ROLE_SET_DATA_ADMIN = ROLE_SET_DATA << 128n;

export const ROOT_RESOURCE = 0n;

/**
 * The mandate's registry-level role bitmap: deliberately empty. The agent gets zero registry
 * roles — soulbound (no ROLE_CAN_TRANSFER_ADMIN), self-expiring (no ROLE_RENEW), and unable to
 * repoint its own resolver or subregistry (no ROLE_SET_RESOLVER / ROLE_SET_SUBREGISTRY). Every
 * capability the agent has lives on the resolver, scoped per-key by `authorizeTextRoles`.
 */
export const MANDATE_REGISTRY_ROLE_BITMAP = 0n;

/**
 * The resolver-instance root bitmap granted to `MandateRegistrar` at `initialize()` — root-scoped
 * on THIS resolver instance only, so it never leaks authority over any other agent's resolver.
 * Includes both the ADMIN bits (to call `authorizeTextRoles`/`authorizeAddrRoles`/
 * `authorizeDataRoles` for later amendments) and the regular bits (to call `setText`/`setAddr`/
 * `setData` directly, e.g. `bindIdentity`'s post-issuance ERC-8004 write) — the admin variant
 * alone only grants the right to delegate the permission to someone else, not to hold it.
 */
export const MANDATE_RESOLVER_ROOT_ROLE_BITMAP =
  ROLE_SET_TEXT |
  ROLE_SET_TEXT_ADMIN |
  ROLE_SET_ADDR |
  ROLE_SET_ADDR_ADMIN |
  ROLE_SET_DATA |
  ROLE_SET_DATA_ADMIN |
  ROLE_UPGRADE |
  ROLE_UPGRADE_ADMIN;
