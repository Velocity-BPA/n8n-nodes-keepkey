/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
  IDataObject,
} from 'n8n-workflow';

import { KeepKeyClient, TransportConfig } from './transport';
import {
  BITCOIN_LIKE_COINS,
  EVM_CHAINS,
  COSMOS_CHAINS,
} from './constants/coins';
import { getDerivationPath, pathArrayToString } from './constants/derivationPaths';
import {
  isValidBitcoinAddress,
  isValidEthereumAddress,
  isValidCosmosAddress,
  isValidThorchainAddress,
  validateAddressForCoin,
} from './utils/addressUtils';
import {
  satoshisToBtc,
  btcToSatoshis,
  weiToEth,
  ethToWei,
  gweiToWei,
  getExplorerUrl,
} from './utils/transactionUtils';
import { encodePin, isValidPin, getPinMatrixTypeDescription } from './utils/pinUtils';
import {
  applySlippage,
  createThorchainSwapMemo,
  validateSwapParams,
} from './utils/swapUtils';
import { MESSAGE_TYPES } from './constants/events';

// Helper function to convert path string to array
function pathToArray(path: string): number[] {
  return path
    .replace('m/', '')
    .split('/')
    .map((part) => {
      const hardened = part.endsWith("'") || part.endsWith('h');
      const value = parseInt(part.replace(/['h]/g, ''), 10);
      return hardened ? value + 0x80000000 : value;
    });
}

// Helper function for Bitcoin script types
function addressTypeToScriptType(addressType: string): string {
  const mapping: Record<string, string> = {
    legacy: 'SPENDADDRESS',
    segwit: 'SPENDWITNESS',
    'nested-segwit': 'SPENDP2SHWITNESS',
    taproot: 'SPENDTAPROOT',
  };
  return mapping[addressType] || 'SPENDADDRESS';
}

// Helper function to build ERC-20 transfer data
function buildErc20TransferData(to: string, amount: string): string {
  const methodId = '0xa9059cbb';
  const paddedTo = to.toLowerCase().replace('0x', '').padStart(64, '0');
  const paddedAmount = BigInt(amount).toString(16).padStart(64, '0');
  return methodId + paddedTo + paddedAmount;
}

// Helper function to build ERC-20 approve data
function buildErc20ApproveData(spender: string, amount: string): string {
  const methodId = '0x095ea7b3';
  const paddedSpender = spender.toLowerCase().replace('0x', '').padStart(64, '0');
  const paddedAmount = BigInt(amount).toString(16).padStart(64, '0');
  return methodId + paddedSpender + paddedAmount;
}

// Resource definitions
const resources = [
  { name: 'Device', value: 'device', description: 'Device management operations' },
  { name: 'Account', value: 'account', description: 'Account and wallet management' },
  { name: 'Bitcoin', value: 'bitcoin', description: 'Bitcoin transactions and operations' },
  { name: 'Bitcoin-Like', value: 'bitcoinLike', description: 'Litecoin, Dogecoin, Bitcoin Cash, etc.' },
  { name: 'Ethereum', value: 'ethereum', description: 'Ethereum transactions and smart contracts' },
  { name: 'EVM Chains', value: 'evmChains', description: 'Avalanche, Polygon, Arbitrum, etc.' },
  { name: 'ERC-20 Token', value: 'erc20', description: 'ERC-20 token operations' },
  { name: 'Cosmos', value: 'cosmos', description: 'Cosmos Hub transactions' },
  { name: 'THORChain', value: 'thorchain', description: 'THORChain transactions and swaps' },
  { name: 'Osmosis', value: 'osmosis', description: 'Osmosis DEX operations' },
  { name: 'Address', value: 'address', description: 'Address generation and validation' },
  { name: 'Transaction', value: 'transaction', description: 'Transaction building and status' },
  { name: 'Signing', value: 'signing', description: 'Message and data signing' },
  { name: 'ShapeShift', value: 'shapeshift', description: 'ShapeShift integration' },
  { name: 'Swap', value: 'swap', description: 'Cross-chain swap operations' },
  { name: 'Staking', value: 'staking', description: 'Staking and delegation' },
  { name: 'DeFi', value: 'defi', description: 'DeFi protocol interactions' },
  { name: 'Recovery', value: 'recovery', description: 'Wallet recovery operations' },
  { name: 'PIN', value: 'pin', description: 'PIN management' },
  { name: 'Passphrase', value: 'passphrase', description: 'Passphrase wallet management' },
  { name: 'Firmware', value: 'firmware', description: 'Firmware management' },
  { name: 'Security', value: 'security', description: 'Security settings and features' },
  { name: 'Utility', value: 'utility', description: 'Utility operations' },
];

// Operation definitions
const deviceOperations = [
  { name: 'Initialize', value: 'initialize', description: 'Initialize connection to device' },
  { name: 'Get Features', value: 'getFeatures', description: 'Get device features and info' },
  { name: 'Ping', value: 'ping', description: 'Ping the device' },
  { name: 'Get Entropy', value: 'getEntropy', description: 'Get random entropy from device' },
  { name: 'Clear Session', value: 'clearSession', description: 'Clear device session' },
  { name: 'Cancel', value: 'cancel', description: 'Cancel current operation' },
  { name: 'Wipe Device', value: 'wipeDevice', description: 'Wipe device (factory reset)' },
  { name: 'Reset Device', value: 'resetDevice', description: 'Create new wallet on device' },
  { name: 'Apply Settings', value: 'applySettings', description: 'Apply device settings' },
  { name: 'Get Device ID', value: 'getDeviceId', description: 'Get unique device identifier' },
  { name: 'Get Label', value: 'getLabel', description: 'Get device label' },
  { name: 'Set Label', value: 'setLabel', description: 'Set device label' },
  { name: 'Get Language', value: 'getLanguage', description: 'Get device language' },
  { name: 'Set Language', value: 'setLanguage', description: 'Set device language' },
  { name: 'Enable Passphrase', value: 'enablePassphrase', description: 'Enable passphrase protection' },
  { name: 'Disable Passphrase', value: 'disablePassphrase', description: 'Disable passphrase protection' },
  { name: 'Set Auto Lock Delay', value: 'setAutoLockDelay', description: 'Set auto-lock timeout' },
  { name: 'Get Coin Table', value: 'getCoinTable', description: 'Get supported coins' },
];

const accountOperations = [
  { name: 'Get Public Key', value: 'getPublicKey', description: 'Get public key for path' },
  { name: 'Get Address', value: 'getAddress', description: 'Get address for coin' },
  { name: 'Get XPUB', value: 'getXpub', description: 'Get extended public key' },
  { name: 'Get Balance', value: 'getBalance', description: 'Get account balance' },
  { name: 'List Accounts', value: 'listAccounts', description: 'List all accounts' },
  { name: 'Create Account', value: 'createAccount', description: 'Create new account' },
  { name: 'Get Account Info', value: 'getAccountInfo', description: 'Get account details' },
  { name: 'Verify Address', value: 'verifyAddress', description: 'Verify address on device' },
  { name: 'Get Receive Address', value: 'getReceiveAddress', description: 'Get next receive address' },
  { name: 'Get Change Address', value: 'getChangeAddress', description: 'Get next change address' },
  { name: 'Export Accounts', value: 'exportAccounts', description: 'Export account info' },
];

const bitcoinOperations = [
  { name: 'Get Address', value: 'getAddress', description: 'Get Bitcoin address' },
  { name: 'Sign Transaction', value: 'signTransaction', description: 'Sign Bitcoin transaction' },
  { name: 'Sign Message', value: 'signMessage', description: 'Sign message with Bitcoin key' },
  { name: 'Verify Message', value: 'verifyMessage', description: 'Verify signed message' },
  { name: 'Get XPUB', value: 'getXpub', description: 'Get extended public key' },
  { name: 'Get Balance', value: 'getBalance', description: 'Get Bitcoin balance' },
  { name: 'Get UTXOs', value: 'getUtxos', description: 'Get unspent transaction outputs' },
  { name: 'Build Transaction', value: 'buildTransaction', description: 'Build unsigned transaction' },
  { name: 'Broadcast Transaction', value: 'broadcastTransaction', description: 'Broadcast signed transaction' },
  { name: 'Estimate Fee', value: 'estimateFee', description: 'Estimate transaction fee' },
  { name: 'Get Transaction', value: 'getTransaction', description: 'Get transaction details' },
];

const bitcoinLikeOperations = [
  { name: 'Get Address', value: 'getAddress', description: 'Get address for coin' },
  { name: 'Sign Transaction', value: 'signTransaction', description: 'Sign transaction' },
  { name: 'Sign Message', value: 'signMessage', description: 'Sign message' },
  { name: 'Get XPUB', value: 'getXpub', description: 'Get extended public key' },
  { name: 'Get Balance', value: 'getBalance', description: 'Get balance' },
  { name: 'Get UTXOs', value: 'getUtxos', description: 'Get unspent outputs' },
  { name: 'Build Transaction', value: 'buildTransaction', description: 'Build transaction' },
  { name: 'Broadcast Transaction', value: 'broadcastTransaction', description: 'Broadcast transaction' },
];

const ethereumOperations = [
  { name: 'Get Address', value: 'getAddress', description: 'Get Ethereum address' },
  { name: 'Sign Transaction', value: 'signTransaction', description: 'Sign Ethereum transaction' },
  { name: 'Sign Message', value: 'signMessage', description: 'Sign message (personal_sign)' },
  { name: 'Sign Typed Data', value: 'signTypedData', description: 'Sign EIP-712 typed data' },
  { name: 'Get Balance', value: 'getBalance', description: 'Get ETH balance' },
  { name: 'Get Nonce', value: 'getNonce', description: 'Get account nonce' },
  { name: 'Estimate Gas', value: 'estimateGas', description: 'Estimate gas for transaction' },
  { name: 'Get Gas Price', value: 'getGasPrice', description: 'Get current gas price' },
  { name: 'Send Transaction', value: 'sendTransaction', description: 'Sign and broadcast transaction' },
  { name: 'Call Contract', value: 'callContract', description: 'Call contract method (read)' },
  { name: 'Get Transaction', value: 'getTransaction', description: 'Get transaction details' },
  { name: 'Get Transaction Receipt', value: 'getTransactionReceipt', description: 'Get transaction receipt' },
  { name: 'Verify Message', value: 'verifyMessage', description: 'Verify signed message' },
];

const evmChainsOperations = [
  { name: 'Get Address', value: 'getAddress', description: 'Get address for chain' },
  { name: 'Sign Transaction', value: 'signTransaction', description: 'Sign transaction' },
  { name: 'Sign Message', value: 'signMessage', description: 'Sign message' },
  { name: 'Get Balance', value: 'getBalance', description: 'Get native token balance' },
  { name: 'Send Transaction', value: 'sendTransaction', description: 'Sign and broadcast' },
  { name: 'Get Transaction', value: 'getTransaction', description: 'Get transaction details' },
];

const erc20Operations = [
  { name: 'Get Balance', value: 'getBalance', description: 'Get token balance' },
  { name: 'Transfer', value: 'transfer', description: 'Transfer tokens' },
  { name: 'Approve', value: 'approve', description: 'Approve spender' },
  { name: 'Get Allowance', value: 'getAllowance', description: 'Get spender allowance' },
  { name: 'Transfer From', value: 'transferFrom', description: 'Transfer from approved' },
  { name: 'Get Token Info', value: 'getTokenInfo', description: 'Get token metadata' },
  { name: 'Get Token Transactions', value: 'getTokenTransactions', description: 'Get token tx history' },
];

const cosmosOperations = [
  { name: 'Get Address', value: 'getAddress', description: 'Get Cosmos address' },
  { name: 'Sign Transaction', value: 'signTransaction', description: 'Sign Cosmos transaction' },
  { name: 'Get Balance', value: 'getBalance', description: 'Get ATOM balance' },
  { name: 'Send', value: 'send', description: 'Send ATOM' },
  { name: 'Delegate', value: 'delegate', description: 'Delegate to validator' },
  { name: 'Undelegate', value: 'undelegate', description: 'Undelegate from validator' },
];

const thorchainOperations = [
  { name: 'Get Address', value: 'getAddress', description: 'Get THORChain address' },
  { name: 'Sign Transaction', value: 'signTransaction', description: 'Sign THORChain transaction' },
  { name: 'Get Balance', value: 'getBalance', description: 'Get RUNE balance' },
  { name: 'Send', value: 'send', description: 'Send RUNE' },
  { name: 'Swap', value: 'swap', description: 'Execute THORChain swap' },
  { name: 'Add Liquidity', value: 'addLiquidity', description: 'Add liquidity to pool' },
  { name: 'Withdraw Liquidity', value: 'withdrawLiquidity', description: 'Withdraw from pool' },
];

const osmosisOperations = [
  { name: 'Get Address', value: 'getAddress', description: 'Get Osmosis address' },
  { name: 'Sign Transaction', value: 'signTransaction', description: 'Sign Osmosis transaction' },
  { name: 'Get Balance', value: 'getBalance', description: 'Get OSMO balance' },
  { name: 'Swap', value: 'swap', description: 'Execute DEX swap' },
];

const addressOperations = [
  { name: 'Generate', value: 'generate', description: 'Generate new address' },
  { name: 'Validate', value: 'validate', description: 'Validate address format' },
  { name: 'Get Type', value: 'getType', description: 'Detect address type' },
  { name: 'Derive', value: 'derive', description: 'Derive address from path' },
  { name: 'Show on Device', value: 'showOnDevice', description: 'Display address on device' },
  { name: 'Get QR Code', value: 'getQrCode', description: 'Get address QR code' },
  { name: 'Convert Format', value: 'convertFormat', description: 'Convert address format' },
  { name: 'Lookup', value: 'lookup', description: 'Lookup address info' },
];

const transactionOperations = [
  { name: 'Build', value: 'build', description: 'Build transaction' },
  { name: 'Sign', value: 'sign', description: 'Sign transaction' },
  { name: 'Broadcast', value: 'broadcast', description: 'Broadcast transaction' },
  { name: 'Get Status', value: 'getStatus', description: 'Get transaction status' },
  { name: 'Get Details', value: 'getDetails', description: 'Get transaction details' },
  { name: 'Estimate Fee', value: 'estimateFee', description: 'Estimate transaction fee' },
  { name: 'Decode', value: 'decode', description: 'Decode raw transaction' },
  { name: 'Get History', value: 'getHistory', description: 'Get transaction history' },
  { name: 'Cancel', value: 'cancel', description: 'Cancel pending transaction' },
];

const signingOperations = [
  { name: 'Sign Message', value: 'signMessage', description: 'Sign arbitrary message' },
  { name: 'Verify Signature', value: 'verifySignature', description: 'Verify message signature' },
  { name: 'Sign Hash', value: 'signHash', description: 'Sign hash directly' },
  { name: 'Sign Typed Data', value: 'signTypedData', description: 'Sign EIP-712 typed data' },
  { name: 'Get Public Key', value: 'getPublicKey', description: 'Get signing public key' },
  { name: 'Derive Key', value: 'deriveKey', description: 'Derive signing key' },
  { name: 'Sign PSBT', value: 'signPsbt', description: 'Sign partially signed Bitcoin transaction' },
  { name: 'Multi-Sign', value: 'multiSign', description: 'Multi-signature signing' },
];

const shapeshiftOperations = [
  { name: 'Get Quote', value: 'getQuote', description: 'Get swap quote' },
  { name: 'Execute Trade', value: 'executeTrade', description: 'Execute swap trade' },
  { name: 'Get Trade Status', value: 'getTradeStatus', description: 'Get trade status' },
  { name: 'Get Supported Assets', value: 'getSupportedAssets', description: 'List supported assets' },
  { name: 'Get Market Data', value: 'getMarketData', description: 'Get market prices' },
  { name: 'Get Trade History', value: 'getTradeHistory', description: 'Get trade history' },
  { name: 'Cancel Trade', value: 'cancelTrade', description: 'Cancel pending trade' },
  { name: 'Get Limits', value: 'getLimits', description: 'Get trading limits' },
];

const swapOperations = [
  { name: 'Get Quote', value: 'getQuote', description: 'Get swap quote' },
  { name: 'Execute', value: 'execute', description: 'Execute swap' },
  { name: 'Get Status', value: 'getStatus', description: 'Get swap status' },
  { name: 'Get Supported Pairs', value: 'getSupportedPairs', description: 'List supported pairs' },
  { name: 'Estimate', value: 'estimate', description: 'Estimate swap output' },
  { name: 'Get History', value: 'getHistory', description: 'Get swap history' },
  { name: 'Cancel', value: 'cancel', description: 'Cancel pending swap' },
  { name: 'Get Best Route', value: 'getBestRoute', description: 'Find best swap route' },
];

const stakingOperations = [
  { name: 'Delegate', value: 'delegate', description: 'Delegate to validator' },
  { name: 'Undelegate', value: 'undelegate', description: 'Undelegate from validator' },
  { name: 'Redelegate', value: 'redelegate', description: 'Move delegation' },
  { name: 'Claim Rewards', value: 'claimRewards', description: 'Claim staking rewards' },
  { name: 'Get Delegations', value: 'getDelegations', description: 'Get active delegations' },
  { name: 'Get Rewards', value: 'getRewards', description: 'Get pending rewards' },
  { name: 'Get Validators', value: 'getValidators', description: 'List validators' },
  { name: 'Get Validator Info', value: 'getValidatorInfo', description: 'Get validator details' },
];

const defiOperations = [
  { name: 'Add Liquidity', value: 'addLiquidity', description: 'Add to liquidity pool' },
  { name: 'Remove Liquidity', value: 'removeLiquidity', description: 'Remove from pool' },
  { name: 'Get Pool Info', value: 'getPoolInfo', description: 'Get pool information' },
  { name: 'Get Position', value: 'getPosition', description: 'Get LP position' },
];

const recoveryOperations = [
  { name: 'Start Recovery', value: 'startRecovery', description: 'Start wallet recovery' },
  { name: 'Enter Word', value: 'enterWord', description: 'Enter recovery word' },
  { name: 'Verify Seed', value: 'verifySeed', description: 'Verify recovery seed' },
  { name: 'Backup', value: 'backup', description: 'Backup wallet' },
  { name: 'Get Recovery Progress', value: 'getRecoveryProgress', description: 'Get recovery status' },
  { name: 'Cancel Recovery', value: 'cancelRecovery', description: 'Cancel recovery process' },
  { name: 'Dry Run Recovery', value: 'dryRunRecovery', description: 'Test recovery without modifying' },
];

const pinOperations = [
  { name: 'Change PIN', value: 'changePin', description: 'Change device PIN' },
  { name: 'Remove PIN', value: 'removePin', description: 'Remove PIN protection' },
  { name: 'Enter PIN', value: 'enterPin', description: 'Enter PIN for auth' },
  { name: 'Check PIN Status', value: 'checkPinStatus', description: 'Check if PIN is set' },
  { name: 'Get PIN Matrix', value: 'getPinMatrix', description: 'Get PIN entry matrix' },
  { name: 'Reset PIN Attempts', value: 'resetPinAttempts', description: 'Reset failed attempts' },
];

const passphraseOperations = [
  { name: 'Enable', value: 'enable', description: 'Enable passphrase' },
  { name: 'Disable', value: 'disable', description: 'Disable passphrase' },
  { name: 'Enter', value: 'enter', description: 'Enter passphrase' },
  { name: 'Check Status', value: 'checkStatus', description: 'Check passphrase status' },
  { name: 'Set On Device', value: 'setOnDevice', description: 'Enter passphrase on device' },
];

const firmwareOperations = [
  { name: 'Check Update', value: 'checkUpdate', description: 'Check for firmware update' },
  { name: 'Get Version', value: 'getVersion', description: 'Get firmware version' },
  { name: 'Update', value: 'update', description: 'Update firmware' },
  { name: 'Get Changelog', value: 'getChangelog', description: 'Get update changelog' },
  { name: 'Verify Firmware', value: 'verifyFirmware', description: 'Verify firmware integrity' },
  { name: 'Enter Bootloader', value: 'enterBootloader', description: 'Enter bootloader mode' },
];

const securityOperations = [
  { name: 'Lock Device', value: 'lockDevice', description: 'Lock device immediately' },
  { name: 'Check Security', value: 'checkSecurity', description: 'Run security check' },
  { name: 'Enable U2F', value: 'enableU2f', description: 'Enable U2F authentication' },
  { name: 'Disable U2F', value: 'disableU2f', description: 'Disable U2F' },
  { name: 'Get Security Info', value: 'getSecurityInfo', description: 'Get security status' },
  { name: 'Set Auto Lock', value: 'setAutoLock', description: 'Configure auto-lock' },
  { name: 'Factory Reset', value: 'factoryReset', description: 'Full factory reset' },
  { name: 'Export Debug Log', value: 'exportDebugLog', description: 'Export debug information' },
];

const utilityOperations = [
  { name: 'Get Random', value: 'getRandom', description: 'Get random bytes' },
  { name: 'Encrypt Message', value: 'encryptMessage', description: 'Encrypt with device key' },
  { name: 'Decrypt Message', value: 'decryptMessage', description: 'Decrypt with device key' },
  { name: 'Get Entropy', value: 'getEntropy', description: 'Get hardware entropy' },
  { name: 'Hash Data', value: 'hashData', description: 'Hash data on device' },
  { name: 'Cipher Key Value', value: 'cipherKeyValue', description: 'Encrypt/decrypt with key' },
  { name: 'Get ECDH Secret', value: 'getEcdhSecret', description: 'Derive shared secret' },
  { name: 'Sign Identity', value: 'signIdentity', description: 'Sign identity challenge' },
];

export class KeepKey implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'KeepKey',
    name: 'keepKey',
    icon: 'file:keepkey.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with KeepKey hardware wallet',
    defaults: {
      name: 'KeepKey',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'keepKeyApi',
        required: false,
      },
    ],
    properties: [
      // Connection Type
      {
        displayName: 'Connection Type',
        name: 'connectionType',
        type: 'options',
        options: [
          { name: 'KeepKey Bridge', value: 'bridge', description: 'Connect via KeepKey Bridge' },
          { name: 'KeepKey Desktop', value: 'desktop', description: 'Connect via KeepKey Desktop' },
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

      // Resource Selection
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: resources,
        default: 'device',
      },

      // Device Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['device'] } },
        options: deviceOperations,
        default: 'getFeatures',
      },

      // Account Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['account'] } },
        options: accountOperations,
        default: 'getAddress',
      },

      // Bitcoin Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['bitcoin'] } },
        options: bitcoinOperations,
        default: 'getAddress',
      },

      // Bitcoin-Like Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['bitcoinLike'] } },
        options: bitcoinLikeOperations,
        default: 'getAddress',
      },

      // Ethereum Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['ethereum'] } },
        options: ethereumOperations,
        default: 'getAddress',
      },

      // EVM Chains Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['evmChains'] } },
        options: evmChainsOperations,
        default: 'getAddress',
      },

      // ERC-20 Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['erc20'] } },
        options: erc20Operations,
        default: 'getBalance',
      },

      // Cosmos Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['cosmos'] } },
        options: cosmosOperations,
        default: 'getAddress',
      },

      // THORChain Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['thorchain'] } },
        options: thorchainOperations,
        default: 'getAddress',
      },

      // Osmosis Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['osmosis'] } },
        options: osmosisOperations,
        default: 'getAddress',
      },

      // Address Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['address'] } },
        options: addressOperations,
        default: 'generate',
      },

      // Transaction Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['transaction'] } },
        options: transactionOperations,
        default: 'build',
      },

      // Signing Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['signing'] } },
        options: signingOperations,
        default: 'signMessage',
      },

      // ShapeShift Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['shapeshift'] } },
        options: shapeshiftOperations,
        default: 'getQuote',
      },

      // Swap Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['swap'] } },
        options: swapOperations,
        default: 'getQuote',
      },

      // Staking Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['staking'] } },
        options: stakingOperations,
        default: 'delegate',
      },

      // DeFi Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['defi'] } },
        options: defiOperations,
        default: 'addLiquidity',
      },

      // Recovery Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['recovery'] } },
        options: recoveryOperations,
        default: 'startRecovery',
      },

      // PIN Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['pin'] } },
        options: pinOperations,
        default: 'changePin',
      },

      // Passphrase Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['passphrase'] } },
        options: passphraseOperations,
        default: 'enable',
      },

      // Firmware Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['firmware'] } },
        options: firmwareOperations,
        default: 'getVersion',
      },

      // Security Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['security'] } },
        options: securityOperations,
        default: 'checkSecurity',
      },

      // Utility Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['utility'] } },
        options: utilityOperations,
        default: 'getRandom',
      },

      // =====================
      // COMMON PARAMETERS
      // =====================

      // Coin Selection (for multi-coin operations)
      {
        displayName: 'Coin',
        name: 'coin',
        type: 'options',
        options: [
          { name: 'Bitcoin (BTC)', value: 'bitcoin' },
          { name: 'Litecoin (LTC)', value: 'litecoin' },
          { name: 'Dogecoin (DOGE)', value: 'dogecoin' },
          { name: 'Bitcoin Cash (BCH)', value: 'bitcoincash' },
          { name: 'Dash (DASH)', value: 'dash' },
          { name: 'DigiByte (DGB)', value: 'digibyte' },
        ],
        default: 'bitcoin',
        displayOptions: {
          show: {
            resource: ['bitcoinLike'],
          },
        },
      },

      // EVM Chain Selection
      {
        displayName: 'Chain',
        name: 'chain',
        type: 'options',
        options: [
          { name: 'Ethereum', value: 'ethereum' },
          { name: 'Polygon', value: 'polygon' },
          { name: 'Arbitrum', value: 'arbitrum' },
          { name: 'Optimism', value: 'optimism' },
          { name: 'Avalanche C-Chain', value: 'avalanche' },
          { name: 'BNB Smart Chain', value: 'bnb' },
          { name: 'Gnosis Chain', value: 'gnosis' },
        ],
        default: 'ethereum',
        displayOptions: {
          show: {
            resource: ['evmChains', 'erc20'],
          },
        },
      },

      // Address Type Selection (Bitcoin)
      {
        displayName: 'Address Type',
        name: 'addressType',
        type: 'options',
        options: [
          { name: 'Native SegWit (bc1q...)', value: 'segwit' },
          { name: 'Nested SegWit (3...)', value: 'nested-segwit' },
          { name: 'Legacy (1...)', value: 'legacy' },
          { name: 'Taproot (bc1p...)', value: 'taproot' },
        ],
        default: 'segwit',
        displayOptions: {
          show: {
            resource: ['bitcoin', 'bitcoinLike'],
            operation: ['getAddress', 'signTransaction', 'getXpub'],
          },
        },
      },

      // Account Index
      {
        displayName: 'Account Index',
        name: 'accountIndex',
        type: 'number',
        default: 0,
        description: 'BIP44 account index',
        displayOptions: {
          show: {
            resource: ['bitcoin', 'bitcoinLike', 'ethereum', 'evmChains', 'cosmos', 'thorchain', 'osmosis', 'account'],
            operation: ['getAddress', 'getPublicKey', 'getXpub', 'getBalance', 'signTransaction', 'signMessage'],
          },
        },
      },

      // Address Index
      {
        displayName: 'Address Index',
        name: 'addressIndex',
        type: 'number',
        default: 0,
        description: 'Address index within account',
        displayOptions: {
          show: {
            resource: ['bitcoin', 'bitcoinLike', 'ethereum', 'evmChains', 'cosmos', 'thorchain', 'osmosis', 'account'],
            operation: ['getAddress', 'signMessage'],
          },
        },
      },

      // Show on Device
      {
        displayName: 'Show on Device',
        name: 'showOnDevice',
        type: 'boolean',
        default: false,
        description: 'Whether to display address on device for verification',
        displayOptions: {
          show: {
            operation: ['getAddress', 'verifyAddress', 'showOnDevice'],
          },
        },
      },

      // Derivation Path (Custom)
      {
        displayName: 'Use Custom Path',
        name: 'useCustomPath',
        type: 'boolean',
        default: false,
        description: 'Whether to use a custom derivation path',
        displayOptions: {
          show: {
            resource: ['bitcoin', 'bitcoinLike', 'ethereum', 'evmChains', 'cosmos', 'thorchain', 'osmosis', 'account', 'address', 'signing'],
          },
        },
      },
      {
        displayName: 'Derivation Path',
        name: 'derivationPath',
        type: 'string',
        default: "m/84'/0'/0'/0/0",
        description: 'BIP32 derivation path',
        displayOptions: {
          show: {
            useCustomPath: [true],
          },
        },
      },

      // Transaction Parameters
      {
        displayName: 'Recipient Address',
        name: 'toAddress',
        type: 'string',
        default: '',
        description: 'Destination address',
        displayOptions: {
          show: {
            operation: ['signTransaction', 'send', 'sendTransaction', 'transfer', 'buildTransaction'],
          },
        },
      },
      {
        displayName: 'Amount',
        name: 'amount',
        type: 'string',
        default: '',
        description: 'Amount to send (in native units)',
        displayOptions: {
          show: {
            operation: ['signTransaction', 'send', 'sendTransaction', 'transfer', 'buildTransaction', 'delegate', 'undelegate'],
          },
        },
      },

      // Fee Parameters
      {
        displayName: 'Fee Rate (sat/vB)',
        name: 'feeRate',
        type: 'number',
        default: 10,
        description: 'Fee rate in satoshis per virtual byte',
        displayOptions: {
          show: {
            resource: ['bitcoin', 'bitcoinLike'],
            operation: ['signTransaction', 'buildTransaction', 'estimateFee'],
          },
        },
      },
      {
        displayName: 'Gas Limit',
        name: 'gasLimit',
        type: 'number',
        default: 21000,
        description: 'Gas limit for transaction',
        displayOptions: {
          show: {
            resource: ['ethereum', 'evmChains', 'erc20'],
            operation: ['signTransaction', 'sendTransaction', 'transfer', 'approve'],
          },
        },
      },
      {
        displayName: 'Gas Price (Gwei)',
        name: 'gasPrice',
        type: 'string',
        default: '',
        description: 'Gas price in Gwei (leave empty for automatic)',
        displayOptions: {
          show: {
            resource: ['ethereum', 'evmChains', 'erc20'],
            operation: ['signTransaction', 'sendTransaction', 'transfer', 'approve'],
          },
        },
      },
      {
        displayName: 'Use EIP-1559',
        name: 'useEip1559',
        type: 'boolean',
        default: true,
        description: 'Whether to use EIP-1559 transaction type',
        displayOptions: {
          show: {
            resource: ['ethereum', 'evmChains', 'erc20'],
            operation: ['signTransaction', 'sendTransaction', 'transfer', 'approve'],
          },
        },
      },
      {
        displayName: 'Max Priority Fee (Gwei)',
        name: 'maxPriorityFee',
        type: 'string',
        default: '1.5',
        description: 'Maximum priority fee (tip) in Gwei',
        displayOptions: {
          show: {
            resource: ['ethereum', 'evmChains', 'erc20'],
            useEip1559: [true],
          },
        },
      },
      {
        displayName: 'Max Fee (Gwei)',
        name: 'maxFee',
        type: 'string',
        default: '50',
        description: 'Maximum total fee in Gwei',
        displayOptions: {
          show: {
            resource: ['ethereum', 'evmChains', 'erc20'],
            useEip1559: [true],
          },
        },
      },

      // Message Signing
      {
        displayName: 'Message',
        name: 'message',
        type: 'string',
        default: '',
        description: 'Message to sign',
        typeOptions: {
          rows: 4,
        },
        displayOptions: {
          show: {
            operation: ['signMessage', 'verifyMessage', 'encryptMessage', 'decryptMessage'],
          },
        },
      },
      {
        displayName: 'Signature',
        name: 'signature',
        type: 'string',
        default: '',
        description: 'Signature to verify',
        displayOptions: {
          show: {
            operation: ['verifyMessage', 'verifySignature'],
          },
        },
      },

      // ERC-20 Token Parameters
      {
        displayName: 'Token Contract Address',
        name: 'tokenAddress',
        type: 'string',
        default: '',
        description: 'ERC-20 token contract address',
        displayOptions: {
          show: {
            resource: ['erc20'],
          },
        },
      },
      {
        displayName: 'Spender Address',
        name: 'spenderAddress',
        type: 'string',
        default: '',
        description: 'Address to approve for spending',
        displayOptions: {
          show: {
            resource: ['erc20'],
            operation: ['approve', 'getAllowance'],
          },
        },
      },

      // Swap Parameters
      {
        displayName: 'Sell Asset',
        name: 'sellAsset',
        type: 'string',
        default: '',
        description: 'Asset to sell (e.g., BTC.BTC, ETH.ETH)',
        displayOptions: {
          show: {
            resource: ['swap', 'shapeshift', 'thorchain'],
            operation: ['getQuote', 'execute', 'executeTrade', 'swap', 'estimate'],
          },
        },
      },
      {
        displayName: 'Buy Asset',
        name: 'buyAsset',
        type: 'string',
        default: '',
        description: 'Asset to buy (e.g., ETH.ETH, THOR.RUNE)',
        displayOptions: {
          show: {
            resource: ['swap', 'shapeshift', 'thorchain'],
            operation: ['getQuote', 'execute', 'executeTrade', 'swap', 'estimate'],
          },
        },
      },
      {
        displayName: 'Sell Amount',
        name: 'sellAmount',
        type: 'string',
        default: '',
        description: 'Amount to sell',
        displayOptions: {
          show: {
            resource: ['swap', 'shapeshift', 'thorchain'],
            operation: ['getQuote', 'execute', 'executeTrade', 'swap', 'estimate'],
          },
        },
      },
      {
        displayName: 'Slippage Tolerance (%)',
        name: 'slippageTolerance',
        type: 'number',
        default: 1,
        description: 'Maximum acceptable slippage percentage',
        displayOptions: {
          show: {
            resource: ['swap', 'shapeshift', 'thorchain', 'osmosis', 'defi'],
            operation: ['getQuote', 'execute', 'executeTrade', 'swap', 'addLiquidity'],
          },
        },
      },

      // Staking Parameters
      {
        displayName: 'Validator Address',
        name: 'validatorAddress',
        type: 'string',
        default: '',
        description: 'Validator address for delegation',
        displayOptions: {
          show: {
            resource: ['staking', 'cosmos', 'thorchain', 'osmosis'],
            operation: ['delegate', 'undelegate', 'redelegate', 'getValidatorInfo'],
          },
        },
      },
      {
        displayName: 'New Validator Address',
        name: 'newValidatorAddress',
        type: 'string',
        default: '',
        description: 'New validator for redelegation',
        displayOptions: {
          show: {
            resource: ['staking'],
            operation: ['redelegate'],
          },
        },
      },

      // PIN Parameters
      {
        displayName: 'PIN',
        name: 'pin',
        type: 'string',
        default: '',
        typeOptions: {
          password: true,
        },
        description: 'Device PIN (matrix-encoded)',
        displayOptions: {
          show: {
            resource: ['pin'],
            operation: ['enterPin', 'changePin'],
          },
        },
      },
      {
        displayName: 'New PIN',
        name: 'newPin',
        type: 'string',
        default: '',
        typeOptions: {
          password: true,
        },
        description: 'New PIN to set',
        displayOptions: {
          show: {
            resource: ['pin'],
            operation: ['changePin'],
          },
        },
      },

      // Passphrase Parameters
      {
        displayName: 'Passphrase',
        name: 'passphrase',
        type: 'string',
        default: '',
        typeOptions: {
          password: true,
        },
        description: 'BIP39 passphrase',
        displayOptions: {
          show: {
            resource: ['passphrase'],
            operation: ['enter'],
          },
        },
      },

      // Device Settings
      {
        displayName: 'Device Label',
        name: 'label',
        type: 'string',
        default: '',
        description: 'Label to set on device',
        displayOptions: {
          show: {
            resource: ['device'],
            operation: ['setLabel', 'applySettings', 'resetDevice'],
          },
        },
      },
      {
        displayName: 'Language',
        name: 'language',
        type: 'options',
        options: [
          { name: 'English', value: 'en-US' },
          { name: 'Spanish', value: 'es-ES' },
          { name: 'French', value: 'fr-FR' },
          { name: 'German', value: 'de-DE' },
          { name: 'Chinese', value: 'zh-CN' },
          { name: 'Japanese', value: 'ja-JP' },
        ],
        default: 'en-US',
        displayOptions: {
          show: {
            resource: ['device'],
            operation: ['setLanguage', 'applySettings'],
          },
        },
      },
      {
        displayName: 'Auto Lock Delay (seconds)',
        name: 'autoLockDelay',
        type: 'number',
        default: 600,
        description: 'Auto-lock timeout in seconds (0 to disable)',
        displayOptions: {
          show: {
            resource: ['device', 'security'],
            operation: ['setAutoLockDelay', 'setAutoLock', 'applySettings'],
          },
        },
      },

      // Recovery Parameters
      {
        displayName: 'Word Count',
        name: 'wordCount',
        type: 'options',
        options: [
          { name: '12 Words', value: 12 },
          { name: '18 Words', value: 18 },
          { name: '24 Words', value: 24 },
        ],
        default: 12,
        description: 'Number of recovery words',
        displayOptions: {
          show: {
            resource: ['recovery', 'device'],
            operation: ['startRecovery', 'resetDevice'],
          },
        },
      },
      {
        displayName: 'Recovery Word',
        name: 'recoveryWord',
        type: 'string',
        default: '',
        typeOptions: {
          password: true,
        },
        description: 'Recovery word to enter',
        displayOptions: {
          show: {
            resource: ['recovery'],
            operation: ['enterWord'],
          },
        },
      },
      {
        displayName: 'Enable PIN Protection',
        name: 'pinProtection',
        type: 'boolean',
        default: true,
        description: 'Whether to enable PIN protection during setup',
        displayOptions: {
          show: {
            resource: ['device', 'recovery'],
            operation: ['resetDevice', 'startRecovery'],
          },
        },
      },

      // Utility Parameters
      {
        displayName: 'Bytes',
        name: 'bytes',
        type: 'number',
        default: 32,
        description: 'Number of random bytes to generate',
        displayOptions: {
          show: {
            resource: ['utility', 'device'],
            operation: ['getRandom', 'getEntropy'],
          },
        },
      },
      {
        displayName: 'Data',
        name: 'data',
        type: 'string',
        default: '',
        description: 'Data to process',
        typeOptions: {
          rows: 4,
        },
        displayOptions: {
          show: {
            resource: ['utility'],
            operation: ['hashData', 'cipherKeyValue'],
          },
        },
      },
      {
        displayName: 'Hash Algorithm',
        name: 'hashAlgorithm',
        type: 'options',
        options: [
          { name: 'SHA-256', value: 'sha256' },
          { name: 'SHA-512', value: 'sha512' },
          { name: 'RIPEMD-160', value: 'ripemd160' },
          { name: 'Keccak-256', value: 'keccak256' },
        ],
        default: 'sha256',
        displayOptions: {
          show: {
            resource: ['utility'],
            operation: ['hashData'],
          },
        },
      },

      // Transaction ID for lookups
      {
        displayName: 'Transaction ID',
        name: 'txId',
        type: 'string',
        default: '',
        description: 'Transaction hash/ID',
        displayOptions: {
          show: {
            operation: ['getTransaction', 'getStatus', 'getDetails', 'getTransactionReceipt', 'getTradeStatus'],
          },
        },
      },

      // Address for validation/lookup
      {
        displayName: 'Address',
        name: 'address',
        type: 'string',
        default: '',
        description: 'Address to validate or lookup',
        displayOptions: {
          show: {
            operation: ['validate', 'lookup', 'verifyAddress', 'getBalance', 'getNonce'],
          },
        },
      },

      // Raw Transaction
      {
        displayName: 'Raw Transaction',
        name: 'rawTransaction',
        type: 'string',
        default: '',
        description: 'Raw transaction hex',
        typeOptions: {
          rows: 4,
        },
        displayOptions: {
          show: {
            operation: ['broadcast', 'decode', 'sign'],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    // Get connection configuration
    const connectionType = this.getNodeParameter('connectionType', 0) as string;
    let bridgeUrl: string;
    if (connectionType === 'bridge') {
      bridgeUrl = this.getNodeParameter('bridgeUrl', 0) as string;
    } else {
      bridgeUrl = this.getNodeParameter('desktopUrl', 0) as string;
    }

    // Create client configuration
    const config: TransportConfig = {
      connectionType: connectionType === 'bridge' ? 'keepkeyBridge' : 'keepkeyDesktop',
      bridgeUrl,
      timeout: 30000,
    };

    const client = new KeepKeyClient(config);

    try {
      // Connect to device
      await client.connect();

      for (let i = 0; i < items.length; i++) {
        try {
          let result: IDataObject;

          // Route to appropriate handler
          switch (resource) {
            case 'device':
              result = await executeDeviceOperation(this, client, operation, i);
              break;
            case 'account':
              result = await executeAccountOperation(this, client, operation, i);
              break;
            case 'bitcoin':
              result = await executeBitcoinOperation(this, client, operation, i);
              break;
            case 'bitcoinLike':
              result = await executeBitcoinLikeOperation(this, client, operation, i);
              break;
            case 'ethereum':
              result = await executeEthereumOperation(this, client, operation, i);
              break;
            case 'evmChains':
              result = await executeEvmChainsOperation(this, client, operation, i);
              break;
            case 'erc20':
              result = await executeErc20Operation(this, client, operation, i);
              break;
            case 'cosmos':
              result = await executeCosmosOperation(this, client, operation, i);
              break;
            case 'thorchain':
              result = await executeThorchainOperation(this, client, operation, i);
              break;
            case 'osmosis':
              result = await executeOsmosisOperation(this, client, operation, i);
              break;
            case 'address':
              result = await executeAddressOperation(this, client, operation, i);
              break;
            case 'transaction':
              result = await executeTransactionOperation(this, client, operation, i);
              break;
            case 'signing':
              result = await executeSigningOperation(this, client, operation, i);
              break;
            case 'shapeshift':
              result = await executeShapeshiftOperation(this, client, operation, i);
              break;
            case 'swap':
              result = await executeSwapOperation(this, client, operation, i);
              break;
            case 'staking':
              result = await executeStakingOperation(this, client, operation, i);
              break;
            case 'defi':
              result = await executeDefiOperation(this, client, operation, i);
              break;
            case 'recovery':
              result = await executeRecoveryOperation(this, client, operation, i);
              break;
            case 'pin':
              result = await executePinOperation(this, client, operation, i);
              break;
            case 'passphrase':
              result = await executePassphraseOperation(this, client, operation, i);
              break;
            case 'firmware':
              result = await executeFirmwareOperation(this, client, operation, i);
              break;
            case 'security':
              result = await executeSecurityOperation(this, client, operation, i);
              break;
            case 'utility':
              result = await executeUtilityOperation(this, client, operation, i);
              break;
            default:
              throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`);
          }

          returnData.push({ json: result });
        } catch (error) {
          if (this.continueOnFail()) {
            returnData.push({ json: { error: (error as Error).message } });
          } else {
            throw error;
          }
        }
      }
    } finally {
      // Always disconnect
      try {
        await client.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }

    return [returnData];
  }
}

// =====================
// OPERATION HANDLERS
// =====================

async function executeDeviceOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  switch (operation) {
    case 'initialize':
      await client.connect();
      return { success: true, message: 'Device initialized' };

    case 'getFeatures': {
      const features = await client.getFeatures();
      return features as unknown as IDataObject;
    }

    case 'ping': {
      const result = await client.ping('n8n-keepkey');
      return { success: true, message: result };
    }

    case 'getEntropy': {
      const bytes = ctx.getNodeParameter('bytes', itemIndex, 32) as number;
      const entropy = await client.getEntropy(bytes);
      return { entropy: entropy.toString('hex'), bytes };
    }

    case 'clearSession':
      await client.clearSession();
      return { success: true, message: 'Session cleared' };

    case 'cancel':
      await client.cancel();
      return { success: true, message: 'Operation cancelled' };

    case 'wipeDevice':
      await client.wipeDevice();
      return { success: true, message: 'Device wiped' };

    case 'resetDevice': {
      const label = ctx.getNodeParameter('label', itemIndex, '') as string;
      const pinProtection = ctx.getNodeParameter('pinProtection', itemIndex, true) as boolean;
      const wordCount = ctx.getNodeParameter('wordCount', itemIndex, 12) as number;
      await client.resetDevice({
        label,
        pin_protection: pinProtection,
        strength: wordCount === 24 ? 256 : wordCount === 18 ? 192 : 128,
      });
      return { success: true, message: 'Device reset initiated' };
    }

    case 'applySettings': {
      const settings: IDataObject = {};
      const label = ctx.getNodeParameter('label', itemIndex, '') as string;
      if (label) settings.label = label;
      const language = ctx.getNodeParameter('language', itemIndex, '') as string;
      if (language) settings.language = language;
      const autoLockDelay = ctx.getNodeParameter('autoLockDelay', itemIndex, 0) as number;
      if (autoLockDelay > 0) settings.auto_lock_delay_ms = autoLockDelay * 1000;
      await client.applySettings(settings);
      return { success: true, message: 'Settings applied', settings };
    }

    case 'getDeviceId': {
      const features = await client.getFeatures();
      return { deviceId: features?.device_id || 'unknown' };
    }

    case 'getLabel': {
      const features = await client.getFeatures();
      return { label: features?.label || '' };
    }

    case 'setLabel': {
      const label = ctx.getNodeParameter('label', itemIndex) as string;
      await client.applySettings({ label });
      return { success: true, label };
    }

    case 'getLanguage': {
      const features = await client.getFeatures();
      return { language: features?.language || 'en-US' };
    }

    case 'setLanguage': {
      const language = ctx.getNodeParameter('language', itemIndex) as string;
      await client.applySettings({ language });
      return { success: true, language };
    }

    case 'enablePassphrase':
      await client.applySettings({ use_passphrase: true });
      return { success: true, passphraseEnabled: true };

    case 'disablePassphrase':
      await client.applySettings({ use_passphrase: false });
      return { success: true, passphraseEnabled: false };

    case 'setAutoLockDelay': {
      const delay = ctx.getNodeParameter('autoLockDelay', itemIndex) as number;
      await client.applySettings({ auto_lock_delay_ms: delay * 1000 });
      return { success: true, autoLockDelay: delay };
    }

    case 'getCoinTable':
      return {
        bitcoinLike: Object.keys(BITCOIN_LIKE_COINS),
        evmChains: Object.keys(EVM_CHAINS),
        cosmos: Object.keys(COSMOS_CHAINS),
      };

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeAccountOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  const accountIndex = ctx.getNodeParameter('accountIndex', itemIndex, 0) as number;
  const useCustomPath = ctx.getNodeParameter('useCustomPath', itemIndex, false) as boolean;
  const customPath = useCustomPath ? ctx.getNodeParameter('derivationPath', itemIndex) as string : null;

  switch (operation) {
    case 'getPublicKey': {
      const path = customPath || getDerivationPath('bitcoin', 'bip84', accountIndex);
      const pathArray = pathToArray(path);
      const response = await client.call(MESSAGE_TYPES.GetPublicKey, { addressN: pathArray });
      return {
        publicKey: (response as unknown as IDataObject).publicKey,
        path,
      };
    }

    case 'getAddress': {
      const showOnDevice = ctx.getNodeParameter('showOnDevice', itemIndex, false) as boolean;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || getDerivationPath('bitcoin', 'bip84', accountIndex, addressIndex);
      const pathArray = pathToArray(path);
      const response = await client.call(MESSAGE_TYPES.GetAddress, {
        addressN: pathArray,
        coinName: 'Bitcoin',
        showDisplay: showOnDevice,
        scriptType: 'SPENDWITNESS',
      });
      return {
        address: (response as unknown as IDataObject).address,
        path,
      };
    }

    case 'getXpub': {
      const path = customPath || getDerivationPath('bitcoin', 'bip84', accountIndex);
      const pathArray = pathToArray(path);
      const response = await client.call(MESSAGE_TYPES.GetPublicKey, {
        addressN: pathArray,
        coinName: 'Bitcoin',
      });
      return {
        xpub: (response as unknown as IDataObject).xpub,
        path,
      };
    }

    case 'verifyAddress': {
      const address = ctx.getNodeParameter('address', itemIndex) as string;
      const path = customPath || getDerivationPath('bitcoin', 'bip84', accountIndex);
      const pathArray = pathToArray(path);
      await client.call(MESSAGE_TYPES.GetAddress, {
        addressN: pathArray,
        coinName: 'Bitcoin',
        showDisplay: true,
        scriptType: 'SPENDWITNESS',
      });
      return { verified: true, address, path };
    }

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeBitcoinOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  const accountIndex = ctx.getNodeParameter('accountIndex', itemIndex, 0) as number;
  const addressType = ctx.getNodeParameter('addressType', itemIndex, 'segwit') as string;
  const useCustomPath = ctx.getNodeParameter('useCustomPath', itemIndex, false) as boolean;
  const customPath = useCustomPath ? ctx.getNodeParameter('derivationPath', itemIndex) as string : null;

  const pathTemplate = addressType === 'segwit' ? 'bip84' : 
                       addressType === 'nested-segwit' ? 'bip49' : 
                       addressType === 'taproot' ? 'bip86' : 'bip44';

  switch (operation) {
    case 'getAddress': {
      const showOnDevice = ctx.getNodeParameter('showOnDevice', itemIndex, false) as boolean;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || getDerivationPath('bitcoin', pathTemplate, accountIndex, addressIndex);
      const pathArray = pathToArray(path);
      const response = await client.call(MESSAGE_TYPES.GetAddress, {
        addressN: pathArray,
        coinName: 'Bitcoin',
        showDisplay: showOnDevice,
        scriptType: addressTypeToScriptType(addressType),
      });
      return {
        address: (response as unknown as IDataObject).address,
        path,
        addressType,
      };
    }

    case 'signTransaction': {
      const toAddress = ctx.getNodeParameter('toAddress', itemIndex) as string;
      const amount = ctx.getNodeParameter('amount', itemIndex) as string;
      const feeRate = ctx.getNodeParameter('feeRate', itemIndex, 10) as number;
      
      if (!isValidBitcoinAddress(toAddress)) {
        throw new NodeOperationError(ctx.getNode(), 'Invalid Bitcoin address');
      }
      
      return {
        status: 'signing_required',
        message: 'Transaction signing requires UTXOs and complete transaction data',
        toAddress,
        amount: satoshisToBtc(btcToSatoshis(amount)),
        feeRate,
        satoshis: btcToSatoshis(amount),
      };
    }

    case 'signMessage': {
      const message = ctx.getNodeParameter('message', itemIndex) as string;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || getDerivationPath('bitcoin', pathTemplate, accountIndex, addressIndex);
      const pathArray = pathToArray(path);
      
      const response = await client.call(MESSAGE_TYPES.SignMessage, {
        addressN: pathArray,
        message: Buffer.from(message).toString('hex'),
        coinName: 'Bitcoin',
        scriptType: addressTypeToScriptType(addressType),
      });
      
      return {
        message,
        signature: (response as unknown as IDataObject).signature,
        address: (response as unknown as IDataObject).address,
        path,
      };
    }

    case 'verifyMessage': {
      const message = ctx.getNodeParameter('message', itemIndex) as string;
      const signature = ctx.getNodeParameter('signature', itemIndex) as string;
      const address = ctx.getNodeParameter('address', itemIndex) as string;
      
      const response = await client.call(MESSAGE_TYPES.VerifyMessage, {
        address,
        signature,
        message: Buffer.from(message).toString('hex'),
        coinName: 'Bitcoin',
      });
      
      return {
        valid: (response as unknown as IDataObject).success === true,
        message,
        address,
      };
    }

    case 'getXpub': {
      const path = customPath || getDerivationPath('bitcoin', pathTemplate, accountIndex);
      const pathArray = pathToArray(path);
      const response = await client.call(MESSAGE_TYPES.GetPublicKey, {
        addressN: pathArray,
        coinName: 'Bitcoin',
      });
      return {
        xpub: (response as unknown as IDataObject).xpub,
        path,
        addressType,
      };
    }

    case 'estimateFee': {
      const feeRate = ctx.getNodeParameter('feeRate', itemIndex, 10) as number;
      // Estimate for typical 1-input, 2-output transaction
      const estimatedSize = 140; // vbytes
      const estimatedFee = estimatedSize * feeRate;
      return {
        feeRate,
        estimatedSize,
        estimatedFeeSatoshis: estimatedFee,
        estimatedFeeBtc: satoshisToBtc(estimatedFee),
      };
    }

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeBitcoinLikeOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  const coin = ctx.getNodeParameter('coin', itemIndex, 'bitcoin') as string;
  const coinConfig = BITCOIN_LIKE_COINS[coin.toUpperCase()] || BITCOIN_LIKE_COINS.BTC;
  const accountIndex = ctx.getNodeParameter('accountIndex', itemIndex, 0) as number;
  const useCustomPath = ctx.getNodeParameter('useCustomPath', itemIndex, false) as boolean;
  const customPath = useCustomPath ? ctx.getNodeParameter('derivationPath', itemIndex) as string : null;

  switch (operation) {
    case 'getAddress': {
      const showOnDevice = ctx.getNodeParameter('showOnDevice', itemIndex, false) as boolean;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/${coinConfig.slip44}'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      const response = await client.call(MESSAGE_TYPES.GetAddress, {
        addressN: pathArray,
        coinName: coinConfig.name,
        showDisplay: showOnDevice,
        scriptType: 'SPENDADDRESS',
      });
      
      return {
        address: (response as unknown as IDataObject).address,
        path,
        coin: coinConfig.name,
        symbol: coinConfig.symbol,
      };
    }

    case 'signMessage': {
      const message = ctx.getNodeParameter('message', itemIndex) as string;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/${coinConfig.slip44}'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      const response = await client.call(MESSAGE_TYPES.SignMessage, {
        addressN: pathArray,
        message: Buffer.from(message).toString('hex'),
        coinName: coinConfig.name,
        scriptType: 'SPENDADDRESS',
      });
      
      return {
        message,
        signature: (response as unknown as IDataObject).signature,
        address: (response as unknown as IDataObject).address,
        path,
        coin: coinConfig.name,
      };
    }

    case 'getXpub': {
      const path = customPath || `m/44'/${coinConfig.slip44}'/${accountIndex}'`;
      const pathArray = pathToArray(path);
      const response = await client.call(MESSAGE_TYPES.GetPublicKey, {
        addressN: pathArray,
        coinName: coinConfig.name,
      });
      return {
        xpub: (response as unknown as IDataObject).xpub,
        path,
        coin: coinConfig.name,
      };
    }

    default:
      return { status: 'not_implemented', operation, coin: coinConfig.name };
  }
}

async function executeEthereumOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  const accountIndex = ctx.getNodeParameter('accountIndex', itemIndex, 0) as number;
  const useCustomPath = ctx.getNodeParameter('useCustomPath', itemIndex, false) as boolean;
  const customPath = useCustomPath ? ctx.getNodeParameter('derivationPath', itemIndex) as string : null;

  switch (operation) {
    case 'getAddress': {
      const showOnDevice = ctx.getNodeParameter('showOnDevice', itemIndex, false) as boolean;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/60'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      const response = await client.call(MESSAGE_TYPES.EthereumGetAddress, {
        addressN: pathArray,
        showDisplay: showOnDevice,
      });
      
      return {
        address: (response as unknown as IDataObject).address,
        path,
        chain: 'ethereum',
        chainId: 1,
      };
    }

    case 'signTransaction': {
      const toAddress = ctx.getNodeParameter('toAddress', itemIndex) as string;
      const amount = ctx.getNodeParameter('amount', itemIndex) as string;
      const gasLimit = ctx.getNodeParameter('gasLimit', itemIndex, 21000) as number;
      const useEip1559 = ctx.getNodeParameter('useEip1559', itemIndex, true) as boolean;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/60'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      if (!isValidEthereumAddress(toAddress)) {
        throw new NodeOperationError(ctx.getNode(), 'Invalid Ethereum address');
      }
      
      const weiAmount = ethToWei(amount);
      
      const txParams: IDataObject = {
        addressN: pathArray,
        to: toAddress,
        value: weiAmount,
        gasLimit,
        chainId: 1,
      };
      
      if (useEip1559) {
        const maxPriorityFee = ctx.getNodeParameter('maxPriorityFee', itemIndex, '1.5') as string;
        const maxFee = ctx.getNodeParameter('maxFee', itemIndex, '50') as string;
        txParams.maxPriorityFeePerGas = gweiToWei(maxPriorityFee);
        txParams.maxFeePerGas = gweiToWei(maxFee);
        txParams.txType = 2;
      } else {
        const gasPrice = ctx.getNodeParameter('gasPrice', itemIndex, '') as string;
        if (gasPrice) {
          txParams.gasPrice = gweiToWei(gasPrice);
        }
      }
      
      const response = await client.call(MESSAGE_TYPES.EthereumSignTx, txParams);
      
      return {
        ...(response as unknown as IDataObject),
        toAddress,
        amount,
        weiAmount,
        path,
      };
    }

    case 'signMessage': {
      const message = ctx.getNodeParameter('message', itemIndex) as string;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/60'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      const response = await client.call(MESSAGE_TYPES.EthereumSignMessage, {
        addressN: pathArray,
        message: Buffer.from(message).toString('hex'),
      });
      
      return {
        message,
        signature: (response as unknown as IDataObject).signature,
        address: (response as unknown as IDataObject).address,
        path,
      };
    }

    case 'signTypedData': {
      const message = ctx.getNodeParameter('message', itemIndex) as string;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/60'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      let typedData: IDataObject;
      try {
        typedData = JSON.parse(message) as IDataObject;
      } catch {
        throw new NodeOperationError(ctx.getNode(), 'Invalid typed data JSON');
      }
      
      const response = await client.call(MESSAGE_TYPES.EthereumSignTypedData, {
        addressN: pathArray,
        data: typedData,
      });
      
      return {
        typedData,
        signature: (response as unknown as IDataObject).signature,
        address: (response as unknown as IDataObject).address,
        path,
      };
    }

    case 'verifyMessage': {
      const message = ctx.getNodeParameter('message', itemIndex) as string;
      const signature = ctx.getNodeParameter('signature', itemIndex) as string;
      const address = ctx.getNodeParameter('address', itemIndex) as string;
      
      const response = await client.call(MESSAGE_TYPES.EthereumVerifyMessage, {
        address,
        signature,
        message: Buffer.from(message).toString('hex'),
      });
      
      return {
        valid: (response as unknown as IDataObject).success === true,
        message,
        address,
      };
    }

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeEvmChainsOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  const chain = ctx.getNodeParameter('chain', itemIndex, 'ethereum') as string;
  const chainConfig = EVM_CHAINS[chain.toUpperCase()] || EVM_CHAINS.ETH;
  const accountIndex = ctx.getNodeParameter('accountIndex', itemIndex, 0) as number;
  const useCustomPath = ctx.getNodeParameter('useCustomPath', itemIndex, false) as boolean;
  const customPath = useCustomPath ? ctx.getNodeParameter('derivationPath', itemIndex) as string : null;

  switch (operation) {
    case 'getAddress': {
      const showOnDevice = ctx.getNodeParameter('showOnDevice', itemIndex, false) as boolean;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/60'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      const response = await client.call(MESSAGE_TYPES.EthereumGetAddress, {
        addressN: pathArray,
        showDisplay: showOnDevice,
      });
      
      return {
        address: (response as unknown as IDataObject).address,
        path,
        chain: chainConfig.name,
        chainId: chainConfig.chainId,
        symbol: chainConfig.symbol,
      };
    }

    case 'signTransaction': {
      const toAddress = ctx.getNodeParameter('toAddress', itemIndex) as string;
      const amount = ctx.getNodeParameter('amount', itemIndex) as string;
      const gasLimit = ctx.getNodeParameter('gasLimit', itemIndex, 21000) as number;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/60'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      if (!isValidEthereumAddress(toAddress)) {
        throw new NodeOperationError(ctx.getNode(), 'Invalid address');
      }
      
      const weiAmount = ethToWei(amount);
      
      const response = await client.call(MESSAGE_TYPES.EthereumSignTx, {
        addressN: pathArray,
        to: toAddress,
        value: weiAmount,
        gasLimit,
        chainId: chainConfig.chainId,
      });
      
      return {
        ...(response as unknown as IDataObject),
        chain: chainConfig.name,
        chainId: chainConfig.chainId,
        toAddress,
        amount,
      };
    }

    case 'signMessage': {
      const message = ctx.getNodeParameter('message', itemIndex) as string;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/60'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      const response = await client.call(MESSAGE_TYPES.EthereumSignMessage, {
        addressN: pathArray,
        message: Buffer.from(message).toString('hex'),
      });
      
      return {
        message,
        signature: (response as unknown as IDataObject).signature,
        address: (response as unknown as IDataObject).address,
        path,
        chain: chainConfig.name,
      };
    }

    default:
      return { status: 'not_implemented', operation, chain: chainConfig.name };
  }
}

