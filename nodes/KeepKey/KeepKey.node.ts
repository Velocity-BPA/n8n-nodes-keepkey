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
  { name: 'Wallet', value: 'wallet', description: 'Wallet management operations' },
  { name: 'Account', value: 'account', description: 'Account and wallet management' },
  { name: 'Bitcoin', value: 'bitcoin', description: 'Bitcoin transactions and operations' },
  { name: 'Bitcoin-Like', value: 'bitcoinLike', description: 'Litecoin, Dogecoin, Bitcoin Cash, etc.' },
  { name: 'Ethereum', value: 'ethereum', description: 'Ethereum transactions and smart contracts' },
  { name: 'EVM Chains', value: 'evmChains', description: 'Avalanche, Polygon, Arbitrum, etc.' },
  { name: 'ERC-20 Token', value: 'erc20', description: 'ERC-20 token operations' },
  { name: 'Cosmos', value: 'cosmos', description: 'Cosmos Hub transactions' },
  { name: 'THORChain', value: 'thorchain', description: 'THORChain transactions and swaps' },
  { name: 'Osmosis', value: 'osmosis', description: 'Osmosis DEX operations' },
  { name: 'Transaction', value: 'transaction', description: 'Transaction building and status' },
  { name: 'Exchange', value: 'exchange', description: 'Exchange operations' },
  { name: 'Asset', value: 'asset', description: 'Asset operations' },
  { name: 'Address', value: 'address', description: 'Address generation and validation' },
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

// Device Operations
const deviceOperations = [
  { name: 'Get Device Info', value: 'getDeviceInfo', description: 'Get device information and capabilities', action: 'Get device info' },
  { name: 'Initialize Device', value: 'initializeDevice', description: 'Initialize device connection', action: 'Initialize device' },
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
  { name: 'Get Public Key', value: 'getPublicKey', description: 'Get public key for derivation path', action: 'Get public key' },
  { name: 'Recover Device', value: 'recoverDevice', description: 'Start device recovery process', action: 'Recover device' },
];

