export interface SubscriptionMessage {
  method: string;
  subscription: {
    type: string;
    coin: string;
  };
}

export interface HyperliquidBboResponse {
  channel: string;
  data: {
    coin: string;
    time: number;
    bbo: Array<{
      px: string;
      sz: string;
      n: number;
    }>;
  };
}
