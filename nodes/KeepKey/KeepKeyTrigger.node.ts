/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
  ITriggerFunctions,
  INodeType,
  INodeTypeDescription,
  ITriggerResponse,
  IDataObject,
} from 'n8n-workflow';

import { KeepKeyClient } from './transport';
import { DEVICE_EVENTS, TRANSACTION_EVENTS, SWAP_EVENTS, type KeepKeyEvent } from './constants/events';

export class KeepKeyTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'KeepKey Trigger',
    name: 'keepKeyTrigger',
    icon: 'file:keepkey.svg',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["event"]}}',
    description: 'Triggers on KeepKey hardware wallet events',
    defaults: {
      name: 'KeepKey Trigger',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'keepKeyApi',
        required: false,
      },
    ],
    properties: [
      {
        displayName: 'Connection Type',
        name: 'connectionType',
        type: 'options',
        options: [
          {
            name: 'KeepKey Bridge',
            value: 'bridge',
            description: 'Connect via KeepKey Bridge (recommended)',
          },
          {
            name: 'KeepKey Desktop',
            value: 'desktop',
            description: 'Connect via KeepKey Desktop app',
          },
        ],
        default: 'bridge',
        description: 'How to connect to the KeepKey device',
      },
      {
        displayName: 'Bridge URL',
        name: 'bridgeUrl',
        type: 'string',
        default: 'http://localhost:1646',
        description: 'KeepKey Bridge URL',
        displayOptions: {
          show: {
            connectionType: ['bridge'],
          },
        },
      },
      {
        displayName: 'Desktop URL',
        name: 'desktopUrl',
        type: 'string',
        default: 'http://localhost:1646',
        description: 'KeepKey Desktop URL',
        displayOptions: {
          show: {
            connectionType: ['desktop'],
          },
        },
      },
      {
        displayName: 'Event Type',
        name: 'event',
        type: 'options',
        options: [
          {
            name: 'Device Connected',
            value: 'deviceConnected',
            description: 'Triggers when a KeepKey device is connected',
          },
          {
            name: 'Device Disconnected',
            value: 'deviceDisconnected',
            description: 'Triggers when a KeepKey device is disconnected',
          },
          {
            name: 'Button Request',
            value: 'buttonRequest',
            description: 'Triggers when device requests button confirmation',
          },
          {
            name: 'PIN Request',
            value: 'pinRequest',
            description: 'Triggers when device requests PIN entry',
          },
          {
            name: 'Passphrase Request',
            value: 'passphraseRequest',
            description: 'Triggers when device requests passphrase',
          },
          {
            name: 'Transaction Signed',
            value: 'transactionSigned',
            description: 'Triggers when a transaction is signed',
          },
          {
            name: 'Transaction Rejected',
            value: 'transactionRejected',
            description: 'Triggers when a transaction is rejected',
          },
          {
            name: 'Swap Initiated',
            value: 'swapInitiated',
            description: 'Triggers when a swap is initiated',
          },
          {
            name: 'Swap Completed',
            value: 'swapCompleted',
            description: 'Triggers when a swap is completed',
          },
          {
            name: 'All Events',
            value: 'all',
            description: 'Triggers on any device event',
          },
        ],
        default: 'deviceConnected',
        description: 'The event to listen for',
      },
      {
        displayName: 'Poll Interval',
        name: 'pollInterval',
        type: 'number',
        default: 5000,
        description: 'How often to poll for events (in milliseconds)',
        hint: 'Minimum 1000ms recommended',
      },
    ],
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const connectionType = this.getNodeParameter('connectionType') as string;
    const event = this.getNodeParameter('event') as string;
    const pollInterval = this.getNodeParameter('pollInterval') as number;

    let bridgeUrl: string;
    if (connectionType === 'bridge') {
      bridgeUrl = this.getNodeParameter('bridgeUrl') as string;
    } else {
      bridgeUrl = this.getNodeParameter('desktopUrl') as string;
    }

    // Map parameter value to TransportConfig type
    const connectionTypeMap: Record<string, 'keepkeyBridge' | 'keepkeyDesktop'> = {
      'bridge': 'keepkeyBridge',
      'desktop': 'keepkeyDesktop',
    };

    const client = new KeepKeyClient({
      connectionType: connectionTypeMap[connectionType] || 'keepkeyBridge',
      bridgeUrl,
    });

    // Map event parameter to actual event names
    const eventMapping: Record<string, string[]> = {
      deviceConnected: [DEVICE_EVENTS.CONNECTED],
      deviceDisconnected: [DEVICE_EVENTS.DISCONNECTED],
      buttonRequest: [DEVICE_EVENTS.BUTTON_REQUEST],
      pinRequest: [DEVICE_EVENTS.PIN_REQUEST],
      passphraseRequest: [DEVICE_EVENTS.PASSPHRASE_REQUEST],
      transactionSigned: [TRANSACTION_EVENTS.SIGNED],
      transactionRejected: [TRANSACTION_EVENTS.REJECTED],
      swapInitiated: [SWAP_EVENTS.INITIATED],
      swapCompleted: [SWAP_EVENTS.COMPLETE],
      all: [
        DEVICE_EVENTS.CONNECTED,
        DEVICE_EVENTS.DISCONNECTED,
        DEVICE_EVENTS.BUTTON_REQUEST,
        DEVICE_EVENTS.PIN_REQUEST,
        DEVICE_EVENTS.PASSPHRASE_REQUEST,
        DEVICE_EVENTS.FAILURE,
        DEVICE_EVENTS.SUCCESS,
        TRANSACTION_EVENTS.SIGNED,
        TRANSACTION_EVENTS.REJECTED,
        TRANSACTION_EVENTS.BROADCAST,
        TRANSACTION_EVENTS.CONFIRMED,
        SWAP_EVENTS.INITIATED,
        SWAP_EVENTS.COMPLETE,
        SWAP_EVENTS.FAILED,
      ],
    };

    const eventsToListen = eventMapping[event] || [event];
    let isRunning = true;
    let pollTimeout: NodeJS.Timeout | null = null;
    let lastDeviceState: string | null = null;

    // Event handler
    const handleEvent = (eventName: string, data: unknown) => {
      this.emit([
        this.helpers.returnJsonArray([
          {
            event: eventName,
            timestamp: new Date().toISOString(),
            data: data as IDataObject,
          },
        ]),
      ]);
    };

    // Register event listeners
    for (const eventName of eventsToListen) {
      client.onEvent(eventName as KeepKeyEvent, (data) => handleEvent(eventName, data));
    }

    // Polling function to check device state
    const pollDeviceState = async () => {
      if (!isRunning) return;

      try {
        // Try to connect if not connected
        if (!client.isConnected()) {
          try {
            await client.connect();
            const features = await client.getFeatures();
            const currentState = features?.device_id || 'unknown';

            if (lastDeviceState === null) {
              // First connection
              lastDeviceState = currentState;
              if (eventsToListen.includes(DEVICE_EVENTS.CONNECTED)) {
                handleEvent(DEVICE_EVENTS.CONNECTED, {
                  deviceId: currentState,
                  features,
                });
              }
            } else if (lastDeviceState !== currentState) {
              // Device changed
              lastDeviceState = currentState;
              if (eventsToListen.includes(DEVICE_EVENTS.CONNECTED)) {
                handleEvent(DEVICE_EVENTS.CONNECTED, {
                  deviceId: currentState,
                  features,
                });
              }
            }
          } catch {
            // Device not available
            if (lastDeviceState !== null) {
              // Was connected, now disconnected
              if (eventsToListen.includes(DEVICE_EVENTS.DISCONNECTED)) {
                handleEvent(DEVICE_EVENTS.DISCONNECTED, {
                  previousDeviceId: lastDeviceState,
                });
              }
              lastDeviceState = null;
            }
          }
        }
      } catch (error) {
        // Silently handle polling errors
      }

      // Schedule next poll
      if (isRunning) {
        pollTimeout = setTimeout(pollDeviceState, Math.max(pollInterval, 1000));
      }
    };

    // Start polling
    pollDeviceState();

    // Cleanup function
    const closeFunction = async () => {
      isRunning = false;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
      try {
        await client.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    };

    return {
      closeFunction,
    };
  }
}
