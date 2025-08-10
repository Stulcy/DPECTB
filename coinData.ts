import WebSocket from "ws";
import { SubscriptionMessage } from "./types";

class HyperliquidCoinData {
  private ws: WebSocket | null = null;
  private readonly url = "wss://api.hyperliquid.xyz/ws";

  constructor() {
    this.connect();
  }

  private connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      console.log("Connected to Hyperliquid WebSocket");
      this.subscribeToActiveAssetCtx();
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      const message = data.toString();
      const timestamp = new Date().toLocaleString();
      console.log(`\n[${timestamp}]`);

      try {
        const parsed = JSON.parse(message);
        if (parsed.data && parsed.data.ctx) {
          const ctx = parsed.data.ctx;
          const fundingRate = parseFloat(ctx.funding || "0");
          const apy = (fundingRate * 24 * 365 * 100).toFixed(2); // Convert to APY percentage
          console.log(`SUI Funding Rate: ${ctx.funding || "N/A"} (${apy}% APY)`);

          // Calculate next funding time (every hour at the top of the hour)
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

  private subscribeToActiveAssetCtx(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not connected");
      return;
    }

    const subscriptionMessage: SubscriptionMessage = {
      method: "subscribe",
      subscription: {
        type: "activeAssetCtx",
        coin: "SUI",
      },
    };

    this.ws.send(JSON.stringify(subscriptionMessage));
    console.log("Sent subscription request for SUI funding rate");
  }
}

// Function to fetch asset context via POST request
async function fetchAssetContext() {
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

    // Find SUI in the response
    const suiIndex = parsed[0]?.universe?.findIndex(
      (asset: any) => asset.name === "SUI"
    );

    if (suiIndex !== -1 && parsed[1] && parsed[1][suiIndex]) {
      const ctx = parsed[1][suiIndex];
      const timestamp = new Date().toLocaleString();

      console.log(`\n[${timestamp}] - POST Request`);
      const fundingRate = parseFloat(ctx.funding || "0");
      const apy = (fundingRate * 24 * 365 * 100).toFixed(2); // Convert to APY percentage
      console.log(`SUI Funding Rate: ${ctx.funding || "N/A"} (${apy}% APY)`);

      // Calculate next funding time (every hour at the top of the hour)
      const now = new Date();
      const nextFundingTime = new Date(now);
      nextFundingTime.setMinutes(0, 0, 0);
      nextFundingTime.setHours(nextFundingTime.getHours() + 1);

      const timeUntilFunding = nextFundingTime.getTime() - now.getTime();
      const minutesUntilFunding = Math.floor(timeUntilFunding / (1000 * 60));
      const secondsUntilFunding = Math.floor(
        (timeUntilFunding % (1000 * 60)) / 1000
      );

      console.log(
        `Funding update in ${minutesUntilFunding}m ${secondsUntilFunding}s`
      );
    } else {
      console.log("SUI not found in response");
    }
  } catch (error) {
    console.error("Error fetching asset context:", error);
  }
}

// Function to fetch predicted funding rates for different venues
async function fetchPredictedFundings() {
  try {
    const response = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "predictedFundings",
      }),
    });

    const responseText = await response.text();
    const parsed = JSON.parse(responseText);

    const timestamp = new Date().toLocaleString();
    console.log(`\n[${timestamp}] - Predicted Funding Rates`);

    // Find SUI data in the response
    const suiData = parsed.find((item: any) => item[0] === "SUI");

    if (suiData) {
      console.log("SUI Predicted Funding Rates:");
      
      // Calculate APY for predicted funding rate if available
      if (suiData[1]) { // Assuming funding rate is in suiData[1]
        const fundingRate = parseFloat(suiData[1] || "0");
        const apy = (fundingRate * 24 * 365 * 100).toFixed(2);
        console.log(`Predicted Funding Rate: ${suiData[1]} (${apy}% APY)`);
      }
      
      console.log(JSON.stringify(suiData, null, 2));

      // Calculate time until next funding if nextFundingTime is available
      if (suiData.nextFundingTime) {
        const now = new Date();
        const nextFundingTime = new Date(suiData.nextFundingTime);
        const timeUntilFunding = nextFundingTime.getTime() - now.getTime();

        if (timeUntilFunding > 0) {
          const minutesUntilFunding = Math.floor(
            timeUntilFunding / (1000 * 60)
          );
          const secondsUntilFunding = Math.floor(
            (timeUntilFunding % (1000 * 60)) / 1000
          );
          console.log(
            `Funding update in ${minutesUntilFunding}m ${secondsUntilFunding}s`
          );
        } else {
          console.log("Next funding time has already passed");
        }
      }
    } else {
      console.log("SUI not found in predicted funding rates");
      console.log(
        "Available coins:",
        parsed.map((item: any) => item.coin)
      );
    }
  } catch (error) {
    console.error("Error fetching predicted funding rates:", error);
  }
}

// Also fetch once via POST request
fetchAssetContext();

// Fetch predicted funding rates
// fetchPredictedFundings();

// Start the WebSocket connection
// const hyperliquidCoinData = new HyperliquidCoinData();

// Handle graceful shutdown
// process.on("SIGINT", () => {
//   console.log("\nShutting down gracefully...");
//   process.exit(0);
// });
