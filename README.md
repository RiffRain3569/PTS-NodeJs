# Project Trading Strategy (PTS-NodeJs)

## 📌 프로젝트 소개 (Project Summary)

본 프로젝트는 **NestJS** 기반의 암호화폐 자동 매매 및 시장 모니터링 시스템입니다. 주로 빗썸(Bithumb), 비트겟(Bitget), 업비트(Upbit) 거래소를 지원하며, 정해진 전략에 따라 자동 매매를 수행하고 텔레그램을 통하여 상태 알림을 전송하는 등의 백그라운드 작업을 관리합니다.

### 목적

- 거래소 API를 사용하여 특정 시간대 매매 전략 테스트 및 백그라운드 자동화 실행.

### 주요 기능 (Key Features)

- **자동매매 전략 실행 (Cron Jobs)**
    - 특정 시간마다 파칭이 나온 상위 코인을 감지하고 매수/진입한 후, 일정 시간 뒤 매도/종료하는 스케줄링 전략 지원 (`holdHour`).
    - 매시간 단위로 시장 상황을 기록(Market Recorder)하고 매매 성과를 계산(Calculate Trade Result).
- **시장 모니터링 및 알림 (Notification)**
    - 주기적으로 거래소별 거래대금 상위(Top 5) 종목을 모니터링하여 메신저(Telegram) 푸시 알림 전송.
- **포지션 상태 관리 및 데이터 추출 (Export)**
    - 단기 거래 성과(ROI) 시뮬레이션 데이터를 시간, 거래소, 포지션(롱/숏) 조건에 맞추어 엑셀 파일로 추출하는 리포팅 기능 포함.
- **수동 및 외부 시그널 제어 (REST API)**
    - 직접적인 지정가 예약 매수/매도, 웹훅 기반의 Bitget 시그널 연동 등 제어 목적의 외부 REST API 제공.

---

## 🚀 API 명세 (API References)

### 📈 Market API (시장 데이터 및 전략)

- **`GET /market/bithumb/top5`**
    - 빗썸(Bithumb) 거래소의 거래대금 최상위 5개 종목 데이터를 조회합니다.
- **`GET /market/bitget/top5`**
    - 비트겟(Bitget) 거래소의 거래대금 최상위 5개 종목 데이터를 조회합니다.
- **`POST /market/job/run`**
    - 개별 종목에 대하여 매매 결과(수익률, 손익) 계산 작업을 즉시 수동 실행합니다.
    - **Body**: `{ "exchange": string, "symbol": string, "base_time": string, "holding_minutes": number, "side": string }`

### 📊 Market Export API (결과 데이터 추출)

- **`GET /market/export/page`**
    - 브라우저 환경에서 엑셀 형식의 다운로드 설정을 간편히 제어할 수 있는 HTML UI 페이지를 응답으로 제공합니다.
- **`GET /market/export/:exchange/top`**
    - 파라미터 조건에 따라 필터링된 과거 거래 결과를 엑셀(`.xlsx`) 파일 형태로 생성 후 다운로드합니다.
    - **Query Params**: `startDate`, `endDate`, `timezone`, `topN`, `targetHours`, `position` (LONG/SHORT/ALL) 등.

### 🛒 Order API (주문 제어)

- **`POST /order/bithumb/bid/top/:num`**
    - 빗썸 거래소의 거래대금 상위 `:num` 개의 종목을 파악하여 매수(Bid)를 실행합니다.
- **`POST /order/bithumb/bid/top5`**
    - 빗썸 거래소의 거래대금 상위 5개의 코인을 일괄 매수(Bid) 처리합니다.
- **`POST /order/bithumb/ask/limit`**
    - 빗썸 거래소에서 목표 퍼센트 수익률(%)에 도달 시 실행되는 지정가 매도(Ask)를 예약합니다.
    - **Body**: `{ "markets": string[], "percent": number }`
- **`POST /order/bithumb/ask`**
    - 보유 중인 특정 시장 종목에 대하여 빗썸 시장가 매도를 즉시 실행합니다.
    - **Body**: `{ "markets": string[] }`
- **`DELETE /order/bithumb`**
    - 빗썸 거래소 내의 대기 중인(미체결 상태) 모든 주문들을 일괄 취소(Delete)합니다.
- **`POST /order/bitget/:blockchainSymbol`**
    - 외부 시그널(예: TradingView Webhook 등)을 수신하여 비트겟(Bitget) 선물 시장의 매매 프로세스(포지션 시작/종료 등)를 제어합니다.
    - **Body**: `{ "message": string }`
