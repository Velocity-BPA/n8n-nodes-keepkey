/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * USB HID Transport for KeepKey hardware wallet
 *
 * This module provides low-level USB HID communication with KeepKey devices.
 * It handles device enumeration, connection, and packet-level communication.
 */

import { EventEmitter } from 'events';
import { USB_CONFIG, DEVICE_TIMEOUTS } from '../constants/usbIds';
import { DEVICE_EVENTS } from '../constants/events';

export interface UsbDevice {
  vendorId: number;
  productId: number;
  path: string;
  serialNumber?: string;
  manufacturer?: string;
  product?: string;
  release?: number;
  interface?: number;
}

export interface UsbTransportConfig {
  vendorId?: number;
  productId?: number;
  devicePath?: string;
  timeout?: number;
}

/**
 * USB HID Transport for KeepKey
 */
export class UsbTransport extends EventEmitter {
  private config: Required<Omit<UsbTransportConfig, 'devicePath'>> & { devicePath?: string };
  private device: UsbDevice | null = null;
  private handle: unknown = null;
  private connected: boolean = false;

  constructor(config: UsbTransportConfig = {}) {
    super();
    this.config = {
      vendorId: config.vendorId || USB_CONFIG.VENDOR_ID,
      productId: config.productId || USB_CONFIG.PRODUCT_ID,
      devicePath: config.devicePath,
      timeout: config.timeout || DEVICE_TIMEOUTS.OPERATION,
    };
  }

  /**
   * Enumerate all connected KeepKey devices
   */
  async enumerate(): Promise<UsbDevice[]> {
    try {
      // Note: This requires the 'usb' or 'node-hid' package
      // In a real implementation, we would use:
      // import HID from 'node-hid';
      // const devices = HID.devices();

      // For now, return mock implementation info
      return [];
    } catch (error) {
      throw new Error(`Failed to enumerate USB devices: ${(error as Error).message}`);
    }
  }

  /**
   * Connect to a KeepKey device
   */
  async connect(path?: string): Promise<UsbDevice> {
    try {
      const devicePath = path || this.config.devicePath;

      if (!devicePath) {
        // Find first available device
        const devices = await this.enumerate();
        const keepKey = devices.find(
          (d) => d.vendorId === this.config.vendorId && d.productId === this.config.productId,
        );

        if (!keepKey) {
          throw new Error('No KeepKey device found');
        }

        this.device = keepKey;
      } else {
        this.device = {
          vendorId: this.config.vendorId,
          productId: this.config.productId,
          path: devicePath,
        };
      }

      // Open HID device
      // In real implementation:
      // this.handle = new HID.HID(this.device.path);

      this.connected = true;
      this.emit(DEVICE_EVENTS.CONNECTED, this.device);
      return this.device;
    } catch (error) {
      this.emit(DEVICE_EVENTS.FAILURE, error);
      throw new Error(`Failed to connect to device: ${(error as Error).message}`);
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    if (!this.connected || !this.handle) {
      return;
    }

    try {
      // In real implementation:
      // (this.handle as HID.HID).close();

      this.connected = false;
      this.device = null;
      this.handle = null;
      this.emit(DEVICE_EVENTS.DISCONNECTED);
    } catch (error) {
      throw new Error(`Failed to disconnect: ${(error as Error).message}`);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get connected device info
   */
  getDevice(): UsbDevice | null {
    return this.device;
  }

  /**
   * Write data to device
   */
  async write(data: Buffer): Promise<number> {
    if (!this.connected || !this.handle) {
      throw new Error('Device not connected');
    }

    try {
      // Pad data to packet size
      const packet = Buffer.alloc(USB_CONFIG.PACKET_SIZE + 1); // +1 for report ID
      packet[0] = 0x00; // Report ID
      data.copy(packet, 1, 0, Math.min(data.length, USB_CONFIG.PACKET_SIZE));

      // In real implementation:
      // return (this.handle as HID.HID).write(Array.from(packet));

      return packet.length;
    } catch (error) {
      throw new Error(`Failed to write to device: ${(error as Error).message}`);
    }
  }

  /**
   * Read data from device
   */
  async read(timeout?: number): Promise<Buffer> {
    if (!this.connected || !this.handle) {
      throw new Error('Device not connected');
    }

    try {
      // In real implementation:
      // const readTimeoutMs = timeout || this.config.timeout;
      // const data = (this.handle as HID.HID).readTimeout(readTimeoutMs);
      // return Buffer.from(data);

      // Mock empty response
      void timeout; // Acknowledge parameter
      return Buffer.alloc(0);
    } catch (error) {
      throw new Error(`Failed to read from device: ${(error as Error).message}`);
    }
  }

  /**
   * Send a message and wait for response
   */
  async exchange(data: Buffer, timeout?: number): Promise<Buffer> {
    await this.write(data);
    return this.read(timeout);
  }

  /**
   * Send a protocol message
   */
  async sendMessage(messageType: number, message: Buffer): Promise<Buffer> {
    // KeepKey protocol format:
    // [0x3F] [MSG_TYPE (2 bytes)] [MSG_LENGTH (4 bytes)] [MSG_DATA...]

    const header = Buffer.alloc(7);
    header[0] = 0x3f; // Protocol marker
    header.writeUInt16BE(messageType, 1);
    header.writeUInt32BE(message.length, 3);

    const fullMessage = Buffer.concat([header, message]);

    // Split into packets
    const packets: Buffer[] = [];
    for (let i = 0; i < fullMessage.length; i += USB_CONFIG.PACKET_SIZE - 1) {
      const packet = Buffer.alloc(USB_CONFIG.PACKET_SIZE);
      packet[0] = i === 0 ? 0x3f : 0x3f; // First packet marker
      fullMessage.copy(packet, 1, i, Math.min(i + USB_CONFIG.PACKET_SIZE - 1, fullMessage.length));
      packets.push(packet);
    }

    // Send all packets
    for (const packet of packets) {
      await this.write(packet);
    }

    // Read response packets
    const responsePackets: Buffer[] = [];
    let totalLength = 0;
    let expectedLength = 0;
    let responseType = 0;

    while (true) {
      const packet = await this.read();
      if (packet.length === 0) {
        break;
      }

      if (responsePackets.length === 0 && packet[0] === 0x3f) {
        // First packet - extract header
        responseType = packet.readUInt16BE(1);
        expectedLength = packet.readUInt32BE(3);
        responsePackets.push(packet.subarray(7));
        totalLength += packet.length - 7;
      } else {
        responsePackets.push(packet.subarray(1));
        totalLength += packet.length - 1;
      }

      if (totalLength >= expectedLength) {
        break;
      }
    }

    // Note: responseType could be used to validate response type matches expected
    void responseType;

    const response = Buffer.concat(responsePackets, expectedLength);
    return response;
  }
}

/**
 * Create a new USB transport instance
 */
export function createUsbTransport(config?: UsbTransportConfig): UsbTransport {
  return new UsbTransport(config);
}