// Wallet Operations
const walletOperations = [
  { name: 'Get Addresses', value: 'getAddresses', description: 'Get wallet addresses for specified coin', action: 'Get wallet addresses' },
  { name: 'Generate Address', value: 'generateAddress', description: 'Generate new address for specified path', action: 'Generate new address' },
  { name: 'Get Balance', value: 'getBalance', description: 'Get balance for specific address or wallet', action: 'Get wallet balance' },
  { name: 'Get UTXOs', value: 'getUtxos', description: 'Get unspent transaction outputs', action: 'Get unspent transaction outputs' },
  { name: 'Get Extended Public Key', value: 'getExtendedPublicKey', description: 'Get extended public key for specified derivation path', action: 'Get extended public key' },
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

// Transaction Operations
const transactionOperations = [
  { name: 'Sign Transaction', value: 'signTransaction', description: 'Sign transaction with KeepKey device', action: 'Sign transaction' },
  { name: 'Broadcast Transaction', value: 'broadcastTransaction', description: 'Broadcast signed transaction to network', action: 'Broadcast transaction' },
  { name: 'Get Transaction History', value: 'getTransactionHistory', description: 'Get transaction history for address', action: 'Get transaction history' },
  { name: 'Estimate Fee', value: 'estimateFee', description: 'Estimate transaction fee', action: 'Estimate fee' },
  { name: 'Get Transaction Details', value: 'getTransactionDetails', description: 'Get detailed transaction information', action: 'Get transaction details' },
  { name: 'Build', value: 'build', description: 'Build transaction' },
  { name: 'Sign', value: 'sign', description: 'Sign transaction' },
  { name: 'Broadcast', value: 'broadcast', description: 'Broadcast transaction' },
  { name: 'Get Status', value: 'getStatus', description: 'Get transaction status' },
  { name: 'Get Details', value: 'getDetails', description: 'Get transaction details' },
  { name: 'Decode', value: 'decode', description: 'Decode raw transaction' },
  { name: 'Get History', value: 'getHistory', description: 'Get transaction history' },
  { name: 'Cancel', value: 'cancel', description: 'Cancel pending transaction' },
];

// Exchange Operations
const exchangeOperations = [
  { name: 'Get Exchange Rate', value: 'getExchangeRate', description: 'Get current exchange rate between coins', action: 'Get exchange rate' },
  { name: 'Create Exchange Order', value: 'createExchangeOrder', description: 'Create new exchange order', action: 'Create exchange order' },
  { name: 'Get Exchange Order', value: 'getExchangeOrder', description: 'Get exchange order status', action: 'Get exchange order' },
  { name: 'Get Supported Pairs', value: 'getSupportedPairs', description: 'Get list of supported trading pairs', action: 'Get supported pairs' },
  { name: 'Get Exchange Limits', value: 'getExchangeLimits', description: 'Get min/max limits for trading pair', action: 'Get exchange limits' },
];

// Asset Operations
const assetOperations = [
  { name: 'Get Supported Assets', value: 'getSupportedAssets', description: 'Get list of all supported cryptocurrencies', action: 'Get supported assets' },
  { name: 'Get Asset Info', value: 'getAssetInfo', description: 'Get detailed information about specific asset', action: 'Get asset info' },
  { name: 'Get Market Data', value: 'getMarketData', description: 'Get current market data for asset', action: 'Get market data' },
  { name: 'Get Price History', value: 'getPriceHistory', description: 'Get historical price data', action: 'Get price history' },
  { name: 'Add Custom Token', value: 'addCustomToken', description: 'Add custom ERC-20 token support', action: 'Add custom token' },
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

      // Wallet Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['wallet'] } },
        options: walletOperations,
        default: 'getAddresses',
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

      // Transaction Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['transaction'] } },
        options: transactionOperations,
        default: 'signTransaction',
      },

      // Exchange Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['exchange'] } },
        options: exchangeOperations,
        default: 'getExchangeRate',
      },

      // Asset Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['asset'] } },
        options: assetOperations,
        default: 'getSupportedAssets',
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

      // NEW API PARAMETERS

      // Device API Parameters
      {
        displayName: 'Label',
        name: 'label',
        type: 'string',
        default: '',
        description: 'Device label/name',
        displayOptions: { show: { resource: ['device'], operation: ['initializeDevice'] } },
      },
      {
        displayName: 'Passphrase Protection',
        name: 'passphrase_protection',
        type: 'boolean',
        default: false,
        description: 'Enable passphrase protection',
        displayOptions: { show: { resource: ['device'], operation: ['initializeDevice', 'recoverDevice'] } },
      },
      {
        displayName: 'Address Path',
        name: 'address_n',
        type: 'string',
        default: "m/44'/0'/0'/0/0",
        description: 'BIP32/BIP44 derivation path (comma-separated integers)',
        displayOptions: { show: { resource: ['device'], operation: ['getPublicKey'] } },
      },
      {
        displayName: 'Coin Name',
        name: 'coin_name',
        type: 'string',
        default: 'Bitcoin',
        description: 'Name of the cryptocurrency',
        displayOptions: { show: { resource: ['device'], operation: ['getPublicKey'] } },
      },
      {
        displayName: 'Show on Display',
        name: 'show_display',
        type: 'boolean',
        default: false,
        description: 'Show address on device display for verification',
        displayOptions: { show: { resource: ['device'], operation: ['getPublicKey'] } },
      },
      {
        displayName: 'Word Count',
        name: 'word_count',
        type: 'options',
        options: [
          { name: '12 words', value: 12 },
          { name: '18 words', value: 18 },
          { name: '24 words', value: 24 },
        ],
        default: 24,
        description: 'Number of recovery seed words',
        displayOptions: { show: { resource: ['device'], operation: ['recoverDevice'] } },
      },
      {
        displayName: 'PIN Protection',
        name: 'pin_protection',
        type: 'boolean',
        default: true,
        description: 'Enable PIN protection',
        displayOptions: { show: { resource: ['device'], operation: ['recoverDevice'] } },
      },
      {
        displayName: 'Language',
        name: 'language',
        type: 'string',
        default: 'english',
        description: 'Recovery seed language',
        displayOptions: { show: { resource: ['device'], operation: ['recoverDevice'] } },
      },

      // Wallet API Parameters
      {
        displayName: 'Coin',
        name: 'coin',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            resource: ['wallet'],
            operation: ['getAddresses', 'generateAddress', 'getBalance', 'getUtxos', 'getExtendedPublicKey'],
          },
        },
        default: 'bitcoin',
        description: 'Cryptocurrency coin type (e.g., bitcoin, ethereum, litecoin)',
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        displayOptions: {
          show: {
            resource: ['wallet'],
            operation: ['getAddresses'],
          },
        },
        default: 10,
        description: 'Maximum number of addresses to return',
      },
      {
        displayName: 'Offset',
        name: 'offset',
        type: 'number',
        displayOptions: {
          show: {
            resource: ['wallet'],
            operation: ['getAddresses'],
          },
        },
        default: 0,
        description: 'Number of addresses to skip',
      },
      {
        displayName: 'Derivation Path',
        name: 'address_n',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            resource: ['wallet'],
            operation: ['generateAddress', 'getExtendedPublicKey'],
          },
        },
        default: "m/44'/0'/0'/0/0",
        description: 'BIP32/BIP44 derivation path for address generation',
      },
      {
        displayName: 'Address',
        name: 'address',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            resource: ['wallet'],
            operation: ['getBalance'],
          },
        },
        default: '',
        description: 'Wallet address to get balance for',
      },
      {
        displayName: 'Addresses',
        name: 'addresses',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            resource: ['wallet'],
            operation: ['getUtxos'],
          },
        },
        default: '',
        description: 'Comma-separated list of addresses to get UTXOs for',
      },

      // Transaction API Parameters
      {
        displayName: 'Transaction Inputs',
        name: 'inputs',
        type: 'json',
        required: true,
        default: '[]',
        description: 'Array of transaction inputs with previous outputs and signatures',
        displayOptions: {
          show: {
            resource: ['transaction'],
            operation: ['signTransaction'],
          },
        },
      },
      {
        displayName: 'Transaction Outputs',
        name: 'outputs',
        type: 'json',
        required: true,
        default: '[]',
        description: 'Array of transaction outputs with addresses and amounts',
        displayOptions: {
          show: {
            resource: ['transaction'],
            operation: ['signTransaction'],
          },
        },
      },
      {
        displayName: 'Transaction Hex',
        name: 'tx_hex',
        type: 'string',
        required: true,
        default: '',
        description: 'Signed transaction in hexadecimal format',
        displayOptions: {
          show: {
            resource: ['transaction'],
            operation: ['broadcastTransaction'],
          },
        },
      },
      {
        displayName: 'Transaction Size',
        name: 'tx_size',
        type: 'number',
        required: true,
        default: 250,
        description: 'Estimated transaction size in bytes',
        displayOptions: {
          show: {
            resource: ['transaction'],
            operation: ['estimateFee'],
          },
        },
      },
      {
        displayName: 'Fee Level',
        name: 'fee_level',
        type: 'options',
        required: true,
        options: [
          {
            name: 'Low',
            value: 'low',
            description: 'Low priority, slower confirmation',
          },
          {
            name: 'Medium',
            value: 'medium',
            description: 'Medium priority, moderate confirmation time',
          },
          {
            name: 'High',
            value: 'high',
            description: 'High priority, faster confirmation',
          },
        ],
        default: 'medium',
        description: 'Fee level for transaction priority',
        displayOptions: {
          show: {
            resource: ['transaction'],
            operation: ['estimateFee'],
          },
        },
      },
      {
        displayName: 'Transaction ID',
        name: 'txid',
        type: 'string',
        required: true,
        default: '',
        description: 'Transaction hash/ID to get details for',
        displayOptions: {
          show: {
            resource: ['transaction'],
            operation: ['getTransactionDetails'],
          },
        },
      },

      // Exchange API Parameters
      {
        displayName: 'From Coin',
        name: 'fromCoin',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            resource: ['exchange'],
            operation: ['getExchangeRate', 'createExchangeOrder', 'getExchangeLimits'],
          },
        },
        default: '',
        placeholder: 'BTC',
        description: 'The coin symbol to exchange from',
      },
      {
        displayName: 'To Coin',
        name: 'toCoin',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            resource: ['exchange'],
            operation: ['getExchangeRate', 'createExchangeOrder', 'getExchangeLimits'],
          },
        },
        default: '',
        placeholder: 'ETH',
        description: 'The coin symbol to exchange to',
      },
      {
        displayName: 'Return Address',
        name: 'returnAddress',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            resource: ['exchange'],
            operation: ['createExchangeOrder'],
          },
        },
        default: '',
        description: 'The address to return funds to if exchange fails',
      },
      {
        displayName: 'Destination Address',
        name: 'destinationAddress',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            resource: ['exchange'],
            operation: ['createExchangeOrder'],
          },
        },
        default: '',
        description: 'The address to send the exchanged coins to',
      },
      {
        displayName: 'Order ID',
        name: 'orderId',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            resource: ['exchange'],
            operation: ['getExchangeOrder'],
          },
        },
        default: '',
        description: 'The exchange order ID to retrieve',
      },

      // Asset API Parameters
      {
        displayName: 'VS Currency',
        name: 'vs_currency',
        type: 'string',
        required: false,
        displayOptions: { show: { resource: ['asset'], operation: ['getMarketData'] } },
        default: 'usd',
        description: 'The currency to get market data in (default: USD)',
      },
      {
        displayName: 'Days',
        name: 'days',
        type: 'number',
        required: false,
        displayOptions: { show: { resource: ['asset'], operation: ['getPriceHistory'] } },
        default: 7,
        description: 'Number of days of historical data (default: 7)',
      },
      {
        displayName: 'Interval',
        name: 'interval',
        type: 'options',
        required: false,
        displayOptions: { show: { resource: ['asset'], operation: ['getPriceHistory'] } },
        options: [
          { name: '1 Hour', value: '1h' },
          { name: '1 Day', value: '1d' },
          { name: '1 Week', value: '1w' },
        ],
        default: '1d',
        description: 'Data interval',
      },
      {
        displayName: 'Contract Address',
        name: 'contract_address',
        type: 'string',
        required: true,
        displayOptions: { show: { resource: ['asset'], operation: ['addCustomToken'] } },
        default: '',
        description: 'The ERC-20 token contract address',
      },
      {
        displayName: 'Symbol',
        name: 'symbol',
        type: 'string',
        required: true,
        displayOptions: { show: { resource: ['asset'], operation: ['addCustomToken'] } },
        default: '',
        description: 'The token symbol',
      },
      {
        displayName: 'Decimals',
        name: 'decimals',
        type: 'number',
        required: true,
        displayOptions: { show: { resource: ['asset'], operation: ['addCustomToken'] } },
        default: 18,
        description: 'Number of decimal places for the token',
      },

      // =====================
      // LEGACY COMMON PARAMETERS (preserved for backward compatibility)
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
            resource: ['bitcoinLike', 'asset', 'transaction'],
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
            operation: ['getAddress', 'verifyAddress', 'showOnDevice', 'generateAddress'],
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
            operation: ['signTransaction', 'send', 'sendTransaction', 'transfer', 'buildTransaction', 'delegate', 'undelegate', 'getExchangeRate', 'createExchangeOrder'],
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