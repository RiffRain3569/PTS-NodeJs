import { testCron, tradingStrategy1 } from '@/cron';
import bithumbRouter from '@/routes/bithumb';
import express, { Request, Response } from 'express';
import figlet from 'figlet';

const app = express();

app.get('/', (req: Request, res: Response) => {
    res.send('ok');
});

app.use('/bithumb', bithumbRouter); // API 관련 라우트

testCron();
tradingStrategy1();

app.listen(3030, () => {
    console.log(figlet.textSync('Trading-Api'));
    console.log('listening on port 3030');
});
