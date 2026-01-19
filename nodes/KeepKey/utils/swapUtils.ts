/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Swap utilities for ShapeShift and THORChain cross-chain swaps
 */

import { SHAPESHIFT_ENDPOINTS } from '../constants/networks';

export interface SwapQuote {
  id: string;
  sellAsset: string;
  buyAsset: string;
  sellAmount: string;
  buyAmount: string;
  rate: string;
  slippage: number;
  fee: string;
  feeAsset: string;
  expiresAt: number;
  route?: SwapRoute;
}

export interface SwapRoute {
  steps: SwapStep[];
  totalGas?: string;
  estimatedTime?: number;
}

export interface SwapStep {
  protocol: string;
  action: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  toAmount: string;
  pool?: string;
}

export interface SwapStatus {
  id: string;
  status: 'pending' | 'confirming' | 'completed' | 'failed' | 'refunded';
  sellTxHash?: string;
  buyTxHash?: string;
  sellAmount?: string;
  buyAmount?: string;
  error?: string;
  updatedAt: number;
}

export interface SwapAsset {
  symbol: string;
  name: string;
  chain: string;
  contractAddress?: string;
  decimals: number;
  logoUrl?: string;
}

export interface SwapParams {
  fromAsset: string;
  toAsset: string;
  amount: number;
  destinationAddress: string;
}

export interface SwapValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ThorchainMemoParams {
  asset: string;
  destinationAddress: string;
  limit?: number;
  affiliate?: string;
  affiliateFee?: number;
}

export interface ParsedThorchainMemo {
  action: string;
  asset: string;
  destinationAddress?: string;
  limit?: number;
  affiliate?: string;
  affiliateFee?: number;
}

export interface ParsedThorchainAsset {
  chain: string;
  symbol: string;
  contractAddress?: string;
}

/**
 * Swap error codes
 */
export const SWAP_ERRORS = {
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  SLIPPAGE_TOO_HIGH: 'SLIPPAGE_TOO_HIGH',
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
  INVALID_ASSET: 'INVALID_ASSET',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  SAME_ASSET: 'SAME_ASSET',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
} as const;

/**
 * Calculate slippage percentage between expected and actual amounts
 */
export function calculateSlippage(
  expected: number | string,
  actual: number | string,
): number {
  const expectedNum = typeof expected === 'string' ? parseFloat(expected) : expected;
  const actualNum = typeof actual === 'string' ? parseFloat(actual) : actual;
  
  if (expectedNum === 0) return 0;
  
  return ((expectedNum - actualNum) / expectedNum) * 100;
}

/**
 * Apply slippage tolerance to an amount
 */
export function applySlippage(amount: number | string, slippagePercent: number): number {
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
  return amountNum * (1 - slippagePercent / 100);
}

/**
 * Calculate swap rate (how much toAsset per unit of fromAsset)
 */
export function calculateSwapRate(
  fromAmount: number | string,
  toAmount: number | string,
): number {
  const from = typeof fromAmount === 'string' ? parseFloat(fromAmount) : fromAmount;
  const to = typeof toAmount === 'string' ? parseFloat(toAmount) : toAmount;
  
  if (from === 0) return 0;
  
  return to / from;
}

/**
 * Format swap rate for display
 */
export function formatSwapRate(rate: number, fromSymbol: string, toSymbol: string): string {
  return `1 ${fromSymbol} = ${rate} ${toSymbol}`;
}

/**
 * Validate swap parameters
 */
