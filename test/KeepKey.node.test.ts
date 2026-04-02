/**
 * Copyright (c) 2026 Velocity BPA
 * Licensed under the Business Source License 1.1
 */

import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { KeepKey } from '../nodes/KeepKey/KeepKey.node';

// Mock n8n-workflow
jest.mock('n8n-workflow', () => ({
  ...jest.requireActual('n8n-workflow'),
  NodeApiError: class NodeApiError extends Error {
    constructor(node: any, error: any) { super(error.message || 'API Error'); }
  },
  NodeOperationError: class NodeOperationError extends Error {
    constructor(node: any, message: string) { super(message); }
  },
}));

describe('KeepKey Node', () => {
  let node: KeepKey;

  beforeAll(() => {
    node = new KeepKey();
  });

  describe('Node Definition', () => {
    it('should have correct basic properties', () => {
      expect(node.description.displayName).toBe('KeepKey');
      expect(node.description.name).toBe('keepkey');
      expect(node.description.version).toBe(1);
      expect(node.description.inputs).toContain('main');
      expect(node.description.outputs).toContain('main');
    });

    it('should define 5 resources', () => {
      const resourceProp = node.description.properties.find(
        (p: any) => p.name === 'resource'
      );
      expect(resourceProp).toBeDefined();
      expect(resourceProp!.type).toBe('options');
      expect(resourceProp!.options).toHaveLength(5);
    });

    it('should have operation dropdowns for each resource', () => {
      const operations = node.description.properties.filter(
        (p: any) => p.name === 'operation'
      );
      expect(operations.length).toBe(5);
    });

    it('should require credentials', () => {
      expect(node.description.credentials).toBeDefined();
      expect(node.description.credentials!.length).toBeGreaterThan(0);
      expect(node.description.credentials![0].required).toBe(true);
    });

    it('should have parameters with proper displayOptions', () => {
      const params = node.description.properties.filter(
        (p: any) => p.displayOptions?.show?.resource
      );
      for (const param of params) {
        expect(param.displayOptions.show.resource).toBeDefined();
        expect(Array.isArray(param.displayOptions.show.resource)).toBe(true);
      }
    });
  });

  // Resource-specific tests
describe('Device Resource', () => {
  let mockExecuteFunctions: any;

  beforeEach(() => {
    mockExecuteFunctions = {
      getNodeParameter: jest.fn(),
      getCredentials: jest.fn().mockResolvedValue({
        apiKey: 'test-key',
        baseUrl: 'https://api.shapeshift.com/v1'
      }),
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
      continueOnFail: jest.fn().mockReturnValue(false),
      helpers: {
        httpRequest: jest.fn(),
        requestWithAuthentication: jest.fn()
      },
    };
  });

  it('should get device info successfully', async () => {
    const mockResponse = { device_id: 'test-device', features: ['signing', 'recovery'] };
    mockExecuteFunctions.getNodeParameter.mockReturnValue('getDeviceInfo');
    mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

    const result = await executeDeviceOperations.call(mockExecuteFunctions, [{ json: {} }]);

    expect(result).toEqual([{
      json: mockResponse,
      pairedItem: { item: 0 }
    }]);
  });

  it('should initialize device successfully', async () => {
    const mockResponse = { success: true, device_id: 'test-device' };
    mockExecuteFunctions.getNodeParameter
      .mockReturnValueOnce('initializeDevice')
      .mockReturnValueOnce('Test Device')
      .mockReturnValueOnce(true);
    mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

    const result = await executeDeviceOperations.call(mockExecuteFunctions, [{ json: {} }]);

    expect(result).toEqual([{
      json: mockResponse,
      pairedItem: { item: 0 }
    }]);
  });

  it('should handle API errors gracefully', async () => {
    mockExecuteFunctions.getNodeParameter.mockReturnValue('getDeviceInfo');
    mockExecuteFunctions.helpers.httpRequest.mockRejectedValue(new Error('Device not connected'));
    mockExecuteFunctions.continueOnFail.mockReturnValue(true);

    const result = await executeDeviceOperations.call(mockExecuteFunctions, [{ json: {} }]);

    expect(result).toEqual([{
      json: { error: 'Device not connected' },
      pairedItem: { item: 0 }
    }]);
  });

  it('should get public key successfully', async () => {
    const mockResponse = { public_key: 'xpub123...', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' };
    mockExecuteFunctions.getNodeParameter
      .mockReturnValueOnce('getPublicKey')
      .mockReturnValueOnce("m/44'/0'/0'/0/0")
      .mockReturnValueOnce('Bitcoin')
      .mockReturnValueOnce(false);
    mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

    const result = await executeDeviceOperations.call(mockExecuteFunctions, [{ json: {} }]);

    expect(result).toEqual([{
      json: mockResponse,
      pairedItem: { item: 0 }
    }]);
  });

  it('should start recovery process successfully', async () => {
    const mockResponse = { recovery_started: true, session_id: 'session123' };
    mockExecuteFunctions.getNodeParameter
      .mockReturnValueOnce('recoverDevice')
      .mockReturnValueOnce(24)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce('english');
    mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

    const result = await executeDeviceOperations.call(mockExecuteFunctions, [{ json: {} }]);

    expect(result).toEqual([{
      json: mockResponse,
      pairedItem: { item: 0 }
    }]);
  });
});

describe('Wallet Resource', () => {
	let mockExecuteFunctions: any;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn().mockResolvedValue({
				apiKey: 'test-api-key',
				baseUrl: 'https://api.shapeshift.com/v1',
			}),
			getInputData: jest.fn().mockReturnValue([{ json: {} }]),
			getNode: jest.fn().mockReturnValue({ name: 'KeepKey Wallet Test' }),
			continueOnFail: jest.fn().mockReturnValue(false),
			helpers: {
				httpRequest: jest.fn(),
				requestWithAuthentication: jest.fn(),
			},
		};
	});

	describe('getAddresses operation', () => {
		it('should get wallet addresses successfully', async () => {
			const mockResponse = {
				addresses: ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'],
				total: 2,
			};

			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('getAddresses')
				.mockReturnValueOnce('bitcoin')
				.mockReturnValueOnce(10)
				.mockReturnValueOnce(0);
			
			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeWalletOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
				method: 'GET',
				url: 'https://api.shapeshift.com/v1/wallet/addresses',
				headers: {
					'Authorization': 'Bearer test-api-key',
					'Content-Type': 'application/json',
				},
				qs: {
					coin: 'bitcoin',
					limit: 10,
					offset: 0,
				},
				json: true,
			});

			expect(result).toEqual([{ json: mockResponse, pairedItem: { item: 0 } }]);
		});

		it('should handle getAddresses error', async () => {
			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('getAddresses')
				.mockReturnValueOnce('bitcoin')
				.mockReturnValueOnce(10)
				.mockReturnValueOnce(0);
			
			mockExecuteFunctions.helpers.httpRequest.mockRejectedValue(new Error('API Error'));
			mockExecuteFunctions.continueOnFail.mockReturnValue(true);

			const result = await executeWalletOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toEqual([{ json: { error: 'API Error' }, pairedItem: { item: 0 } }]);
		});
	});

	describe('generateAddress operation', () => {
		it('should generate new address successfully', async () => {
			const mockResponse = {
				address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
				path: "m/44'/0'/0'/0/0",
			};

			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('generateAddress')
				.mockReturnValueOnce('bitcoin')
				.mockReturnValueOnce("m/44'/0'/0'/0/0")
				.mockReturnValueOnce(false);
			
			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeWalletOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
				method: 'POST',
				url: 'https://api.shapeshift.com/v1/wallet/address',
				headers: {
					'Authorization': 'Bearer test-api-key',
					'Content-Type': 'application/json',
				},
				body: {
					coin: 'bitcoin',
					address_n: "m/44'/0'/0'/0/0",
					show_display: false,
				},
				json: true,
			});

			expect(result).toEqual([{ json: mockResponse, pairedItem: { item: 0 } }]);
		});
	});

	describe('getBalance operation', () => {
		it('should get wallet balance successfully', async () => {
			const mockResponse = {
				balance: '0.001',
				confirmed: '0.001',
				unconfirmed: '0.000',
			};

			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('getBalance')
				.mockReturnValueOnce('bitcoin')
				.mockReturnValueOnce('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
			
			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeWalletOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
				method: 'GET',
				url: 'https://api.shapeshift.com/v1/wallet/balance',
				headers: {
					'Authorization': 'Bearer test-api-key',
					'Content-Type': 'application/json',
				},
				qs: {
					coin: 'bitcoin',
					address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
				},
				json: true,
			});

			expect(result).toEqual([{ json: mockResponse, pairedItem: { item: 0 } }]);
		});
	});

	describe('getUtxos operation', () => {
		it('should get UTXOs successfully', async () => {
			const mockResponse = {
				utxos: [
					{
						txid: 'abc123',
						vout: 0,
						value: '0.001',
						confirmations: 6,
					},
				],
			};

			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('getUtxos')
				.mockReturnValueOnce('bitcoin')
				.mockReturnValueOnce('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa,1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
			
			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeWalletOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
				method: 'GET',
				url: 'https://api.shapeshift.com/v1/wallet/utxos',
				headers: {
					'Authorization': 'Bearer test-api-key',
					'Content-Type': 'application/json',
				},
				qs: {
					coin: 'bitcoin',
					addresses: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa,1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
				},
				json: true,
			});

			expect(result).toEqual([{ json: mockResponse, pairedItem: { item: 0 } }]);
		});
	});

	describe('getExtendedPublicKey operation', () => {
		it('should get extended public key successfully', async () => {
			const mockResponse = {
				xpub: 'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj',
				path: "m/44'/0'/0'",
			};

			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('getExtendedPublicKey')
				.mockReturnValueOnce('bitcoin')
				.mockReturnValueOnce("m/44'/0'/0'");
			
			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeWalletOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
				method: 'POST',
				url: 'https://api.shapeshift.com/v1/wallet/xpub',
				headers: {
					'Authorization': 'Bearer test-api-key',
					'Content-Type': 'application/json',
				},
				body: {
					coin: 'bitcoin',
					address_n: "m/44'/0'/0'",
				},
				json: true,
			});

			expect(result).toEqual([{ json: mockResponse, pairedItem: { item: 0 } }]);
		});
	});
});

