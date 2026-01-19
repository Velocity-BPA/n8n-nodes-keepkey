/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Transaction utilities for Bitcoin, Ethereum, and Cosmos blockchains
 */

export interface BitcoinInput {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey?: string;
  addressN?: number[];
}

export interface BitcoinOutput {
  address: string;
  value: number;
  scriptType?: string;
}

export interface EthereumTxParams {
  to: string;
  value: string;
  data?: string;
  nonce: number;
  gasLimit: number;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId: number;
  txType?: number;
}

export interface CosmosTxParams {
  fromAddress: string;
  toAddress: string;
  amount: string;
  denom: string;
  fee: string;
  gas: number;
  memo?: string;
  chainId: string;
  accountNumber: number;
  sequence: number;
}

/**
 * Calculate total value from inputs
 */
export function calculateTotalInputValue(inputs: BitcoinInput[]): number {
  return inputs.reduce((sum, input) => sum + (input.value || 0), 0);
}

/**
 * Calculate total value from outputs
 */
export function calculateTotalOutputValue(outputs: BitcoinOutput[]): number {
  return outputs.reduce((sum, output) => sum + (output.value || 0), 0);
}

/**
 * Calculate Bitcoin transaction fee
 */
export function calculateBitcoinFee(inputs: BitcoinInput[], outputs: BitcoinOutput[]): number {
  if (!inputs.length || !outputs.length) return 0;
  const inputTotal = calculateTotalInputValue(inputs);
  const outputTotal = calculateTotalOutputValue(outputs);
  return inputTotal - outputTotal;
}

/**
 * Estimate Bitcoin transaction size in virtual bytes
 */
export function estimateBitcoinTxSize(
  numInputs: number,
  numOutputs: number,
  addressType: 'legacy' | 'segwit' | 'nativeSegwit' | 'taproot' = 'nativeSegwit',
): number {
  // Base transaction overhead
  const overhead = 10;

  switch (addressType) {
    case 'legacy':
      // P2PKH: 148 bytes per input, 34 bytes per output
      return overhead + numInputs * 148 + numOutputs * 34;
    case 'segwit':
      // P2SH-P2WPKH: ~91 vbytes per input, 32 bytes per output
      return overhead + numInputs * 91 + numOutputs * 32;
    case 'nativeSegwit':
      // P2WPKH: ~68 vbytes per input, 31 bytes per output
      return overhead + numInputs * 68 + numOutputs * 31;
    case 'taproot':
      // P2TR: ~57.5 vbytes per input, 43 bytes per output
      return overhead + Math.ceil(numInputs * 57.5) + numOutputs * 43;
    default:
      return overhead + numInputs * 148 + numOutputs * 34;
  }
}

/**
 * Calculate fee rate in sat/vB
 */
export function calculateFeeRate(fee: number, txSize: number): number {
  if (txSize === 0) return 0;
  return Math.round(fee / txSize);
}

/**
 * Convert satoshis to BTC
 */
export function satoshisToBtc(satoshis: number | string): number {
  const sats = typeof satoshis === 'string' ? parseInt(satoshis, 10) : satoshis;
  return sats / 100000000;
}

/**
 * Convert BTC to satoshis
 */
export function btcToSatoshis(btc: number | string): number {
  const btcNum = typeof btc === 'string' ? parseFloat(btc) : btc;
  return Math.round(btcNum * 100000000);
}

/**
 * Convert wei to ETH
 */
export function weiToEth(wei: string | bigint): number {
  const weiNum = typeof wei === 'bigint' ? wei : BigInt(wei);
  return Number(weiNum) / 1e18;
}

/**
 * Convert ETH to wei
 */
export function ethToWei(eth: string | number): string {
  const ethNum = typeof eth === 'string' ? parseFloat(eth) : eth;
  return BigInt(Math.round(ethNum * 1e18)).toString();
}

/**
 * Convert gwei to wei
 */
export function gweiToWei(gwei: string | number): string {
  const gweiNum = typeof gwei === 'string' ? parseFloat(gwei) : gwei;
  return BigInt(Math.round(gweiNum * 1e9)).toString();
}

/**
 * Convert micro units to standard units (for Cosmos)
 */
