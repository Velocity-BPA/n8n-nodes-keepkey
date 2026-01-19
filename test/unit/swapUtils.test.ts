/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
  calculateSlippage,
  applySlippage,
  calculateSwapRate,
  formatSwapRate,
  validateSwapParams,
  isQuoteExpired,
  getQuoteValidityRemaining,
  createThorchainSwapMemo,
  parseThorchainSwapMemo,
  formatThorchainAsset,
  parseThorchainAsset,
  estimateThorchainSwapGas,
  SWAP_ERRORS,
} from '../../nodes/KeepKey/utils/swapUtils';

describe('swapUtils', () => {
  describe('calculateSlippage', () => {
    it('should calculate slippage percentage', () => {
      const expected = 100;
      const actual = 98;
      const slippage = calculateSlippage(expected, actual);
      expect(slippage).toBe(2); // 2% slippage
    });

    it('should handle zero expected', () => {
      const slippage = calculateSlippage(0, 100);
      expect(slippage).toBe(0);
    });

    it('should handle positive slippage (better rate)', () => {
      const expected = 100;
      const actual = 102;
      const slippage = calculateSlippage(expected, actual);
      expect(slippage).toBe(-2); // -2% means better than expected
    });
  });

  describe('applySlippage', () => {
    it('should apply slippage to amount', () => {
      const amount = 100;
      const slippagePercent = 1;
      const result = applySlippage(amount, slippagePercent);
      expect(result).toBe(99); // 100 - 1%
    });

    it('should handle zero slippage', () => {
      const result = applySlippage(100, 0);
      expect(result).toBe(100);
    });

    it('should handle large slippage', () => {
      const result = applySlippage(100, 50);
      expect(result).toBe(50);
    });
  });

  describe('calculateSwapRate', () => {
    it('should calculate swap rate', () => {
      const fromAmount = 1;
      const toAmount = 30000;
      const rate = calculateSwapRate(fromAmount, toAmount);
      expect(rate).toBe(30000);
    });

    it('should handle decimal amounts', () => {
      const rate = calculateSwapRate(0.5, 15000);
      expect(rate).toBe(30000);
    });

    it('should handle zero from amount', () => {
      const rate = calculateSwapRate(0, 100);
      expect(rate).toBe(0);
    });
  });

  describe('formatSwapRate', () => {
    it('should format rate with symbols', () => {
      const formatted = formatSwapRate(30000, 'BTC', 'USD');
      expect(formatted).toContain('30000');
      expect(formatted).toContain('BTC');
      expect(formatted).toContain('USD');
    });

    it('should handle decimal rates', () => {
      const formatted = formatSwapRate(0.00003333, 'USD', 'BTC');
      expect(formatted).toContain('USD');
      expect(formatted).toContain('BTC');
    });
  });

  describe('validateSwapParams', () => {
    it('should validate correct swap params', () => {
      const result = validateSwapParams({
        fromAsset: 'BTC.BTC',
        toAsset: 'ETH.ETH',
        amount: 0.1,
        destinationAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1',
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing from asset', () => {
      const result = validateSwapParams({
        fromAsset: '',
        toAsset: 'ETH.ETH',
        amount: 0.1,
        destinationAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject zero amount', () => {
      const result = validateSwapParams({
        fromAsset: 'BTC.BTC',
        toAsset: 'ETH.ETH',
        amount: 0,
        destinationAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1',
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject negative amount', () => {
      const result = validateSwapParams({
        fromAsset: 'BTC.BTC',
        toAsset: 'ETH.ETH',
        amount: -1,
        destinationAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1',
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject same from and to asset', () => {
      const result = validateSwapParams({
        fromAsset: 'BTC.BTC',
        toAsset: 'BTC.BTC',
        amount: 0.1,
        destinationAddress: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('isQuoteExpired', () => {
    it('should detect expired quotes', () => {
      const expiredTime = Date.now() - 60000; // 1 minute ago
      expect(isQuoteExpired(expiredTime)).toBe(true);
    });

    it('should detect valid quotes', () => {
      const futureTime = Date.now() + 60000; // 1 minute from now
      expect(isQuoteExpired(futureTime)).toBe(false);
    });
  });

  describe('getQuoteValidityRemaining', () => {
    it('should return remaining time', () => {
      const futureTime = Date.now() + 60000; // 1 minute from now
      const remaining = getQuoteValidityRemaining(futureTime);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60);
    });

    it('should return 0 for expired quotes', () => {
      const pastTime = Date.now() - 60000;
      const remaining = getQuoteValidityRemaining(pastTime);
      expect(remaining).toBe(0);
    });
  });

  describe('createThorchainSwapMemo', () => {
    it('should create basic swap memo', () => {
      const memo = createThorchainSwapMemo({
        asset: 'ETH.ETH',
        destinationAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1',
      });
      expect(memo).toContain('SWAP');
      expect(memo).toContain('ETH.ETH');
      expect(memo).toContain('0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1');
    });

    it('should include limit if provided', () => {
      const memo = createThorchainSwapMemo({
        asset: 'ETH.ETH',
        destinationAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1',
        limit: 1000000,
      });
      expect(memo).toContain('1000000');
    });

    it('should include affiliate if provided', () => {
      const memo = createThorchainSwapMemo({
        asset: 'ETH.ETH',
        destinationAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1',
        affiliate: 'ss',
        affiliateFee: 50,
      });
      expect(memo).toContain('ss');
      expect(memo).toContain('50');
    });
  });

  describe('parseThorchainSwapMemo', () => {
    it('should parse basic memo', () => {
      const memo = 'SWAP:ETH.ETH:0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1';
      const parsed = parseThorchainSwapMemo(memo);
      expect(parsed.action).toBe('SWAP');
      expect(parsed.asset).toBe('ETH.ETH');
      expect(parsed.destinationAddress).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1');
    });

    it('should parse memo with limit', () => {
      const memo = 'SWAP:ETH.ETH:0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1:1000000';
      const parsed = parseThorchainSwapMemo(memo);
      expect(parsed.limit).toBe(1000000);
    });

    it('should handle shorthand actions', () => {
      const memo = '=:ETH.ETH:0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1';
      const parsed = parseThorchainSwapMemo(memo);
      expect(parsed.action).toBe('SWAP');
    });
  });

  describe('formatThorchainAsset', () => {
    it('should format native assets', () => {
      expect(formatThorchainAsset('BTC', 'BTC')).toBe('BTC.BTC');
      expect(formatThorchainAsset('ETH', 'ETH')).toBe('ETH.ETH');
    });

    it('should format tokens with contract', () => {
      const result = formatThorchainAsset('ETH', 'USDC', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
      expect(result).toContain('ETH');
      expect(result).toContain('USDC');
    });
  });

  describe('parseThorchainAsset', () => {
    it('should parse native assets', () => {
      const parsed = parseThorchainAsset('BTC.BTC');
      expect(parsed.chain).toBe('BTC');
      expect(parsed.symbol).toBe('BTC');
    });

    it('should parse tokens', () => {
      const parsed = parseThorchainAsset('ETH.USDC-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
      expect(parsed.chain).toBe('ETH');
      expect(parsed.symbol).toBe('USDC');
      expect(parsed.contractAddress).toBeDefined();
    });
  });

  describe('estimateThorchainSwapGas', () => {
    it('should estimate gas for BTC swaps', () => {
      const gas = estimateThorchainSwapGas('BTC.BTC', 'ETH.ETH');
      expect(gas).toBeGreaterThan(0);
    });

    it('should estimate gas for ETH swaps', () => {
      const gas = estimateThorchainSwapGas('ETH.ETH', 'BTC.BTC');
      expect(gas).toBeGreaterThan(0);
    });

    it('should estimate gas for token swaps', () => {
      const gas = estimateThorchainSwapGas('ETH.USDC', 'BTC.BTC');
      expect(gas).toBeGreaterThan(0);
    });
  });

  describe('SWAP_ERRORS', () => {
    it('should have error codes defined', () => {
      expect(SWAP_ERRORS.INSUFFICIENT_BALANCE).toBeDefined();
      expect(SWAP_ERRORS.SLIPPAGE_TOO_HIGH).toBeDefined();
      expect(SWAP_ERRORS.QUOTE_EXPIRED).toBeDefined();
      expect(SWAP_ERRORS.INVALID_ASSET).toBeDefined();
    });
  });
});
