/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * KeepKey Client - Main device communication interface
 *
 * This module provides a unified interface for communicating with KeepKey devices
 * through various transport mechanisms (USB HID, WebUSB, Bridge, Desktop).
 */

import { EventEmitter } from 'events';
import {
  USB_CONFIG,
  CONNECTION_TYPES,
  DEVICE_TIMEOUTS,
  type ConnectionType,
} from '../constants/usbIds';
import { DEVICE_EVENTS, MESSAGE_TYPES, type KeepKeyEvent } from '../constants/events';

// Log licensing notice once when module is loaded
console.warn(`[Velocity BPA Licensing Notice]

This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).

Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.

For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.`);

export interface DeviceFeatures {
  vendor: string;
  major_version: number;
  minor_version: number;
  patch_version: number;
  bootloader_mode: boolean;
  device_id: string;
  pin_protection: boolean;
  passphrase_protection: boolean;
  language: string;
  label: string;
  initialized: boolean;
  model: string;
  firmware_present?: boolean;
  needs_backup?: boolean;
  flags?: number;
  fw_vendor?: string;
}

export interface KeepKeyDevice {
  path: string;
  vendorId: number;
  productId: number;
  label?: string;
  features?: DeviceFeatures;
}

export interface TransportConfig {
  connectionType: ConnectionType;
  devicePath?: string;
  vendorId?: number;
  productId?: number;
  bridgeUrl?: string;
  desktopUrl?: string;
  apiKey?: string;
  timeout?: number;
}

export interface MessageResponse<T = unknown> {
  type: number;
  message: T;
}

export class KeepKeyClient extends EventEmitter {
  private config: TransportConfig;
  private device: KeepKeyDevice | null = null;
  private connected: boolean = false;
  private sessionId: string | null = null;

  constructor(config: TransportConfig) {
    super();
    this.config = {
      ...config,
      vendorId: config.vendorId || USB_CONFIG.VENDOR_ID,
      productId: config.productId || USB_CONFIG.PRODUCT_ID,
      timeout: config.timeout || DEVICE_TIMEOUTS.OPERATION,
    };
  }

  /**
   * Connect to KeepKey device
   */
  async connect(): Promise<KeepKeyDevice> {
    try {
      switch (this.config.connectionType) {
        case CONNECTION_TYPES.USB_HID:
          return await this.connectUsbHid();
        case CONNECTION_TYPES.WEBUSB:
          return await this.connectWebUsb();
        case CONNECTION_TYPES.KEEPKEY_DESKTOP:
          return await this.connectDesktop();
        case CONNECTION_TYPES.KEEPKEY_BRIDGE:
          return await this.connectBridge();
        default:
          throw new Error(`Unsupported connection type: ${this.config.connectionType}`);
      }
    } catch (error) {
      this.emit(DEVICE_EVENTS.FAILURE, error);
      throw error;
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.clearSession();
      this.connected = false;
      this.device = null;
      this.sessionId = null;
      this.emit(DEVICE_EVENTS.DISCONNECTED);
    } catch (error) {
      throw new Error(`Failed to disconnect: ${(error as Error).message}`);
    }
  }

  /**
   * Check if device is connected
   */
  isConnected(): boolean {
    return this.connected && this.device !== null;
  }

  /**
   * Get connected device
   */
  getDevice(): KeepKeyDevice | null {
    return this.device;
  }

  /**
   * Get device features
   */
  async getFeatures(): Promise<DeviceFeatures> {
    const response = await this.call<DeviceFeatures>(MESSAGE_TYPES.Initialize, {});
    return response.message;
  }

  /**
   * Ping device
   */
  async ping(message: string = 'ping'): Promise<string> {
    const response = await this.call<{ message: string }>(MESSAGE_TYPES.Ping, {
      message,
      button_protection: false,
    });
    return response.message.message;
  }

  /**
   * Get device entropy
   */
  async getEntropy(size: number): Promise<Buffer> {
    const response = await this.call<{ entropy: string }>(MESSAGE_TYPES.GetEntropy, { size });
    return Buffer.from(response.message.entropy, 'hex');
  }

  /**
   * Cancel current operation
   */
  async cancel(): Promise<void> {
    await this.call(MESSAGE_TYPES.Cancel, {});
  }

  /**
   * Clear session
   */
  async clearSession(): Promise<void> {
    await this.call(MESSAGE_TYPES.ClearSession, {});
    this.sessionId = null;
  }

  /**
   * Apply device settings
   */
  async applySettings(settings: {
    label?: string;
    language?: string;
    use_passphrase?: boolean;
    auto_lock_delay_ms?: number;
  }): Promise<void> {
    await this.callWithButtonAck(MESSAGE_TYPES.ApplySettings, settings);
  }

  /**
   * Wipe device
   */
  async wipeDevice(): Promise<void> {
    await this.callWithButtonAck(MESSAGE_TYPES.WipeDevice, {});
  }

