// Auto-generated from contracts/out/MandateRegistrarDeployer.sol/MandateRegistrarDeployer.json — do not hand-edit.
// Regenerate: cd contracts && forge build, then re-run the extraction (see contracts/README.md).
export const MandateRegistrarDeployerAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "verifiableFactory",
        "type": "address",
        "internalType": "contract IVerifiableFactory"
      },
      {
        "name": "userRegistryImpl",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "resolverImpl",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "RESOLVER_IMPL",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "USER_REGISTRY_IMPL",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "VERIFIABLE_FACTORY",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IVerifiableFactory"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deploy",
    "inputs": [
      {
        "name": "orgRootNode",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "orgRootDnsEncoded",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "orgEnsName",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "initialOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "registrar",
        "type": "address",
        "internalType": "contract MandateRegistrar"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "RegistrarDeployed",
    "inputs": [
      {
        "name": "registrar",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "initialOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "orgRootNode",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  }
] as const;
