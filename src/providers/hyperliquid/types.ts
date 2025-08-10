export interface SubscriptionMessage {
  method: string;
  subscription: {
    type: string;
    coin: string;
  };
}