export function validateSwapParams(params: SwapParams): SwapValidationResult {
  const errors: string[] = [];
  
  if (!params.fromAsset || params.fromAsset.trim() === '') {
    errors.push('From asset is required');
  }
  
  if (!params.toAsset || params.toAsset.trim() === '') {
    errors.push('To asset is required');
  }
  
  if (params.fromAsset === params.toAsset) {
    errors.push('Cannot swap same asset');
  }
  
  if (typeof params.amount !== 'number' || isNaN(params.amount) || params.amount <= 0) {
    errors.push('Invalid amount');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a quote has expired (takes timestamp in ms)
 */
export function isQuoteExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

/**
 * Get remaining quote validity time in seconds
 */
export function getQuoteValidityRemaining(expiresAt: number): number {
  const remaining = Math.max(0, expiresAt - Date.now());
  return Math.floor(remaining / 1000);
}

/**
 * Format quote validity time for display
 */
export function formatQuoteValidity(expiresAt: number): string {
  const remaining = getQuoteValidityRemaining(expiresAt);
  if (remaining <= 0) {
    return 'Expired';
  }
  if (remaining < 60) {
    return `${remaining}s`;
  }
  const minutes = Math.floor(remaining / 60);
  return `${minutes}m ${remaining % 60}s`;
}

/**
 * Create THORChain swap memo
 * Format: SWAP:ASSET:DESTADDR:LIM:AFFILIATE:FEE
 */
export function createThorchainSwapMemo(params: ThorchainMemoParams): string {
  const parts = ['SWAP', params.asset, params.destinationAddress];

  if (params.limit !== undefined) {
    parts.push(params.limit.toString());
  } else {
    parts.push('');
  }

  if (params.affiliate) {
    parts.push(params.affiliate);
    parts.push(params.affiliateFee?.toString() || '0');
  }

  return parts.join(':');
}

/**
 * Parse THORChain swap memo
 */
export function parseThorchainSwapMemo(memo: string): ParsedThorchainMemo {
  const parts = memo.split(':');
  
  // Handle shorthand actions
  let action = parts[0];
  if (action === '=' || action === 's') {
    action = 'SWAP';
  } else if (action === '+') {
    action = 'ADD';
  } else if (action === '-') {
    action = 'WITHDRAW';
  }
  
  const result: ParsedThorchainMemo = {
    action,
    asset: parts[1] || '',
    destinationAddress: parts[2],
  };

  if (parts[3]) {
    result.limit = parseInt(parts[3], 10);
  }

  if (parts[4]) {
    result.affiliate = parts[4];
  }

  if (parts[5]) {
    result.affiliateFee = parseInt(parts[5], 10);
  }

  return result;
}

/**
 * Format THORChain asset string
 */
export function formatThorchainAsset(chain: string, symbol: string, contractAddress?: string): string {
  if (contractAddress) {
    return `${chain}.${symbol}-${contractAddress}`;
  }
  return `${chain}.${symbol}`;
}

/**
 * Parse THORChain asset string
 */
export function parseThorchainAsset(asset: string): ParsedThorchainAsset {
  const [chain, rest] = asset.split('.');
  
  if (!rest) {
    return { chain, symbol: chain };
  }
  
  // Check for contract address (symbol-address format)
  const dashIndex = rest.indexOf('-');
  if (dashIndex > 0) {
    return {
      chain,
      symbol: rest.substring(0, dashIndex),
      contractAddress: rest.substring(dashIndex + 1),
    };
  }
  
  return { chain, symbol: rest };
}

/**
 * Estimate gas for THORChain swap
 */
export function estimateThorchainSwapGas(_fromAsset: string, _toAsset: string): number {
  // Base gas estimate - in practice this would vary by chain
  return 2500000;
}

/**
 * Calculate streaming swap parameters
 */
export function calculateStreamingParams(
  _sellAmount: string,
  numSwaps: number = 10,
): { interval: number; quantity: number } {
  return {
    interval: 1, // blocks between swaps
    quantity: numSwaps,
  };
}

/**
 * Get ShapeShift API endpoints
 */
export function getShapeShiftEndpoints(): typeof SHAPESHIFT_ENDPOINTS {
  return SHAPESHIFT_ENDPOINTS;
}

// Keep unused export reference
void getShapeShiftEndpoints;
