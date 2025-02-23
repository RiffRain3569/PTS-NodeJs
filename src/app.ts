import { testCron, tradingStrategy1 } from '@/cron';
import bithumbRouter from '@/routes/bithumb';
import express, { Request, Response } from 'express';
import figlet from 'figlet';

import dotenv from 'dotenv';
import { HOST, PORT } from './config/info';

dotenv.config();

const app = express();
const port = process.env.PORT || 3030;
console.log(process.env.HOST, process.env.PORT, HOST, PORT);

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
