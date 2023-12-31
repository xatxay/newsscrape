import BybitTrading from './bybit.js';
import { BybitPrice, FrontEndWebsocket } from './getPrice.js';
import { OpenAiAnalyze } from './chatgpt.js';
import KlineClient from './klineClient.js';

export const bybitAccount = new BybitTrading();
export const bybitWsClient = new BybitPrice();
export const openAiClass = new OpenAiAnalyze();
export const klineWs = new KlineClient();
export const dataFrontEnd = new FrontEndWebsocket();