  /**
   * Reset device (initialize with new seed)
   */
  async resetDevice(params: {
    strength?: number;
    passphrase_protection?: boolean;
    pin_protection?: boolean;
    label?: string;
    language?: string;
    skip_backup?: boolean;
  }): Promise<void> {
    await this.callWithButtonAck(MESSAGE_TYPES.ResetDevice, {
      display_random: true,
      strength: params.strength || 256,
      passphrase_protection: params.passphrase_protection || false,
      pin_protection: params.pin_protection || true,
      label: params.label || '',
      language: params.language || 'en-US',
      skip_backup: params.skip_backup || false,
    });
  }

  /**
   * Recover device from seed
   */
  async recoverDevice(params: {
    word_count: 12 | 18 | 24;
    passphrase_protection?: boolean;
    pin_protection?: boolean;
    label?: string;
    language?: string;
    enforce_wordlist?: boolean;
    type?: number;
    dry_run?: boolean;
  }): Promise<void> {
    await this.callWithRecovery(MESSAGE_TYPES.RecoveryDevice, {
      word_count: params.word_count,
      passphrase_protection: params.passphrase_protection || false,
      pin_protection: params.pin_protection || true,
      label: params.label || '',
      language: params.language || 'en-US',
      enforce_wordlist: params.enforce_wordlist !== false,
      type: params.type || 0,
      dry_run: params.dry_run || false,
    });
  }

  /**
   * Change PIN
   */
  async changePin(remove: boolean = false): Promise<void> {
    await this.callWithPinMatrix(MESSAGE_TYPES.ChangePin, { remove });
  }

  /**
   * Send PIN matrix acknowledgement
   */
  async sendPin(pin: string): Promise<MessageResponse> {
    return this.call(MESSAGE_TYPES.PinMatrixAck, { pin });
  }

  /**
   * Send passphrase acknowledgement
   */
  async sendPassphrase(passphrase: string, onDevice: boolean = false): Promise<MessageResponse> {
    return this.call(MESSAGE_TYPES.PassphraseAck, {
      passphrase: onDevice ? undefined : passphrase,
      on_device: onDevice,
    });
  }

  /**
   * Send word acknowledgement (for recovery)
   */
  async sendWord(word: string): Promise<MessageResponse> {
    return this.call(MESSAGE_TYPES.WordAck, { word });
  }

  /**
   * Send button acknowledgement
   */
  async sendButtonAck(): Promise<MessageResponse> {
    return this.call(MESSAGE_TYPES.ButtonAck, {});
  }

  /**
   * Make a call to the device
   */
  async call<T = unknown>(type: number, params: Record<string, unknown>): Promise<MessageResponse<T>> {
    if (!this.connected) {
      throw new Error('Device not connected');
    }

    // Implementation depends on transport type
    switch (this.config.connectionType) {
      case CONNECTION_TYPES.USB_HID:
        return this.callUsbHid<T>(type, params);
      case CONNECTION_TYPES.WEBUSB:
        return this.callWebUsb<T>(type, params);
      case CONNECTION_TYPES.KEEPKEY_DESKTOP:
        return this.callDesktop<T>(type, params);
      case CONNECTION_TYPES.KEEPKEY_BRIDGE:
        return this.callBridge<T>(type, params);
      default:
        throw new Error(`Unsupported connection type: ${this.config.connectionType}`);
    }
  }

  /**
   * Call with button acknowledgement handling
   */
  private async callWithButtonAck<T = unknown>(
    type: number,
    params: Record<string, unknown>,
  ): Promise<MessageResponse<T>> {
    const response = await this.call<T>(type, params);

    if (response.type === MESSAGE_TYPES.ButtonRequest) {
      this.emit(DEVICE_EVENTS.BUTTON_REQUEST, response.message);
      return this.sendButtonAck() as Promise<MessageResponse<T>>;
    }

    return response;
  }

  /**
   * Call with PIN matrix handling
   */
  private async callWithPinMatrix<T = unknown>(
    type: number,
    params: Record<string, unknown>,
  ): Promise<MessageResponse<T>> {
    const response = await this.call<T>(type, params);

    if (response.type === MESSAGE_TYPES.PinMatrixRequest) {
      this.emit(DEVICE_EVENTS.PIN_REQUEST, response.message);
      // PIN will be sent separately via sendPin()
    }

    return response;
  }

  /**
   * Call with recovery word handling
   */
  private async callWithRecovery<T = unknown>(
    type: number,
    params: Record<string, unknown>,
  ): Promise<MessageResponse<T>> {
    const response = await this.call<T>(type, params);

    if (response.type === MESSAGE_TYPES.WordRequest) {
      this.emit(DEVICE_EVENTS.WORD_REQUEST, response.message);
      // Word will be sent separately via sendWord()
    }

    return response;
  }

  // Transport-specific implementations

