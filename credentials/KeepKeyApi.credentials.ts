/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class KeepKeyApi implements ICredentialType {
  name = 'keepKeyApi';
  displayName = 'KeepKey Device';
  documentationUrl = 'https://github.com/keepkey/keepkey-desktop';
  properties: INodeProperties[] = [
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
          description: 'Connect via KeepKey Desktop API',
        },
        {
          name: 'USB HID',
          value: 'usb',
          description: 'Direct USB HID connection (requires node-hid)',
        },
        {
          name: 'WebUSB',
          value: 'webusb',
          description: 'WebUSB connection (browser environments)',
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
      description: 'KeepKey Bridge API URL',
      displayOptions: {
        show: {
          connectionType: ['bridge'],
        },
      },
    },
    {
      displayName: 'Desktop API URL',
      name: 'desktopUrl',
      type: 'string',
      default: 'http://localhost:1646',
      description: 'KeepKey Desktop API URL',
      displayOptions: {
        show: {
          connectionType: ['desktop'],
        },
      },
    },
    {
      displayName: 'Device Path',
      name: 'devicePath',
      type: 'string',
      default: '',
      description: 'Specific device path (leave empty to use first detected device)',
      displayOptions: {
        show: {
          connectionType: ['usb', 'bridge'],
        },
      },
    },
    {
      displayName: 'Timeout (ms)',
      name: 'timeout',
      type: 'number',
      default: 60000,
      description: 'Operation timeout in milliseconds',
    },
    {
      displayName: 'Auto Retry',
      name: 'autoRetry',
      type: 'boolean',
      default: true,
      description: 'Whether to automatically retry failed operations',
    },
    {
      displayName: 'Retry Count',
      name: 'retryCount',
      type: 'number',
      default: 3,
      description: 'Number of retry attempts',
      displayOptions: {
        show: {
          autoRetry: [true],
        },
      },
    },
  ];
}
