/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * KeepKey USB device identifiers and configuration
 */

export const KEEPKEY_VENDOR_ID = 0x2b24;
export const KEEPKEY_PRODUCT_ID = 0x0001;
export const KEEPKEY_BOOTLOADER_PRODUCT_ID = 0x0002;

export const USB_CONFIG = {
  VENDOR_ID: KEEPKEY_VENDOR_ID,
  PRODUCT_ID: KEEPKEY_PRODUCT_ID,
  BOOTLOADER_PRODUCT_ID: KEEPKEY_BOOTLOADER_PRODUCT_ID,
  INTERFACE: 0,
  ENDPOINT_IN: 0x81,
  ENDPOINT_OUT: 0x01,
  PACKET_SIZE: 64,
  TIMEOUT: 30000,
};

export const WEBUSB_CONFIG = {
  filters: [
    { vendorId: KEEPKEY_VENDOR_ID, productId: KEEPKEY_PRODUCT_ID },
    { vendorId: KEEPKEY_VENDOR_ID, productId: KEEPKEY_BOOTLOADER_PRODUCT_ID },
  ],
};

export const CONNECTION_TYPES = {
  USB_HID: 'usbHid',
  WEBUSB: 'webusb',
  KEEPKEY_DESKTOP: 'keepkeyDesktop',
  KEEPKEY_BRIDGE: 'keepkeyBridge',
} as const;

export type ConnectionType = (typeof CONNECTION_TYPES)[keyof typeof CONNECTION_TYPES];

export const BRIDGE_CONFIG = {
  DEFAULT_URL: 'http://localhost:1646',
  DEFAULT_PORT: 1646,
  ENDPOINTS: {
    ENUMERATE: '/enumerate',
    ACQUIRE: '/acquire',
    RELEASE: '/release',
    CALL: '/call',
    LISTEN: '/listen',
  },
};

export const DESKTOP_CONFIG = {
  DEFAULT_URL: 'http://localhost:1646',
  API_VERSION: 'v1',
  ENDPOINTS: {
    DEVICES: '/devices',
    CONNECT: '/connect',
    DISCONNECT: '/disconnect',
    SIGN: '/sign',
    ADDRESS: '/address',
  },
};

/**
 * KeepKey Bridge configuration
 */
export const KEEPKEY_BRIDGE = {
  DEFAULT_URL: 'http://localhost:1646',
  DEFAULT_PORT: 1646,
  VERSION: '1.0.0',
};

/**
 * KeepKey device models
 */
export const KEEPKEY_MODELS = {
  K1_14AM: {
    name: 'KeepKey',
    displayName: 'KeepKey K1-14AM',
    vendorId: KEEPKEY_VENDOR_ID,
    productId: KEEPKEY_PRODUCT_ID,
  },
  BOOTLOADER: {
    name: 'KeepKey Bootloader',
    displayName: 'KeepKey Bootloader',
    vendorId: KEEPKEY_VENDOR_ID,
    productId: KEEPKEY_BOOTLOADER_PRODUCT_ID,
  },
} as const;

export type DeviceModel = keyof typeof KEEPKEY_MODELS;

export const DEVICE_TIMEOUTS = {
  CONNECTION: 10000,
  OPERATION: 30000,
  BUTTON: 60000,
  PIN_ENTRY: 120000,
  PASSPHRASE_ENTRY: 120000,
  BUTTON_PRESS: 60000,
  RECOVERY_WORD: 300000,
  FIRMWARE_UPDATE: 600000,
};