export function microToStandard(micro: string | number, decimals: number = 6): number {
  const microNum = typeof micro === 'string' ? parseInt(micro, 10) : micro;
  return microNum / Math.pow(10, decimals);
}

/**
 * Convert standard units to micro units (for Cosmos)
 */
export function standardToMicro(standard: string | number, decimals: number = 6): number {
  const standardNum = typeof standard === 'string' ? parseFloat(standard) : standard;
  return Math.round(standardNum * Math.pow(10, decimals));
}

/**
 * Format transaction hash for display
 */
export function formatTxHash(hash: string, chars: number = 10): string {
  if (hash.length <= chars * 2) {
    return hash;
  }
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

/**
 * Get explorer URL for transaction
 */
export function getExplorerUrl(txHash: string, coin: string): string {
  const coinUpper = coin.toUpperCase();
  
  switch (coinUpper) {
    case 'BTC':
    case 'BITCOIN':
      return `https://blockstream.info/tx/${txHash}`;
    case 'ETH':
    case 'ETHEREUM':
      return `https://etherscan.io/tx/${txHash}`;
    case 'ATOM':
    case 'COSMOS':
      return `https://mintscan.io/cosmos/txs/${txHash}`;
    case 'THOR':
    case 'RUNE':
    case 'THORCHAIN':
      return `https://thorchain.net/tx/${txHash}`;
    case 'OSMO':
    case 'OSMOSIS':
      return `https://mintscan.io/osmosis/txs/${txHash}`;
    case 'LTC':
    case 'LITECOIN':
      return `https://blockchair.com/litecoin/transaction/${txHash}`;
    case 'DOGE':
    case 'DOGECOIN':
      return `https://blockchair.com/dogecoin/transaction/${txHash}`;
    default:
      return '';
  }
}

/**
 * Validate transaction hash format
 */
export function isValidTxHash(hash: string, blockchain: string): boolean {
  if (!hash || typeof hash !== 'string') return false;
  
  const blockchainUpper = blockchain.toUpperCase();
  
  switch (blockchainUpper) {
    case 'BTC':
    case 'BITCOIN':
    case 'LTC':
    case 'DOGE':
      // 64 character hex string
      return /^[a-fA-F0-9]{64}$/.test(hash);
    case 'ETH':
    case 'ETHEREUM':
      // 0x + 64 hex characters
      return /^0x[a-fA-F0-9]{64}$/.test(hash);
    case 'ATOM':
    case 'COSMOS':
    case 'THOR':
    case 'OSMO':
      // Usually 64 hex characters
      return /^[A-F0-9]{64}$/.test(hash);
    default:
      return false;
  }
}

/**
 * Build EIP-1559 transaction
 */
export function buildEip1559Transaction(
  to: string,
  value: string,
  nonce: number,
  gasLimit: number,
  maxFeePerGas: string,
  maxPriorityFeePerGas: string,
  chainId: number,
  data?: string,
): EthereumTxParams {
  return {
    to,
    value,
    nonce,
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    chainId,
    txType: 2,
    data,
  };
}

/**
 * Build legacy transaction
 */
export function buildLegacyTransaction(
  to: string,
  value: string,
  nonce: number,
  gasLimit: number,
  gasPrice: string,
  chainId: number,
  data?: string,
): EthereumTxParams {
  return {
    to,
    value,
    nonce,
    gasLimit,
    gasPrice,
    chainId,
    data,
  };
}

/**
 * Build Cosmos send message
 */
export function buildCosmosSendMsg(
  fromAddress: string,
  toAddress: string,
  amount: string,
  denom: string,
): {
  type: string;
  value: {
    from_address: string;
    to_address: string;
    amount: Array<{ denom: string; amount: string }>;
  };
} {
  return {
    type: 'cosmos-sdk/MsgSend',
    value: {
      from_address: fromAddress,
      to_address: toAddress,
      amount: [{ denom, amount }],
    },
  };
}

/**
 * Create transaction status object
 */
export function createTransactionStatus(
  txHash: string,
  status: 'pending' | 'confirmed' | 'failed',
  confirmations: number = 0,
): {
  txHash: string;
  status: string;
  confirmations: number;
  timestamp: number;
} {
  return {
    txHash,
    status,
    confirmations,
    timestamp: Date.now(),
  };
}
