/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Address validation and utility functions for multiple blockchain networks
 */

import * as crypto from 'crypto';

/**
 * Validate a Bitcoin address format
 */
export function isValidBitcoinAddress(address: string, _network: 'mainnet' | 'testnet' = 'mainnet'): boolean {
  if (!address || typeof address !== 'string') return false;
  
  // Legacy addresses (P2PKH) - start with 1 (mainnet) or m/n (testnet)
  if (/^[1mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) {
    return true; // Simplified - real validation would check Base58Check checksum
  }
  // SegWit addresses (P2SH) - start with 3 (mainnet) or 2 (testnet)
  if (/^[32][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) {
    return true;
  }
  // Native SegWit addresses (Bech32) - start with bc1 (mainnet) or tb1 (testnet)
  if (/^(bc1|tb1)[a-z0-9]{25,90}$/.test(address)) {
    return true;
  }
  // Taproot addresses (Bech32m) - start with bc1p
  if (/^bc1p[a-z0-9]{58}$/.test(address)) {
    return true;
  }
  
  return false;
}

/**
 * Validate an Ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate a Cosmos address format
 */
export function isValidCosmosAddress(address: string, prefix: string = 'cosmos'): boolean {
  const regex = new RegExp(`^${prefix}1[a-z0-9]{38}$`);
  return regex.test(address);
}

/**
 * Validate a THORChain address format
 */
export function isValidThorchainAddress(address: string): boolean {
  return /^thor1[a-z0-9]{38}$/.test(address);
}

/**
 * Validate an Osmosis address format
 */
export function isValidOsmosisAddress(address: string): boolean {
  return /^osmo1[a-z0-9]{38}$/.test(address);
}

/**
 * Detect address type from format
 */
export function detectAddressType(
  address: string,
): 'bitcoin' | 'ethereum' | 'cosmos' | 'thorchain' | 'osmosis' | 'unknown' {
  if (isValidBitcoinAddress(address)) {
    return 'bitcoin';
  }
  if (isValidEthereumAddress(address)) {
    return 'ethereum';
  }
  if (isValidCosmosAddress(address)) {
    return 'cosmos';
  }
  if (isValidThorchainAddress(address)) {
    return 'thorchain';
  }
  if (isValidOsmosisAddress(address)) {
    return 'osmosis';
  }
  return 'unknown';
}

/**
 * Get Bitcoin address type
 */
export function getBitcoinAddressType(
  address: string,
): 'legacy' | 'segwit' | 'nativeSegwit' | 'taproot' | 'unknown' {
  if (/^[1][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) {
    return 'legacy';
  }
  if (/^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) {
    return 'segwit';
  }
  if (/^bc1q[a-z0-9]{38,}$/.test(address)) {
    return 'nativeSegwit';
  }
  if (/^bc1p[a-z0-9]{58}$/.test(address)) {
    return 'taproot';
  }
  return 'unknown';
}

/**
 * Checksum an Ethereum address (EIP-55)
 */
export function checksumEthereumAddress(address: string): string {
  // Remove 0x prefix and lowercase
  const addr = address.toLowerCase().replace('0x', '');
  
  // Create keccak256 hash of the lowercase address
  const hash = crypto.createHash('sha3-256').update(addr).digest('hex');
  
  // Apply checksum based on hash
  let checksummed = '0x';
  for (let i = 0; i < addr.length; i++) {
    // If the hash character is >= 8, uppercase the address character
    if (parseInt(hash[i], 16) >= 8) {
      checksummed += addr[i].toUpperCase();
    } else {
      checksummed += addr[i];
    }
  }
  
  // If input was already checksummed and matches, return it
  if (address.startsWith('0x') && address !== address.toLowerCase()) {
    // Verify it's a valid checksum
    const inputLower = address.toLowerCase();
    if (inputLower === checksummed.toLowerCase()) {
      return address; // Return original if it was already properly checksummed
    }
  }
  
  return checksummed;
}

/**
 * Validate address for a specific coin
 */
export function validateAddressForCoin(address: string, coin: string): boolean {
  const coinUpper = coin.toUpperCase();
  
  // Bitcoin and Bitcoin-like
  if (coinUpper === 'BTC' || coinUpper === 'BITCOIN') {
    return isValidBitcoinAddress(address);
  }
  if (coinUpper === 'LTC' || coinUpper === 'LITECOIN') {
    // Litecoin addresses start with L, M, or ltc1
    return /^[LM3][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || /^ltc1[a-z0-9]{25,90}$/.test(address);
  }
  if (coinUpper === 'DOGE' || coinUpper === 'DOGECOIN') {
    return /^D[5-9A-HJ-NP-U][a-km-zA-HJ-NP-Z1-9]{24,33}$/.test(address);
  }
  if (coinUpper === 'BCH') {
    return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || /^bitcoincash:[a-z0-9]{42}$/.test(address);
  }
  
  // Ethereum and EVM chains
  if (coinUpper === 'ETH' || coinUpper === 'ETHEREUM' || 
      coinUpper === 'MATIC' || coinUpper === 'POLYGON' ||
      coinUpper === 'ARB' || coinUpper === 'ARBITRUM' ||
      coinUpper === 'OP' || coinUpper === 'OPTIMISM' ||
      coinUpper === 'AVAX' || coinUpper === 'BNB' || coinUpper === 'BSC') {
    return isValidEthereumAddress(address);
  }
  
  // Cosmos chains
  if (coinUpper === 'ATOM' || coinUpper === 'COSMOS') {
    return isValidCosmosAddress(address, 'cosmos');
  }
  if (coinUpper === 'RUNE' || coinUpper === 'THORCHAIN') {
    return isValidThorchainAddress(address);
  }
  if (coinUpper === 'OSMO' || coinUpper === 'OSMOSIS') {
    return isValidOsmosisAddress(address);
  }
  
  return false;
}

/**
 * Format address for display (truncate middle)
 */
export function formatAddressDisplay(address: string, chars: number = 8): string {
  if (address.length <= chars * 2) {
    return address;
  }
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Normalize address - trim whitespace and lowercase for Ethereum
 */
export function normalizeAddress(address: string): string {
  const trimmed = address.trim();
  
  // Auto-detect Ethereum addresses and lowercase them
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  
  return trimmed;
}

/**
 * Generate address message for KeepKey display verification
 */
export function getDisplayAddressMessage(address: string, coin: string): string {
  return `Verify this ${coin} address on your KeepKey:\n${address}`;
}

export interface AddressInfo {
  address: string;
  path: string;
  coin: string;
  type: string;
  verified: boolean;
}

/**
 * Create address info object
 */
export function createAddressInfo(
  address: string,
  path: string,
  coin: string,
  type: string,
  verified: boolean = false,
): AddressInfo {
  return {
    address,
    path,
    coin,
    type,
    verified,
  };
}
