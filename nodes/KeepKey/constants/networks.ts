/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Network configuration for various blockchains
 */

export interface BitcoinNetwork {
  name: string;
  messagePrefix: string;
  bip32: {
    public: number;
    private: number;
  };
  pubKeyHash: number;
  scriptHash: number;
  wif: number;
  bech32?: string;
}

export interface EthereumNetwork {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface CosmosNetwork {
  name: string;
  chainId: string;
  rpcUrl: string;
  restUrl: string;
  denom: string;
  prefix: string;
}

/**
 * Bitcoin networks
 */
export const BITCOIN_NETWORKS: Record<string, BitcoinNetwork> = {
  mainnet: {
    name: 'mainnet',
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4,
    },
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    bech32: 'bc',
  },
  testnet: {
    name: 'testnet',
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    bech32: 'tb',
  },
};

/**
 * Ethereum networks
 */
export const ETHEREUM_NETWORKS: Record<string, EthereumNetwork> = {
  mainnet: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  goerli: {
    name: 'Goerli Testnet',
    chainId: 5,
    rpcUrl: 'https://goerli.infura.io/v3/',
    explorer: 'https://goerli.etherscan.io',
    nativeCurrency: {
      name: 'Goerli Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  sepolia: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: 'https://sepolia.infura.io/v3/',
    explorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    rpcUrl: 'https://mainnet.optimism.io',
    explorer: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  avalanche: {
    name: 'Avalanche C-Chain',
    chainId: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorer: 'https://snowtrace.io',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18,
    },
  },
  bsc: {
    name: 'BNB Smart Chain',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
  },
};

/**
 * Cosmos networks
 */
export const COSMOS_NETWORKS: Record<string, CosmosNetwork> = {
  mainnet: {
    name: 'Cosmos Hub',
    chainId: 'cosmoshub-4',
    rpcUrl: 'https://rpc.cosmos.network',
    restUrl: 'https://lcd.cosmos.network',
    denom: 'uatom',
    prefix: 'cosmos',
  },
  testnet: {
    name: 'Cosmos Testnet',
    chainId: 'theta-testnet-001',
    rpcUrl: 'https://rpc.sentry-01.theta-testnet.polypore.xyz',
    restUrl: 'https://rest.sentry-01.theta-testnet.polypore.xyz',
    denom: 'uatom',
    prefix: 'cosmos',
  },
};

/**
 * THORChain networks
 */
export const THORCHAIN_NETWORKS: Record<string, CosmosNetwork> = {
  mainnet: {
    name: 'THORChain',
    chainId: 'thorchain-mainnet-v1',
    rpcUrl: 'https://rpc.thorchain.info',
    restUrl: 'https://thornode.thorchain.info',
    denom: 'rune',
    prefix: 'thor',
  },
  stagenet: {
    name: 'THORChain Stagenet',
    chainId: 'thorchain-stagenet-v2',
    rpcUrl: 'https://stagenet-rpc.ninerealms.com',
    restUrl: 'https://stagenet-thornode.ninerealms.com',
    denom: 'rune',
    prefix: 'sthor',
  },
};

/**
 * Osmosis networks
 */
export const OSMOSIS_NETWORKS: Record<string, CosmosNetwork> = {
  mainnet: {
    name: 'Osmosis',
    chainId: 'osmosis-1',
    rpcUrl: 'https://rpc.osmosis.zone',
    restUrl: 'https://lcd.osmosis.zone',
    denom: 'uosmo',
    prefix: 'osmo',
  },
  testnet: {
    name: 'Osmosis Testnet',
    chainId: 'osmo-test-5',
    rpcUrl: 'https://rpc.testnet.osmosis.zone',
    restUrl: 'https://lcd.testnet.osmosis.zone',
    denom: 'uosmo',
    prefix: 'osmo',
  },
};

/**
 * ShapeShift API endpoints
 */
export const SHAPESHIFT_ENDPOINTS = {
  API_URL: 'https://api.shapeshift.com',
  QUOTE: '/api/v1/quote',
  SWAP: '/api/v1/swap',
  STATUS: '/api/v1/status',
  ASSETS: '/api/v1/assets',
  RATES: '/api/v1/rates',
};

/**
 * Get network configuration
 */
export function getNetworkConfig(
  coin: string,
  network: string,
): BitcoinNetwork | EthereumNetwork | CosmosNetwork | null {
  const coinUpper = coin.toUpperCase();
  const networkLower = network.toLowerCase();
  
  if (coinUpper === 'BTC' || coinUpper === 'BITCOIN') {
    return BITCOIN_NETWORKS[networkLower] || null;
  }
  
  if (coinUpper === 'ETH' || coinUpper === 'ETHEREUM') {
    return ETHEREUM_NETWORKS[networkLower] || null;
  }
  
  if (coinUpper === 'ATOM' || coinUpper === 'COSMOS') {
    return COSMOS_NETWORKS[networkLower] || null;
  }
  
  if (coinUpper === 'RUNE' || coinUpper === 'THORCHAIN') {
    return THORCHAIN_NETWORKS[networkLower] || null;
  }
  
  if (coinUpper === 'OSMO' || coinUpper === 'OSMOSIS') {
    return OSMOSIS_NETWORKS[networkLower] || null;
  }
  
  return null;
}

/**
 * Get explorer URL for a coin
 */
export function getExplorerUrl(coin: string, network: string = 'mainnet'): string {
  const config = getNetworkConfig(coin, network);
  if (config && 'explorer' in config) {
    return config.explorer;
  }
  return '';
}
