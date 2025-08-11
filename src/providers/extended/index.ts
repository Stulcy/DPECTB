import WebSocket from "ws";
import {
  DataProvider,
  DataType,
  OrderbookData,
  FundingData,
} from "../../core/interfaces";
import { DataBus } from "../../core/data-bus";

export class ExtendedProvider implements DataProvider {
  public readonly name = "extended";
  private wsConnections: Map<string, WebSocket> = new Map();
  private readonly wsBaseUrl =
    "wss://api.extended.exchange/stream.extended.exchange/v1";
  private readonly apiUrl = "https://api.extended.exchange";
  private dataBus: DataBus;
  private subscriptions: Map<string, Set<DataType>> = new Map();
  private fundingCache: Map<string, FundingData> = new Map();
  private fundingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private reconnectIntervals: Map<string, NodeJS.Timeout> = new Map();
  private reconnectingSymbols: Set<string> = new Set();

  constructor(dataBus: DataBus) {
    this.dataBus = dataBus;
  }

  async connect(): Promise<void> {
    // Extended might need market-specific WebSocket connections
    // For now, let's just resolve without connecting to WebSocket
    // We'll connect per-symbol in subscribeToOrderbook
    console.log("Extended provider ready (will connect per-symbol)");
    return Promise.resolve();
  }

  private async connectToMarket(symbol: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const headers = {
        "User-Agent": "DPECTB-Bot/1.0",
      };

      // Try market-specific URL
      const wsUrl = `${this.wsBaseUrl}/orderbooks/${symbol}?depth=1`;
      const ws = new WebSocket(wsUrl, { headers });
      this.wsConnections.set(symbol, ws);

      ws.on("open", () => {
        console.log(`Extended: Connected to ${symbol} WebSocket`);

        // Preemptive reconnection every 14 seconds to avoid 15s timeout
        const reconnectInterval = setInterval(() => {
          console.log(
            `Extended: Preemptive reconnection for ${symbol} to avoid server timeout`
          );
          this.reconnectSymbol(symbol);
        }, 14000);
        this.reconnectIntervals.set(symbol, reconnectInterval);

        resolve();
      });

      ws.on("message", (data: WebSocket.Data) => {
        this.handleMessage(data, symbol);
      });

      ws.on("close", (code: number, reason: Buffer) => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(
          `[${timestamp}] Extended ${symbol} WebSocket connection closed - Code: ${code}, Reason: "${reason.toString()}"`
        );

        const reconnectInterval = this.reconnectIntervals.get(symbol);
        if (reconnectInterval) {
          clearInterval(reconnectInterval);
          this.reconnectIntervals.delete(symbol);
        }

        // Remove connection
        this.wsConnections.delete(symbol);

        // Only reconnect if this wasn't a planned reconnection
        if (!this.reconnectingSymbols.has(symbol)) {
          setTimeout(() => {
            console.log(
              `Extended: Attempting to reconnect ${symbol} after unexpected close...`
            );
            if (this.subscriptions.has(symbol)) {
              this.connectToMarket(symbol);
            }
          }, 5000);
        } else {
          this.reconnectingSymbols.delete(symbol);
        }
      });

