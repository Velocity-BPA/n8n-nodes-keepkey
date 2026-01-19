/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
  BITCOIN_LIKE_COINS,
  EVM_CHAINS,
  COSMOS_CHAINS,
  COIN_SYMBOLS,
  BITCOIN_LIKE_SYMBOLS,
  EVM_CHAIN_OPTIONS,
  COSMOS_CHAIN_OPTIONS,
} from '../../nodes/KeepKey/constants/coins';

import {
  BIP44_PURPOSE,
  BIP49_PURPOSE,
  BIP84_PURPOSE,
  BIP86_PURPOSE,
  DERIVATION_TEMPLATES,
  ADDRESS_TYPES,
  parseDerivationPath,
  buildDerivationPath,
  getDerivationPath,
  pathArrayToString,
  pathStringToArray,
} from '../../nodes/KeepKey/constants/derivationPaths';

import {
  USB_CONFIG,
  WEBUSB_CONFIG,
  DEVICE_TIMEOUTS,
  KEEPKEY_BRIDGE,
  KEEPKEY_MODELS,
} from '../../nodes/KeepKey/constants/usbIds';

import {
  DEVICE_EVENTS,
  TRANSACTION_EVENTS,
  SIGNING_EVENTS,
  ACCOUNT_EVENTS,
  SWAP_EVENTS,
  SECURITY_EVENTS,
  MESSAGE_TYPES,
  BUTTON_REQUEST_TYPES,
  FAILURE_TYPES,
} from '../../nodes/KeepKey/constants/events';

import {
  BITCOIN_NETWORKS,
  ETHEREUM_NETWORKS,
  COSMOS_NETWORKS,
  THORCHAIN_NETWORKS,
  OSMOSIS_NETWORKS,
  SHAPESHIFT_ENDPOINTS,
  getNetworkConfig,
} from '../../nodes/KeepKey/constants/networks';

