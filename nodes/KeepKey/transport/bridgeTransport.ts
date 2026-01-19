/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * KeepKey Bridge Transport
 *
 * This module provides communication with KeepKey devices through the
 * KeepKey Bridge application, which runs as a local service and provides
 * a REST API for device communication.
 */

import { EventEmitter } from 'events';
import { BRIDGE_CONFIG, DEVICE_TIMEOUTS } from '../constants/usbIds';
import { DEVICE_EVENTS } from '../constants/events';

export interface BridgeDevice {
  path: string;
  session?: string;
  debugSession?: string;
  product?: string;
  vendor?: string;
}

export interface BridgeTransportConfig {
  url?: string;
  timeout?: number;
}

export interface BridgeResponse<T = unknown> {
  type: number;
  message: T;
}

/**
 * KeepKey Bridge Transport
 */
export class BridgeTransport extends EventEmitter {
  private config: Required<BridgeTransportConfig>;
  private session: string | null = null;
  private device: BridgeDevice | null = null;
  private connected: boolean = false;
  private listenController: AbortController | null = null;

  constructor(config: BridgeTransportConfig = {}) {
    super();
    this.config = {
      url: config.url || BRIDGE_CONFIG.DEFAULT_URL,
      timeout: config.timeout || DEVICE_TIMEOUTS.OPERATION,
    };
  }

  /**
   * Check if Bridge is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.url}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get Bridge version
   */
  async getVersion(): Promise<string> {
    const response = await fetch(`${this.config.url}/`);
    const data = await response.json() as { version: string };
    return data.version;
  }

  /**
   * Enumerate all connected devices
   */
  async enumerate(): Promise<BridgeDevice[]> {
    const response = await fetch(`${this.config.url}${BRIDGE_CONFIG.ENDPOINTS.ENUMERATE}`);
    const devices = await response.json() as BridgeDevice[];
    return devices;
  }

  /**
   * Acquire a device session
   */
  async acquire(devicePath: string, previousSession?: string | null): Promise<string> {
    const prev = previousSession || 'null';
    const response = await fetch(
      `${this.config.url}${BRIDGE_CONFIG.ENDPOINTS.ACQUIRE}/${devicePath}/${prev}`,
      { method: 'POST' },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to acquire device: ${error}`);
    }

    const data = await response.json() as { session: string };
    return data.session;
  }

  /**
   * Release a device session
   */
  async release(session: string): Promise<void> {
    const response = await fetch(`${this.config.url}${BRIDGE_CONFIG.ENDPOINTS.RELEASE}/${session}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to release session: ${error}`);
    }
  }

  /**
   * Connect to a device
   */
  async connect(devicePath?: string): Promise<BridgeDevice> {
    try {
      // Enumerate devices
      const devices = await this.enumerate();

      if (devices.length === 0) {
        throw new Error('No KeepKey device found via Bridge');
      }

      // Select device
      const targetDevice = devicePath
        ? devices.find((d) => d.path === devicePath)
        : devices[0];

      if (!targetDevice) {
        throw new Error(`Device not found: ${devicePath}`);
      }

      // Acquire session
      this.session = await this.acquire(targetDevice.path, targetDevice.session);
      this.device = { ...targetDevice, session: this.session };
      this.connected = true;

      this.emit(DEVICE_EVENTS.CONNECTED, this.device);
      return this.device;
    } catch (error) {
      this.emit(DEVICE_EVENTS.FAILURE, error);
      throw error;
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    if (!this.connected || !this.session) {
      return;
    }

    try {
      // Stop listening
      this.stopListening();

      // Release session
      await this.release(this.session);

      this.session = null;
      this.device = null;
      this.connected = false;

      this.emit(DEVICE_EVENTS.DISCONNECTED);
    } catch (error) {
      throw new Error(`Failed to disconnect: ${(error as Error).message}`);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.session !== null;
  }

  /**
   * Get current device
   */
  getDevice(): BridgeDevice | null {
    return this.device;
  }

  /**
   * Get current session
   */
  getSession(): string | null {
    return this.session;
  }

  /**
   * Call device with a message
   */
  async call<T = unknown>(
    messageType: number,
    message: Record<string, unknown>,
  ): Promise<BridgeResponse<T>> {
    if (!this.session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${this.config.url}${BRIDGE_CONFIG.ENDPOINTS.CALL}/${this.session}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: messageType,
        message,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bridge call failed: ${error}`);
    }

    const result = await response.json() as BridgeResponse<T>;
    return result;
  }

  /**
   * Post raw message to device
   */
  async post<T = unknown>(data: string): Promise<BridgeResponse<T>> {
    if (!this.session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${this.config.url}${BRIDGE_CONFIG.ENDPOINTS.CALL}/${this.session}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: data,
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bridge post failed: ${error}`);
    }

    return response.json() as Promise<BridgeResponse<T>>;
  }

  /**
   * Start listening for device events
   */
  async listen(): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }

    this.listenController = new AbortController();

    try {
      const response = await fetch(`${this.config.url}${BRIDGE_CONFIG.ENDPOINTS.LISTEN}/${this.session}`, {
        method: 'POST',
        signal: this.listenController.signal,
      });

      if (!response.ok) {
        throw new Error('Listen request failed');
      }

      const data = await response.json() as BridgeResponse;

      // Emit event based on message type
      this.handleListenResponse(data);

      // Continue listening if not aborted
      if (!this.listenController.signal.aborted) {
        void this.listen();
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.emit(DEVICE_EVENTS.FAILURE, error);
      }
    }
  }

  /**
   * Stop listening for events
   */
  stopListening(): void {
    if (this.listenController) {
      this.listenController.abort();
      this.listenController = null;
    }
  }

  /**
   * Handle listen response and emit appropriate events
   */
  private handleListenResponse(response: BridgeResponse): void {
    switch (response.type) {
      case 26: // ButtonRequest
        this.emit(DEVICE_EVENTS.BUTTON_REQUEST, response.message);
        break;
      case 18: // PinMatrixRequest
        this.emit(DEVICE_EVENTS.PIN_REQUEST, response.message);
        break;
      case 41: // PassphraseRequest
        this.emit(DEVICE_EVENTS.PASSPHRASE_REQUEST, response.message);
        break;
      case 46: // WordRequest
        this.emit(DEVICE_EVENTS.WORD_REQUEST, response.message);
        break;
      case 3: // Failure
        this.emit(DEVICE_EVENTS.FAILURE, response.message);
        break;
      case 2: // Success
        this.emit(DEVICE_EVENTS.SUCCESS, response.message);
        break;
    }
  }

  /**
   * Refresh session (re-acquire if needed)
   */
  async refreshSession(): Promise<string> {
    if (!this.device) {
      throw new Error('No device connected');
    }

    const devices = await this.enumerate();
    const currentDevice = devices.find((d) => d.path === this.device!.path);

    if (!currentDevice) {
      this.connected = false;
      throw new Error('Device disconnected');
    }

    if (currentDevice.session !== this.session) {
      // Session changed, re-acquire
      this.session = await this.acquire(currentDevice.path, currentDevice.session);
      this.device.session = this.session;
    }

    return this.session!;
  }
}

/**
 * Create a new Bridge transport instance
 */
export function createBridgeTransport(config?: BridgeTransportConfig): BridgeTransport {
  return new BridgeTransport(config);
}

/**
 * Check if Bridge is running
 */
export async function isBridgeAvailable(url?: string): Promise<boolean> {
  const transport = new BridgeTransport({ url });
  return transport.isAvailable();
}
