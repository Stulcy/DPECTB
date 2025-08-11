import { ProviderManager } from "./core/provider-manager";
import { HyperliquidProvider } from "./providers/hyperliquid";
import { ExtendedProvider } from "./providers/extended";
import { Config } from "./core/interfaces";
import * as fs from "fs";
import * as path from "path";

async function main() {
  try {
    const configPath = path.join(__dirname, "config", "providers.json");
    const configData = fs.readFileSync(configPath, "utf-8");
    const config: Config = JSON.parse(configData);

    const manager = new ProviderManager(config);

    const hyperliquidProvider = new HyperliquidProvider(manager.dataBus);
    manager.registerProvider(hyperliquidProvider);

    const extendedProvider = new ExtendedProvider(manager.dataBus);
    manager.registerProvider(extendedProvider);

    manager.dataBus.onOrderbook((data) => {
      const timestamp = new Date().toLocaleTimeString();

      // Calculate bid stats
      const bidPrices = data.bids.map((bid) => parseFloat(bid.px));
      const bidVolumes = data.bids.map((bid) => parseFloat(bid.sz));
      const totalBidVolume = bidVolumes.reduce((sum, vol) => sum + vol, 0);
      const bidRange = bidPrices.length > 0 
        ? `${Math.min(...bidPrices).toFixed(2)} - ${Math.max(...bidPrices).toFixed(2)}`
        : "N/A";

      // Calculate ask stats
      const askPrices = data.asks.map((ask) => parseFloat(ask.px));
      const askVolumes = data.asks.map((ask) => parseFloat(ask.sz));
      const totalAskVolume = askVolumes.reduce((sum, vol) => sum + vol, 0);
      const askRange = askPrices.length > 0
        ? `${Math.min(...askPrices).toFixed(2)} - ${Math.max(...askPrices).toFixed(2)}`
        : "N/A";

      console.log(
        `\n┌─ ${data.symbol} ORDERBOOK ─ ${timestamp} ─────────────────────────────────┐`
      );
      console.log(
        `│ BIDS: $${bidRange} │ Volume: ${totalBidVolume
          .toFixed(2)
          .padStart(10)} │`
      );
      console.log(
        `│ ASKS: $${askRange} │ Volume: ${totalAskVolume
          .toFixed(2)
          .padStart(10)} │`
      );
      console.log(
        `└──────────────────────────────────────────────────────────────┘`
      );
    });

    manager.dataBus.onFunding((data) => {});

    await manager.startAll();

    process.on("SIGINT", async () => {
      console.log("\nShutting down gracefully...");
      await manager.stopAll();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

main();
