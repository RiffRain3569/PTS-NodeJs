# PTS-NodeJs Project Context & Rules

이 문서는 `PTS-NodeJs` 프로젝트의 전반적인 아키텍처, 사용 기술, 그리고 도메인 특화 규칙들을 정의합니다. AI 어시스턴트는 코드를 작성하거나 수정할 때 반드시 이 문서와 기타 전역 규칙(`code-style-guide.md`, `nest-js.md`)을 참고해야 합니다.

## 1. Tech Stack (기술 스택)
- **Runtime & Language**: Node.js, TypeScript
- **Framework**: NestJS (Express 기반)
- **Scheduling**: `@nestjs/schedule`, `node-cron`
- **Database**: MySQL (using `mysql2`)
- **External Apis**: `axios`
- **Notifications**: Telegram Bot API (`node-telegram-bot-api`)

## 2. Directory Structure (폴더 구조)
프로젝트는 크게 3가지 주요 영역으로 나뉩니다.

### `src/modules/`
비즈니스 로직을 담당하는 도메인 모듈들이 위치합니다.
- `order`: 주문 실행 로직 (Upbit, Bithumb, Bitget 등)
- `market`: 시세 조회 및 시장 데이터 처리
- `notification`: 알림 발송 로직 (Telegram 등)
- `database`: DB 연결 및 엔티티/리포지토리

**규칙**: Controller는 라우팅만 담당하며 매우 얇게 유지(Thin Controller)하고, 모든 비즈니스 로직은 Service에 작성합니다.

### `src/common/`
프로젝트 전반에서 공통으로 사용되는 기능들이 위치합니다.
- `apis`: 외부 거래소 API 통신 모듈 (`upbit.api.ts`, `bithumb.api.ts`, `bitget.api.ts`)
- `utils`: 포맷팅, 시간 계산 등 공통 유틸리티 (`date.utils.ts` 등)
- `config`: 환경 변수 및 설정 관리
- `middlewares`: 공통 미들웨어 로직

### `src/jobs/`
주기적으로 실행되는 Cron Job 스크립트들이 위치합니다. (`@nestjs/schedule` 또는 `node-cron` 활용)
- `strategy.job.ts`: 트레이딩 전략 실행 (가장 핵심적인 로직 포함)
- `market-monitor.job.ts`, `market-recorder.job.ts`: 시장 모니터링 및 데이터 기록

## 3. Domain-Specific Rules (도메인 특화 규칙)

### 3.1. Timezone (KST 필수)
- **극도로 중요**: 이 서버의 기준 시간은 무조건 **KST (한국 표준시, UTC+9)** 입니다.
- 시간 계산에 오차가 발생하면 트레이딩과 데이터 기록에 치명적입니다.
- 외부 API와 통신할 때 Timestamp 변환이 필요하다면 반드시 `src/common/utils/date.utils.ts`의 `kstToUtcTimestamp` 등의 유틸리티를 활용하거나, 명시적으로 KST 기준임을 고려하여 코드를 작성해야 합니다.

### 3.2. Crypto Exchanges (가상자산 거래소 연동)
- 주로 **Upbit, Bithumb, Bitget** 세 곳의 거래소를 다룹니다.
- `src/common/apis/` 내의 파일들은 순수 API 요청(Request/Response)을 담당합니다.
- `src/modules/order/providers/` 에 위치한 클래스들이 실제 주문 전략과 결합된 비즈니스 로직(예: 분할 매수, 지정가/시장가 매도, 슬리피지 계산 등)을 처리합니다.
- 각 거래소마다 최소 주문 금액, 수량 단위(Decimal), 수수료 정책이 다르므로 주문 로직 수정 시 방어적 코딩과 검증(Validation)을 반드시 수행합니다.

### 3.3. Job Execution & Concurrency (스케줄링 및 동시성)
- `.job.ts` 파일(예: `holdHour`, 주기적 매수/매도 로직 등) 수정 시, 비동기 호출 간의 **Race Condition(경합 조건)**이나 주문 지연(Latency)으로 인한 "Not held", "Balance exceeded" 에러가 발생하지 않도록 순차적 실행 및 예외 처리(Fallback) 로직을 포함해야 합니다.

## 4. General Workflow
- **코드 작성 언어**: 모든 주석, 리드미, 문서, 커밋 메시지는 **한국어(ko-KR)**로 작성합니다.
- **방어적 프로그래밍**: 외부 API 응답을 전적으로 신뢰하지 않고, 항상 예외 상황(Network Error, Rate Limit, Invalid Data)을 대비하는 Error Handling 구문을 추가합니다.
