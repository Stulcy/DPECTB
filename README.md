# DPECTB - Decentralized Perpetual Exchange Crypto Trading Bot

A real-time market data aggregator that monitors orderbook and funding rate data across multiple decentralized perpetual exchanges.

## Features

- **Real-time orderbook data**: Live bid/ask prices and spread calculations
- **Funding rate monitoring**: Track funding rates and APY across exchanges
- **Multi-exchange support**: Currently supports Hyperliquid and Extended Exchange
- **Multi-symbol tracking**: Monitor multiple trading pairs simultaneously
- **Automatic reconnection**: Robust WebSocket connection handling with auto-reconnect
- **Clean output**: Market data summary displayed every 10 seconds

## Supported Exchanges

- **Hyperliquid**: Real-time orderbook and funding data
- **Extended Exchange**: Real-time orderbook and funding data with connection stability features

## Setup

### Prerequisites

- [Bun](https://bun.sh) runtime (v1.0.2+)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd DPECTB

# Install dependencies
bun install
```

### Configuration

Configure which exchanges and symbols to monitor in `src/config/providers.json`:

```json
{
  "providers": {
    "hyperliquid": {
      "enabled": true,
      "symbols": ["SUI", "BNB", "BTC", "ETH"],
      "dataTypes": ["orderbook", "funding"]
    },
    "extended": {
      "enabled": true,
      "symbols": ["SUI-USD", "BNB-USD", "BTC-USD", "ETH-USD"],
      "dataTypes": ["orderbook", "funding"]
    }
  }
}
```

## Running the Bot

```bash
bun run src/index.ts
```

The bot will:

1. Connect to all enabled exchanges
2. Subscribe to orderbook and funding data for configured symbols
3. Display a comprehensive market data summary every 10 seconds

## Output Format

The bot displays market data every 10 seconds in a tree format:

```
📊 COMPLETE MARKET DATA STORE:
├─ Total Providers: 2 | Total Symbols: 4
├─ HYPERLIQUID:
│  ├─ BTC:
│  │  ├─ ORDERBOOK: BID $43250.00 | ASK $43255.00 | SPREAD 0.0116%
│  │  ├─ FUNDING: 0.0085% (7.45% APY)
│  │  └─ UPDATED: 3:45:23 PM
├─ EXTENDED:
│  ├─ BTC-USD:
│  │  ├─ ORDERBOOK: BID $43248.00 | ASK $43258.00 | SPREAD 0.0231%
│  │  ├─ FUNDING: 0.0092% (8.05% APY)
│  │  └─ UPDATED: 3:45:22 PM
└─────────────────────────────────────────────────────────────────────
```

## Project Structure

```
src/
├── config/           # Configuration files
├── core/            # Core framework (data bus, provider manager, etc.)
├── providers/       # Exchange-specific implementations
│   ├── hyperliquid/ # Hyperliquid exchange integration
│   └── extended/    # Extended exchange integration
└── index.ts         # Main application entry point
```

## Shutting Down

Press `Ctrl+C` to gracefully shutdown the bot. All connections will be closed properly.

---
