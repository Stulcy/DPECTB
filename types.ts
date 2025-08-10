export interface WsLevel {
  px: string; // price
  sz: string; // size
  n: number; // number of orders
}

export interface WsBook {
  coin: string;
  levels: [Array<WsLevel>, Array<WsLevel>]; // [bids, asks]
  time: number;
}

export interface SubscriptionMessage {
  method: string;
  subscription: {
    type: string;
    coin: string;
  };
}
