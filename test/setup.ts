/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

// Jest setup file for n8n-nodes-keepkey tests

// Increase timeout for hardware wallet tests
jest.setTimeout(30000);

// Mock USB/WebUSB for testing without hardware
jest.mock('usb', () => ({
  findByIds: jest.fn(),
  getDeviceList: jest.fn().mockReturnValue([]),
}));

// Mock console.warn to suppress licensing notices in tests
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = jest.fn((...args) => {
    // Suppress licensing notices in test output
    if (args[0]?.includes?.('Velocity BPA Licensing Notice')) {
      return;
    }
    originalWarn(...args);
  });
});

afterAll(() => {
  console.warn = originalWarn;
});

// Global test utilities
global.testUtils = {
  mockKeepKeyDevice: {
    vendorId: 0x2b24,
    productId: 0x0001,
    path: '/dev/hidraw0',
    label: 'Test KeepKey',
    features: {
      vendor: 'keepkey.com',
      major_version: 7,
      minor_version: 6,
      patch_version: 0,
      bootloader_mode: false,
      device_id: 'test-device-id-123',
      pin_protection: true,
      passphrase_protection: false,
      language: 'en-US',
      label: 'Test KeepKey',
      initialized: true,
      model: 'K1-14AM',
    },
  },
  mockBitcoinAddress: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
  mockEthereumAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f00000',
  mockCosmosAddress: 'cosmos1...',
  mockThorchainAddress: 'thor1...',
};

// Type declaration for global test utilities
declare global {
  // eslint-disable-next-line no-var
  var testUtils: {
    mockKeepKeyDevice: {
      vendorId: number;
      productId: number;
      path: string;
      label: string;
      features: Record<string, unknown>;
    };
    mockBitcoinAddress: string;
    mockEthereumAddress: string;
    mockCosmosAddress: string;
    mockThorchainAddress: string;
  };
}

export {};
