export class SymbolMapper {
  private static readonly SYMBOL_MAPPINGS: Record<string, string[]> = {
    BNB: ["BNB", "BNB-USD", "BNBUSD"],
    ETH: ["ETH", "ETH-USD", "ETHUSD"],
    BTC: ["BTC", "BTC-USD", "BTCUSD"],
    SUI: ["SUI", "SUI-USD", "SUIUSD"],
  };

  private static readonly PROVIDER_SYMBOL_MAP: Record<
    string,
    Record<string, string>
  > = {
    hyperliquid: {
      BNB: "BNB",
      ETH: "ETH",
      BTC: "BTC",
    },
    extended: {
      BNB: "BNB-USD",
      ETH: "ETH-USD",
      BTC: "BTC-USD",
    },
  };

  static normalizeSymbol(
    providerSymbol: string,
    providerName: string
  ): string | null {
    // Find which normalized symbol this provider symbol belongs to
    for (const [normalized, variants] of Object.entries(this.SYMBOL_MAPPINGS)) {
      if (variants.includes(providerSymbol)) {
        return normalized;
      }
    }

    // If not found in mappings, check provider-specific mapping
    const providerMap = this.PROVIDER_SYMBOL_MAP[providerName];
    if (providerMap) {
      for (const [normalized, mapped] of Object.entries(providerMap)) {
        if (mapped === providerSymbol) {
          return normalized;
        }
      }
    }

    return null;
  }

  static getProviderSymbol(
    normalizedSymbol: string,
    providerName: string
  ): string | null {
    const providerMap = this.PROVIDER_SYMBOL_MAP[providerName];
    return providerMap?.[normalizedSymbol] || null;
  }

  static getAllVariants(normalizedSymbol: string): string[] {
    return this.SYMBOL_MAPPINGS[normalizedSymbol] || [];
  }

  static getSupportedSymbols(): string[] {
    return Object.keys(this.SYMBOL_MAPPINGS);
  }

  static addSymbolMapping(normalizedSymbol: string, variants: string[]): void {
    this.SYMBOL_MAPPINGS[normalizedSymbol] = variants;
  }

  static addProviderMapping(
    providerName: string,
    mappings: Record<string, string>
  ): void {
    this.PROVIDER_SYMBOL_MAP[providerName] = mappings;
  }
}
