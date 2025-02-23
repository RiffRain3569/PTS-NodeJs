import express, { Request, Response } from 'express';
const app = express();

app.get('/', (req: Request, res: Response) => {
    res.send('Hello World!');
});

app.listen(3030, () => {
    console.log(`타입스크립트 서버 시작`);
});
