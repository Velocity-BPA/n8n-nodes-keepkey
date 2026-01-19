/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * KeepKey device events and message types
 */

export const DEVICE_EVENTS = {
  CONNECTED: 'device:connected',
  DISCONNECTED: 'device:disconnected',
  BUTTON_REQUEST: 'device:buttonRequest',
  PIN_REQUEST: 'device:pinRequest',
  PASSPHRASE_REQUEST: 'device:passphraseRequest',
  WORD_REQUEST: 'device:wordRequest',
  FAILURE: 'device:failure',
  SUCCESS: 'device:success',
} as const;

export const TRANSACTION_EVENTS = {
  SIGNED: 'transaction:signed',
  REJECTED: 'transaction:rejected',
  BROADCAST: 'transaction:broadcast',
  CONFIRMED: 'transaction:confirmed',
  FAILED: 'transaction:failed',
} as const;

export const SIGNING_EVENTS = {
  REQUEST: 'signing:request',
  COMPLETE: 'signing:complete',
  CANCELLED: 'signing:cancelled',
} as const;

export const ACCOUNT_EVENTS = {
  DISCOVERED: 'account:discovered',
  BALANCE_CHANGED: 'account:balanceChanged',
  TRANSACTION_RECEIVED: 'account:transactionReceived',
} as const;

export const SWAP_EVENTS = {
  INITIATED: 'swap:initiated',
  COMPLETE: 'swap:complete',
  FAILED: 'swap:failed',
} as const;

export const SECURITY_EVENTS = {
  PIN_CHANGED: 'security:pinChanged',
  DEVICE_WIPED: 'security:deviceWiped',
  RECOVERY_STARTED: 'security:recoveryStarted',
  DEVICE_RESET: 'security:deviceReset',
} as const;

export type DeviceEvent = (typeof DEVICE_EVENTS)[keyof typeof DEVICE_EVENTS];
export type TransactionEvent = (typeof TRANSACTION_EVENTS)[keyof typeof TRANSACTION_EVENTS];
export type SigningEvent = (typeof SIGNING_EVENTS)[keyof typeof SIGNING_EVENTS];
export type AccountEvent = (typeof ACCOUNT_EVENTS)[keyof typeof ACCOUNT_EVENTS];
export type SwapEvent = (typeof SWAP_EVENTS)[keyof typeof SWAP_EVENTS];
export type SecurityEvent = (typeof SECURITY_EVENTS)[keyof typeof SECURITY_EVENTS];

export type KeepKeyEvent =
  | DeviceEvent
  | TransactionEvent
  | SigningEvent
  | AccountEvent
  | SwapEvent
  | SecurityEvent;

export const ALL_EVENTS = {
  ...DEVICE_EVENTS,
  ...TRANSACTION_EVENTS,
  ...SIGNING_EVENTS,
  ...ACCOUNT_EVENTS,
  ...SWAP_EVENTS,
  ...SECURITY_EVENTS,
};

export const EVENT_OPTIONS = {
  device: Object.entries(DEVICE_EVENTS).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    value,
  })),
  transaction: Object.entries(TRANSACTION_EVENTS).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    value,
  })),
  signing: Object.entries(SIGNING_EVENTS).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    value,
  })),
  account: Object.entries(ACCOUNT_EVENTS).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    value,
  })),
  swap: Object.entries(SWAP_EVENTS).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    value,
  })),
  security: Object.entries(SECURITY_EVENTS).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    value,
  })),
};

export const MESSAGE_TYPES = {
  // Initialization
  Initialize: 0,
  Ping: 1,
  Success: 2,
  Failure: 3,
  ChangePin: 4,
  WipeDevice: 5,
  GetEntropy: 9,
  Entropy: 10,
  LoadDevice: 13,
  ResetDevice: 14,
  Features: 17,
  PinMatrixRequest: 18,
  PinMatrixAck: 19,
  Cancel: 20,
  ClearSession: 24,
  ApplySettings: 25,
  ButtonRequest: 26,
  ButtonAck: 27,
  ApplyFlags: 28,
  GetNonce: 31,
  Nonce: 33,

  // Passphrase
  PassphraseRequest: 41,
  PassphraseAck: 42,
  PassphraseStateRequest: 77,
  PassphraseStateAck: 78,

  // Recovery
  RecoveryDevice: 45,
  WordRequest: 46,
  WordAck: 47,

  // Bitcoin
  GetPublicKey: 11,
  PublicKey: 12,
  GetAddress: 29,
  Address: 30,
  SignTx: 15,
  TxRequest: 21,
  TxAck: 22,
  CipherKeyValue: 23,
  SignMessage: 38,
  VerifyMessage: 39,
  MessageSignature: 40,
  CipheredKeyValue: 48,

  // Ethereum
  EthereumGetAddress: 56,
  EthereumAddress: 57,
  EthereumSignTx: 58,
  EthereumTxRequest: 59,
  EthereumTxAck: 60,
  EthereumSignMessage: 64,
  EthereumVerifyMessage: 65,
  EthereumMessageSignature: 66,
  EthereumSignTypedData: 464,
  EthereumTypedDataStructRequest: 465,
  EthereumTypedDataStructAck: 466,
  EthereumTypedDataValueRequest: 467,
  EthereumTypedDataValueAck: 468,
  EthereumTypedDataSignature: 469,

  // Cosmos
  CosmosGetAddress: 510,
  CosmosAddress: 511,
  CosmosSignTx: 512,
  CosmosSignedTx: 513,

  // THORChain
  ThorchainGetAddress: 530,
  ThorchainAddress: 531,
  ThorchainSignTx: 532,
  ThorchainSignedTx: 533,

  // Osmosis
  OsmosisGetAddress: 550,
  OsmosisAddress: 551,
  OsmosisSignTx: 552,
  OsmosisSignedTx: 553,

  // Firmware
  FirmwareErase: 6,
  FirmwareUpload: 7,
  FirmwareRequest: 8,
  SelfTest: 32,
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export const BUTTON_REQUEST_TYPES = {
  Other: 1,
  FeeOverThreshold: 2,
  ConfirmOutput: 3,
  ResetDevice: 4,
  ConfirmWord: 5,
  WipeDevice: 6,
  ProtectCall: 7,
  SignTx: 8,
  FirmwareCheck: 9,
  Address: 10,
  PublicKey: 11,
  MnemonicWordCount: 12,
  MnemonicInput: 13,
  PassphraseType: 14,
  UnknownDerivationPath: 15,
} as const;

export const FAILURE_TYPES = {
  UnexpectedMessage: 1,
  ButtonExpected: 2,
  DataError: 3,
  ActionCancelled: 4,
  PinExpected: 5,
  PinCancelled: 6,
  PinInvalid: 7,
  InvalidSignature: 8,
  ProcessError: 9,
  NotEnoughFunds: 10,
  NotInitialized: 11,
  PinMismatch: 12,
  WipeCodeMismatch: 13,
  InvalidSession: 14,
  FirmwareError: 99,
} as const;

export type FailureType = (typeof FAILURE_TYPES)[keyof typeof FAILURE_TYPES];
