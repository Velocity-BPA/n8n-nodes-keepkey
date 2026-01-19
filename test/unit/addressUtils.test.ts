/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
  isValidBitcoinAddress,
  isValidEthereumAddress,
  isValidCosmosAddress,
  isValidThorchainAddress,
  isValidOsmosisAddress,
  detectAddressType,
  getBitcoinAddressType,
  checksumEthereumAddress,
  validateAddressForCoin,
  formatAddressDisplay,
  normalizeAddress,
} from '../../nodes/KeepKey/utils/addressUtils';

describe('addressUtils', () => {
  describe('isValidBitcoinAddress', () => {
    it('should validate legacy Bitcoin addresses', () => {
      // P2PKH mainnet
      expect(isValidBitcoinAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(true);
      // Format check - wrong prefix
      expect(isValidBitcoinAddress('0BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(false);
    });

    it('should validate SegWit Bitcoin addresses', () => {
      // P2SH-P2WPKH mainnet
      expect(isValidBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true);
    });

    it('should validate native SegWit Bitcoin addresses', () => {
      // Bech32 mainnet
      expect(isValidBitcoinAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe(true);
    });

    it('should validate testnet addresses', () => {
      // P2PKH testnet
      expect(isValidBitcoinAddress('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn')).toBe(true);
      // Bech32 testnet
      expect(isValidBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidBitcoinAddress('')).toBe(false);
      expect(isValidBitcoinAddress('invalid')).toBe(false);
      expect(isValidBitcoinAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1')).toBe(false);
    });
  });

  describe('isValidEthereumAddress', () => {
    it('should validate valid Ethereum addresses', () => {
      expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1')).toBe(true);
      expect(isValidEthereumAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    });

    it('should validate lowercase addresses', () => {
      expect(isValidEthereumAddress('0x742d35cc6634c0532925a3b844bc9e7595f1b2b1')).toBe(true);
    });

    it('should reject invalid Ethereum addresses', () => {
      expect(isValidEthereumAddress('')).toBe(false);
      expect(isValidEthereumAddress('0x')).toBe(false);
      expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b')).toBe(false); // Too short
      expect(isValidEthereumAddress('742d35Cc6634C0532925a3b844Bc9e7595f1b2b1')).toBe(false); // No 0x
      expect(isValidEthereumAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(false); // Bitcoin address
    });
  });

  describe('isValidCosmosAddress', () => {
    it('should validate valid Cosmos addresses', () => {
      expect(isValidCosmosAddress('cosmos1hsk6jryyqjfhp5dhc55tc9jtckygx0eph6dd02', 'cosmos')).toBe(true);
    });

    it('should reject invalid Cosmos addresses', () => {
      expect(isValidCosmosAddress('', 'cosmos')).toBe(false);
      expect(isValidCosmosAddress('cosmos1invalid', 'cosmos')).toBe(false);
      expect(isValidCosmosAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1', 'cosmos')).toBe(false);
    });
  });

  describe('isValidThorchainAddress', () => {
    it('should validate valid THORChain addresses', () => {
      expect(isValidThorchainAddress('thor1hsk6jryyqjfhp5dhc55tc9jtckygx0eph5mhrf')).toBe(true);
    });

    it('should reject invalid THORChain addresses', () => {
      expect(isValidThorchainAddress('')).toBe(false);
      expect(isValidThorchainAddress('cosmos1hsk6jryyqjfhp5dhc55tc9jtckygx0eph6dd02')).toBe(false);
    });
  });

  describe('isValidOsmosisAddress', () => {
    it('should validate valid Osmosis addresses', () => {
      expect(isValidOsmosisAddress('osmo1hsk6jryyqjfhp5dhc55tc9jtckygx0epx4t5vh')).toBe(true);
    });

    it('should reject invalid Osmosis addresses', () => {
      expect(isValidOsmosisAddress('')).toBe(false);
      expect(isValidOsmosisAddress('cosmos1hsk6jryyqjfhp5dhc55tc9jtckygx0eph6dd02')).toBe(false);
    });
  });

  describe('detectAddressType', () => {
    it('should detect Bitcoin addresses', () => {
      expect(detectAddressType('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe('bitcoin');
      expect(detectAddressType('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe('bitcoin');
    });

    it('should detect Ethereum addresses', () => {
      expect(detectAddressType('0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1')).toBe('ethereum');
    });

    it('should detect Cosmos addresses', () => {
      expect(detectAddressType('cosmos1hsk6jryyqjfhp5dhc55tc9jtckygx0eph6dd02')).toBe('cosmos');
    });

    it('should detect THORChain addresses', () => {
      expect(detectAddressType('thor1hsk6jryyqjfhp5dhc55tc9jtckygx0eph5mhrf')).toBe('thorchain');
    });

    it('should detect Osmosis addresses', () => {
      expect(detectAddressType('osmo1hsk6jryyqjfhp5dhc55tc9jtckygx0epx4t5vh')).toBe('osmosis');
    });

    it('should return unknown for invalid addresses', () => {
      expect(detectAddressType('invalid')).toBe('unknown');
      expect(detectAddressType('')).toBe('unknown');
    });
  });

  describe('getBitcoinAddressType', () => {
    it('should detect legacy addresses', () => {
      expect(getBitcoinAddressType('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe('legacy');
    });

    it('should detect SegWit addresses', () => {
      expect(getBitcoinAddressType('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe('segwit');
    });

    it('should detect native SegWit addresses', () => {
      expect(getBitcoinAddressType('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe('nativeSegwit');
    });

    it('should detect Taproot addresses', () => {
      expect(getBitcoinAddressType('bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297')).toBe('taproot');
    });
  });

  describe('checksumEthereumAddress', () => {
    it('should return checksummed address', () => {
      const address = '0x742d35cc6634c0532925a3b844bc9e7595f1b2b1';
      const checksummed = checksumEthereumAddress(address);
      expect(checksummed).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('should handle already checksummed addresses', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1';
      const checksummed = checksumEthereumAddress(address);
      // Should return a valid checksummed format
      expect(checksummed).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  describe('validateAddressForCoin', () => {
    it('should validate Bitcoin addresses for BTC', () => {
      expect(validateAddressForCoin('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', 'BTC')).toBe(true);
      expect(validateAddressForCoin('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'BTC')).toBe(true);
    });

    it('should validate Ethereum addresses for ETH', () => {
      expect(validateAddressForCoin('0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1', 'ETH')).toBe(true);
    });

    it('should validate Cosmos addresses for ATOM', () => {
      expect(validateAddressForCoin('cosmos1hsk6jryyqjfhp5dhc55tc9jtckygx0eph6dd02', 'ATOM')).toBe(true);
    });

    it('should reject mismatched addresses', () => {
      expect(validateAddressForCoin('0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1', 'BTC')).toBe(false);
      expect(validateAddressForCoin('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', 'ETH')).toBe(false);
    });
  });

  describe('formatAddressDisplay', () => {
    it('should truncate long addresses', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1';
      const formatted = formatAddressDisplay(address, 8);
      expect(formatted.length).toBeLessThan(address.length);
      expect(formatted).toContain('...');
    });

    it('should not truncate short addresses', () => {
      const address = '0x1234';
      const formatted = formatAddressDisplay(address, 10);
      expect(formatted).toBe(address);
    });
  });

  describe('normalizeAddress', () => {
    it('should lowercase Ethereum addresses', () => {
      const address = '0x742D35CC6634C0532925A3B844BC9E7595F1B2B1';
      expect(normalizeAddress(address)).toBe('0x742d35cc6634c0532925a3b844bc9e7595f1b2b1');
    });

    it('should trim whitespace', () => {
      const address = '  0x742d35Cc6634C0532925a3b844Bc9e7595f1b2b1  ';
      expect(normalizeAddress(address).startsWith('0x')).toBe(true);
      expect(normalizeAddress(address).includes(' ')).toBe(false);
    });
  });
});
