import { logger } from '@/global/middleware/logger.middleware';

// 경로 에러 핸들링
export const pathErrorMiddleware = (req: any, res: any, next: any) => {
    res.status(404).send('404 Not Found');
};

// throw 에러 핸들링
export const finalErrorMiddleware = (error: any, req: any, res: any, next: any) => {
    if (error.status >= 500 || !error.status) {
        logger.error(error.stack);
    }
    if (error.status >= 400 && error.status < 500) {
        logger.error(`error: ${error.status} ${error.message}`);
    }
    res.status(error.status || 500).json(error.message);
};
