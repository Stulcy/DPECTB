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

    manager.dataBus.onOrderbook((_) => {});

    manager.dataBus.onFunding((data) => {});

    await manager.startAll();

    // Print market data every 10 seconds
    const printInterval = setInterval(() => {
      // Print entire MarketDataStore
      console.log(`\n📊 COMPLETE MARKET DATA STORE:`);
      const providers = manager.marketDataStore.getProviders();
      const symbols = manager.marketDataStore.getSymbols();
      console.log(
        `├─ Total Providers: ${providers.length} | Total Symbols: ${symbols.length}`
      );
      for (const provider of providers) {
        console.log(`├─ ${provider.toUpperCase()}:`);
        for (const symbol of symbols) {
          const allData = manager.marketDataStore.getAllData(symbol);
          const providerData = allData.get(provider);
          if (providerData) {
            const lastUpdated = new Date(
              providerData.lastUpdated
            ).toLocaleTimeString();
            console.log(`│  ├─ ${symbol}:`);
            if (providerData.orderbook) {
              const ob = providerData.orderbook;
              const spread = ob.bestAsk - ob.bestBid;
              const spreadPercent = ((spread / ob.bestBid) * 100).toFixed(4);
              console.log(
                `│  │  ├─ ORDERBOOK: BID $${ob.bestBid.toFixed(
                  2
                )} | ASK $${ob.bestAsk.toFixed(2)} | SPREAD ${spreadPercent}%`
              );
            }
            if (providerData.funding) {
              const funding = providerData.funding;
              console.log(
                `│  │  ├─ FUNDING: ${(funding.fundingRate * 100).toFixed(
                  4
                )}% (${funding.apy.toFixed(2)}% APY)`
              );
            }
            console.log(`│  │  └─ UPDATED: ${lastUpdated}`);
          }
        }
      }
      console.log(
        `└─────────────────────────────────────────────────────────────────────`
      );
    }, 10000);

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