      ws.on("error", (error: Error) => {
        console.error(`Extended ${symbol} WebSocket error:`, error);
        reject(error);
      });
    });
  }

  private reconnectSymbol(symbol: string): void {
    this.reconnectingSymbols.add(symbol);

    const reconnectInterval = this.reconnectIntervals.get(symbol);
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      this.reconnectIntervals.delete(symbol);
    }

    // Close existing connection for this symbol
    const ws = this.wsConnections.get(symbol);
    if (ws) {
      ws.close();
      this.wsConnections.delete(symbol);
    }

    // Reconnect immediately for this symbol
    if (this.subscriptions.has(symbol)) {
      this.connectToMarket(symbol);
    }
  }

  async disconnect(): Promise<void> {
    // Clear all funding intervals
    for (const interval of this.fundingIntervals.values()) {
      clearInterval(interval);
    }
    this.fundingIntervals.clear();

    for (const interval of this.reconnectIntervals.values()) {
      clearInterval(interval);
    }
    this.reconnectIntervals.clear();

    // Close all WebSocket connections
    for (const ws of this.wsConnections.values()) {
      ws.close();
    }
    this.wsConnections.clear();
    this.reconnectingSymbols.clear();
  }

  async subscribe(symbol: string, dataTypes: DataType[]): Promise<void> {
    this.subscriptions.set(symbol, new Set(dataTypes));

    // Process funding first (if requested)
    if (dataTypes.includes("funding")) {
      await this.startFundingPolling(symbol);
    }

    // Then start orderbook WebSocket
    if (dataTypes.includes("orderbook")) {
      await this.subscribeToOrderbook(symbol);
    }
  }

  unsubscribe(symbol: string): void {
    this.subscriptions.delete(symbol);

    // Clear funding interval for this symbol
    const fundingInterval = this.fundingIntervals.get(symbol);
    if (fundingInterval) {
      clearInterval(fundingInterval);
      this.fundingIntervals.delete(symbol);
    }

    const reconnectInterval = this.reconnectIntervals.get(symbol);
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      this.reconnectIntervals.delete(symbol);
    }

    // Close WebSocket connection for this symbol
    const ws = this.wsConnections.get(symbol);
    if (ws) {
      ws.close();
      this.wsConnections.delete(symbol);
    }

    // Remove from reconnecting symbols
    this.reconnectingSymbols.delete(symbol);

    // Remove from cache
    this.fundingCache.delete(symbol);
  }

  isConnected(): boolean {
    // Return true if at least one connection is open
    for (const ws of this.wsConnections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        return true;
      }
    }
    return false;
  }

  private async subscribeToOrderbook(symbol: string): Promise<void> {
    try {
      await this.connectToMarket(symbol);
      console.log(`Extended: Connected to ${symbol} orderbook stream`);
    } catch (error) {
      console.error(`Failed to connect to Extended ${symbol} stream:`, error);
    }
  }

  private async startFundingPolling(symbol: string): Promise<void> {
    // Fetch immediately
    await this.fetchFundingRate(symbol);

    // Calculate ms until next whole hour
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    const msUntilNextHour = nextHour.getTime() - now.getTime();

    // Set timeout for first hourly update, then interval
    setTimeout(() => {
      this.fetchFundingRate(symbol);

      // Set hourly interval
      const interval = setInterval(() => {
        this.fetchFundingRate(symbol);
      }, 60 * 60 * 1000); // Every hour

      this.fundingIntervals.set(symbol, interval);
    }, msUntilNextHour);

    console.log(
      `Started Extended funding polling for ${symbol} - next update in ${Math.floor(
        msUntilNextHour / 60000
      )}m`
    );
  }

  private handleMessage(data: WebSocket.Data, symbol: string): void {
    const message = data.toString();
    const timestamp = new Date().toLocaleTimeString();

    try {
      const parsed = JSON.parse(message);

      if (parsed.data && parsed.data.b && parsed.data.a) {
        this.handleOrderbookMessage(parsed);
      } else {
        console.log(
          `[${timestamp}] Extended ${symbol} unknown message format:`,
          message
        );
      }
    } catch (error) {
      console.log(
        `[${timestamp}] Extended ${symbol} JSON parse error:`,
        message
      );
    }
  }

  private handleOrderbookMessage(parsed: any): void {
    const { data } = parsed;

    // Extract best bid and ask prices
    const bestBid = parseFloat(data.b[0]?.p || "0");
    const bestAsk = parseFloat(data.a[0]?.p || "0");

    // Get funding rate from cache
    const fundingData = this.fundingCache.get(data.m);
    const fundingRate = fundingData?.fundingRate || 0;

    const orderbookData: OrderbookData = {
      symbol: data.m,
      bestBid,
      bestAsk,
      fundingRate,
      timestamp: parsed.ts || Date.now(),
    };

    this.dataBus.emitOrderbook(orderbookData);
  }

  private async fetchFundingRate(symbol: string): Promise<void> {
    try {
      // Get current funding rate from markets endpoint
      const response = await fetch(`${this.apiUrl}/api/v1/info/markets`, {
        headers: {
          "User-Agent": "DPECTB-Bot/1.0",
        },
      });

      if (!response.ok) {
        console.error(
          `Extended API error for ${symbol}: ${response.status} ${response.statusText}`
        );
        return;
      }

      const responseText = await response.text();
      const responseData = JSON.parse(responseText);

      if (responseData.status === "OK" && responseData.data.length > 0) {
        // Find the specific market
        const marketData = responseData.data.find(
          (market: any) => market.name === symbol
        );

        if (marketData && marketData.marketStats) {
          const timestamp = new Date().toLocaleString();

          console.log(`\n[${timestamp}] - Extended Funding API Call`);
          const fundingRate = parseFloat(
            marketData.marketStats.fundingRate || "0"
          );
          const apy = fundingRate * 24 * 365 * 100;
          console.log(
            `${symbol} Funding Rate: ${
              marketData.marketStats.fundingRate || "N/A"
            } (${apy.toFixed(2)}% APY)`
          );

          const now = new Date();
          const nextFundingTime = new Date(now);
          nextFundingTime.setMinutes(0, 0, 0);
          nextFundingTime.setHours(nextFundingTime.getHours() + 1);

          const timeUntilFunding = nextFundingTime.getTime() - now.getTime();
          const minutesUntilFunding = Math.floor(
            timeUntilFunding / (1000 * 60)
          );
          const secondsUntilFunding = Math.floor(
            (timeUntilFunding % (1000 * 60)) / 1000
          );

          console.log(
            `Funding update in ${minutesUntilFunding}m ${secondsUntilFunding}s`
          );

          const fundingDataObj: FundingData = {
            symbol,
            fundingRate: parseFloat(marketData.marketStats.fundingRate || "0"),
            apy: fundingRate * 24 * 365 * 100,
            nextFundingMinutes: minutesUntilFunding,
            nextFundingSeconds: secondsUntilFunding,
            timestamp: Date.now(),
          };

          // Cache the funding data
          this.fundingCache.set(symbol, fundingDataObj);

          // Emit to data bus
          this.dataBus.emitFunding(fundingDataObj);
        } else {
          console.log(`${symbol} not found in Extended markets response`);
        }
      } else {
        console.log(`Extended API returned invalid status or no data`);
      }
    } catch (error) {
      console.error(
        `Error fetching Extended funding rate for ${symbol}:`,
        error
      );
    }
  }
}
