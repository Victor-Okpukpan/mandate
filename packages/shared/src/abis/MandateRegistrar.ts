// Auto-generated from contracts/out/MandateRegistrar.sol/MandateRegistrar.json — do not hand-edit.
// Regenerate: cd contracts && forge build, then re-run the extraction (see contracts/README.md).
export const MandateRegistrarAbi = [
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
      },
      {
        "name": "orgRootNode",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "orgRootDnsEncoded_",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "orgEnsName_",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "initialOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ORG_ROOT_NODE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ORG_ROOT_REGISTRY",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IUserRegistry"
      }
    ],
    "stateMutability": "view"
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
    "name": "acceptOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "amendMandate",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "terms",
        "type": "tuple",
        "internalType": "struct MandateRegistrar.MandateTerms",
        "components": [
          {
            "name": "allowlistRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "budgetTotal",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "perTxCap",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "expiry",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "budgetPeriod",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxDepth",
            "type": "uint16",
            "internalType": "uint16"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "attenuate",
    "inputs": [
      {
        "name": "parentNode",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "label",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "subAgentWallet",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "terms",
        "type": "tuple",
        "internalType": "struct MandateRegistrar.MandateTerms",
        "components": [
          {
            "name": "allowlistRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "budgetTotal",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "perTxCap",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "expiry",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "budgetPeriod",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxDepth",
            "type": "uint16",
            "internalType": "uint16"
          }
        ]
      },
      {
        "name": "arcWallet",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "allowHumanJson",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "resolver",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "bindIdentity",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "erc8004Id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "model",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getMandate",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct MandateRegistrar.Mandate",
        "components": [
          {
            "name": "node",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "terms",
            "type": "tuple",
            "internalType": "struct MandateRegistrar.MandateTerms",
            "components": [
              {
                "name": "allowlistRoot",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "budgetTotal",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "perTxCap",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "expiry",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "budgetPeriod",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "maxDepth",
                "type": "uint16",
                "internalType": "uint16"
              }
            ]
          },
          {
            "name": "registry",
            "type": "address",
            "internalType": "contract IUserRegistry"
          },
          {
            "name": "resolver",
            "type": "address",
            "internalType": "contract IPermissionedResolver"
          },
          {
            "name": "tokenId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "agentWallet",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "parentNode",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "label",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "dnsEncodedName",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "committed",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "revoked",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "exists",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "issueMandate",
    "inputs": [
      {
        "name": "label",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "agentWallet",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "terms",
        "type": "tuple",
        "internalType": "struct MandateRegistrar.MandateTerms",
        "components": [
          {
            "name": "allowlistRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "budgetTotal",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "perTxCap",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "expiry",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "budgetPeriod",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxDepth",
            "type": "uint16",
            "internalType": "uint16"
          }
        ]
      },
      {
        "name": "arcWallet",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "allowHumanJson",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "resolver",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "mandateHash",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "orgEnsName",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "orgRootDnsEncoded",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
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
    "name": "pendingOwner",
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
    "name": "principalOf",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
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
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokeMandate",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "reason",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "subRegistryOf",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IUserRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "termsOf",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct MandateRegistrar.MandateTerms",
        "components": [
          {
            "name": "allowlistRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "budgetTotal",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "perTxCap",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "expiry",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "budgetPeriod",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxDepth",
            "type": "uint16",
            "internalType": "uint16"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "IdentityBound",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "erc8004Id",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "model",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MandateAmended",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "termsHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "expiry",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MandateIssued",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "parentNode",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "agentWallet",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "resolver",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "termsHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "expiry",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MandateRevoked",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "revokedBy",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "reason",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferStarted",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SubRegistryDeployed",
    "inputs": [
      {
        "name": "parentNode",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "registry",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "LibDNSEncode__EmptyLabel",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LibDNSEncode__LabelTooLong",
    "inputs": [
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateRegistrar__AgentGrantFailed",
    "inputs": [
      {
        "name": "agentWallet",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateRegistrar__BudgetExceedsHeadroom",
    "inputs": [
      {
        "name": "requested",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "headroom",
        "type": "uint128",
        "internalType": "uint128"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateRegistrar__DepthExhausted",
    "inputs": [
      {
        "name": "parentNode",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateRegistrar__ExpiryExceedsParent",
    "inputs": [
      {
        "name": "requested",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "parentExpiry",
        "type": "uint64",
        "internalType": "uint64"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateRegistrar__ExpiryInPast",
    "inputs": [
      {
        "name": "expiry",
        "type": "uint64",
        "internalType": "uint64"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateRegistrar__MandateAlreadyExists",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateRegistrar__MandateNotFound",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateRegistrar__MandateRevoked",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateRegistrar__NotPrincipal",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "caller",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateRegistrar__ParentExpired",
    "inputs": [
      {
        "name": "parentNode",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateRegistrar__PerTxCapExceedsParent",
    "inputs": [
      {
        "name": "requested",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "parentCap",
        "type": "uint128",
        "internalType": "uint128"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateRegistrar__ZeroAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StringsInsufficientHexLength",
    "inputs": [
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  }
] as const;
