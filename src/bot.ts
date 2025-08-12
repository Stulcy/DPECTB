import { Client, Events, GatewayIntentBits, EmbedBuilder } from "discord.js";
import dotenv from "dotenv";
import { ProviderManager } from "./core/provider-manager";
import { HyperliquidProvider } from "./providers/hyperliquid";
import { ExtendedProvider } from "./providers/extended";
import { Config } from "./core/interfaces";
import * as fs from "fs";
import * as path from "path";
dotenv.config();

const clientToken = process.env.CLIENT_TOKEN;

import { MarketDataStore } from "./core/market-data-store";
import { Decimal } from "decimal.js";

interface ArbitrageOpportunity {
  type: "price" | "funding";
  symbol: string;
  details: string;
  profit?: string;
  apy?: string;
}

function processMarketDataForDiscord(
  marketDataStore: MarketDataStore,
  config: Config
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  const symbols = marketDataStore.getSymbols();

  for (const symbol of symbols) {
    const allData = marketDataStore.getAllData(symbol);
    const providers = Array.from(allData.keys());

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
            const [, takerFeeA] = configA.fees;
            const [, takerFeeB] = configB.fees;

            const buyPriceA = dataA.orderbook.bestAsk;
            const sellPriceB = dataB.orderbook.bestBid;
            const feeA = buyPriceA * (takerFeeA / 100);
            const feeB = sellPriceB * (takerFeeB / 100);

            const profitAtoB = sellPriceB - feeB - buyPriceA - feeA;

            const buyPriceB = dataB.orderbook.bestAsk;
            const sellPriceA = dataA.orderbook.bestBid;
            const feeBbuy = buyPriceB * (takerFeeB / 100);
            const feeAsell = sellPriceA * (takerFeeA / 100);

            const profitBtoA = sellPriceA - feeAsell - buyPriceB - feeBbuy;

            if (profitAtoB >= 0.0001) {
              opportunities.push({
                type: "price",
                symbol,
                details: `Buy ${providerA} $${buyPriceA.toFixed(
                  4
                )} → Sell ${providerB} $${sellPriceB.toFixed(4)}`,
                profit: `$${profitAtoB.toFixed(4)} per ${symbol}`,
              });
            }
            if (profitBtoA >= 0.0001) {
              opportunities.push({
                type: "price",
                symbol,
                details: `Buy ${providerB} $${buyPriceB.toFixed(
                  4
                )} → Sell ${providerA} $${sellPriceA.toFixed(4)}`,
                profit: `$${profitBtoA.toFixed(4)} per ${symbol}`,
              });
            }
          }
        }

        if (dataA?.funding && dataB?.funding) {
          const fundingRateA = new Decimal(dataA.funding.fundingRate);
          const fundingRateB = new Decimal(dataB.funding.fundingRate);
          const fundingDiff = fundingRateA.minus(fundingRateB);
          const annualizedDiff = fundingDiff.abs().mul(24).mul(365).mul(100);

          if (annualizedDiff.gte(5)) {
            const longExchange = fundingDiff.gt(0) ? providerA : providerB;
            const shortExchange = fundingDiff.gt(0) ? providerB : providerA;
            const higherRate = fundingRateA.gt(fundingRateB)
              ? fundingRateA
              : fundingRateB;
            const lowerRate = fundingRateA.lt(fundingRateB)
              ? fundingRateA
              : fundingRateB;

            opportunities.push({
              type: "funding",
              symbol,
              details: `Long ${longExchange} (${higherRate
                .mul(100)
                .toFixed(4)}%) → Short ${shortExchange} (${lowerRate
                .mul(100)
                .toFixed(4)}%)`,
              apy: `${annualizedDiff.toFixed(2)}%`,
            });
          }
        }
      }
    }
  }

  return opportunities;
}

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // servers
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

let manager: ProviderManager;
let printInterval: NodeJS.Timeout;

client
  .once("ready", async () => {
    try {
      const user = await client.users.fetch(process.env.USER_ID as string);
      await user.send("Let's gremo!");
      console.log("DM sent");

      // Initialize trading system
      const configPath = path.join(__dirname, "config", "providers.json");
      const configData = fs.readFileSync(configPath, "utf-8");
      const config: Config = JSON.parse(configData);

      manager = new ProviderManager(config);

      const hyperliquidProvider = new HyperliquidProvider(manager.dataBus);
      manager.registerProvider(hyperliquidProvider);

      const extendedProvider = new ExtendedProvider(manager.dataBus);
      manager.registerProvider(extendedProvider);

      manager.dataBus.onOrderbook((_) => {});
      manager.dataBus.onFunding((data) => {});

      await manager.startAll();
      console.log("Trading system started");

      // Start processing market data and sending to Discord
      printInterval = setInterval(async () => {
        const opportunities = processMarketDataForDiscord(
          manager.marketDataStore,
          config
        );

        if (opportunities.length > 0) {
          const embed = new EmbedBuilder()
            .setTitle("🚨 Arbitrage Opportunities")
            .setColor(0x00ff00)
            .setTimestamp();

          const priceOpportunities = opportunities.filter(
            (op) => op.type === "price"
          );
          const fundingOpportunities = opportunities.filter(
            (op) => op.type === "funding"
          );

          if (priceOpportunities.length > 0) {
            const priceText = priceOpportunities
              .map((op) => `**${op.symbol}**: ${op.details}\n💰 ${op.profit}`)
              .join("\n\n");
            embed.addFields({
              name: "Price Arbitrage",
              value: priceText,
              inline: false,
            });
          }

          if (fundingOpportunities.length > 0) {
            const fundingText = fundingOpportunities
              .map((op) => `**${op.symbol}**: ${op.details}\n📈 APY: ${op.apy}`)
              .join("\n\n");
            embed.addFields({
              name: "Funding Arbitrage",
              value: fundingText,
              inline: false,
            });
          }

          try {
            await user.send({ embeds: [embed] });
          } catch (error) {
            console.error("Failed to send arbitrage message:", error);
          }
        }
      }, 5000);
    } catch (error) {
      console.error("Failed to initialize:", error);
    }
  })
  .on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
  });

const initialize = async () => {
  try {
    await client.login(clientToken);
    console.log("[INFO] DPECTB Online");
  } catch (e) {
    console.error("[ERROR] Login failed", e);
    process.exit(1);
  }
};

// Graceful shutdown handling
process.on("SIGINT", async () => {
  console.log("Shutting down...");

  if (printInterval) {
    clearInterval(printInterval);
  }

  if (manager) {
    await manager.stopAll();
  }

  if (client) {
    client.destroy();
  }

  process.exit(0);
});

initialize();
