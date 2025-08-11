import WebSocket from "ws";
import {
  DataProvider,
  DataType,
  WsLevel,
  OrderbookData,
  FundingData,
} from "../../core/interfaces";
import { DataBus } from "../../core/data-bus";
import { SubscriptionMessage } from "./types";

export class HyperliquidProvider implements DataProvider {
  public readonly name = "hyperliquid";
  private ws: WebSocket | null = null;
  private readonly url = "wss://api.hyperliquid.xyz/ws";
  private dataBus: DataBus;
  private subscriptions: Map<string, Set<DataType>> = new Map();
  private fundingCache: Map<string, FundingData> = new Map();
  private fundingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(dataBus: DataBus) {
    this.dataBus = dataBus;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        console.log("Connected to Hyperliquid WebSocket");
        resolve();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on("close", () => {
        console.log("Hyperliquid WebSocket connection closed");
        setTimeout(() => {
          console.log("Reconnecting to Hyperliquid ...");
          this.connect();
        }, 5000);
      });

      this.ws.on("error", (error) => {
        console.error("Hyperliquid WebSocket error:", error);
        reject(error);
      });
    });
  }

  async disconnect(): Promise<void> {
    // Clear all funding intervals
    for (const interval of this.fundingIntervals.values()) {
      clearInterval(interval);
    }
    this.fundingIntervals.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async subscribe(symbol: string, dataTypes: DataType[]): Promise<void> {
    this.subscriptions.set(symbol, new Set(dataTypes));

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not connected");
      return;
    }

    // Process funding first (if requested)
    if (dataTypes.includes("funding")) {
      await this.startFundingPolling(symbol);
    }

    // Then start orderbook WebSocket
    if (dataTypes.includes("orderbook")) {
      this.subscribeToOrderbook(symbol);
    }
  }

  unsubscribe(symbol: string): void {
    this.subscriptions.delete(symbol);

    // Clear funding interval for this symbol
    const interval = this.fundingIntervals.get(symbol);
    if (interval) {
      clearInterval(interval);
      this.fundingIntervals.delete(symbol);
    }

    // Remove from cache
    this.fundingCache.delete(symbol);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private subscribeToOrderbook(symbol: string): void {
    const subscriptionMessage: SubscriptionMessage = {
      method: "subscribe",
      subscription: {
        type: "bbo",
        coin: symbol,
      },
    };

    this.ws!.send(JSON.stringify(subscriptionMessage));
    console.log(`Sent subscription request for ${symbol} bbo`);
  }

  private async startFundingPolling(symbol: string): Promise<void> {
    // Fetch immediately
    await this.fetchAssetContext(symbol);

    // Calculate ms until next whole hour
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    const msUntilNextHour = nextHour.getTime() - now.getTime();

    // Set timeout for first hourly update, then interval
    setTimeout(() => {
      this.fetchAssetContext(symbol);

      // Set hourly interval
      const interval = setInterval(() => {
        this.fetchAssetContext(symbol);
      }, 60 * 60 * 1000); // Every hour

      this.fundingIntervals.set(symbol, interval);
    }, msUntilNextHour);

    console.log(
      `Started funding polling for ${symbol} - next update in ${Math.floor(
        msUntilNextHour / 60000
      )}m`
    );
  }

  private handleMessage(data: WebSocket.Data): void {
    const message = data.toString();

    try {
      const parsed = JSON.parse(message);

      if (parsed.data && parsed.data.bbo) {
        this.handleOrderbookMessage(parsed);
      }
    } catch (error) {
      console.log(message);
    }
  }

  private handleOrderbookMessage(parsed: any): void {
    const { data } = parsed;

    // Extract best bid and ask prices from bbo format
    const bestBid = parseFloat(data.bbo[0]?.px || "0");
    const bestAsk = parseFloat(data.bbo[1]?.px || "0");

    // Get funding rate from cache
    const fundingData = this.fundingCache.get(data.coin);
    const fundingRate = fundingData?.fundingRate || 0;

    const orderbookData: OrderbookData = {
      symbol: data.coin || "UNKNOWN",
      bestBid,
      bestAsk,
      fundingRate,
      timestamp: data.time || Date.now(),
    };

    this.dataBus.emitOrderbook(orderbookData);
  }

  private async fetchAssetContext(symbol: string): Promise<void> {
    try {
      const response = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "metaAndAssetCtxs",
        }),
      });

      const responseText = await response.text();
      const parsed = JSON.parse(responseText);

      const symbolIndex = parsed[0]?.universe?.findIndex(
        (asset: any) => asset.name === symbol
      );

      if (symbolIndex !== -1 && parsed[1] && parsed[1][symbolIndex]) {
        const ctx = parsed[1][symbolIndex];
        const timestamp = new Date().toLocaleString();

        console.log(`\n[${timestamp}] - Funding API Call`);
        const fundingRate = parseFloat(ctx.funding || "0");
        const apy = fundingRate * 24 * 365 * 100;
        console.log(
          `${symbol} Funding Rate: ${ctx.funding || "N/A"} (${apy.toFixed(
            2
          )}% APY)`
        );

        const now = new Date();
        const nextFundingTime = new Date(now);
        nextFundingTime.setMinutes(0, 0, 0);
        nextFundingTime.setHours(nextFundingTime.getHours() + 1);

        const timeUntilFunding = nextFundingTime.getTime() - now.getTime();
        const minutesUntilFunding = Math.floor(timeUntilFunding / (1000 * 60));
        const secondsUntilFunding = Math.floor(
          (timeUntilFunding % (1000 * 60)) / 1000
        );

        const fundingData: FundingData = {
          symbol,
          fundingRate: parseFloat(ctx.funding || "0"),
          apy: fundingRate * 24 * 365 * 100,
          nextFundingMinutes: minutesUntilFunding,
          nextFundingSeconds: secondsUntilFunding,
          timestamp: Date.now(),
        };

        // Cache the funding data
        this.fundingCache.set(symbol, fundingData);

        // Emit to data bus
        this.dataBus.emitFunding(fundingData);
      } else {
        console.log(`${symbol} not found in response`);
      }
    } catch (error) {
      console.error("Error fetching asset context:", error);
    }
  }
}
