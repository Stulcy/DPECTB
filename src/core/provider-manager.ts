import { DataProvider, Config } from "./interfaces";
import { DataBus } from "./data-bus";
import { MarketDataStore } from "./market-data-store";

export class ProviderManager {
  public readonly dataBus: DataBus;
  public readonly marketDataStore: MarketDataStore;
  private providers: Map<string, DataProvider> = new Map();
  private config: Config;

  constructor(config: Config) {
    this.dataBus = new DataBus();
    this.marketDataStore = new MarketDataStore(this.dataBus);
    this.config = config;
  }

  registerProvider(provider: DataProvider): void {
    this.providers.set(provider.name, provider);
  }

  async startAll(): Promise<void> {
    const enabledProviders = Object.entries(this.config.providers).filter(
      ([_, config]) => config.enabled
    );

    for (const [providerName, providerConfig] of enabledProviders) {
      const provider = this.providers.get(providerName);
      if (!provider) {
        console.warn(`Provider ${providerName} not registered, skipping`);
        continue;
      }

      try {
        await provider.connect();

        for (const symbol of providerConfig.symbols) {
          await provider.subscribe(symbol, providerConfig.dataTypes);
        }

      } catch (error) {
        console.error(`Failed to start provider ${providerName}:`, error);
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const provider of this.providers.values()) {
      try {
        await provider.disconnect();
      } catch (error) {
        console.error(`Error stopping provider ${provider.name}:`, error);
      }
    }
  }

  getProvider(name: string): DataProvider | undefined {
    return this.providers.get(name);
  }
}
