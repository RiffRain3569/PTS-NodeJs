import { AsyncLocalStorage } from 'async_hooks';
import winston from 'winston';

// AsyncLocalStorage 인스턴스를 생성합니다.
export const asyncLocalStorage = new AsyncLocalStorage<any>();

// UUID를 포함시키기 위한 커스텀 포맷 정의
const uuidFormat = winston.format((info: any) => {
    const store = asyncLocalStorage.getStore();
    if (store && store.uuid) {
        info.uuid = store.uuid; // 저장된 UUID 사용
    } else {
        info.uuid = 'N/A'; // UUID가 없을 경우 기본 값 설정
    }
    return info;
});

// 로거 설정
export const logger = winston.createLogger({
    level: 'info', // 로그 레벨 설정
    format: winston.format.combine(
        uuidFormat(), // UUID 포맷 추가
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // 타임스탬프 추가
        winston.format.printf((info) => `${info.timestamp} [${info.uuid}] ${info.level.toUpperCase()}: ${info.message}`) // 로그 포맷 정의
    ),
    transports: [
        new winston.transports.Console(), // 콘솔로 로그 출력
        // 필요에 따라 파일로 로그를 남길 수 있습니다:
        // new winston.transports.File({ filename: 'logfile.log' })
    ],
});
