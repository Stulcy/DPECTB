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
        resolve();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on("close", () => {
        setTimeout(() => {
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
  }

  private async startFundingPolling(symbol: string): Promise<void> {
    // Fetch immediately
    await this.fetchAssetContext(symbol);

    // Set 5-second interval
    const interval = setInterval(() => {
      this.fetchAssetContext(symbol);
    }, 5000); // Every 5 seconds

    this.fundingIntervals.set(symbol, interval);
  }

  private handleMessage(data: WebSocket.Data): void {
    const message = data.toString();

    try {
      const parsed = JSON.parse(message);

      if (parsed.data && parsed.data.bbo) {
        this.handleOrderbookMessage(parsed);
      }
    } catch (error) {}
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

        const fundingRate = parseFloat(ctx.funding || "0");
        const apy = fundingRate * 24 * 365 * 100;

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
      }
    } catch (error) {
      console.error("Error fetching asset context:", error);
    }
  }
}
