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

export class KeepKeyNetwork implements ICredentialType {
  name = 'keepKeyNetwork';
  displayName = 'KeepKey Network Settings';
  documentationUrl = 'https://github.com/keepkey/keepkey-desktop';
  properties: INodeProperties[] = [
    {
      displayName: 'Bitcoin Network',
      name: 'bitcoinNetwork',
      type: 'options',
      options: [
        { name: 'Mainnet', value: 'mainnet' },
        { name: 'Testnet', value: 'testnet' },
      ],
      default: 'mainnet',
      description: 'Bitcoin network to use',
    },
    {
      displayName: 'Bitcoin RPC URL',
      name: 'bitcoinRpcUrl',
      type: 'string',
      default: '',
      description: 'Custom Bitcoin RPC endpoint (leave empty for default)',
    },
    {
      displayName: 'Ethereum Network',
      name: 'ethereumNetwork',
      type: 'options',
      options: [
        { name: 'Mainnet', value: 'mainnet' },
        { name: 'Goerli', value: 'goerli' },
        { name: 'Sepolia', value: 'sepolia' },
      ],
      default: 'mainnet',
      description: 'Ethereum network to use',
    },
    {
      displayName: 'Ethereum RPC URL',
      name: 'ethereumRpcUrl',
      type: 'string',
      default: '',
      description: 'Custom Ethereum RPC endpoint (leave empty for default)',
    },
    {
      displayName: 'Infura Project ID',
      name: 'infuraProjectId',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Infura Project ID for Ethereum API access',
    },
    {
      displayName: 'Alchemy API Key',
      name: 'alchemyApiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Alchemy API key for enhanced blockchain access',
    },
    {
      displayName: 'THORChain Network',
      name: 'thorchainNetwork',
      type: 'options',
      options: [
        { name: 'Mainnet', value: 'mainnet' },
        { name: 'Stagenet', value: 'stagenet' },
      ],
      default: 'mainnet',
      description: 'THORChain network to use',
    },
    {
      displayName: 'THORChain Node URL',
      name: 'thorchainNodeUrl',
      type: 'string',
      default: '',
      description: 'Custom THORChain node URL (leave empty for default)',
    },
    {
      displayName: 'Cosmos Network',
      name: 'cosmosNetwork',
      type: 'options',
      options: [
        { name: 'Cosmoshub-4', value: 'cosmoshub-4' },
        { name: 'Testnet', value: 'theta-testnet-001' },
      ],
      default: 'cosmoshub-4',
      description: 'Cosmos Hub network to use',
    },
    {
      displayName: 'Cosmos RPC URL',
      name: 'cosmosRpcUrl',
      type: 'string',
      default: '',
      description: 'Custom Cosmos RPC endpoint (leave empty for default)',
    },
    {
      displayName: 'Osmosis Network',
      name: 'osmosisNetwork',
      type: 'options',
      options: [
        { name: 'Osmosis-1', value: 'osmosis-1' },
        { name: 'Testnet', value: 'osmo-test-5' },
      ],
      default: 'osmosis-1',
      description: 'Osmosis network to use',
    },
    {
      displayName: 'ShapeShift API Key',
      name: 'shapeShiftApiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'ShapeShift API key for swap services',
    },
  ];
}
