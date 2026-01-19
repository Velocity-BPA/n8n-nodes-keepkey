# n8n-nodes-keepkey

> **[Velocity BPA Licensing Notice]**
>
> This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
>
> Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.
>
> For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.

A comprehensive n8n community node for KeepKey hardware wallet integration, enabling workflow automation for cryptocurrency operations including address generation, transaction signing, device management, and cross-chain swaps via THORChain.

![n8n](https://img.shields.io/badge/n8n-community--node-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![License](https://img.shields.io/badge/license-BSL--1.1-blue)

## Features

- **23 Resource Categories** - Comprehensive coverage of KeepKey operations
- **164+ Operations** - Full range of cryptocurrency workflow actions
- **Multi-Chain Support** - Bitcoin, Ethereum, Cosmos ecosystem, THORChain
- **Hardware Security** - Secure key operations on KeepKey device
- **Cross-Chain Swaps** - THORChain DEX integration
- **Device Management** - PIN, passphrase, recovery, firmware operations
- **Trigger Node** - Event-driven workflow automation

## Installation

### Community Nodes (Recommended)

1. Open n8n
2. Go to **Settings** > **Community Nodes**
3. Click **Install**
4. Enter `n8n-nodes-keepkey`
5. Click **Install**

### Manual Installation

```bash
cd ~/.n8n/custom
npm install n8n-nodes-keepkey
```

### Development Installation

```bash
# 1. Extract the zip file
unzip n8n-nodes-keepkey.zip
cd n8n-nodes-keepkey

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Create symlink to n8n custom nodes directory
# For Linux/macOS:
mkdir -p ~/.n8n/custom
ln -s $(pwd) ~/.n8n/custom/n8n-nodes-keepkey

# For Windows (run as Administrator):
# mklink /D %USERPROFILE%\.n8n\custom\n8n-nodes-keepkey %CD%

# 5. Restart n8n
n8n start
```

## Credentials Setup

### KeepKey API Credentials

| Field | Description |
|-------|-------------|
| Connection Type | `bridge` or `desktop` |
| Bridge URL | KeepKey Bridge URL (default: `http://localhost:1646`) |

### KeepKey Network Credentials

| Field | Description |
|-------|-------------|
| Network | `mainnet` or `testnet` |
| Explorer URL | Block explorer base URL |

## Resources & Operations

### Device Operations
- Get Features, Initialize, Wipe, Ping, Get Entropy, Get Random Bytes

### Account Management
- Get Accounts, Get Balance, Get Transaction History, Sync Account

### Bitcoin Operations
- Get Public Key, Get Address, Get Xpub, Verify Address, Sign Transaction, Sign Message, Verify Message

### Bitcoin-Like Coins
- Litecoin, Dogecoin, Bitcoin Cash support with same operations as Bitcoin

### Ethereum Operations
- Get Address, Get Public Key, Sign Transaction, Sign Message, Verify Message, Get Balance, Get Nonce

### EVM Chains
- Polygon, Arbitrum, Optimism, Avalanche, BSC support

### ERC-20 Tokens
- Get Balance, Transfer, Approve, Get Allowance

### Cosmos Operations
- Get Address, Get Public Key, Sign Transaction, Delegate, Undelegate, Claim Rewards

### THORChain Operations
- Get Address, Get Balance, Deposit, Swap, Add Liquidity, Withdraw Liquidity

### Osmosis Operations
- Get Address, Swap, Add Liquidity, Get Pools

### Address Utilities
- Validate Address, Detect Address Type, Get Address Info, Format Address

### Transaction Operations
- Build Transaction, Estimate Fee, Get Transaction Status, Broadcast Transaction

### Signing Operations
- Sign Hash, Sign Typed Data, Verify Signature

### ShapeShift Integration
- Get Quote, Execute Trade, Get Trade Status, Get Supported Pairs

### Swap Operations
- Prepare Swap, Execute Swap, Get Swap Status, Get Swap History

### Staking Operations
- Stake, Unstake, Claim Rewards, Get Staking Info

### DeFi Operations
- Get Protocol Info, Get User Position, Deposit, Withdraw

### Recovery Operations
- Start Recovery, Enter Word, Cancel Recovery

### PIN Operations
- Change PIN, Remove PIN, Enter PIN, Check PIN Status, Get PIN Matrix

### Passphrase Operations
- Enable, Disable, Enter, Check Status, Set On Device

### Firmware Operations
- Get Version, Check Update, Update Firmware

### Security Operations
- Get Device Status, Set Auto Lock, Factory Reset

### Utility Operations
- Convert Units, Validate Address, Get Derivation Path, Format Amount

## Trigger Node

The KeepKey Trigger node allows event-driven workflows:

| Event | Description |
|-------|-------------|
| Device Connected | Triggered when KeepKey is connected |
| Device Disconnected | Triggered when KeepKey is disconnected |
| Button Request | Triggered when device requests button press |
| PIN Request | Triggered when device requests PIN entry |
| Passphrase Request | Triggered when device requests passphrase |
| Transaction Signed | Triggered when transaction is signed |
| Transaction Rejected | Triggered when transaction is rejected |
| Swap Initiated | Triggered when swap begins |
| Swap Completed | Triggered when swap completes |

## Usage Examples

### Get Bitcoin Address

```javascript
// Configure KeepKey node
{
  "resource": "bitcoin",
  "operation": "getAddress",
  "accountIndex": 0,
  "addressIndex": 0,
  "showOnDevice": true
}
```

### Sign Ethereum Message

```javascript
// Configure KeepKey node
{
  "resource": "ethereum",
  "operation": "signMessage",
  "message": "Hello, KeepKey!",
  "accountIndex": 0
}
```

### Prepare THORChain Swap

```javascript
// Configure KeepKey node
{
  "resource": "swap",
  "operation": "prepareSwap",
  "sellAsset": "BTC.BTC",
  "buyAsset": "ETH.ETH",
  "sellAmount": "0.01",
  "slippageTolerance": 1
}
```

## KeepKey Concepts

### Derivation Paths

KeepKey uses BIP-32/44/49/84 derivation paths:

| Type | Path | Description |
|------|------|-------------|
| Legacy | m/44'/0'/0'/0/0 | P2PKH addresses (1...) |
| SegWit | m/49'/0'/0'/0/0 | P2SH-P2WPKH addresses (3...) |
| Native SegWit | m/84'/0'/0'/0/0 | Bech32 addresses (bc1q...) |
| Taproot | m/86'/0'/0'/0/0 | Bech32m addresses (bc1p...) |

### Connection Types

| Type | Description |
|------|-------------|
| KeepKey Bridge | Chrome extension bridge (localhost:1646) |
| KeepKey Desktop | Desktop application |

## Networks

| Network | Chain ID | Description |
|---------|----------|-------------|
| Bitcoin Mainnet | - | Production Bitcoin network |
| Bitcoin Testnet | - | Test Bitcoin network |
| Ethereum Mainnet | 1 | Production Ethereum network |
| Polygon | 137 | Polygon PoS network |
| Arbitrum | 42161 | Arbitrum One L2 |
| Optimism | 10 | Optimism L2 |
| Cosmos Hub | cosmoshub-4 | Cosmos mainnet |
| THORChain | thorchain-mainnet-v1 | THORChain mainnet |
| Osmosis | osmosis-1 | Osmosis mainnet |

## Error Handling

The node provides detailed error messages for common scenarios:

| Error | Description |
|-------|-------------|
| Device not connected | KeepKey is not plugged in or bridge not running |
| User rejected | User rejected the operation on device |
| PIN required | Device is locked and requires PIN |
| Invalid address | Address format validation failed |
| Insufficient funds | Not enough balance for transaction |

## Security Best Practices

1. **Always verify addresses on device** - Use `showOnDevice: true`
2. **Use passphrase for additional security** - Enable BIP39 passphrase
3. **Keep firmware updated** - Check for updates regularly
4. **Verify transaction details** - Always confirm on device display
5. **Use testnet for development** - Test workflows before mainnet

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Watch mode for development
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
Use of this node within any SaaS, PaaS, hosted platform, managed service,
or paid automation offering requires a commercial license.

For licensing inquiries:
**licensing@velobpa.com**

See [LICENSE](LICENSE), [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md), and [LICENSING_FAQ.md](LICENSING_FAQ.md) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- **Issues**: [GitHub Issues](https://github.com/Velocity-BPA/n8n-nodes-keepkey/issues)
- **Documentation**: [KeepKey Docs](https://developer.keepkey.com/)
- **n8n Community**: [n8n Community Forum](https://community.n8n.io/)

## Acknowledgments

- [KeepKey](https://shapeshift.com/keepkey) - Hardware wallet manufacturer
- [ShapeShift](https://shapeshift.com/) - Decentralized exchange platform
- [n8n](https://n8n.io/) - Workflow automation platform
- [THORChain](https://thorchain.org/) - Cross-chain liquidity protocol
