import { ProviderManager } from "./core/provider-manager";
import { HyperliquidProvider } from "./providers/hyperliquid";
import { ExtendedProvider } from "./providers/extended";
import { Config } from "./core/interfaces";
import { processMarketData } from "./logic/calculations";
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

    manager.dataBus.onOrderbook((_) => {});

    manager.dataBus.onFunding((data) => {});

    await manager.startAll();

    // Print market data every 10 seconds
    const printInterval = setInterval(() => {
      processMarketData(manager.marketDataStore, config);
      // printMarketDataStore(manager.marketDataStore);
    }, 5000);

    process.on("SIGINT", async () => {
      clearInterval(printInterval);
      await manager.stopAll();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

main();