describe('Transaction Resource', () => {
	let mockExecuteFunctions: any;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn().mockResolvedValue({
				apiKey: 'test-key',
				baseUrl: 'https://api.shapeshift.com/v1'
			}),
			getInputData: jest.fn().mockReturnValue([{ json: {} }]),
			getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
			continueOnFail: jest.fn().mockReturnValue(false),
			helpers: {
				httpRequest: jest.fn(),
			},
		};
	});

	describe('signTransaction', () => {
		it('should sign transaction successfully', async () => {
			const mockResponse = {
				signed_tx: 'abcd1234...',
				signatures: ['sig1', 'sig2']
			};

			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('signTransaction')
				.mockReturnValueOnce('BTC')
				.mockReturnValueOnce([{ prev_hash: 'abc', prev_index: 0 }])
				.mockReturnValueOnce([{ address: '1ABC...', amount: 100000 }])
				.mockReturnValueOnce("m/44'/0'/0'/0/0");

			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeTransactionOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(mockResponse);
			expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
				method: 'POST',
				url: 'https://api.shapeshift.com/v1/transaction/sign',
				headers: {
					'Authorization': 'Bearer test-key',
					'Content-Type': 'application/json',
				},
				body: {
					coin: 'BTC',
					inputs: [{ prev_hash: 'abc', prev_index: 0 }],
					outputs: [{ address: '1ABC...', amount: 100000 }],
					address_n: "m/44'/0'/0'/0/0",
				},
				json: true,
			});
		});

		it('should handle sign transaction error', async () => {
			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('signTransaction')
				.mockReturnValueOnce('BTC')
				.mockReturnValueOnce([])
				.mockReturnValueOnce([])
				.mockReturnValueOnce("m/44'/0'/0'/0/0");

			mockExecuteFunctions.helpers.httpRequest.mockRejectedValue(new Error('Device not connected'));
			mockExecuteFunctions.continueOnFail.mockReturnValue(true);

			const result = await executeTransactionOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toHaveLength(1);
			expect(result[0].json.error).toBe('Device not connected');
		});
	});

	describe('broadcastTransaction', () => {
		it('should broadcast transaction successfully', async () => {
			const mockResponse = {
				txid: 'abc123...',
				success: true
			};

			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('broadcastTransaction')
				.mockReturnValueOnce('BTC')
				.mockReturnValueOnce('abcd1234...');

			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeTransactionOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(mockResponse);
		});
	});

	describe('getTransactionHistory', () => {
		it('should get transaction history successfully', async () => {
			const mockResponse = {
				transactions: [{ txid: 'abc123', amount: 0.001 }],
				total: 1
			};

			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('getTransactionHistory')
				.mockReturnValueOnce('BTC')
				.mockReturnValueOnce('1ABC...')
				.mockReturnValueOnce(50)
				.mockReturnValueOnce(0);

			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeTransactionOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(mockResponse);
		});
	});

	describe('estimateFee', () => {
		it('should estimate fee successfully', async () => {
			const mockResponse = {
				fee_estimate: 0.0001,
				fee_rate: 50
			};

			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('estimateFee')
				.mockReturnValueOnce('BTC')
				.mockReturnValueOnce(250)
				.mockReturnValueOnce('medium');

			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeTransactionOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(mockResponse);
		});
	});

	describe('getTransactionDetails', () => {
		it('should get transaction details successfully', async () => {
			const mockResponse = {
				txid: 'abc123...',
				confirmations: 6,
				amount: 0.001
			};

			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('getTransactionDetails')
				.mockReturnValueOnce('BTC')
				.mockReturnValueOnce('abc123...');

			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeTransactionOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(mockResponse);
		});
	});
});

