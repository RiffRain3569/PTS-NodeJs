import { envMiddleware } from './global/middleware/env';
envMiddleware();

import { notiCron, tradingStrategy1 } from '@/cron';
import { PORT } from '@/global/config/info';
import bithumbRouter from '@/routes/bithumb';
import express, { Request, Response } from 'express';
import figlet from 'figlet';
import { entryPointLoggingMiddleware, uuidMiddleware } from './global/middleware/logging';

const app = express();
const port = PORT || 3030;

// JSON 요청을 처리하기 위한 미들웨어
app.use(express.json());

// URL-encoded 요청을 처리하기 위한 미들웨어 (form data 지원)
app.use(express.urlencoded({ extended: true }));

app.use(uuidMiddleware); // UUID 설정 미들웨어
app.use(entryPointLoggingMiddleware); // route start log 미들웨어
// app.use(responseFormatMiddleware); // success, fail 포맷 설정

// testCron();
notiCron();
tradingStrategy1();

app.get('/', (req: Request, res: Response) => {
    console.log(req.body);
    res.send('ok');
});

app.use('/bithumb', bithumbRouter); // API 관련 라우트

app.listen(port, () => {
    console.log(figlet.textSync('PTS'));
    console.log(`Server listening on port ${port}`);
});
