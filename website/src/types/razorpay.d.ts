declare module "razorpay" {
  interface RazorpayOrder {
    id: string;
    amount: number | string;
    currency: string;
    receipt?: string;
  }

  interface RazorpayOrders {
    create(options: {
      amount: number;
      currency: string;
      receipt?: string;
      notes?: Record<string, string>;
    }): Promise<RazorpayOrder>;
  }

  export default class Razorpay {
    constructor(options: { key_id: string; key_secret: string });
    orders: RazorpayOrders;
  }
}