describe('constants', () => {
  describe('coins', () => {
    describe('BITCOIN_LIKE_COINS', () => {
      it('should include BTC', () => {
        expect(BITCOIN_LIKE_COINS.BTC).toBeDefined();
        expect(BITCOIN_LIKE_COINS.BTC.symbol).toBe('BTC');
        expect(BITCOIN_LIKE_COINS.BTC.name).toBe('Bitcoin');
        expect(BITCOIN_LIKE_COINS.BTC.slip44).toBe(0);
      });

      it('should include LTC', () => {
        expect(BITCOIN_LIKE_COINS.LTC).toBeDefined();
        expect(BITCOIN_LIKE_COINS.LTC.symbol).toBe('LTC');
        expect(BITCOIN_LIKE_COINS.LTC.slip44).toBe(2);
      });

      it('should include DOGE', () => {
        expect(BITCOIN_LIKE_COINS.DOGE).toBeDefined();
        expect(BITCOIN_LIKE_COINS.DOGE.symbol).toBe('DOGE');
      });
    });

    describe('EVM_CHAINS', () => {
      it('should include Ethereum', () => {
        expect(EVM_CHAINS.ETH).toBeDefined();
        expect(EVM_CHAINS.ETH.chainId).toBe(1);
        expect(EVM_CHAINS.ETH.name).toBe('Ethereum');
      });

      it('should include Polygon', () => {
        expect(EVM_CHAINS.MATIC).toBeDefined();
        expect(EVM_CHAINS.MATIC.chainId).toBe(137);
      });

      it('should include Arbitrum', () => {
        expect(EVM_CHAINS.ARB).toBeDefined();
        expect(EVM_CHAINS.ARB.chainId).toBe(42161);
      });
    });

    describe('COSMOS_CHAINS', () => {
      it('should include Cosmos Hub', () => {
        expect(COSMOS_CHAINS.ATOM).toBeDefined();
        expect(COSMOS_CHAINS.ATOM.prefix).toBe('cosmos');
      });

      it('should include THORChain', () => {
        expect(COSMOS_CHAINS.RUNE).toBeDefined();
        expect(COSMOS_CHAINS.RUNE.prefix).toBe('thor');
      });

      it('should include Osmosis', () => {
        expect(COSMOS_CHAINS.OSMO).toBeDefined();
        expect(COSMOS_CHAINS.OSMO.prefix).toBe('osmo');
      });
    });

    describe('COIN_SYMBOLS', () => {
      it('should be an array of strings', () => {
        expect(Array.isArray(COIN_SYMBOLS)).toBe(true);
        expect(COIN_SYMBOLS.every(s => typeof s === 'string')).toBe(true);
      });
    });
  });

  describe('derivationPaths', () => {
    describe('BIP purpose codes', () => {
      it('should have correct purpose codes', () => {
        expect(BIP44_PURPOSE).toBe(44);
        expect(BIP49_PURPOSE).toBe(49);
        expect(BIP84_PURPOSE).toBe(84);
        expect(BIP86_PURPOSE).toBe(86);
      });
    });

    describe('DERIVATION_TEMPLATES', () => {
      it('should have templates for BTC', () => {
        expect(DERIVATION_TEMPLATES.BTC).toBeDefined();
        expect(DERIVATION_TEMPLATES.BTC.legacy).toBeDefined();
        expect(DERIVATION_TEMPLATES.BTC.nativeSegwit).toBeDefined();
      });

      it('should have templates for ETH', () => {
        expect(DERIVATION_TEMPLATES.ETH).toBeDefined();
      });
    });

    describe('parseDerivationPath', () => {
      it('should parse standard paths', () => {
        const parsed = parseDerivationPath("m/44'/0'/0'/0/0");
        expect(parsed.purpose).toBe(44);
        expect(parsed.coinType).toBe(0);
        expect(parsed.account).toBe(0);
        expect(parsed.change).toBe(0);
        expect(parsed.addressIndex).toBe(0);
      });

      it('should handle hardened indices', () => {
        const parsed = parseDerivationPath("m/84'/0'/0'/0/0");
        expect(parsed.purpose).toBe(84);
      });
    });

    describe('buildDerivationPath', () => {
      it('should build valid paths', () => {
        const path = buildDerivationPath({
          purpose: 84,
          coinType: 0,
          account: 0,
          change: 0,
          addressIndex: 0,
        });
        expect(path).toBe("m/84'/0'/0'/0/0");
      });
    });

    describe('getDerivationPath', () => {
      it('should get path for coin and type', () => {
        const path = getDerivationPath('BTC', 'nativeSegwit', 0, 0);
        expect(path).toContain("84'");
        expect(path).toContain("0'");
      });
    });

    describe('path conversions', () => {
      it('should convert path to array', () => {
        const array = pathStringToArray("m/44'/0'/0'/0/0");
        expect(array.length).toBe(5);
        expect(array[0]).toBe(44 + 0x80000000); // Hardened
      });

      it('should convert array to path', () => {
        const array = [44 + 0x80000000, 0x80000000, 0x80000000, 0, 0];
        const path = pathArrayToString(array);
        expect(path).toBe("m/44'/0'/0'/0/0");
      });
    });

    describe('ADDRESS_TYPES', () => {
      it('should have all address types', () => {
        expect(ADDRESS_TYPES.legacy).toBeDefined();
        expect(ADDRESS_TYPES.segwit).toBeDefined();
        expect(ADDRESS_TYPES.nativeSegwit).toBeDefined();
        expect(ADDRESS_TYPES.taproot).toBeDefined();
      });
    });
  });

  describe('usbIds', () => {
    describe('USB_CONFIG', () => {
      it('should have correct vendor ID', () => {
        expect(USB_CONFIG.VENDOR_ID).toBe(0x2b24);
      });

      it('should have correct product ID', () => {
        expect(USB_CONFIG.PRODUCT_ID).toBe(0x0001);
      });

      it('should have packet size', () => {
        expect(USB_CONFIG.PACKET_SIZE).toBe(64);
      });
    });

    describe('WEBUSB_CONFIG', () => {
      it('should have filters array', () => {
        expect(Array.isArray(WEBUSB_CONFIG.filters)).toBe(true);
        expect(WEBUSB_CONFIG.filters.length).toBeGreaterThan(0);
      });
    });

    describe('DEVICE_TIMEOUTS', () => {
      it('should have reasonable timeouts', () => {
        expect(DEVICE_TIMEOUTS.CONNECTION).toBeGreaterThan(0);
        expect(DEVICE_TIMEOUTS.OPERATION).toBeGreaterThan(0);
        expect(DEVICE_TIMEOUTS.BUTTON).toBeGreaterThan(0);
      });
    });

    describe('KEEPKEY_BRIDGE', () => {
      it('should have default URL', () => {
        expect(KEEPKEY_BRIDGE.DEFAULT_URL).toBe('http://localhost:1646');
      });
    });

    describe('KEEPKEY_MODELS', () => {
      it('should have at least one model', () => {
        expect(Object.keys(KEEPKEY_MODELS).length).toBeGreaterThan(0);
      });
    });
  });

  describe('events', () => {
    describe('DEVICE_EVENTS', () => {
      it('should have connection events', () => {
        expect(DEVICE_EVENTS.CONNECTED).toBeDefined();
        expect(DEVICE_EVENTS.DISCONNECTED).toBeDefined();
      });

      it('should have interaction events', () => {
        expect(DEVICE_EVENTS.BUTTON_REQUEST).toBeDefined();
        expect(DEVICE_EVENTS.PIN_REQUEST).toBeDefined();
        expect(DEVICE_EVENTS.PASSPHRASE_REQUEST).toBeDefined();
      });
    });

    describe('TRANSACTION_EVENTS', () => {
      it('should have transaction lifecycle events', () => {
        expect(TRANSACTION_EVENTS.SIGNED).toBeDefined();
        expect(TRANSACTION_EVENTS.REJECTED).toBeDefined();
        expect(TRANSACTION_EVENTS.BROADCAST).toBeDefined();
        expect(TRANSACTION_EVENTS.CONFIRMED).toBeDefined();
      });
    });

    describe('MESSAGE_TYPES', () => {
      it('should have Initialize message', () => {
        expect(MESSAGE_TYPES.Initialize).toBe(0);
      });

      it('should have Ping message', () => {
        expect(MESSAGE_TYPES.Ping).toBe(1);
      });

      it('should have GetPublicKey message', () => {
        expect(MESSAGE_TYPES.GetPublicKey).toBe(11);
      });

      it('should have SignTx message', () => {
        expect(MESSAGE_TYPES.SignTx).toBe(15);
      });
    });

    describe('FAILURE_TYPES', () => {
      it('should have common failure types', () => {
        expect(FAILURE_TYPES.UnexpectedMessage).toBeDefined();
        expect(FAILURE_TYPES.ActionCancelled).toBeDefined();
        expect(FAILURE_TYPES.PinInvalid).toBeDefined();
      });
    });
  });

  describe('networks', () => {
    describe('BITCOIN_NETWORKS', () => {
      it('should have mainnet', () => {
        expect(BITCOIN_NETWORKS.mainnet).toBeDefined();
        expect(BITCOIN_NETWORKS.mainnet.name).toBe('mainnet');
      });

      it('should have testnet', () => {
        expect(BITCOIN_NETWORKS.testnet).toBeDefined();
      });
    });

    describe('ETHEREUM_NETWORKS', () => {
      it('should have mainnet', () => {
        expect(ETHEREUM_NETWORKS.mainnet).toBeDefined();
        expect(ETHEREUM_NETWORKS.mainnet.chainId).toBe(1);
      });

      it('should have L2 networks', () => {
        expect(ETHEREUM_NETWORKS.polygon).toBeDefined();
        expect(ETHEREUM_NETWORKS.arbitrum).toBeDefined();
        expect(ETHEREUM_NETWORKS.optimism).toBeDefined();
      });
    });

    describe('COSMOS_NETWORKS', () => {
      it('should have mainnet', () => {
        expect(COSMOS_NETWORKS.mainnet).toBeDefined();
      });
    });

    describe('SHAPESHIFT_ENDPOINTS', () => {
      it('should have API URL', () => {
        expect(SHAPESHIFT_ENDPOINTS.API_URL).toBeDefined();
      });

      it('should have quote endpoint', () => {
        expect(SHAPESHIFT_ENDPOINTS.QUOTE).toBeDefined();
      });
    });

    describe('getNetworkConfig', () => {
      it('should return config for BTC mainnet', () => {
        const config = getNetworkConfig('BTC', 'mainnet');
        expect(config).toBeDefined();
      });

      it('should return config for ETH mainnet', () => {
        const config = getNetworkConfig('ETH', 'mainnet');
        expect(config).toBeDefined();
        expect(config.chainId).toBe(1);
      });

      it('should return null for unknown network', () => {
        const config = getNetworkConfig('UNKNOWN', 'mainnet');
        expect(config).toBeNull();
      });
    });
  });
});
