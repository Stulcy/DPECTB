import { MarketDataStore } from "../core/market-data-store";
import { Config } from "../core/interfaces";
import { Decimal } from "decimal.js";

export function processMarketData(
  marketDataStore: MarketDataStore,
  config: Config
): void {
  const now = new Date();
  console.log(`--- ${now.toLocaleString()} ---`);

  const symbols = marketDataStore.getSymbols();

  for (const symbol of symbols) {
    const allData = marketDataStore.getAllData(symbol);
    const providers = Array.from(allData.keys());

    // Calculate arbitrage opportunities between all provider pairs
    for (let i = 0; i < providers.length; i++) {
      for (let j = i + 1; j < providers.length; j++) {
        const providerA = providers[i];
        const providerB = providers[j];

        const dataA = allData.get(providerA);
        const dataB = allData.get(providerB);

        if (dataA?.orderbook && dataB?.orderbook) {
          const configA = config.providers[providerA];
          const configB = config.providers[providerB];

          if (configA && configB) {
            // Taking just takerFee for now because we will probably be market buying
            // also it's safer to assume profitability
            const [makerFeeA, takerFeeA] = configA.fees;
            const [makerFeeB, takerFeeB] = configB.fees;

            // Calculate profit: Buy on A, Sell on B
            const buyPriceA = dataA.orderbook.bestAsk; // We buy at the ask price
            const sellPriceB = dataB.orderbook.bestBid; // We sell at the bid price
            const feeA = buyPriceA * (takerFeeA / 100); // Fee for buying on A
            const feeB = sellPriceB * (takerFeeB / 100); // Fee for selling on B

            const profitAtoB = sellPriceB - feeB - buyPriceA - feeA;

            // Calculate profit: Buy on B, Sell on A
            const buyPriceB = dataB.orderbook.bestAsk; // We buy at the ask price
            const sellPriceA = dataA.orderbook.bestBid; // We sell at the bid price
            const feeBbuy = buyPriceB * (takerFeeB / 100); // Fee for buying on B
            const feeAsell = sellPriceA * (takerFeeA / 100); // Fee for selling on A

            const profitBtoA = sellPriceA - feeAsell - buyPriceB - feeBbuy;

            // Log profitable opportunities
            if (profitAtoB >= 0.0001) {
              console.log(
                `🟢 PRICE ARBITRAGE: ${symbol} | Buy ${providerA} $${buyPriceA.toFixed(
                  4
                )} → Sell ${providerB} $${sellPriceB.toFixed(
                  4
                )} | Profit: $${profitAtoB.toFixed(4)} per ${symbol}`
              );
            }
            if (profitBtoA >= 0.0001) {
              console.log(
                `🟢 PRICE ARBITRAGE: ${symbol} | Buy ${providerB} $${buyPriceB.toFixed(
                  4
                )} → Sell ${providerA} $${sellPriceA.toFixed(
                  4
                )} | Profit: $${profitBtoA.toFixed(4)} per ${symbol}`
              );
            }
          }
        }

        // Funding arbitrage calculations
        if (dataA?.funding && dataB?.funding) {
          const fundingRateA = new Decimal(dataA.funding.fundingRate);
          const fundingRateB = new Decimal(dataB.funding.fundingRate);
          const fundingDiff = fundingRateA.minus(fundingRateB);
          const annualizedDiff = fundingDiff.abs().mul(24).mul(365).mul(100); // Convert to APY %

          if (annualizedDiff.gte(5)) {
            const longExchange = fundingDiff.gt(0) ? providerA : providerB;
            const shortExchange = fundingDiff.gt(0) ? providerB : providerA;
            const higherRate = fundingRateA.gt(fundingRateB)
              ? fundingRateA
              : fundingRateB;
            const lowerRate = fundingRateA.lt(fundingRateB)
              ? fundingRateA
              : fundingRateB;

            console.log(
              `💰 FUNDING ARBITRAGE: ${symbol} | Long ${longExchange} (${higherRate
                .mul(100)
                .toFixed(4)}%) → Short ${shortExchange} (${lowerRate
                .mul(100)
                .toFixed(4)}%) | Diff: ${fundingDiff
                .abs()
                .mul(100)
                .toFixed(4)}% | APY: ${annualizedDiff.toFixed(2)}%`
            );
          }
        }
      }
    }
  }
  console.log();
}
