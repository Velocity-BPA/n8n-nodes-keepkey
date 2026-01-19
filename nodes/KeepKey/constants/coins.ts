/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Coin and chain definitions for KeepKey
 */

export interface BitcoinLikeCoin {
  symbol: string;
  name: string;
  slip44: number;
  segwit?: boolean;
  bech32Prefix?: string;
  addressPrefix?: number;
}

export interface EvmChain {
  symbol: string;
  name: string;
  chainId: number;
  rpcUrl?: string;
  explorer?: string;
  nativeCurrency?: string;
}

export interface CosmosChain {
  symbol: string;
  name: string;
  prefix: string;
  slip44: number;
  denom: string;
  chainId?: string;
  rpcUrl?: string;
}

/**
 * Bitcoin and Bitcoin-like coins
 */
export const BITCOIN_LIKE_COINS: Record<string, BitcoinLikeCoin> = {
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    slip44: 0,
    segwit: true,
    bech32Prefix: 'bc',
  },
  LTC: {
    symbol: 'LTC',
    name: 'Litecoin',
    slip44: 2,
    segwit: true,
    bech32Prefix: 'ltc',
  },
  DOGE: {
    symbol: 'DOGE',
    name: 'Dogecoin',
    slip44: 3,
    segwit: false,
  },
  BCH: {
    symbol: 'BCH',
    name: 'Bitcoin Cash',
    slip44: 145,
    segwit: false,
  },
  DASH: {
    symbol: 'DASH',
    name: 'Dash',
    slip44: 5,
    segwit: false,
  },
  DGB: {
    symbol: 'DGB',
    name: 'DigiByte',
    slip44: 20,
    segwit: true,
    bech32Prefix: 'dgb',
  },
};

/**
 * EVM-compatible chains
 */
export const EVM_CHAINS: Record<string, EvmChain> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    nativeCurrency: 'ETH',
  },
  MATIC: {
    symbol: 'MATIC',
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    nativeCurrency: 'MATIC',
  },
  ARB: {
    symbol: 'ARB',
    name: 'Arbitrum',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    nativeCurrency: 'ETH',
  },
  OP: {
    symbol: 'OP',
    name: 'Optimism',
    chainId: 10,
    rpcUrl: 'https://mainnet.optimism.io',
    explorer: 'https://optimistic.etherscan.io',
    nativeCurrency: 'ETH',
  },
  AVAX: {
    symbol: 'AVAX',
    name: 'Avalanche C-Chain',
    chainId: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorer: 'https://snowtrace.io',
    nativeCurrency: 'AVAX',
  },
  BNB: {
    symbol: 'BNB',
    name: 'BNB Smart Chain',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
    nativeCurrency: 'BNB',
  },
  BASE: {
    symbol: 'BASE',
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    nativeCurrency: 'ETH',
  },
};

/**
 * Cosmos-based chains
 */
export const COSMOS_CHAINS: Record<string, CosmosChain> = {
  ATOM: {
    symbol: 'ATOM',
    name: 'Cosmos Hub',
    prefix: 'cosmos',
    slip44: 118,
    denom: 'uatom',
    chainId: 'cosmoshub-4',
  },
  RUNE: {
    symbol: 'RUNE',
    name: 'THORChain',
    prefix: 'thor',
    slip44: 931,
    denom: 'rune',
    chainId: 'thorchain-mainnet-v1',
  },
  OSMO: {
    symbol: 'OSMO',
    name: 'Osmosis',
    prefix: 'osmo',
    slip44: 118,
    denom: 'uosmo',
    chainId: 'osmosis-1',
  },
  KAVA: {
    symbol: 'KAVA',
    name: 'Kava',
    prefix: 'kava',
    slip44: 459,
    denom: 'ukava',
    chainId: 'kava_2222-10',
  },
};

/**
 * All supported coin symbols
 */
export const COIN_SYMBOLS: string[] = [
  ...Object.keys(BITCOIN_LIKE_COINS),
  ...Object.keys(EVM_CHAINS),
  ...Object.keys(COSMOS_CHAINS),
];

/**
 * Bitcoin-like coin symbols
 */
export const BITCOIN_LIKE_SYMBOLS: string[] = Object.keys(BITCOIN_LIKE_COINS);

/**
 * EVM chain options for UI
 */
export const EVM_CHAIN_OPTIONS = Object.entries(EVM_CHAINS).map(([key, chain]) => ({
  name: chain.name,
  value: key,
}));

/**
 * Cosmos chain options for UI
 */
export const COSMOS_CHAIN_OPTIONS = Object.entries(COSMOS_CHAINS).map(([key, chain]) => ({
  name: chain.name,
  value: key,
}));

/**
 * Get coin info
 */
export function getCoinInfo(symbol: string): BitcoinLikeCoin | EvmChain | CosmosChain | null {
  const upperSymbol = symbol.toUpperCase();
  return BITCOIN_LIKE_COINS[upperSymbol] || EVM_CHAINS[upperSymbol] || COSMOS_CHAINS[upperSymbol] || null;
}

/**
 * Check if coin is Bitcoin-like
 */
export function isBitcoinLike(symbol: string): boolean {
  return symbol.toUpperCase() in BITCOIN_LIKE_COINS;
}

/**
 * Check if coin is EVM-based
 */
export function isEvmChain(symbol: string): boolean {
  return symbol.toUpperCase() in EVM_CHAINS;
}

/**
 * Check if coin is Cosmos-based
 */
export function isCosmosChain(symbol: string): boolean {
  return symbol.toUpperCase() in COSMOS_CHAINS;
}
