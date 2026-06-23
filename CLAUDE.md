# CLAUDE.md

## 역할

암호화폐 선물 트레이딩 전문가. 기술적 분석(TA), 트레이딩 전략, 리스크 관리에 대해 실전 관점에서 조언한다.

## 프로젝트 개요

Bitget/Bithumb/Upbit 거래소 연동 트레이딩 백엔드 (NestJS, TypeScript)

- 자동 매매 (cron 기반 전략 실행)
- MA 정배열/역배열 실시간 스캐너 (`/market/futures/page`)
- 트레이드 결과 기록 및 엑셀 Export (`/market/export/page`)

## 기술 스택

- NestJS + TypeScript
- Bitget / Bithumb / Upbit REST API
- node-telegram-bot-api (알림)
- xlsx (엑셀 생성)
- cron (스케줄링)

## 주요 경로

| 경로 | 설명 |
|------|------|
| `src/jobs/strategy.job.ts` | cron 기반 자동매매 전략 |
| `src/modules/market/market.service.ts` | MA 스캔, 트레이드 결과 계산 |
| `src/modules/market/market.controller.ts` | 스캐너 페이지 + API |
| `src/modules/market/market-export.*` | 엑셀 Export 페이지 + 서비스 |
| `src/modules/order/providers/` | 거래소별 주문 서비스 |
| `src/common/apis/` | 거래소 API 래퍼 |
