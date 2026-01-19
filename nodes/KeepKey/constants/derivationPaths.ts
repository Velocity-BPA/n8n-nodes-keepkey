/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Derivation path constants and utilities for KeepKey
 */

// BIP purpose codes
export const BIP44_PURPOSE = 44;
export const BIP49_PURPOSE = 49;
export const BIP84_PURPOSE = 84;
export const BIP86_PURPOSE = 86;

// Hardened offset
export const HARDENED_OFFSET = 0x80000000;

/**
 * Address types
 */
export const ADDRESS_TYPES = {
  legacy: 'legacy',
  segwit: 'segwit',
  nativeSegwit: 'nativeSegwit',
  taproot: 'taproot',
} as const;

export type AddressType = (typeof ADDRESS_TYPES)[keyof typeof ADDRESS_TYPES];

/**
 * Derivation templates by coin and type
 */
export const DERIVATION_TEMPLATES: Record<string, Record<string, string>> = {
  BTC: {
    legacy: "m/44'/0'/{account}'/0/{index}",
    segwit: "m/49'/0'/{account}'/0/{index}",
    nativeSegwit: "m/84'/0'/{account}'/0/{index}",
    taproot: "m/86'/0'/{account}'/0/{index}",
  },
  LTC: {
    legacy: "m/44'/2'/{account}'/0/{index}",
    segwit: "m/49'/2'/{account}'/0/{index}",
    nativeSegwit: "m/84'/2'/{account}'/0/{index}",
  },
  DOGE: {
    legacy: "m/44'/3'/{account}'/0/{index}",
  },
  BCH: {
    legacy: "m/44'/145'/{account}'/0/{index}",
  },
  DASH: {
    legacy: "m/44'/5'/{account}'/0/{index}",
  },
  ETH: {
    default: "m/44'/60'/{account}'/0/{index}",
  },
  ATOM: {
    default: "m/44'/118'/{account}'/0/{index}",
  },
  RUNE: {
    default: "m/44'/931'/{account}'/0/{index}",
  },
  OSMO: {
    default: "m/44'/118'/{account}'/0/{index}",
  },
};

export interface ParsedDerivationPath {
  purpose: number;
  coinType: number;
  account: number;
  change: number;
  addressIndex: number;
}

export interface DerivationPathParams {
  purpose: number;
  coinType: number;
  account: number;
  change: number;
  addressIndex: number;
}

/**
 * Parse a derivation path string
 */
export function parseDerivationPath(path: string): ParsedDerivationPath {
  const parts = path.replace('m/', '').split('/');
  
  const parsePart = (part: string): number => {
    const value = parseInt(part.replace(/['h]/g, ''), 10);
    return value;
  };
  
  return {
    purpose: parsePart(parts[0]),
    coinType: parsePart(parts[1]),
    account: parsePart(parts[2]),
    change: parts[3] ? parsePart(parts[3]) : 0,
    addressIndex: parts[4] ? parsePart(parts[4]) : 0,
  };
}

/**
 * Build a derivation path from parameters
 */
export function buildDerivationPath(params: DerivationPathParams): string {
  return `m/${params.purpose}'/${params.coinType}'/${params.account}'/` +
         `${params.change}/${params.addressIndex}`;
}

/**
 * Get derivation path for a coin and address type
 */
export function getDerivationPath(
  coin: string,
  addressType: string = 'legacy',
  account: number = 0,
  index: number = 0,
): string {
  const templates = DERIVATION_TEMPLATES[coin.toUpperCase()];
  if (!templates) {
    throw new Error(`Unknown coin: ${coin}`);
  }
  
  const template = templates[addressType] || templates.default || Object.values(templates)[0];
  return template
    .replace('{account}', account.toString())
    .replace('{index}', index.toString());
}

/**
 * Convert path string to array of indices (with hardened flags)
 */
export function pathStringToArray(path: string): number[] {
  return path
    .replace('m/', '')
    .split('/')
    .map((part) => {
      const isHardened = part.endsWith("'") || part.endsWith('h');
      const value = parseInt(part.replace(/['h]/g, ''), 10);
      return isHardened ? value + HARDENED_OFFSET : value;
    });
}

/**
 * Convert path array to string
 */
export function pathArrayToString(pathArray: number[]): string {
  return (
    'm/' +
    pathArray
      .map((n) => {
        const hardened = n >= HARDENED_OFFSET;
        const value = hardened ? n - HARDENED_OFFSET : n;
        return hardened ? `${value}'` : value.toString();
      })
      .join('/')
  );
}

/**
 * Get coin type from SLIP-44
 */
export function getCoinType(coin: string): number {
  const coinTypes: Record<string, number> = {
    BTC: 0,
    LTC: 2,
    DOGE: 3,
    DASH: 5,
    ETH: 60,
    ATOM: 118,
    RUNE: 931,
  };
  return coinTypes[coin.toUpperCase()] ?? 0;
}

/**
 * Get purpose for address type
 */
export function getPurposeForAddressType(addressType: string): number {
  const purposes: Record<string, number> = {
    legacy: BIP44_PURPOSE,
    segwit: BIP49_PURPOSE,
    nativeSegwit: BIP84_PURPOSE,
    taproot: BIP86_PURPOSE,
    default: BIP44_PURPOSE,
  };
  return purposes[addressType] ?? BIP44_PURPOSE;
}
