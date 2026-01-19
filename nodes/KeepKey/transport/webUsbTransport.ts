/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * WebUSB Transport for KeepKey hardware wallet
 *
 * This module provides WebUSB-based communication with KeepKey devices.
 * Note: WebUSB is only available in browser environments.
 * In Node.js/n8n server context, this transport will not be functional.
 */

import { EventEmitter } from 'events';
import { USB_CONFIG, WEBUSB_CONFIG, DEVICE_TIMEOUTS } from '../constants/usbIds';
import { DEVICE_EVENTS } from '../constants/events';

// Browser-specific type declarations for Node.js compilation
type BufferSource = ArrayBuffer | ArrayBufferView;

interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  serialNumber?: string;
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

interface USBConfiguration {
  configurationValue: number;
}

interface USBInTransferResult {
  data: DataView | null;
  status: 'ok' | 'stall' | 'babble';
}

interface USBOutTransferResult {
  bytesWritten: number;
  status: 'ok' | 'stall';
}

interface USBConnectionEvent {
  device: USBDevice;
}

interface USBDevice {
  vendorId: number;
  productId: number;
  deviceClass: number;
  deviceSubclass: number;
  deviceProtocol: number;
  deviceVersionMajor: number;
  deviceVersionMinor: number;
  deviceVersionSubminor: number;
  manufacturerName: string | null;
  productName: string | null;
  serialNumber: string | null;
  configuration: USBConfiguration | null;
  opened: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
}

interface USB {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
  addEventListener(type: 'connect' | 'disconnect', listener: (event: USBConnectionEvent) => void): void;
  removeEventListener(type: 'connect' | 'disconnect', listener: (event: USBConnectionEvent) => void): void;
}

interface NavigatorUSB {
  usb?: USB;
}

// Helper to safely access WebUSB navigator
function getNavigatorUsb(): USB | null {
  if (typeof globalThis !== 'undefined' && 'navigator' in globalThis) {
    const nav = (globalThis as unknown as { navigator: NavigatorUSB }).navigator;
    return nav.usb || null;
  }
  return null;
}

export interface WebUsbDevice {
  vendorId: number;
  productId: number;
  deviceClass: number;
  deviceSubclass: number;
  deviceProtocol: number;
  deviceVersionMajor: number;
  deviceVersionMinor: number;
  deviceVersionSubminor: number;
  manufacturerName?: string;
  productName?: string;
  serialNumber?: string;
  opened: boolean;
}

export interface WebUsbTransportConfig {
  timeout?: number;
}

/**
 * WebUSB Transport for KeepKey
 * Note: This transport is primarily for browser environments
 */
export class WebUsbTransport extends EventEmitter {
  private _config: Required<WebUsbTransportConfig>;
  private device: USBDevice | null = null;
  private connected: boolean = false;

  constructor(config: WebUsbTransportConfig = {}) {
    super();
    this._config = {
      timeout: config.timeout || DEVICE_TIMEOUTS.OPERATION,
    };
  }

  /**
   * Check if WebUSB is supported
   */
  static isSupported(): boolean {
    return getNavigatorUsb() !== null;
  }

