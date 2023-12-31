import NewScraper from './newScrape/newScrape.js';
import { Binance, Upbit } from './newScrape/exchange.js';
import { ExchangeHeader, ExchangeParams, Proxy } from './interface.js';
import convertProxiesToString from './proxy/proxies.js';
import startServer from './newScrape/server.js';
import dotenv from 'dotenv';

dotenv.config();

const main = async (): Promise<void> => {
  const allProxies: Proxy[] = convertProxiesToString();

  // TODO: remove create database scripts (done)
  // TODO: refactor database scripts into node scripts to run on ec2 machines (done)
  // TODO: create '/create-user' endpoint that takes in email and password and creates a new user in the 'login' table for the db (done)
  // TODO: set up bybit to handle multiple user credentials (done)
  // TODO: create bybit api integration for other users (done)
  // const handleUser = async (): Promise<void> => {
  //   const account = {
  //     username: process.env.USERNAMELOGIN,
  //     password: process.env.PASSWORD,
  //   };
  // await createDb('loginTable.sql');
  // await createDb('tradeAnalyze.sql');
  //   await createUser(account.username, account.password);
  // };

  const routesHandling = (): void => {
    startServer();
  };

  const upbitScrape = async (): Promise<void> => {
    try {
      const upbitUrl: string = process.env.UPBIT;
      const upbitParams: ExchangeParams = {
          search: process.env.UPBITSEARCH,
          page: 1,
          per_page: 1,
        },
        upbitHeader: ExchangeHeader = {
          'accept-language': 'en-KR, en;q=1, en;q=0.1',
        };
      const upbit = new Upbit(upbitUrl, upbitParams, upbitHeader, allProxies),
        upbitListing = await upbit.getListing(),
        timeStampt = upbitListing.list[0].created_at,
        listingLink = `https://upbit.com/service_center/notice?id=${upbitListing.list[0].id}`,
        regex = /\[Trade\] New digital asset on KRW Market \(([^)]+)\)/;

      const ticker = upbit.getTicker(upbitListing.list[0].title, regex),
        tickerPair = `${ticker}USDT`;

      console.log('@@@@@: ', tickerPair);
      // const bybitSubmit = new BybitTrading(tickerPair);
      // await bybitSubmit.submitOrder('Buy', 0.01);

      console.log(
        `Upbit Listing: ${upbitListing.list[0].title}\nTimestampt: ${timeStampt}\nLink: ${listingLink}\n------\n`,
      );
    } catch (err) {
      console.error('Failed getting upbit listing: ', err);
    }
  };

  const binanceScrape = async (): Promise<void> => {
    try {
      const binanceUrl = process.env.BINANCEURL;
      const binanceParams: ExchangeParams = {
          catalogId: 48,
          pageNo: 1,
          pageSize: 1,
        },
        time = new Date(Date.now()),
        announcementTime = time.toISOString();
      const binance = new Binance(binanceUrl, binanceParams, allProxies),
        binanceListing = await binance.getListing(),
        textFormat = binanceListing.articles[0].title
          .toLowerCase()
          .replaceAll(' ', '-'),
        listingLink = `https://www.binance.com/en/support/announcement/${textFormat}-${binanceListing.articles[0].code}`,
        binanceAnnouncementListing = binanceListing.articles[0].title;
      // const analyzer = new OpenAiAnalyze(binanceAnnouncementListing),
      //   response = await analyzer.callOpenAi();

      // const companyAndSentiment: TickerAndSentiment[] = extractString(response);

      // for (const sentiment of companyAndSentiment) {
      //   if (sentiment.sentiment >= 75 || sentiment.sentiment <= 75) {
      //     const side = sentiment.sentiment >= 75 ? 'Buy' : 'Sell';
      //     const bybitSubmit = new BybitTrading(sentiment.ticker);
      //     await bybitSubmit.submitOrder(side, 0.001);
      //   }
      // }

      // console.log('sentiment score: ', companyAndSentiment);
      console.log(
        `Binance Listing: ${binanceAnnouncementListing}\nTimestampt: ${announcementTime}\nLink: ${listingLink}\n------\n`,
      );
    } catch (err) {
      console.log('Failed getting binance listing: ', err);
    }
  };

  const secScrape = async (): Promise<void> => {
    try {
      const secUrl = process.env.SECURL;
      const feed = new NewScraper(secUrl),
        pressreleases = await feed.fetchRssPage(),
        title = pressreleases[0].title,
        link = pressreleases[0].link,
        contentSnippet = pressreleases[0].contentSnippet,
        date = pressreleases[0].isoDate;

      // const analyzer = new OpenAiAnalyze();
      // const response = await analyzer.callOpenAi(title);
      // const TickerAndSentiment = extractString(response);
      // console.log('SEC analyze: ', TickerAndSentiment);

      console.log(
        `pressreleases: ${title}\nContent snippet: ${contentSnippet}\nLink: ${link}\nTimestampt: ${date}\n------\n`,
      );
    } catch (err) {
      console.error('Error fetching SEC rss data: ', err);
    }
  };

  setInterval(
    async () =>
      await Promise.all([upbitScrape(), binanceScrape(), secScrape()]),
    500000000,
  ); //or use node-cron
  routesHandling();
};

main();
