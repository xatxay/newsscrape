import * as crypto from 'crypto';
import {
  OrderTypeV5,
  CategoryV5,
  OrderTimeInForceV5,
  APIResponseV3WithTime,
  CategoryCursorListV5,
  ClosedPnLV5,
} from 'bybit-api';
import {
  AccountSummary,
  ResponseBybit,
  SpecificCoin,
  SubmitOrder,
} from '../interface.js';
import BybitClient from './bybitClient.js';

class BybitTrading extends BybitClient {
  private category: CategoryV5 = 'linear';
  private orderType: OrderTypeV5 = 'Market';
  private quantity: string;
  private timeInForce: OrderTimeInForceV5 = 'GTC';
  private symbol: string;
  private leverage: string = '10';
  private price: string | number;
  private inPosition: number;
  private tp: string;
  private sl: string;

  // private openPosition: unknown;

  constructor(symbol: string) {
    super();
    // this.client = new RestClientV5({
    // key: process.env.BYBITAPIKEY,
    // // TODO: instead of only using process.env.BYBITSECRET, store other user secrets in db and dynamically query db for secret depending on the connected user
    // secret: process.env.BYBITSECRET,
    // enable_time_sync: true,
    // });
    this.symbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
  }

  private async getAssetPrice(): Promise<number> {
    try {
      const response = await this.client.getTickers({
        category: this.category,
        symbol: this.symbol,
      });
      const price = Number(response.result.list[0].lastPrice);
      console.log(`${this.symbol} last price: ${price}`);
      return price;
    } catch (err) {
      console.error('Failed getting asset price: ', err);
      throw err;
    }
  }

  public async getWalletBalance(): Promise<AccountSummary> {
    try {
      const response = await this.client.getWalletBalance({
        accountType: 'UNIFIED',
        coin: 'USDT',
      });
      const accountSummary: AccountSummary = {
        totalEquity: Number(response.result.list[0].totalEquity),
        totalMarginBalance: Number(response.result.list[0].totalMarginBalance),
        totalAvailableBalance: Number(
          response.result.list[0].totalAvailableBalance,
        ),
        totalPerpUPL: Number(response.result.list[0].totalPerpUPL),
      };
      console.log('checking wallet balance');
      return accountSummary;
    } catch (err) {
      console.error('Failed getting balance: ', err);
      throw err;
    }
  }

  public async calculatePositionSize(percentage: number): Promise<string> {
    try {
      const assetPrice = await this.getAssetPrice();
      const { totalAvailableBalance } = await this.getWalletBalance();
      const positionSizeNumber =
        (totalAvailableBalance * Number(this.leverage) * percentage) /
        assetPrice;
      const positionSize = positionSizeNumber.toFixed(0).toString();
      console.log('percentage: ', percentage);
      console.log('price: ', assetPrice);
      console.log('accountBalnce: ', totalAvailableBalance);
      console.log('Position size: ', positionSize);
      return positionSize;
    } catch (err) {
      console.error('Failed calculating position size: ', err);
      throw err;
    }
  }

  private async setLeverage(): Promise<void> {
    try {
      const response = await this.client.setLeverage({
        category: 'linear',
        symbol: this.symbol,
        buyLeverage: this.leverage,
        sellLeverage: this.leverage,
      });
      console.log('Setleverage response: ', response);
      // return response;
    } catch (err) {
      console.error('Failed setting leverage: ', err);
      throw err;
    }
  }

  public async isInPosition(): Promise<number> {
    try {
      const response = await this.client.getPositionInfo({
        category: this.category,
        symbol: this.symbol, //change this when use!!!@@@@
      });
      console.log('openorder: ', response.result.list);
      // console.log('OPEN ORDER: ', response.result.list.length);
      return +response.result.list[0].size;
    } catch (err) {
      console.error('Failed getting open order: ', err);
      throw err;
    }
  }

  public async getAllOpenPosition(): Promise<unknown> {
    try {
      const response = await this.client.getPositionInfo({
        category: this.category,
        settleCoin: 'USDT',
      });
      console.log('checking all positions');
      return response.result.list;
    } catch (err) {
      console.log('Error getting all open positions: ', err);
      throw err;
    }
  }

