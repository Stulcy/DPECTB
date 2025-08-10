import WebSocket from "ws";
import { WsLevel, SubscriptionMessage } from "./types";

class HyperliquidWebSocket {
  private ws: WebSocket | null = null;
  private readonly url = "wss://api.hyperliquid.xyz/ws";

  constructor() {
    this.connect();
  }

  private connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      console.log("Connected to Hyperliquid WebSocket");
      this.subscribeToBNBOrderbook();
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      const message = data.toString();
      const timestamp = new Date().toLocaleString();
      console.log(`\n[${timestamp}]`);

      try {
        const parsed = JSON.parse(message);
        if (parsed.data && parsed.data.levels) {
          const [bids, asks] = parsed.data.levels;

          // BID analysis
          const bidPrices = bids.map((bid: WsLevel) => parseFloat(bid.px));
          const bidVolumes = bids.map((bid: WsLevel) => parseFloat(bid.sz));
          const totalBidVolume = bidVolumes.reduce(
            (sum: number, vol: number) => sum + vol,
            0
          );
          const bidRange = `${Math.min(...bidPrices)} - ${Math.max(
            ...bidPrices
          )}`;

          // ASK analysis
          const askPrices = asks.map((ask: WsLevel) => parseFloat(ask.px));
          const askVolumes = asks.map((ask: WsLevel) => parseFloat(ask.sz));
          const totalAskVolume = askVolumes.reduce(
            (sum: number, vol: number) => sum + vol,
            0
          );
          const askRange = `${Math.min(...askPrices)} - ${Math.max(
            ...askPrices
          )}`;

          console.log(
            `BIDS: Range ${bidRange} | Total Volume: ${totalBidVolume.toFixed(
              2
            )}`
          );
          console.log(
            `ASKS: Range ${askRange} | Total Volume: ${totalAskVolume.toFixed(
              2
            )}`
          );
        } else {
          console.log(message);
        }
      } catch (error) {
        console.log(message);
      }
    });

    this.ws.on("close", () => {
      console.log("WebSocket connection closed");
      setTimeout(() => {
        console.log("Reconnecting...");
        this.connect();
      }, 5000);
    });

    this.ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  }

  private subscribeToBNBOrderbook(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not connected");
      return;
    }

    const subscriptionMessage: SubscriptionMessage = {
      method: "subscribe",
      subscription: {
        type: "l2Book", // can also do "bbo" if we only need the tightest spread (even faster updates)
        coin: "BNB",
      },
    };

    this.ws.send(JSON.stringify(subscriptionMessage));
    console.log("Sent subscription request for BNB orderbook");
  }
}

// Start the WebSocket connection
const hyperliquidWS = new HyperliquidWebSocket();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  process.exit(0);
});
