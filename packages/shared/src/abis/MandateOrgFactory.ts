// Auto-generated from contracts/out/MandateOrgFactory.sol/MandateOrgFactory.json — do not hand-edit.
// Regenerate: cd contracts && forge build, then re-run the extraction (see contracts/README.md).
export const MandateOrgFactoryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "ethRegistrar",
        "type": "address",
        "internalType": "contract IETHRegistrar"
      },
      {
        "name": "deployer",
        "type": "address",
        "internalType": "contract MandateRegistrarDeployer"
      },
      {
        "name": "paymentToken",
        "type": "address",
        "internalType": "contract IERC20"
      },
      {
        "name": "ethNode",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "ethDns",
        "type": "bytes",
        "internalType": "bytes"
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
    "name": "DEPLOYER",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract MandateRegistrarDeployer"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ETH_REGISTRAR",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IETHRegistrar"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PAYMENT_TOKEN",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "abandonOrg",
    "inputs": [
      {
        "name": "commitment",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
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
    "name": "allRegistrars",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
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
    "name": "beginOrg",
    "inputs": [
      {
        "name": "label",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "admin",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "secretSalt",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "commitment",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "registrar",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "orgRootRegistry",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "orgRootNode",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "finalizeOrg",
    "inputs": [
      {
        "name": "commitment",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "registrar",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "pricePaid",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "orgCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "orgs",
    "inputs": [
      {
        "name": "registrar",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "registrar",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "orgRootRegistry",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "admin",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "createdAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "orgRootNode",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "orgEnsName",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "orgsOfAdmin",
    "inputs": [
      {
        "name": "admin",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address[]",
        "internalType": "address[]"
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
    "name": "pending",
    "inputs": [
      {
        "name": "commitment",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "registrar",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "committedAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "admin",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "duration",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "secret",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "label",
        "type": "string",
        "internalType": "string"
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
    "name": "referrer",
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
    "name": "registrarOfNode",
    "inputs": [
      {
        "name": "orgRootNode",
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
    "name": "registrarsPaginated",
    "inputs": [
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "page",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registrationDuration",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
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
    "name": "rescueToken",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "contract IERC20"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setReferrer",
    "inputs": [
      {
        "name": "newReferrer",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setRegistrationDuration",
    "inputs": [
      {
        "name": "duration",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
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
    "name": "OrgAbandoned",
    "inputs": [
      {
        "name": "commitment",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "orgRootNode",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "registrar",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OrgCommitted",
    "inputs": [
      {
        "name": "commitment",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "orgRootNode",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "admin",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "registrar",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "orgRootRegistry",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "label",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "committedAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "duration",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OrgCreated",
    "inputs": [
      {
        "name": "orgRootNode",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "registrar",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "admin",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "orgRootRegistry",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "orgEnsName",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "nameExpiry",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "pricePaid",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
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
    "name": "MandateOrgFactory__CommitmentExpired",
    "inputs": [
      {
        "name": "age",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "maxAge",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateOrgFactory__CommitmentTooNew",
    "inputs": [
      {
        "name": "age",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "minAge",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateOrgFactory__LabelUnavailable",
    "inputs": [
      {
        "name": "label",
        "type": "string",
        "internalType": "string"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateOrgFactory__NoSuchCommitment",
    "inputs": [
      {
        "name": "commitment",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateOrgFactory__NotPendingAdmin",
    "inputs": [
      {
        "name": "caller",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "admin",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "MandateOrgFactory__ZeroAddress",
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
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  }
] as const;
