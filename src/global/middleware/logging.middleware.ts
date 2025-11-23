import { v4 as uuidv4 } from 'uuid';
import { asyncLocalStorage, logger } from './logger.middleware';

// UUID 설정 미들웨어
export const uuidMiddleware = (req: any, res: any, next: any) => {
    asyncLocalStorage.run({ uuid: uuidv4() }, () => {
        next();
    });
};

// request, response 로깅 미들웨어
export const entryPointLoggingMiddleware = (req: any, res: any, next: any) => {
    // request logging
    const requestSummary = {
        uri: req.path,
        params: { ...req.params, ...req.body },
    };
    logger.info(`>>> CONTROLLER INPUT: ${JSON.stringify(requestSummary)}`);

    // response logging
    const originalSend = res.send;
    res.send = function (body: any) {
        // 응답 로그 기록
        logger.info(`>>> CONTROLLER OUTPUT: ${body}`);
        // 원래의 send 함수 호출
        return originalSend.apply(this, arguments);
    };

    next();
};
