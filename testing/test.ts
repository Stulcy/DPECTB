import WebSocket from "ws";

class ExtendedWebSocketTest {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly wsUrl =
    "wss://api.extended.exchange/stream.extended.exchange/v1/orderbooks/BTC-USDC?depth=1";

  connect(): void {
    const headers = {
      "User-Agent": "DPECTB-Bot/1.0",
    };

    console.log("Connecting to Extended Exchange WebSocket...");
    this.ws = new WebSocket(this.wsUrl, { headers });

    this.ws.on("open", () => {
      console.log("Connected to Extended Exchange WebSocket");

      // Send initial ping to test server response
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        console.log("Sent initial ping to server");
      }

      // Start periodic ping every 5 seconds
      this.pingInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.ping();
          console.log("Sent periodic ping to server");
        }
      }, 5000);
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      this.handleMessage(data);
    });

    this.ws.on("ping", (data: Buffer) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Received ping frame (${data.length} bytes)`);

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.pong(data);
        console.log(`[${timestamp}] Sent pong frame response`);
      }
    });

    this.ws.on("pong", (data: Buffer) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Received pong frame (${data.length} bytes)`);
    });

    this.ws.on("close", (code: number, reason: Buffer) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(
        `[${timestamp}] Connection closed - Code: ${code}, Reason: "${reason.toString()}"`
      );

      // Clear ping interval
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      // Simple reconnection logic
      setTimeout(() => {
        console.log("Attempting to reconnect...");
        this.connect();
      }, 5000);
    });

    this.ws.on("error", (error: Error) => {
      console.error("WebSocket error:", error.message);
    });
  }

  private handleMessage(data: WebSocket.Data): void {
    const message = data.toString();
    const timestamp = new Date().toLocaleTimeString();

    // Handle custom ping messages in text format
    if (message.startsWith("[ping ") && message.endsWith(" ping]")) {
      console.log(`[${timestamp}] Received custom ping message: ${message}`);

      const pongMessage = message
        .replace("[ping ", "[pong ")
        .replace(" ping]", " pong]");

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(pongMessage);
        console.log(`[${timestamp}] Sent custom pong message: ${pongMessage}`);
      }
      return;
    }

    // Log other messages (orderbook data, etc.)
    console.log(`[${timestamp}] Received message (${message.length} chars)`);

    try {
      const parsed = JSON.parse(message);
      if (parsed.data && parsed.data.m) {
        console.log(`Orderbook data for ${parsed.data.m}`);
      }
    } catch (error) {
      console.log(`Non-JSON message: ${message.substring(0, 100)}...`);
    }
  }

  disconnect(): void {
    if (this.ws) {
      console.log("Disconnecting from WebSocket...");
      this.ws.close();
      this.ws = null;
    }

    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Create and connect
const test = new ExtendedWebSocketTest();
test.connect();

// Handle process termination
process.on("SIGINT", () => {
  console.log("\nReceived SIGINT, closing WebSocket...");
  test.disconnect();
  process.exit(0);
});

console.log("Extended Exchange WebSocket test started. Press Ctrl+C to exit.");
