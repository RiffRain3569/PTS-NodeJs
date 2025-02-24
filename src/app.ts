import { envMiddleware } from './middleware/env';
envMiddleware();

import { testCron, tradingStrategy1 } from '@/cron';
import bithumbRouter from '@/routes/bithumb';
import express, { Request, Response } from 'express';
import figlet from 'figlet';
import { PORT } from './config/info';

const app = express();
const port = PORT || 3030;

app.get('/', (req: Request, res: Response) => {
    res.send('ok');
});

app.use('/bithumb', bithumbRouter); // API 관련 라우트

testCron();
tradingStrategy1();

app.listen(port, () => {
    console.log(figlet.textSync('Trading-Api'));
    console.log(`Server listening on port ${port}`);
});