describe('Exchange Resource', () => {
	let mockExecuteFunctions: any;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn().mockResolvedValue({
				apiKey: 'test-api-key',
				baseUrl: 'https://api.shapeshift.com/v1',
			}),
			getInputData: jest.fn().mockReturnValue([{ json: {} }]),
			getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
			continueOnFail: jest.fn().mockReturnValue(false),
			helpers: {
				httpRequest: jest.fn(),
				requestWithAuthentication: jest.fn(),
			},
		};
	});

	describe('getExchangeRate', () => {
		it('should get exchange rate successfully', async () => {
			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('getExchangeRate')
				.mockReturnValueOnce('BTC')
				.mockReturnValueOnce('ETH')
				.mockReturnValueOnce('0.1');

			const mockResponse = { rate: '15.5', pair: 'BTC_ETH' };
			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeExchangeOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toEqual([{ json: mockResponse, pairedItem: { item: 0 } }]);
			expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
				method: 'GET',
				url: 'https://api.shapeshift.com/v1/exchange/rate',
				headers: {
					'Authorization': 'Bearer test-api-key',
					'Content-Type': 'application/json',
				},
				qs: {
					from_coin: 'BTC',
					to_coin: 'ETH',
					amount: '0.1',
				},
				json: true,
			});
		});

		it('should handle errors when getting exchange rate', async () => {
			mockExecuteFunctions.getNodeParameter.mockReturnValue('getExchangeRate');
			mockExecuteFunctions.helpers.httpRequest.mockRejectedValue(new Error('API Error'));
			mockExecuteFunctions.continueOnFail.mockReturnValue(true);

			const result = await executeExchangeOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toEqual([{ json: { error: 'API Error' }, pairedItem: { item: 0 } }]);
		});
	});

	describe('createExchangeOrder', () => {
		it('should create exchange order successfully', async () => {
			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('createExchangeOrder')
				.mockReturnValueOnce('BTC')
				.mockReturnValueOnce('ETH')
				.mockReturnValueOnce('0.1')
				.mockReturnValueOnce('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
				.mockReturnValueOnce('0x742d35Cc6634C0532925a3b8D6c39F6be99fb709');

			const mockResponse = { order_id: '12345', status: 'pending' };
			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeExchangeOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toEqual([{ json: mockResponse, pairedItem: { item: 0 } }]);
		});

		it('should handle errors when creating exchange order', async () => {
			mockExecuteFunctions.getNodeParameter.mockReturnValue('createExchangeOrder');
			mockExecuteFunctions.helpers.httpRequest.mockRejectedValue(new Error('Order creation failed'));
			mockExecuteFunctions.continueOnFail.mockReturnValue(true);

			const result = await executeExchangeOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toEqual([{ json: { error: 'Order creation failed' }, pairedItem: { item: 0 } }]);
		});
	});

	describe('getExchangeOrder', () => {
		it('should get exchange order successfully', async () => {
			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('getExchangeOrder')
				.mockReturnValueOnce('12345');

			const mockResponse = { order_id: '12345', status: 'complete', tx_hash: '0xabc123' };
			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeExchangeOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toEqual([{ json: mockResponse, pairedItem: { item: 0 } }]);
		});
	});

	describe('getSupportedPairs', () => {
		it('should get supported pairs successfully', async () => {
			mockExecuteFunctions.getNodeParameter.mockReturnValue('getSupportedPairs');

			const mockResponse = { pairs: ['BTC_ETH', 'ETH_BTC', 'LTC_BTC'] };
			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeExchangeOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toEqual([{ json: mockResponse, pairedItem: { item: 0 } }]);
		});
	});

	describe('getExchangeLimits', () => {
		it('should get exchange limits successfully', async () => {
			mockExecuteFunctions.getNodeParameter
				.mockReturnValueOnce('getExchangeLimits')
				.mockReturnValueOnce('BTC')
				.mockReturnValueOnce('ETH');

			const mockResponse = { min: '0.001', max: '10.0', pair: 'BTC_ETH' };
			mockExecuteFunctions.helpers.httpRequest.mockResolvedValue(mockResponse);

			const result = await executeExchangeOperations.call(mockExecuteFunctions, [{ json: {} }]);

			expect(result).toEqual([{ json: mockResponse, pairedItem: { item: 0 } }]);
		});
	});

	it('should throw error for unknown operation', async () => {
		mockExecuteFunctions.getNodeParameter.mockReturnValue('unknownOperation');

		await expect(executeExchangeOperations.call(mockExecuteFunctions, [{ json: {} }])).rejects.toThrow('The operation "unknownOperation" is not supported!');
	});
});