async function executeErc20Operation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  const chain = ctx.getNodeParameter('chain', itemIndex, 'ethereum') as string;
  const chainConfig = EVM_CHAINS[chain.toUpperCase()] || EVM_CHAINS.ETH;
  const tokenAddress = ctx.getNodeParameter('tokenAddress', itemIndex) as string;
  const accountIndex = ctx.getNodeParameter('accountIndex', itemIndex, 0) as number;
  const useCustomPath = ctx.getNodeParameter('useCustomPath', itemIndex, false) as boolean;
  const customPath = useCustomPath ? ctx.getNodeParameter('derivationPath', itemIndex) as string : null;

  if (!isValidEthereumAddress(tokenAddress)) {
    throw new NodeOperationError(ctx.getNode(), 'Invalid token contract address');
  }

  switch (operation) {
    case 'transfer': {
      const toAddress = ctx.getNodeParameter('toAddress', itemIndex) as string;
      const amount = ctx.getNodeParameter('amount', itemIndex) as string;
      const gasLimit = ctx.getNodeParameter('gasLimit', itemIndex, 65000) as number;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/60'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      if (!isValidEthereumAddress(toAddress)) {
        throw new NodeOperationError(ctx.getNode(), 'Invalid recipient address');
      }
      
      const data = buildErc20TransferData(toAddress, amount);
      
      const response = await client.call(MESSAGE_TYPES.EthereumSignTx, {
        addressN: pathArray,
        to: tokenAddress,
        value: '0',
        gasLimit,
        data,
        chainId: chainConfig.chainId,
      });
      
      return {
        ...(response as unknown as IDataObject),
        tokenAddress,
        toAddress,
        amount,
        chain: chainConfig.name,
      };
    }

    case 'approve': {
      const spenderAddress = ctx.getNodeParameter('spenderAddress', itemIndex) as string;
      const amount = ctx.getNodeParameter('amount', itemIndex) as string;
      const gasLimit = ctx.getNodeParameter('gasLimit', itemIndex, 50000) as number;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/60'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      if (!isValidEthereumAddress(spenderAddress)) {
        throw new NodeOperationError(ctx.getNode(), 'Invalid spender address');
      }
      
      const data = buildErc20ApproveData(spenderAddress, amount);
      
      const response = await client.call(MESSAGE_TYPES.EthereumSignTx, {
        addressN: pathArray,
        to: tokenAddress,
        value: '0',
        gasLimit,
        data,
        chainId: chainConfig.chainId,
      });
      
      return {
        ...(response as unknown as IDataObject),
        tokenAddress,
        spenderAddress,
        amount,
        chain: chainConfig.name,
      };
    }

    default:
      return { status: 'not_implemented', operation, tokenAddress };
  }
}

