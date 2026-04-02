# n8n-nodes-keepkey

> **[Velocity BPA Licensing Notice]**
>
> This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
>
> Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.
>
> For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.

This n8n community node provides comprehensive integration with KeepKey hardware wallets, enabling secure cryptocurrency operations directly within your n8n workflows. With support for 5 core resources (Device, Wallet, Transaction, Exchange, Asset), it offers complete wallet management, transaction processing, and portfolio tracking capabilities for automated crypto workflows.

![n8n Community Node](https://img.shields.io/badge/n8n-Community%20Node-blue)
![License](https://img.shields.io/badge/license-BSL--1.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Hardware Wallet](https://img.shields.io/badge/Hardware-Wallet-green)
![Crypto](https://img.shields.io/badge/Crypto-Trading-orange)
![Security](https://img.shields.io/badge/Security-Hardware-red)

## Features

- **Hardware Wallet Management** - Connect, initialize, and manage KeepKey devices with full PIN and passphrase support
- **Multi-Currency Support** - Handle Bitcoin, Ethereum, and 40+ cryptocurrencies with native KeepKey integration
- **Secure Transaction Processing** - Sign and broadcast transactions with hardware-level security validation
- **Portfolio Tracking** - Monitor balances, transaction history, and asset allocation across multiple wallets
- **Exchange Integration** - Execute trades and manage orders through supported exchange partnerships
- **Address Generation** - Generate receiving addresses with full BIP32/44 hierarchical deterministic support
- **Recovery Operations** - Backup and restore wallet seeds with mnemonic phrase management
- **Real-time Price Data** - Access live cryptocurrency prices and market data for portfolio valuation

## Installation

### Community Nodes (Recommended)

1. Open n8n
2. Go to **Settings** → **Community Nodes**
3. Click **Install a community node**
4. Enter `n8n-nodes-keepkey`
5. Click **Install**

### Manual Installation

```bash
cd ~/.n8n
npm install n8n-nodes-keepkey
```

### Development Installation

```bash
git clone https://github.com/Velocity-BPA/n8n-nodes-keepkey.git
cd n8n-nodes-keepkey
npm install
npm run build
mkdir -p ~/.n8n/custom
ln -s $(pwd) ~/.n8n/custom/n8n-nodes-keepkey
n8n start
```

## Credentials Setup

| Field | Description | Required |
|-------|-------------|----------|
| API Key | KeepKey API key for device communication | Yes |
| Device ID | Unique identifier for your KeepKey device | Yes |
| PIN | Device PIN for authentication | No |
| Passphrase | Optional passphrase for additional security | No |

## Resources & Operations

### 1. Device

| Operation | Description |
|-----------|-------------|
| Connect | Establish connection to KeepKey device |
| Disconnect | Safely disconnect from device |
| Initialize | Set up new device with PIN and label |
| Reset | Factory reset device (wipes all data) |
| Get Features | Retrieve device capabilities and firmware version |
| Update Firmware | Install latest firmware updates |
| Wipe Device | Securely erase all device data |
| Load Device | Restore device from recovery seed |

### 2. Wallet

| Operation | Description |
|-----------|-------------|
| Create Wallet | Generate new wallet with mnemonic seed |
| Import Wallet | Import existing wallet from seed phrase |
| Get Balance | Retrieve balance for specific cryptocurrency |
| Get Address | Generate receiving address for transactions |
| List Addresses | Get all generated addresses for wallet |
| Backup Seed | Export mnemonic seed phrase securely |
| Change PIN | Update device PIN code |
| Set Label | Assign custom label to wallet |

### 3. Transaction

| Operation | Description |
|-----------|-------------|
| Sign Transaction | Sign transaction with hardware wallet |
| Send Crypto | Send cryptocurrency to specified address |
| Get Transaction | Retrieve transaction details by hash |
| List Transactions | Get transaction history for wallet |
| Estimate Fee | Calculate network fees for transaction |
| Broadcast Transaction | Submit signed transaction to network |
| Verify Message | Verify cryptographic message signature |
| Sign Message | Sign message with wallet private key |

### 4. Exchange

| Operation | Description |
|-----------|-------------|
| Get Rates | Retrieve current exchange rates |
| Create Order | Place buy/sell order on exchange |
| Get Order Status | Check status of existing order |
| Cancel Order | Cancel pending exchange order |
| List Orders | Get order history and active orders |
| Get Trading Pairs | Retrieve available trading pairs |
| Execute Trade | Perform instant buy/sell transaction |
| Get Trade History | Access complete trading history |

### 5. Asset

| Operation | Description |
|-----------|-------------|
| List Assets | Get all supported cryptocurrencies |
| Get Asset Info | Retrieve detailed asset information |
| Get Price | Get current market price for asset |
| Get Price History | Retrieve historical price data |
| Get Market Cap | Get market capitalization data |
| Track Portfolio | Monitor portfolio value and allocation |
| Set Price Alerts | Configure price change notifications |
| Get Asset News | Retrieve latest news for cryptocurrency |

## Usage Examples

```javascript
// Connect to KeepKey device and get balance
{
  "nodes": [
    {
      "parameters": {
        "resource": "device",
        "operation": "connect",
        "deviceId": "{{ $json.deviceId }}"
      },
      "type": "n8n-nodes-keepkey.keepkey",
      "position": [250, 300]
    }
  ]
}
```

```javascript
// Send Bitcoin transaction
{
  "nodes": [
    {
      "parameters": {
        "resource": "transaction",
        "operation": "sendCrypto",
        "cryptocurrency": "bitcoin",
        "toAddress": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
        "amount": 0.001,
        "feeLevel": "normal"
      },
      "type": "n8n-nodes-keepkey.keepkey",
      "position": [250, 300]
    }
  ]
}
```

```javascript
// Get portfolio balance across multiple assets
{
  "nodes": [
    {
      "parameters": {
        "resource": "asset",
        "operation": "trackPortfolio",
        "assets": ["bitcoin", "ethereum", "litecoin"],
        "includePrices": true,
        "currency": "USD"
      },
      "type": "n8n-nodes-keepkey.keepkey",
      "position": [250, 300]
    }
  ]
}
```

```javascript
// Set up automated trading with price alerts
{
  "nodes": [
    {
      "parameters": {
        "resource": "exchange",
        "operation": "createOrder",
        "pair": "BTC/USD",
        "type": "limit",
        "side": "buy",
        "amount": 0.01,
        "price": 45000
      },
      "type": "n8n-nodes-keepkey.keepkey",
      "position": [250, 300]
    }
  ]
}
```

## Error Handling

| Error | Description | Solution |
|-------|-------------|----------|
| Device Not Found | KeepKey device is not connected or detected | Ensure device is plugged in and drivers are installed |
| PIN Required | Device requires PIN authentication | Provide PIN in credentials or device operation |
| Transaction Failed | Transaction could not be signed or broadcast | Check balance, network fees, and address validity |
| Invalid API Key | Authentication failed with provided credentials | Verify API key is correct and has necessary permissions |
| Network Error | Connection to blockchain network failed | Check internet connection and try again later |
| Insufficient Balance | Not enough funds to complete transaction | Verify wallet balance and reduce transaction amount |

## Development

```bash
npm install
npm run build
npm test
npm run lint
npm run dev
```

## Author

**Velocity BPA**
- Website: [velobpa.com](https://velobpa.com)
- GitHub: [Velocity-BPA](https://github.com/Velocity-BPA)

## Licensing

This n8n community node is licensed under the **Business Source License 1.1**.

### Free Use
Permitted for personal, educational, research, and internal business use.

### Commercial Use
Use of this node within any SaaS, PaaS, hosted platform, managed service, or paid automation offering requires a commercial license.

For licensing inquiries: **licensing@velobpa.com**

See [LICENSE](LICENSE), [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md), and [LICENSING_FAQ.md](LICENSING_FAQ.md) for details.

## Contributing

Contributions are welcome! Please ensure:

1. Code follows existing style conventions
2. All tests pass (`npm test`)
3. Linting passes (`npm run lint`)
4. Documentation is updated for new features
5. Commit messages are descriptive

## Support

- **Issues**: [GitHub Issues](https://github.com/Velocity-BPA/n8n-nodes-keepkey/issues)
- **KeepKey API Documentation**: [KeepKey Developer Docs](https://keepkey.myshopify.com/pages/developer-documentation)
- **Hardware Wallet Community**: [KeepKey Support Forum](https://keepkey.zendesk.com/hc/en-us)