describe('Asset Resource', () => {
  let mockExecuteFunctions: any;

  beforeEach(() => {
    mockExecuteFunctions = {
      getNodeParameter: jest.fn(),
      getCredentials: jest.fn().mockResolvedValue({ 
        apiKey: 'test-key', 
        baseUrl: 'https://api.shapeshift.com/v1' 
      }),
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
      continueOnFail: jest.fn().mockReturnValue(false),
      helpers: { 
        httpRequest: jest.fn(),
        requestWithAuthentication: jest.fn() 
      },
    };
  });

  test('should get supported assets successfully', async () => {
    const mockResponse = { assets: ['BTC', 'ETH', 'LTC'] };
    mockExecuteFunctions.getNodeParameter.mockReturnValueOnce('getSupportedAssets');
    mockExecuteFunctions.helpers.httpRequest.mockResolvedValueOnce(mockResponse);

    const result = await executeAssetOperations.call(mockExecuteFunctions, [{ json: {} }]);

    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual(mockResponse);
    expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: 'https://api.shapeshift.com/v1/assets/supported',
      headers: {
        'Authorization': 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      json: true,
    });
  });

  test('should get asset info successfully', async () => {
    const mockResponse = { symbol: 'BTC', name: 'Bitcoin', price: 50000 };
    mockExecuteFunctions.getNodeParameter
      .mockReturnValueOnce('getAssetInfo')
      .mockReturnValueOnce('BTC');
    mockExecuteFunctions.helpers.httpRequest.mockResolvedValueOnce(mockResponse);

    const result = await executeAssetOperations.call(mockExecuteFunctions, [{ json: {} }]);

    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual(mockResponse);
    expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: 'https://api.shapeshift.com/v1/assets/info',
      headers: {
        'Authorization': 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      qs: { coin: 'BTC' },
      json: true,
    });
  });

  test('should get market data successfully', async () => {
    const mockResponse = { price: 50000, volume: 1000000 };
    mockExecuteFunctions.getNodeParameter
      .mockReturnValueOnce('getMarketData')
      .mockReturnValueOnce('BTC')
      .mockReturnValueOnce('usd');
    mockExecuteFunctions.helpers.httpRequest.mockResolvedValueOnce(mockResponse);

    const result = await executeAssetOperations.call(mockExecuteFunctions, [{ json: {} }]);

    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual(mockResponse);
  });

  test('should get price history successfully', async () => {
    const mockResponse = { prices: [[1234567890, 50000], [1234567891, 51000]] };
    mockExecuteFunctions.getNodeParameter
      .mockReturnValueOnce('getPriceHistory')
      .mockReturnValueOnce('BTC')
      .mockReturnValueOnce(7)
      .mockReturnValueOnce('1d');
    mockExecuteFunctions.helpers.httpRequest.mockResolvedValueOnce(mockResponse);

    const result = await executeAssetOperations.call(mockExecuteFunctions, [{ json: {} }]);

    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual(mockResponse);
  });

  test('should add custom token successfully', async () => {
    const mockResponse = { success: true, token_id: 'custom-token-123' };
    mockExecuteFunctions.getNodeParameter
      .mockReturnValueOnce('addCustomToken')
      .mockReturnValueOnce('0x1234567890abcdef')
      .mockReturnValueOnce('CUSTOM')
      .mockReturnValueOnce(18);
    mockExecuteFunctions.helpers.httpRequest.mockResolvedValueOnce(mockResponse);

    const result = await executeAssetOperations.call(mockExecuteFunctions, [{ json: {} }]);

    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual(mockResponse);
  });

  test('should handle API errors gracefully', async () => {
    mockExecuteFunctions.getNodeParameter.mockReturnValueOnce('getSupportedAssets');
    mockExecuteFunctions.helpers.httpRequest.mockRejectedValueOnce(new Error('API Error'));
    mockExecuteFunctions.continueOnFail.mockReturnValue(true);

    const result = await executeAssetOperations.call(mockExecuteFunctions, [{ json: {} }]);

    expect(result).toHaveLength(1);
    expect(result[0].json.error).toBe('API Error');
  });

  test('should throw error for unknown operation', async () => {
    mockExecuteFunctions.getNodeParameter.mockReturnValueOnce('unknownOperation');

    await expect(executeAssetOperations.call(mockExecuteFunctions, [{ json: {} }]))
      .rejects
      .toThrow('Unknown operation: unknownOperation');
  });
});
});
