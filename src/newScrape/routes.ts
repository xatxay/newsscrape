import { NextFunction, Request, Response } from 'express';
import { Decoded } from '../interface.js';
import BybitTrading from './bybit.js';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import {
  appEmit,
  closeAllButton,
  closeButton,
  startButton,
  stopButton,
  submitNewsOrder,
} from './utils.js';
import { selectUser } from '../tradeData/tradeAnalyzeUtils.js';
import {
  createUser,
  checkExistingUser,
  updateApi,
  checkUserSubmitApi,
  updateOpenAi,
  checkUserSubmitOpenAiApi,
  selectApiWithId,
  // selectOpenAiWithId,
} from '../login/userDatabase.js';
import { BybitPrice } from './getPrice.js';
// import BybitClient from './bybitClient.js';
// import BybitClient from './bybitClient.js';
// import { OpenAiClient } from './chatgpt.js';

export const bybitAccount = new BybitTrading();

class AccountInfo {
  // private bybitClient = BybitClient.getInstance();
  private bybitWsClient = new BybitPrice();
  // private openAiUpdate = new OpenAiClient();

  public authenticateToken(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ message: 'Access Denied: No Token Provided' });
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
      console.log('decoded: ', decoded);
      req.user = decoded as Decoded;
      appEmit.emit('authRequest', decoded);
      next();
    } catch (err) {
      res.status(401).json({ message: 'Invalid Token' });
    }
  }

  public async accountSummaryHandler(
    _req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const data = await bybitAccount.getWalletBalance();
      res.json(data);
    } catch (err) {
      res.status(500).send(err.message);
      console.error('Erro handling account summary: ', err);
    }
  }

  public async openPositionHandler(
    _req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const data = await bybitAccount.getAllOpenPosition();
      res.json(data);
    } catch (err) {
      res.status(500).send(err.message);
    }
  }

  public async startButtonHandler(req: Request, res: Response): Promise<void> {
    try {
      startButton(); //log for now
      res.send({ message: 'starting...' });
      console.log('req: ', req.user);
    } catch (err) {
      res.status(500).send(err.message);
    }
  }

  public async stopButtonHandler(req: Request, res: Response): Promise<void> {
    try {
      stopButton(); //log for now
      res.send({ message: 'stopping...' });
      console.log('req: ', req.user);
    } catch (err) {
      res.status(500).send(err.message);
    }
  }

  public async closeAllButtonHandler(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      closeAllButton(); //log for now
      res.send({ message: 'closing all...' });
      console.log('req: ', req.user);
    } catch (err) {
      res.status(500).send(err.message);
    }
  }

  public async closeButtonHandler(req: Request, res: Response): Promise<void> {
    try {
      console.log('reqbody: ', req.body);
      const { side, symbol } = req.body;
      const response = await closeButton(symbol, side);
      response.retCode === 0
        ? res.send({ message: `closing ${symbol}` })
        : res.send({ message: `Error closing: ${response.retMsg}` });
    } catch (err) {
      res.status(500).send(err.message);
    }
  }

  public async submitOrderHandler(req: Request, res: Response): Promise<void> {
    try {
      console.log('reqbody: ', req.body);
      const { side, symbol, positionSize } = req.body;
      await submitNewsOrder(symbol, side, positionSize);
      res.send({ message: `${side} ${symbol} ${positionSize}` });
    } catch (err) {
      res.status(500).send(err.message);
    }
  }

  public logoutHandler(req: Request, res: Response): void {
    req.session.destroy((err) => {
      err
        ? res.status(500).send(err.message)
        : res.send('Logged out successfully');
    });
  }

  public async loginHandler(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      console.log('Login: ', email, password);
      const user = await selectUser(email);
      console.log('user: ', user);
      if (!user) {
        res.status(400).json({ message: 'Invalid email' });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        res.status(400).json({ message: 'Invalid password' });
        return;
      }

      const payload = { userId: user.id };
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
      });
      res.json({ token });
      appEmit.emit('authRequest', {
        apiKey: user.apikey,
        apiSecret: user.apisecret,
      });
    } catch (err) {
      res.status(500).send('Server Error');
    }
  }

  public async createAccountHandler(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await checkExistingUser(email);
      if (result > 0) {
        res.status(400).json({ message: 'User already exists' });
        return;
      }
      console.log('New user: ', email, password);
      await createUser(email, password);
      res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
      res.status(500).json({ message: 'Error creating user ', err });
    }
  }

  public async submitApiHandler(req: Request, res: Response): Promise<void> {
    try {
      const { email, apiKey, apiSecret } = req.body;
      console.log('api handler: ', email, apiKey, apiSecret);
      const response = await updateApi(email, apiKey, apiSecret);
      if (response === 0) {
        res.status(400).json({ message: 'Error saving api keys' });
      } else {
        res.status(201).json({ message: 'Updated api successful!' });
      }
      appEmit.emit('bybitApi', { email, apiKey, apiSecret });
    } catch (err) {
      res.status(500).json({ message: 'Error saving api key: ', err });
      console.error('Error submitting api key: ', err);
    }
  }

  public async checkSubmittedApi(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      console.log('check email: ', email);
      const response = await checkUserSubmitApi(email);
      console.log('checked: ', response);
      if (response && response.apikey && response.apisecret) {
        console.log('checking');
        res.json({ apiKey: response.apikey, apiSecret: response.apisecret });
      } else {
        res.status(400).json({ message: 'User has not submitted API key' });
      }
    } catch (err) {
      res.status(500).json({ message: 'Error checking user api' });
      console.error('Error check submitted user api: ', err);
    }
  }

  public async submitOpenAiHandler(req: Request, res: Response): Promise<void> {
    try {
      const { email, openAiApi } = req.body;
      console.log('openai update: ', email, openAiApi);
      const response = await updateOpenAi(email, openAiApi);
      if (response && response > 0) {
        res.status(201).json({ message: 'Updated openai api successful!' });
      } else {
        res.status(400).json({ message: 'Error saving openai api key' });
      }
    } catch (err) {
      res.status(500).json({ message: 'Error saving openai api' });
      console.error('Failed saving openai api: ', err);
    }
  }

  public async checkSubmittedOpenAi(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const { email } = req.body;
      const response = await checkUserSubmitOpenAiApi(email);
      if (response && response.openai) {
        res.json({ openAi: response.openai });
      } else {
        res.status(400).json({ message: 'User has not submitted openAi api' });
      }
    } catch (err) {
      res.status(500).json({ message: 'No openai api available' });
      console.error('Failed checking existing openAi api: ', err);
    }
  }

  public async clientInit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) return;
      const userId = req.user.userId;
      // console.log('userid: ', userId);
      const response = await selectApiWithId(userId);
      // console.log('id api response: ', response);
      bybitAccount.updateApi(response.apikey, response.apisecret);
      this.bybitWsClient.updateWsApi(response.apikey, response.apisecret);
      if (!this.bybitWsClient.isWsInitialized()) {
        this.bybitWsClient.initializeWebsocket();
        this.bybitWsClient.subscribePositions();
      }
      next();
    } catch (err) {
      res.status(500).json({ message: err });
      console.error('Error initialize clients: ', err);
    }
  }

  // public submitPositionSize() {
  //
  //     try {
  //       const { email, firstPositionSize, secondPositionSize } = req.body;
  //     } catch (err) {
  //       res.status(500).json({ message: 'Error submitting position size' });
  //       console.error('Failed submitting position size: ', err);
  //     }
  //
  // }
}

export { AccountInfo };