  public async getSpecificPosition(): Promise<SpecificCoin> {
    try {
      const response = await this.client.getPositionInfo({
        category: this.category,
        symbol: this.symbol,
      });
      console.log('specific coin: ', response.result.list);
      const data = {
        entryPrice: response.result.list[0].avgPrice,
        size: response.result.list[0].size,
      };
      return data;
    } catch (err) {
      console.error('Failed getting specific coin info: ', err);
      throw err;
    }
  }

  // public async getPricePercentage(time: number): Promise<void> {
  //   try {
  //     // const time = Date.now();
  //     const response = await this.client.getKline({
  //       category: 'linear',
  //       symbol: 'BTCUSDT',
  //       interval: '1',
  //       start: time,
  //     });
  //     console.log(Date.now());
  //     console.log('price data: ', response.result.list);
  //   } catch (err) {
  //     console.error('Error getting price data: ', err);
  //   }
  // }

  public async getTradeResult(
    time: number,
  ): Promise<
    APIResponseV3WithTime<CategoryCursorListV5<ClosedPnLV5[], CategoryV5>>
  > {
    try {
      console.log('thissss: ', this.symbol, '|', time);
      const response = await this.client.getClosedPnL({
        category: this.category,
        symbol: this.symbol,
        startTime: time,
        limit: 1,
      });
      console.log('gettraderesult: ', response.result.list);
      return response;
    } catch (err) {
      console.log('Error getting trade result: ', err);
      throw err;
    }
  }

  public async closeOrder(side: string, size?: string): Promise<ResponseBybit> {
    const sideDirection = side === 'Buy' ? 'Sell' : 'Buy';
    try {
      const response = await this.client.submitOrder({
        category: this.category,
        symbol: this.symbol,
        side: sideDirection,
        orderType: 'Market',
        qty: size ? (+size / 2).toString() : '0',
        reduceOnly: true,
        timeInForce: this.timeInForce,
      });
      console.log('Close order response: ', response);
      this.getTradeResult(response.time);
      return response;
    } catch (err) {
      console.error('Error closing order: ', err);
      throw err;
    }
  }

  public async getInstrumentInfo(ticker: string): Promise<number> {
    try {
      const response = await this.client.getInstrumentsInfo({
        category: this.category,
        symbol: ticker,
      });
      console.log('getinstrumentinfolog: ', response, 'ticker: ', ticker);
      return response.retCode;
    } catch (err) {
      console.log('Error checking instrument: ', err);
      throw err;
    }
  }

  public async submitOrder(
    side: string,
    percentage: number,
    chatgpt: boolean,
  ): Promise<SubmitOrder> {
    const orderLinkId = crypto.randomBytes(16).toString('hex');
    const direction = side === 'Buy' ? 'Buy' : 'Sell';
    try {
      const checkInstrument = await this.getInstrumentInfo(this.symbol);
      if (checkInstrument !== 0) return null;

      await this.setLeverage();
      this.quantity = await this.calculatePositionSize(percentage);

      if (chatgpt) {
        this.inPosition = await this.isInPosition();
        console.log('this.inposition: ', this.inPosition);
        if (this.inPosition && this.inPosition !== 0) return null;
        this.price = await this.getAssetPrice();
        if (side === 'Buy') {
          this.tp = (this.price * 0.005 + this.price).toString();
          this.sl = (this.price - this.price * 0.02).toString();
        } else {
          this.tp = (this.price - this.price * 0.005).toString();
          this.sl = (this.price + this.price * 0.02).toString();
        }
      }

      const response = await this.client.submitOrder({
        category: this.category,
        symbol: this.symbol,
        side: direction,
        orderType: this.orderType,
        qty: this.quantity,
        // price: this.price.toString(),
        timeInForce: this.timeInForce,
        orderLinkId: `${orderLinkId}`,
        takeProfit: `${this.tp}`,
        stopLoss: `${this.sl}`,
      });

      console.log('Submit order response: ', response);
      return response;
    } catch (err) {
      console.error('Failed submitting order: ', err);
      throw err;
    }
  }
}

export default BybitTrading;