  private async connectUsbHid(): Promise<KeepKeyDevice> {
    // USB HID connection implementation
    // Note: Requires node-hid or similar library
    const device: KeepKeyDevice = {
      path: this.config.devicePath || '',
      vendorId: this.config.vendorId!,
      productId: this.config.productId!,
    };

    this.device = device;
    this.connected = true;

    const features = await this.getFeatures();
    this.device.features = features;
    this.device.label = features.label;

    this.emit(DEVICE_EVENTS.CONNECTED, this.device);
    return this.device;
  }

  private async connectWebUsb(): Promise<KeepKeyDevice> {
    // WebUSB connection implementation
    const device: KeepKeyDevice = {
      path: 'webusb',
      vendorId: this.config.vendorId!,
      productId: this.config.productId!,
    };

    this.device = device;
    this.connected = true;

    const features = await this.getFeatures();
    this.device.features = features;
    this.device.label = features.label;

    this.emit(DEVICE_EVENTS.CONNECTED, this.device);
    return this.device;
  }

  private async connectDesktop(): Promise<KeepKeyDevice> {
    // KeepKey Desktop API connection
    const url = this.config.desktopUrl || 'http://localhost:1646';
    const response = await fetch(`${url}/devices`);
    const devices = await response.json() as KeepKeyDevice[];

    if (devices.length === 0) {
      throw new Error('No KeepKey device found via Desktop');
    }

    this.device = devices[0];
    this.connected = true;

    this.emit(DEVICE_EVENTS.CONNECTED, this.device);
    return this.device;
  }

  private async connectBridge(): Promise<KeepKeyDevice> {
    // KeepKey Bridge connection
    const url = this.config.bridgeUrl || 'http://localhost:1646';
    const response = await fetch(`${url}/enumerate`);
    const devices = await response.json() as Array<{ path: string; session?: string }>;

    if (devices.length === 0) {
      throw new Error('No KeepKey device found via Bridge');
    }

    const deviceInfo = devices[0];

    // Acquire session
    const acquireResponse = await fetch(`${url}/acquire/${deviceInfo.path}/${deviceInfo.session || 'null'}`, {
      method: 'POST',
    });
    const session = await acquireResponse.json() as { session: string };
    this.sessionId = session.session;

    this.device = {
      path: deviceInfo.path,
      vendorId: this.config.vendorId!,
      productId: this.config.productId!,
    };
    this.connected = true;

    const features = await this.getFeatures();
    this.device.features = features;
    this.device.label = features.label;

    this.emit(DEVICE_EVENTS.CONNECTED, this.device);
    return this.device;
  }

  private async callUsbHid<T>(_type: number, _params: Record<string, unknown>): Promise<MessageResponse<T>> {
    // USB HID call implementation
    throw new Error('USB HID transport requires native module');
  }

  private async callWebUsb<T>(_type: number, _params: Record<string, unknown>): Promise<MessageResponse<T>> {
    // WebUSB call implementation
    throw new Error('WebUSB transport requires browser environment');
  }

  private async callDesktop<T>(type: number, params: Record<string, unknown>): Promise<MessageResponse<T>> {
    const url = this.config.desktopUrl || 'http://localhost:1646';
    const response = await fetch(`${url}/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({ type, ...params }),
    });

    const result = await response.json() as MessageResponse<T>;
    return result;
  }

  private async callBridge<T>(type: number, params: Record<string, unknown>): Promise<MessageResponse<T>> {
    const url = this.config.bridgeUrl || 'http://localhost:1646';
    const response = await fetch(`${url}/call/${this.sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message: params }),
    });

    const result = await response.json() as MessageResponse<T>;
    return result;
  }

  /**
   * Subscribe to device events
   */
  onEvent(event: KeepKeyEvent, callback: (...args: unknown[]) => void): void {
    this.on(event, callback);
  }

  /**
   * Unsubscribe from device events
   */
  offEvent(event: KeepKeyEvent, callback: (...args: unknown[]) => void): void {
    this.off(event, callback);
  }
}

/**
 * Create a new KeepKey client instance
 */
export function createKeepKeyClient(config: TransportConfig): KeepKeyClient {
  return new KeepKeyClient(config);
}

/**
 * Enumerate connected KeepKey devices
 */
export async function enumerateDevices(
  connectionType: ConnectionType,
  options?: { bridgeUrl?: string; desktopUrl?: string },
): Promise<KeepKeyDevice[]> {
  switch (connectionType) {
    case CONNECTION_TYPES.KEEPKEY_DESKTOP: {
      const url = options?.desktopUrl || 'http://localhost:1646';
      const response = await fetch(`${url}/devices`);
      return response.json() as Promise<KeepKeyDevice[]>;
    }
    case CONNECTION_TYPES.KEEPKEY_BRIDGE: {
      const url = options?.bridgeUrl || 'http://localhost:1646';
      const response = await fetch(`${url}/enumerate`);
      const devices = await response.json() as Array<{ path: string }>;
      return devices.map((d) => ({
        path: d.path,
        vendorId: USB_CONFIG.VENDOR_ID,
        productId: USB_CONFIG.PRODUCT_ID,
      }));
    }
    default:
      return [];
  }
}
