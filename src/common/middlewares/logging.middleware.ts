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
    // response logging helper
    const logResponse = (body: any, res: any) => {
        if (res.locals.loggingDone) return;
        res.locals.loggingDone = true;

        const contentType = res.get('Content-Type') || res.getHeader('content-type') || '';
        if (contentType && contentType.includes('application/json')) {
            logger.info(`>>> CONTROLLER OUTPUT: ${body}`);
        } else {
            logger.info(`>>> CONTROLLER OUTPUT: Content-Type: ${contentType}`);
        }
    };

    const originalSend = res.send;
    res.send = function (body: any) {
        logResponse(body, res);
        return originalSend.apply(this, arguments);
    };

    const originalEnd = res.end;
    res.end = function (chunk: any, encoding: any) {
        logResponse(chunk, res); // chunk might be buffer or string
        return originalEnd.apply(this, arguments);
    };

    next();
};
