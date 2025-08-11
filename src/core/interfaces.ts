export interface WsLevel {
  px: string;
  sz: string;
  n: number;
}

export interface OrderbookData {
  symbol: string;
  bestBid: number;
  bestAsk: number;
  fundingRate: number;
  timestamp: number;
}

export interface FundingData {
  symbol: string;
  fundingRate: number;
  apy: number;
  nextFundingMinutes: number;
  nextFundingSeconds: number;
  timestamp: number;
}

export type MarketData = OrderbookData | FundingData;

export type DataType = "orderbook" | "funding";

export interface DataProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(symbol: string, dataTypes: DataType[]): Promise<void>;
  unsubscribe(symbol: string): void;
  isConnected(): boolean;
  readonly name: string;
}

export interface ProviderConfig {
  enabled: boolean;
  symbols: string[];
  dataTypes: DataType[];
}

export interface Config {
  providers: {
    [providerName: string]: ProviderConfig;
  };
}
