export interface ExtendedOrderbookResponse {
  status: string;
  data: {
    market: string;
    bids: Array<[string, string]>; // [price, quantity]
    asks: Array<[string, string]>; // [price, quantity]
    timestamp: number;
  };
}

export interface ExtendedMarketsResponse {
  status: string;
  data: Array<{
    name: string;
    assetName: string;
    assetPrecision: number;
    collateralAssetName: string;
    collateralAssetPrecision: number;
    active: boolean;
    status: string;
    marketStats: {
      dailyVolume: string;
      dailyVolumeBase: string;
      dailyPriceChangePercentage: string;
      dailyLow: string;
      dailyHigh: string;
      lastPrice: string;
      askPrice: string;
      bidPrice: string;
      markPrice: string;
      indexPrice: string;
      fundingRate: string;
      nextFundingRate: number;
      openInterest: string;
      openInterestBase: string;
    };
    tradingConfig: any;
    l2Config: any;
  }>;
}

export interface ExtendedSubscriptionMessage {
  method: string;
  params: {
    channel: string;
    market: string;
  };
  id: number;
}

export interface ExtendedWebSocketMessage {
  ts: number;
  type: "SNAPSHOT" | "UPDATE";
  data: {
    m: string; // market
    b: Array<{
      p: string; // price
      q: string; // quantity
    }>;
    a: Array<{
      p: string; // price  
      q: string; // quantity
    }>;
  };
  seq: number;
}