/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
  satoshisToBtc,
  btcToSatoshis,
  weiToEth,
  ethToWei,
  microToStandard,
  standardToMicro,
  formatTxHash,
  getExplorerUrl,
  isValidTxHash,
  calculateBitcoinFee,
  estimateBitcoinTxSize,
  calculateFeeRate,
} from '../../nodes/KeepKey/utils/transactionUtils';

describe('transactionUtils', () => {
  describe('Bitcoin conversions', () => {
    describe('satoshisToBtc', () => {
      it('should convert satoshis to BTC', () => {
        expect(satoshisToBtc(100000000)).toBe(1);
        expect(satoshisToBtc(50000000)).toBe(0.5);
        expect(satoshisToBtc(1)).toBe(0.00000001);
        expect(satoshisToBtc(0)).toBe(0);
      });

      it('should handle large amounts', () => {
        expect(satoshisToBtc(2100000000000000)).toBe(21000000);
      });
    });

    describe('btcToSatoshis', () => {
      it('should convert BTC to satoshis', () => {
        expect(btcToSatoshis(1)).toBe(100000000);
        expect(btcToSatoshis(0.5)).toBe(50000000);
        expect(btcToSatoshis(0.00000001)).toBe(1);
        expect(btcToSatoshis(0)).toBe(0);
      });

      it('should handle decimal precision', () => {
        expect(btcToSatoshis(0.123456789)).toBe(12345679); // Rounds
      });
    });

    describe('round trip conversion', () => {
      it('should be reversible', () => {
        const original = 12345678;
        expect(btcToSatoshis(satoshisToBtc(original))).toBe(original);
      });
    });
  });

  describe('Ethereum conversions', () => {
    describe('weiToEth', () => {
      it('should convert wei to ETH', () => {
        expect(weiToEth('1000000000000000000')).toBe(1);
        expect(weiToEth('500000000000000000')).toBe(0.5);
        expect(weiToEth('1')).toBe(1e-18);
        expect(weiToEth('0')).toBe(0);
      });

      it('should handle string input', () => {
        expect(weiToEth('1000000000000000000')).toBe(1);
      });

      it('should handle BigInt input', () => {
        expect(weiToEth(BigInt('1000000000000000000'))).toBe(1);
      });
    });

    describe('ethToWei', () => {
      it('should convert ETH to wei', () => {
        expect(ethToWei(1)).toBe('1000000000000000000');
        expect(ethToWei(0.5)).toBe('500000000000000000');
        expect(ethToWei(0)).toBe('0');
      });

      it('should handle decimal precision', () => {
        const result = ethToWei(0.123456789012345678);
        expect(result).toMatch(/^\d+$/);
      });
    });
  });

  describe('Cosmos conversions', () => {
    describe('microToStandard', () => {
      it('should convert micro units to standard', () => {
        expect(microToStandard(1000000)).toBe(1);
        expect(microToStandard(500000)).toBe(0.5);
        expect(microToStandard(1)).toBe(0.000001);
        expect(microToStandard(0)).toBe(0);
      });
    });

    describe('standardToMicro', () => {
      it('should convert standard units to micro', () => {
        expect(standardToMicro(1)).toBe(1000000);
        expect(standardToMicro(0.5)).toBe(500000);
        expect(standardToMicro(0)).toBe(0);
      });
    });
  });

  describe('formatTxHash', () => {
    it('should truncate long transaction hashes', () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const formatted = formatTxHash(hash, 8);
      expect(formatted).toContain('...');
      expect(formatted.length).toBeLessThan(hash.length);
    });

    it('should not truncate short hashes', () => {
      const hash = '0x1234';
      const formatted = formatTxHash(hash);
      expect(formatted).toBe(hash);
    });
  });

  describe('getExplorerUrl', () => {
    it('should return Bitcoin explorer URL', () => {
      const hash = '1234567890abcdef';
      const url = getExplorerUrl(hash, 'BTC');
      expect(url).toContain(hash);
      expect(url).toContain('blockstream');
    });

    it('should return Ethereum explorer URL', () => {
      const hash = '0x1234567890abcdef';
      const url = getExplorerUrl(hash, 'ETH');
      expect(url).toContain(hash);
      expect(url).toContain('etherscan');
    });

    it('should return Cosmos explorer URL', () => {
      const hash = 'ABCDEF123456';
      const url = getExplorerUrl(hash, 'ATOM');
      expect(url).toContain(hash);
      expect(url).toContain('mintscan');
    });

    it('should handle unknown coins', () => {
      const hash = '123456';
      const url = getExplorerUrl(hash, 'UNKNOWN');
      expect(url).toBe('');
    });
  });

  describe('isValidTxHash', () => {
    it('should validate Bitcoin transaction hashes', () => {
      // 64 character hex
      const validHash = 'a'.repeat(64);
      expect(isValidTxHash(validHash, 'BTC')).toBe(true);
    });

    it('should validate Ethereum transaction hashes', () => {
      // 0x + 64 hex characters
      const validHash = '0x' + 'a'.repeat(64);
      expect(isValidTxHash(validHash, 'ETH')).toBe(true);
    });

    it('should reject invalid hashes', () => {
      expect(isValidTxHash('', 'BTC')).toBe(false);
      expect(isValidTxHash('invalid', 'BTC')).toBe(false);
      expect(isValidTxHash('0x123', 'ETH')).toBe(false);
    });
  });

  describe('calculateBitcoinFee', () => {
    it('should calculate fee from inputs and outputs', () => {
      const inputs = [
        { value: 100000 },
        { value: 50000 },
      ];
      const outputs = [
        { value: 120000 },
      ];
      const fee = calculateBitcoinFee(
        inputs as any,
        outputs as any
      );
      expect(fee).toBe(30000); // 150000 - 120000
    });

    it('should return 0 for invalid transactions', () => {
      const fee = calculateBitcoinFee([], []);
      expect(fee).toBe(0);
    });
  });

  describe('estimateBitcoinTxSize', () => {
    it('should estimate P2PKH transaction size', () => {
      const size = estimateBitcoinTxSize(2, 2, 'legacy');
      // P2PKH: 10 + 148 * inputs + 34 * outputs
      expect(size).toBeGreaterThan(0);
    });

    it('should estimate P2WPKH transaction size', () => {
      const size = estimateBitcoinTxSize(2, 2, 'nativeSegwit');
      // Should be smaller than legacy
      const legacySize = estimateBitcoinTxSize(2, 2, 'legacy');
      expect(size).toBeLessThan(legacySize);
    });

    it('should handle single input/output', () => {
      const size = estimateBitcoinTxSize(1, 1, 'legacy');
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('calculateFeeRate', () => {
    it('should calculate sat/vB fee rate', () => {
      const fee = 1000; // satoshis
      const size = 250; // vBytes
      const rate = calculateFeeRate(fee, size);
      expect(rate).toBe(4); // 1000 / 250 = 4
    });

    it('should handle zero size', () => {
      const rate = calculateFeeRate(1000, 0);
      expect(rate).toBe(0);
    });

    it('should round to nearest integer', () => {
      const rate = calculateFeeRate(1001, 250);
      expect(Number.isInteger(rate)).toBe(true);
    });
  });
});
