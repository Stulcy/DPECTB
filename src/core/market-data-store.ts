import { OrderbookData, FundingData } from "./interfaces";
import { DataBus } from "./data-bus";
import { SymbolMapper } from "./symbol-mapper";

export interface StoredMarketData {
  orderbook?: OrderbookData;
  funding?: FundingData;
  lastUpdated: number;
}

export interface ProviderData {
  [normalizedSymbol: string]: StoredMarketData;
}

export class MarketDataStore {
  private data: Map<string, ProviderData> = new Map();
  private dataBus: DataBus;

  constructor(dataBus: DataBus) {
    this.dataBus = dataBus;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.dataBus.onOrderbook((data: OrderbookData) => {
      this.storeOrderbookData(data);
    });

    this.dataBus.onFunding((data: FundingData) => {
      this.storeFundingData(data);
    });
  }

  private storeOrderbookData(data: OrderbookData): void {
    const providerName = this.extractProviderFromOrderbook(data);
    if (!providerName) {
      console.warn(`Unable to determine provider for symbol ${data.symbol}`);
      return;
    }

    const normalizedSymbol = SymbolMapper.normalizeSymbol(
      data.symbol,
      providerName
    );
    if (!normalizedSymbol) {
      console.warn(
        `Unable to normalize symbol ${data.symbol} for provider ${providerName}`
      );
      return;
    }

    this.ensureProviderExists(providerName);
    this.ensureSymbolExists(providerName, normalizedSymbol);

    const providerData = this.data.get(providerName)!;
    providerData[normalizedSymbol].orderbook = data;
    providerData[normalizedSymbol].lastUpdated = Date.now();
  }

  private storeFundingData(data: FundingData): void {
    const providerName = this.extractProviderFromFunding(data);
    if (!providerName) {
      console.warn(`Unable to determine provider for symbol ${data.symbol}`);
      return;
    }

    const normalizedSymbol = SymbolMapper.normalizeSymbol(
      data.symbol,
      providerName
    );
    if (!normalizedSymbol) {
      console.warn(
        `Unable to normalize symbol ${data.symbol} for provider ${providerName}`
      );
      return;
    }

    this.ensureProviderExists(providerName);
    this.ensureSymbolExists(providerName, normalizedSymbol);

    const providerData = this.data.get(providerName)!;
    providerData[normalizedSymbol].funding = data;
    providerData[normalizedSymbol].lastUpdated = Date.now();
  }

  private extractProviderFromOrderbook(data: OrderbookData): string | null {
    // Temporary logic - we'll improve this when we add provider info to the data
    if (data.symbol.includes("-")) {
      return "extended";
    }
    return "hyperliquid";
  }

  private extractProviderFromFunding(data: FundingData): string | null {
    // Temporary logic - we'll improve this when we add provider info to the data
    if (data.symbol.includes("-")) {
      return "extended";
    }
    return "hyperliquid";
  }

  private ensureProviderExists(providerName: string): void {
    if (!this.data.has(providerName)) {
      this.data.set(providerName, {});
    }
  }

  private ensureSymbolExists(
    providerName: string,
    normalizedSymbol: string
  ): void {
    const providerData = this.data.get(providerName)!;
    if (!providerData[normalizedSymbol]) {
      providerData[normalizedSymbol] = {
        lastUpdated: Date.now(),
      };
    }
  }

  getOrderbookData(
    normalizedSymbol: string,
    providerName?: string
  ): OrderbookData[] {
    const results: OrderbookData[] = [];

    if (providerName) {
      const providerData = this.data.get(providerName);
      const symbolData = providerData?.[normalizedSymbol];
      if (symbolData?.orderbook) {
        results.push(symbolData.orderbook);
      }
    } else {
      // Get from all providers
      for (const [, providerData] of this.data.entries()) {
        const symbolData = providerData[normalizedSymbol];
        if (symbolData?.orderbook) {
          results.push(symbolData.orderbook);
        }
      }
    }

    return results;
  }

  getFundingData(
    normalizedSymbol: string,
    providerName?: string
  ): FundingData[] {
    const results: FundingData[] = [];

    if (providerName) {
      const providerData = this.data.get(providerName);
      const symbolData = providerData?.[normalizedSymbol];
      if (symbolData?.funding) {
        results.push(symbolData.funding);
      }
    } else {
      // Get from all providers
      for (const [, providerData] of this.data.entries()) {
        const symbolData = providerData[normalizedSymbol];
        if (symbolData?.funding) {
          results.push(symbolData.funding);
        }
      }
    }

    return results;
  }

  getAllData(normalizedSymbol: string): Map<string, StoredMarketData> {
    const results = new Map<string, StoredMarketData>();

    for (const [provider, providerData] of this.data.entries()) {
      const symbolData = providerData[normalizedSymbol];
      if (symbolData) {
        results.set(provider, symbolData);
      }
    }

    return results;
  }

  getProviders(): string[] {
    return Array.from(this.data.keys());
  }

  getSymbols(): string[] {
    const symbols = new Set<string>();
    for (const providerData of this.data.values()) {
      for (const symbol of Object.keys(providerData)) {
        symbols.add(symbol);
      }
    }
    return Array.from(symbols);
  }

  clear(): void {
    this.data.clear();
  }
}
