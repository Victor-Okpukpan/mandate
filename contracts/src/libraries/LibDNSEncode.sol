// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title LibDNSEncode
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Builds ENS/DNS wire-format name bytes entirely on-chain, one label at a time.
/// @dev `PermissionedResolver.authorize{Text,Addr,Data,Name}Roles()` take the *full* DNS-encoded
///      name of the node being configured, not just its `bytes32` node hash. Rather than trust a
///      caller-supplied name (which an adversarial caller could set to a *different* node than the
///      one it hashes to as the target of `authorizeTextRoles`, silently granting write access
///      somewhere else), `MandateRegistrar` derives every descendant name on-chain by prepending
///      its label to the parent's own already-encoded name — starting from the org's root name,
///      handed to the registrar once at deployment and never re-derived from untrusted input again.
library LibDNSEncode {
    error LibDNSEncode__LabelTooLong(uint256 length);
    error LibDNSEncode__EmptyLabel();

    /// @dev A DNS wire-format label length prefix is one byte, so 255 is the hard protocol ceiling.
    uint256 internal constant MAX_LABEL_LENGTH = 255;

    /// @notice Prepend `label` to `parentDnsEncoded`, producing the DNS wire-format name for
    ///         `label.<parent>`.
    /// @dev Deliberately `abi.encodePacked`, not `abi.encode`: this builds an actual DNS wire-format
    ///      byte string — length-prefixed labels concatenated — for `PermissionedResolver` to parse
    ///      as a name, not an ABI tuple. `abi.encode`'s 32-byte padding would produce bytes that no
    ///      longer parse as a valid DNS name at all. This is not a hash-collision risk either: the
    ///      output is only ever passed on to `NameCoder.namehash()`-style DNS parsing (length-prefix
    ///      delimited, unambiguous by construction), never used as a raw pre-image to `keccak256`
    ///      the way a generic `abi.encodePacked` hash input would be.
    /// @param label The immediate child label, e.g. "research" for "research.acme.eth".
    /// @param parentDnsEncoded The parent's own DNS wire-format name, e.g. dnsEncode("acme.eth").
    /// @return dnsEncoded The DNS wire-format name for `label.<parent>`.
    function prependLabel(string memory label, bytes memory parentDnsEncoded)
        internal
        pure
        returns (bytes memory dnsEncoded)
    {
        bytes memory labelBytes = bytes(label);
        uint256 len = labelBytes.length;
        if (len == 0) revert LibDNSEncode__EmptyLabel();
        if (len > MAX_LABEL_LENGTH) revert LibDNSEncode__LabelTooLong(len);

        // forge-lint: disable-next-line(unsafe-typecast)
        // safe: len is checked <= MAX_LABEL_LENGTH above, so it always fits in uint8.
        dnsEncoded = abi.encodePacked(uint8(len), labelBytes, parentDnsEncoded);
    }

    /// @notice The standard ENS namehash of `label.<parent>`, given the parent's own namehash.
    /// @dev `node = keccak256(parentNode, keccak256(label))`. This is the same node
    ///      `NameCoder.namehash()` derives from the DNS-encoded bytes `prependLabel` builds — the
    ///      two representations of the same name always agree, since both descend from the same
    ///      trusted parent state rather than from independently-supplied caller input.
    function namehashChild(bytes32 parentNode, string memory label)
        internal
        pure
        returns (bytes32 node)
    {
        bytes memory labelBytes = bytes(label);
        if (labelBytes.length == 0) revert LibDNSEncode__EmptyLabel();
        if (labelBytes.length > MAX_LABEL_LENGTH) {
            revert LibDNSEncode__LabelTooLong(labelBytes.length);
        }

        node = keccak256(abi.encodePacked(parentNode, keccak256(labelBytes)));
    }
}