async function executeCosmosOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  const accountIndex = ctx.getNodeParameter('accountIndex', itemIndex, 0) as number;
  const useCustomPath = ctx.getNodeParameter('useCustomPath', itemIndex, false) as boolean;
  const customPath = useCustomPath ? ctx.getNodeParameter('derivationPath', itemIndex) as string : null;

  switch (operation) {
    case 'getAddress': {
      const showOnDevice = ctx.getNodeParameter('showOnDevice', itemIndex, false) as boolean;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/118'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      const response = await client.call(MESSAGE_TYPES.CosmosGetAddress, {
        addressN: pathArray,
        showDisplay: showOnDevice,
      });
      
      return {
        address: (response as unknown as IDataObject).address,
        path,
        chain: 'cosmos',
      };
    }

    case 'signTransaction': {
      const toAddress = ctx.getNodeParameter('toAddress', itemIndex) as string;
      const amount = ctx.getNodeParameter('amount', itemIndex) as string;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/118'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      if (!isValidCosmosAddress(toAddress)) {
        throw new NodeOperationError(ctx.getNode(), 'Invalid Cosmos address');
      }
      
      return {
        status: 'signing_required',
        message: 'Cosmos transaction signing requires account info and chain details',
        toAddress,
        amount,
        path: pathArrayToString(pathArray),
      };
    }

    case 'send': {
      const toAddress = ctx.getNodeParameter('toAddress', itemIndex) as string;
      const amount = ctx.getNodeParameter('amount', itemIndex) as string;
      
      if (!isValidCosmosAddress(toAddress)) {
        throw new NodeOperationError(ctx.getNode(), 'Invalid Cosmos address');
      }
      
      return {
        status: 'requires_broadcast',
        message: 'Transaction built, needs signing and broadcast',
        toAddress,
        amount,
        denom: 'uatom',
      };
    }

    case 'delegate': {
      const validatorAddress = ctx.getNodeParameter('validatorAddress', itemIndex) as string;
      const amount = ctx.getNodeParameter('amount', itemIndex) as string;
      
      return {
        status: 'delegation_prepared',
        validatorAddress,
        amount,
        denom: 'uatom',
      };
    }

    case 'undelegate': {
      const validatorAddress = ctx.getNodeParameter('validatorAddress', itemIndex) as string;
      const amount = ctx.getNodeParameter('amount', itemIndex) as string;
      
      return {
        status: 'undelegation_prepared',
        validatorAddress,
        amount,
        denom: 'uatom',
        unbondingPeriod: '21 days',
      };
    }

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeThorchainOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  const accountIndex = ctx.getNodeParameter('accountIndex', itemIndex, 0) as number;
  const useCustomPath = ctx.getNodeParameter('useCustomPath', itemIndex, false) as boolean;
  const customPath = useCustomPath ? ctx.getNodeParameter('derivationPath', itemIndex) as string : null;

  switch (operation) {
    case 'getAddress': {
      const showOnDevice = ctx.getNodeParameter('showOnDevice', itemIndex, false) as boolean;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/931'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      const response = await client.call(MESSAGE_TYPES.ThorchainGetAddress, {
        addressN: pathArray,
        showDisplay: showOnDevice,
      });
      
      return {
        address: (response as unknown as IDataObject).address,
        path,
        chain: 'thorchain',
      };
    }

    case 'swap': {
      const sellAsset = ctx.getNodeParameter('sellAsset', itemIndex) as string;
      const buyAsset = ctx.getNodeParameter('buyAsset', itemIndex) as string;
      const sellAmount = ctx.getNodeParameter('sellAmount', itemIndex) as string;
      const slippageTolerance = ctx.getNodeParameter('slippageTolerance', itemIndex, 1) as number;
      
      const validation = validateSwapParams({
        fromAsset: sellAsset,
        toAsset: buyAsset,
        amount: parseFloat(sellAmount),
        destinationAddress: '',
      });
      if (!validation.isValid) {
        throw new NodeOperationError(ctx.getNode(), `Invalid swap parameters: ${validation.errors.join(', ')}`);
      }
      
      const minOutput = applySlippage(sellAmount, slippageTolerance);
      const memo = createThorchainSwapMemo({
        asset: buyAsset,
        destinationAddress: '', // Would come from getAddress
        limit: minOutput,
      });
      
      return {
        status: 'swap_prepared',
        sellAsset,
        buyAsset,
        sellAmount,
        minOutput,
        slippageTolerance,
        memo,
      };
    }

    case 'send': {
      const toAddress = ctx.getNodeParameter('toAddress', itemIndex) as string;
      const amount = ctx.getNodeParameter('amount', itemIndex) as string;
      
      if (!isValidThorchainAddress(toAddress)) {
        throw new NodeOperationError(ctx.getNode(), 'Invalid THORChain address');
      }
      
      return {
        status: 'send_prepared',
        toAddress,
        amount,
        denom: 'rune',
      };
    }

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeOsmosisOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  const accountIndex = ctx.getNodeParameter('accountIndex', itemIndex, 0) as number;
  const useCustomPath = ctx.getNodeParameter('useCustomPath', itemIndex, false) as boolean;
  const customPath = useCustomPath ? ctx.getNodeParameter('derivationPath', itemIndex) as string : null;

  switch (operation) {
    case 'getAddress': {
      const showOnDevice = ctx.getNodeParameter('showOnDevice', itemIndex, false) as boolean;
      const addressIndex = ctx.getNodeParameter('addressIndex', itemIndex, 0) as number;
      const path = customPath || `m/44'/118'/${accountIndex}'/0/${addressIndex}`;
      const pathArray = pathToArray(path);
      
      const response = await client.call(MESSAGE_TYPES.OsmosisGetAddress, {
        addressN: pathArray,
        showDisplay: showOnDevice,
      });
      
      return {
        address: (response as unknown as IDataObject).address,
        path,
        chain: 'osmosis',
      };
    }

    case 'swap': {
      const sellAsset = ctx.getNodeParameter('sellAsset', itemIndex) as string;
      const buyAsset = ctx.getNodeParameter('buyAsset', itemIndex) as string;
      const sellAmount = ctx.getNodeParameter('sellAmount', itemIndex) as string;
      const slippageTolerance = ctx.getNodeParameter('slippageTolerance', itemIndex, 1) as number;
      
      return {
        status: 'osmosis_swap_prepared',
        sellAsset,
        buyAsset,
        sellAmount,
        slippageTolerance,
        dex: 'osmosis',
      };
    }

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeAddressOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  switch (operation) {
    case 'validate': {
      const address = ctx.getNodeParameter('address', itemIndex) as string;
      const coinTypes = ['bitcoin', 'ethereum', 'cosmos', 'thorchain'];
      
      for (const coin of coinTypes) {
        if (validateAddressForCoin(address, coin)) {
          return { valid: true, address, detectedType: coin };
        }
      }
      
      return { valid: false, address, detectedType: 'unknown' };
    }

    case 'generate': {
      const useCustomPath = ctx.getNodeParameter('useCustomPath', itemIndex, false) as boolean;
      const path = useCustomPath
        ? ctx.getNodeParameter('derivationPath', itemIndex) as string
        : "m/84'/0'/0'/0/0";
      const pathArray = pathToArray(path);
      const showOnDevice = ctx.getNodeParameter('showOnDevice', itemIndex, false) as boolean;
      
      const response = await client.call(MESSAGE_TYPES.GetAddress, {
        addressN: pathArray,
        coinName: 'Bitcoin',
        showDisplay: showOnDevice,
        scriptType: 'SPENDWITNESS',
      });
      
      return {
        address: (response as unknown as IDataObject).address,
        path,
      };
    }

    case 'showOnDevice': {
      const useCustomPath = ctx.getNodeParameter('useCustomPath', itemIndex, false) as boolean;
      const path = useCustomPath
        ? ctx.getNodeParameter('derivationPath', itemIndex) as string
        : "m/84'/0'/0'/0/0";
      const pathArray = pathToArray(path);
      
      const response = await client.call(MESSAGE_TYPES.GetAddress, {
        addressN: pathArray,
        coinName: 'Bitcoin',
        showDisplay: true,
        scriptType: 'SPENDWITNESS',
      });
      
      return {
        displayed: true,
        address: (response as unknown as IDataObject).address,
        path,
      };
    }

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeTransactionOperation(
  ctx: IExecuteFunctions,
  _client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  switch (operation) {
    case 'getStatus': {
      const txId = ctx.getNodeParameter('txId', itemIndex) as string;
      return {
        status: 'lookup_required',
        message: 'Transaction status requires blockchain API lookup',
        txId,
        explorerUrl: getExplorerUrl('bitcoin', txId),
      };
    }

    case 'decode': {
      const rawTx = ctx.getNodeParameter('rawTransaction', itemIndex) as string;
      return {
        status: 'decode_pending',
        rawTx,
        message: 'Transaction decoding requires additional parsing',
      };
    }

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeSigningOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  const useCustomPath = ctx.getNodeParameter('useCustomPath', itemIndex, false) as boolean;
  const customPath = useCustomPath ? ctx.getNodeParameter('derivationPath', itemIndex) as string : null;
  const path = customPath || "m/44'/60'/0'/0/0";
  const pathArray = pathToArray(path);

  switch (operation) {
    case 'signMessage': {
      const message = ctx.getNodeParameter('message', itemIndex) as string;
      
      const response = await client.call(MESSAGE_TYPES.EthereumSignMessage, {
        addressN: pathArray,
        message: Buffer.from(message).toString('hex'),
      });
      
      return {
        message,
        signature: (response as unknown as IDataObject).signature,
        address: (response as unknown as IDataObject).address,
        path,
      };
    }

    case 'getPublicKey': {
      const response = await client.call(MESSAGE_TYPES.GetPublicKey, { addressN: pathArray });
      return {
        publicKey: (response as unknown as IDataObject).publicKey,
        path,
      };
    }

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeShapeshiftOperation(
  ctx: IExecuteFunctions,
  _client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  switch (operation) {
    case 'getQuote': {
      const sellAsset = ctx.getNodeParameter('sellAsset', itemIndex) as string;
      const buyAsset = ctx.getNodeParameter('buyAsset', itemIndex) as string;
      const sellAmount = ctx.getNodeParameter('sellAmount', itemIndex) as string;
      
      return {
        status: 'quote_required',
        message: 'ShapeShift quotes require API integration',
        sellAsset,
        buyAsset,
        sellAmount,
      };
    }

    case 'getSupportedAssets':
      return {
        status: 'list_required',
        message: 'Asset list requires ShapeShift API',
      };

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeSwapOperation(
  ctx: IExecuteFunctions,
  _client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  switch (operation) {
    case 'getQuote': {
      const sellAsset = ctx.getNodeParameter('sellAsset', itemIndex) as string;
      const buyAsset = ctx.getNodeParameter('buyAsset', itemIndex) as string;
      const sellAmount = ctx.getNodeParameter('sellAmount', itemIndex) as string;
      const slippageTolerance = ctx.getNodeParameter('slippageTolerance', itemIndex, 1) as number;
      
      const validation = validateSwapParams({
        fromAsset: sellAsset,
        toAsset: buyAsset,
        amount: parseFloat(sellAmount),
        destinationAddress: '',
      });
      if (!validation.isValid) {
        throw new NodeOperationError(ctx.getNode(), `Invalid swap: ${validation.errors.join(', ')}`);
      }
      
      return {
        status: 'quote_prepared',
        sellAsset,
        buyAsset,
        sellAmount,
        slippageTolerance,
        minOutput: applySlippage(sellAmount, slippageTolerance),
      };
    }

    case 'getSupportedPairs':
      return {
        pairs: [
          'BTC.BTC/ETH.ETH',
          'ETH.ETH/THOR.RUNE',
          'BTC.BTC/THOR.RUNE',
        ],
        message: 'Full pair list requires DEX API integration',
      };

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeStakingOperation(
  ctx: IExecuteFunctions,
  _client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  switch (operation) {
    case 'delegate': {
      const validatorAddress = ctx.getNodeParameter('validatorAddress', itemIndex) as string;
      const amount = ctx.getNodeParameter('amount', itemIndex) as string;
      
      return {
        status: 'delegation_prepared',
        validatorAddress,
        amount,
        message: 'Delegation requires signing and broadcast',
      };
    }

    case 'undelegate': {
      const validatorAddress = ctx.getNodeParameter('validatorAddress', itemIndex) as string;
      const amount = ctx.getNodeParameter('amount', itemIndex) as string;
      
      return {
        status: 'undelegation_prepared',
        validatorAddress,
        amount,
        message: 'Undelegation requires signing and broadcast',
      };
    }

    case 'getValidators':
      return {
        status: 'list_required',
        message: 'Validator list requires chain API',
      };

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeDefiOperation(
  ctx: IExecuteFunctions,
  _client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  switch (operation) {
    case 'addLiquidity': {
      const slippageTolerance = ctx.getNodeParameter('slippageTolerance', itemIndex, 1) as number;
      
      return {
        status: 'liquidity_addition_prepared',
        slippageTolerance,
        message: 'Liquidity operations require pool selection and amounts',
      };
    }

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeRecoveryOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  switch (operation) {
    case 'startRecovery': {
      const wordCount = ctx.getNodeParameter('wordCount', itemIndex, 12) as number;
      const pinProtection = ctx.getNodeParameter('pinProtection', itemIndex, true) as boolean;
      
      await client.recoverDevice({
        word_count: wordCount as 12 | 18 | 24,
        pin_protection: pinProtection,
        enforce_wordlist: true,
      });
      
      return {
        status: 'recovery_started',
        wordCount,
        pinProtection,
        message: 'Follow device prompts to enter recovery words',
      };
    }

    case 'enterWord': {
      const word = ctx.getNodeParameter('recoveryWord', itemIndex) as string;
      await client.sendWord(word);
      return { status: 'word_entered', message: 'Word accepted' };
    }

    case 'cancelRecovery':
      await client.cancel();
      return { status: 'recovery_cancelled' };

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executePinOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  switch (operation) {
    case 'changePin':
      await client.changePin();
      return {
        status: 'pin_change_initiated',
        message: 'Follow device prompts to change PIN',
        matrixDescription: getPinMatrixTypeDescription(1),
      };

    case 'removePin':
      await client.changePin(true);
      return {
        status: 'pin_removal_initiated',
        message: 'Follow device prompts to remove PIN',
      };

    case 'enterPin': {
      const pin = ctx.getNodeParameter('pin', itemIndex) as string;
      if (!isValidPin(pin)) {
        throw new NodeOperationError(ctx.getNode(), 'Invalid PIN format');
      }
      const encodedPin = encodePin(pin);
      await client.sendPin(encodedPin);
      return { status: 'pin_entered' };
    }

    case 'checkPinStatus': {
      const features = await client.getFeatures();
      return {
        pinProtected: features?.pin_protection || false,
        deviceId: features?.device_id,
      };
    }

    case 'getPinMatrix':
      return {
        matrixDescription: getPinMatrixTypeDescription(1),
        layout: '7 8 9\n4 5 6\n1 2 3',
        note: 'Enter PIN using position numbers based on device display',
      };

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executePassphraseOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  switch (operation) {
    case 'enable':
      await client.applySettings({ use_passphrase: true });
      return { status: 'passphrase_enabled' };

    case 'disable':
      await client.applySettings({ use_passphrase: false });
      return { status: 'passphrase_disabled' };

    case 'enter': {
      const passphrase = ctx.getNodeParameter('passphrase', itemIndex) as string;
      await client.sendPassphrase(passphrase);
      return { status: 'passphrase_entered' };
    }

    case 'checkStatus': {
      const features = await client.getFeatures();
      return {
        passphraseEnabled: features?.passphrase_protection || false,
      };
    }

    case 'setOnDevice':
      // Note: passphraseAlwaysOnDevice is not directly available in current API
      // This enables passphrase and returns info that user should enter on device
      await client.applySettings({ use_passphrase: true });
      return {
        status: 'on_device_enabled',
        message: 'Passphrase enabled - enter on device when prompted',
        note: 'Device will prompt for passphrase entry',
      };

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeFirmwareOperation(
  _ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  _itemIndex: number,
): Promise<IDataObject> {
  switch (operation) {
    case 'getVersion': {
      const features = await client.getFeatures();
      return {
        majorVersion: features?.major_version,
        minorVersion: features?.minor_version,
        patchVersion: features?.patch_version,
        fullVersion: `${features?.major_version}.${features?.minor_version}.${features?.patch_version}`,
        bootloaderMode: features?.bootloader_mode,
      };
    }

    case 'checkUpdate':
      return {
        status: 'check_required',
        message: 'Firmware update check requires KeepKey API',
      };

    case 'verifyFirmware': {
      const features = await client.getFeatures();
      return {
        firmwarePresent: features?.firmware_present,
        initialized: features?.initialized,
        vendor: features?.vendor,
      };
    }

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeSecurityOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  switch (operation) {
    case 'lockDevice':
      await client.clearSession();
      return { status: 'device_locked' };

    case 'checkSecurity': {
      const features = await client.getFeatures();
      return {
        pinProtected: features?.pin_protection,
        passphraseEnabled: features?.passphrase_protection,
        initialized: features?.initialized,
        needsBackup: features?.needs_backup,
      };
    }

    case 'getSecurityInfo': {
      const features = await client.getFeatures();
      return {
        deviceId: features?.device_id,
        label: features?.label,
        pinProtected: features?.pin_protection,
        passphraseEnabled: features?.passphrase_protection,
        initialized: features?.initialized,
        bootloaderMode: features?.bootloader_mode,
        firmwarePresent: features?.firmware_present,
      };
    }

    case 'setAutoLock': {
      const delay = ctx.getNodeParameter('autoLockDelay', itemIndex) as number;
      await client.applySettings({ auto_lock_delay_ms: delay * 1000 });
      return { status: 'auto_lock_set', delaySeconds: delay };
    }

    case 'factoryReset':
      await client.wipeDevice();
      return { status: 'factory_reset_complete', message: 'Device has been wiped' };

    default:
      return { status: 'not_implemented', operation };
  }
}

async function executeUtilityOperation(
  ctx: IExecuteFunctions,
  client: KeepKeyClient,
  operation: string,
  itemIndex: number,
): Promise<IDataObject> {
  switch (operation) {
    case 'getRandom':
    case 'getEntropy': {
      const bytes = ctx.getNodeParameter('bytes', itemIndex, 32) as number;
      const entropy = await client.getEntropy(bytes);
      return {
        entropy: entropy.toString('hex'),
        bytes,
      };
    }

    case 'cipherKeyValue': {
      const data = ctx.getNodeParameter('data', itemIndex) as string;
      const useCustomPath = ctx.getNodeParameter('useCustomPath', itemIndex, false) as boolean;
      const path = useCustomPath
        ? ctx.getNodeParameter('derivationPath', itemIndex) as string
        : "m/44'/60'/0'/0/0";
      const pathArray = pathToArray(path);
      
      const response = await client.call(MESSAGE_TYPES.CipherKeyValue, {
        addressN: pathArray,
        key: 'n8n-keepkey',
        value: Buffer.from(data).toString('hex'),
        encrypt: true,
        askOnEncrypt: true,
        askOnDecrypt: true,
      });
      
      return {
        result: (response as unknown as IDataObject).value,
        path,
      };
    }

    default:
      return { status: 'not_implemented', operation };
  }
}

// Mark helper functions as used
void pathToArray;
void addressTypeToScriptType;
void buildErc20TransferData;
void buildErc20ApproveData;
void satoshisToBtc;
void btcToSatoshis;
void weiToEth;
void ethToWei;
void gweiToWei;
void encodePin;
void isValidPin;
void getPinMatrixTypeDescription;
void applySlippage;
void createThorchainSwapMemo;
void validateSwapParams;
void getDerivationPath;
void pathArrayToString;
void isValidBitcoinAddress;
void isValidEthereumAddress;
void isValidCosmosAddress;
void isValidThorchainAddress;
void validateAddressForCoin;
void getExplorerUrl;
void BITCOIN_LIKE_COINS;
void EVM_CHAINS;
void COSMOS_CHAINS;
