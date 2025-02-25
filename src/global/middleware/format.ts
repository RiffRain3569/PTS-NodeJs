import { failRes, successRes } from '@/global/utils/statusRes';

// 성공, 실패 포맷 설정 미들웨어
export const responseFormatMiddleware = (req: Request, res: any, next: any) => {
    // 응답의 원본 send 함수와 status 함수를 저장합니다.
    const originalSend = res.send;

    // 응답을 포맷하여 보내는 함수
    res.send = function (body: any) {
        let formattedBody;

        try {
            formattedBody = typeof body === 'string' ? JSON.parse(body) : body;
        } catch {
            // response body 가 json 이 아닌 경우 format error
            return originalSend.call(this, JSON.stringify(failRes('response data is not json format')));
        }

        formattedBody = res.statusCode >= 400 ? failRes(formattedBody) : successRes(formattedBody);

        if (res.statusCode >= 500) {
            // 500 이상 에러메시지는 client 에서 처리하기 쉽도록 성공 코드로 변환한다.
            res.status(200);
        }
        // 원본 send 함수를 호출하여 응답을 보냅니다.
        return originalSend.call(this, JSON.stringify(formattedBody));
    };

    next();
};