  /**
   * Request device access from user
   */
  async requestDevice(): Promise<WebUsbDevice | null> {
    const usb = getNavigatorUsb();
    if (!usb) {
      throw new Error('WebUSB is not supported in this environment');
    }

    try {
      const device = await usb.requestDevice({
        filters: WEBUSB_CONFIG.filters,
      });

      return this.mapDevice(device);
    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        // User cancelled
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all authorized devices
   */
  async getDevices(): Promise<WebUsbDevice[]> {
    const usb = getNavigatorUsb();
    if (!usb) {
      return [];
    }

    const devices = await usb.getDevices();
    return devices
      .filter(
        (d: USBDevice) =>
          d.vendorId === USB_CONFIG.VENDOR_ID &&
          (d.productId === USB_CONFIG.PRODUCT_ID ||
            d.productId === USB_CONFIG.BOOTLOADER_PRODUCT_ID),
      )
      .map((d: USBDevice) => this.mapDevice(d));
  }

  /**
   * Connect to a device
   */
  async connect(device?: USBDevice): Promise<WebUsbDevice> {
    const usb = getNavigatorUsb();
    if (!usb) {
      throw new Error('WebUSB is not supported in this environment');
    }

    try {
      let targetDevice = device;

      if (!targetDevice) {
        // Get first available device or request one
        const devices = await usb.getDevices();
        targetDevice = devices.find(
          (d: USBDevice) => d.vendorId === USB_CONFIG.VENDOR_ID && d.productId === USB_CONFIG.PRODUCT_ID,
        );

        if (!targetDevice) {
          targetDevice = await usb.requestDevice({
            filters: WEBUSB_CONFIG.filters,
          });
        }
      }

      if (!targetDevice) {
        throw new Error('No KeepKey device found');
      }

      await targetDevice.open();

      if (targetDevice.configuration === null) {
        await targetDevice.selectConfiguration(1);
      }

      await targetDevice.claimInterface(USB_CONFIG.INTERFACE);

      this.device = targetDevice;
      this.connected = true;

      const deviceInfo = this.mapDevice(targetDevice);
      this.emit(DEVICE_EVENTS.CONNECTED, deviceInfo);

      return deviceInfo;
    } catch (error) {
      this.emit(DEVICE_EVENTS.FAILURE, error);
      throw error;
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    if (!this.device) {
      return;
    }

    try {
      await this.device.releaseInterface(USB_CONFIG.INTERFACE);
      await this.device.close();
    } catch {
      // Ignore errors during disconnect
    } finally {
      this.device = null;
      this.connected = false;
      this.emit(DEVICE_EVENTS.DISCONNECTED);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.device !== null;
  }

  /**
   * Send data to device
   */
  async write(data: Uint8Array): Promise<void> {
    if (!this.device) {
      throw new Error('Not connected to device');
    }

    const result = await this.device.transferOut(USB_CONFIG.ENDPOINT_OUT, data);
    if (result.status !== 'ok') {
      throw new Error(`Write failed with status: ${result.status}`);
    }
  }

  /**
   * Read data from device
   */
  async read(length: number = 64): Promise<Uint8Array> {
    if (!this.device) {
      throw new Error('Not connected to device');
    }

    const result = await this.device.transferIn(USB_CONFIG.ENDPOINT_IN, length);
    if (result.status !== 'ok') {
      throw new Error(`Read failed with status: ${result.status}`);
    }

    if (!result.data) {
      return new Uint8Array(0);
    }

    return new Uint8Array(result.data.buffer);
  }

  /**
   * Send a message and wait for response
   */
  async call<T = unknown>(
    _messageType: number,
    _message: Record<string, unknown>,
  ): Promise<{ type: number; message: T }> {
    // In a real implementation, this would:
    // 1. Serialize the message using protobuf
    // 2. Send via write()
    // 3. Read response via read()
    // 4. Deserialize response
    throw new Error('WebUSB transport call() not implemented - use bridge transport in n8n');
  }

  /**
   * Listen for device connection events
   */
  listenForDevices(callback: (event: 'connect' | 'disconnect', device: WebUsbDevice) => void): () => void {
    const usb = getNavigatorUsb();
    if (!usb) {
      return () => {};
    }

    const connectHandler = (event: USBConnectionEvent): void => {
      const deviceInfo = this.mapDevice(event.device);
      callback('connect', deviceInfo);
    };

    const disconnectHandler = (event: USBConnectionEvent): void => {
      const deviceInfo = this.mapDevice(event.device);
      callback('disconnect', deviceInfo);
    };

    usb.addEventListener('connect', connectHandler);
    usb.addEventListener('disconnect', disconnectHandler);

    return () => {
      usb.removeEventListener('connect', connectHandler);
      usb.removeEventListener('disconnect', disconnectHandler);
    };
  }

  /**
   * Map USBDevice to our device interface
   */
  private mapDevice(device: USBDevice): WebUsbDevice {
    return {
      vendorId: device.vendorId,
      productId: device.productId,
      deviceClass: device.deviceClass,
      deviceSubclass: device.deviceSubclass,
      deviceProtocol: device.deviceProtocol,
      deviceVersionMajor: device.deviceVersionMajor,
      deviceVersionMinor: device.deviceVersionMinor,
      deviceVersionSubminor: device.deviceVersionSubminor,
      manufacturerName: device.manufacturerName || undefined,
      productName: device.productName || undefined,
      serialNumber: device.serialNumber || undefined,
      opened: device.opened,
    };
  }

  /**
   * Get current device info
   */
  getDevice(): WebUsbDevice | null {
    return this.device ? this.mapDevice(this.device) : null;
  }

  /**
   * Get configuration
   */
  getConfig(): Required<WebUsbTransportConfig> {
    return { ...this._config };
  }
}

export default WebUsbTransport;
