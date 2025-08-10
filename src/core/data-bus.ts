import { EventEmitter } from 'events';
import { MarketData, OrderbookData, FundingData } from './interfaces';

export class DataBus extends EventEmitter {
  emitOrderbook(data: OrderbookData): void {
    this.emit('orderbook', data);
  }

  emitFunding(data: FundingData): void {
    this.emit('funding', data);
  }

  onOrderbook(callback: (data: OrderbookData) => void): void {
    this.on('orderbook', callback);
  }

  onFunding(callback: (data: FundingData) => void): void {
    this.on('funding', callback);
  }
}