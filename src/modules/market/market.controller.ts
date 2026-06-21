import { BadRequestException, Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { MarketService } from './market.service';

@Controller('market')
export class MarketController {
    constructor(private readonly marketService: MarketService) {}

    @Get('bithumb/top5')
    async getTop5(@Res() res: Response) {
        try {
            const data = await this.marketService.getTop5Markets();
            res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    @Get('bitget/top5')
    async getBitgetTop5(@Res() res: Response) {
        try {
            const data = await this.marketService.getBitgetTop5Markets();
            res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    @Get('futures/scan')
    async scanMaAlignment(@Query() query: any, @Res() res: Response) {
        try {
            const minVolume = query.minVolume ? parseFloat(query.minVolume) : 5_000_000;
            const granularity = ['1m', '5m', '15m'].includes(query.granularity) ? query.granularity : '1m';
            const maxLever = query.maxLever ? parseInt(query.maxLever, 10) : 0;
            const data = await this.marketService.scanMaAlignmentAll(minVolume, granularity, maxLever);
            res.json({ count: data.length, scanned_at: new Date().toISOString(), granularity, data });
        } catch (error: any) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal Server Error' });
        }
    }

    @Get('futures/page')
    getFuturesPage(@Res() res: Response) {
        const html = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MA 정배열 스캐너</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #1e1b1e;
            color: #eee;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 {
            font-size: 22px;
            color: #fff;
            border-bottom: 2px solid #8a1c1c;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .controls {
            display: flex;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
            margin-bottom: 24px;
            background: #2a252a;
            padding: 16px;
            border-radius: 8px;
            border: 1px solid #443c44;
        }
        .controls label { font-size: 13px; color: #aaa; margin-right: 4px; }
        select, input[type=number] {
            padding: 8px 10px;
            background: #332f33;
            border: 1px solid #555;
            border-radius: 4px;
            color: #fff;
            font-size: 14px;
        }
        select:focus, input:focus { outline: none; border-color: #a51d2d; }
        button {
            padding: 8px 20px;
            background: #a51d2d;
            color: #fff;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s;
        }
        button:hover:not(:disabled) { background: #c52233; }
        button:disabled { background: #555; cursor: not-allowed; }
        .status { font-size: 13px; color: #aaa; margin-left: auto; }
        .status.scanning { color: #f0a500; }
        .status.done { color: #4caf50; }

        .sections { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 900px) { .sections { grid-template-columns: 1fr; } }

        .section {
            background: #2a252a;
            border: 1px solid #443c44;
            border-radius: 8px;
            overflow: hidden;
        }
        .section-header {
            padding: 10px 14px;
            font-size: 13px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px solid #443c44;
        }
        .section-header.long { background: #1b3a1b; color: #4caf50; border-left: 4px solid #4caf50; }
        .section-header.short { background: #3a1b1b; color: #ef5350; border-left: 4px solid #ef5350; }
        .section-header .count {
            margin-left: auto;
            background: #00000044;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
        }

        .section table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .section th {
            background: #1e1b1e;
            color: #999;
            padding: 6px 10px;
            text-align: right;
            white-space: nowrap;
            font-size: 11px;
        }
        .section th:first-child { text-align: left; }
        .section td {
            padding: 7px 10px;
            border-bottom: 1px solid #2e2b2e;
            text-align: right;
            white-space: nowrap;
        }
        .section td:first-child { text-align: left; }
        .section tr:hover td { background: #332f33; }

        .symbol-link { font-weight: 700; color: #fff; text-decoration: none; }
        .symbol-link:hover { color: #e07070; }
        .change-pos { color: #4caf50; }
        .change-neg { color: #ef5350; }
        .duration-badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 8px;
            font-size: 10px;
            font-weight: 700;
        }
        .dur-fresh { background: #4caf5033; color: #81c784; }
        .dur-mid { background: #ff980033; color: #ffb74d; }
        .dur-old { background: #ef535033; color: #ef9a9a; }
        .empty-section { padding: 20px; text-align: center; color: #555; font-size: 13px; }
    </style>
</head>
<body>
<div class="container">
    <h1>MA 정배열/역배열 스캐너 <span style="font-size:13px;color:#888;font-weight:400">Bitget USDT-FUTURES · 1m · MA30/60/90/120</span></h1>

    <div class="controls">
        <div>
            <label>캔들 기준</label>
            <select id="granularity">
                <option value="1m" selected>1분봉</option>
                <option value="5m">5분봉</option>
                <option value="15m">15분봉</option>
            </select>
        </div>
        <div>
            <label>최대 레버리지</label>
            <select id="maxLever">
                <option value="0">전체</option>
                <option value="20" selected>x20 이하</option>
                <option value="25">x25 이하</option>
                <option value="50">x50 이하</option>
            </select>
        </div>
        <div>
            <label>최소 거래량 (USDT)</label>
            <input type="number" id="minVolume" value="5000000" step="1000000" min="0" style="width:140px">
        </div>
        <button id="scanBtn" onclick="startScan()">스캔 시작</button>
        <button id="alertBtn" onclick="toggleAlert()">알림 시작</button>
        <span class="status" id="status">대기 중</span>
    </div>

    <div class="sections" id="sections">
        <div class="empty-section" style="grid-column:1/-1;background:#2a252a;border-radius:8px;padding:40px;">
            스캔 버튼을 눌러 시작하세요
        </div>
    </div>
</div>

<script>
const SECTIONS = [
    { position: 'LONG', label: 'LONG 정배열', durLabel: '15분 이내', min: 0, max: 15 },
    { position: 'SHORT', label: 'SHORT 역배열', durLabel: '15분 이내', min: 0, max: 15 },
    { position: 'LONG', label: 'LONG 정배열', durLabel: '15분 초과', min: 16, max: 9999 },
    { position: 'SHORT', label: 'SHORT 역배열', durLabel: '15분 초과', min: 16, max: 9999 },
];

async function startScan() {
    const btn = document.getElementById('scanBtn');
    const statusEl = document.getElementById('status');
    const minVolume = document.getElementById('minVolume').value || 5000000;

    const granularity = document.getElementById('granularity').value;

    btn.disabled = true;
    statusEl.className = 'status scanning';
    statusEl.textContent = '스캔 중... (10~30초 소요)';
    document.getElementById('sections').innerHTML =
        '<div class="empty-section" style="grid-column:1/-1;background:#2a252a;border-radius:8px;padding:40px;">스캔 중입니다...</div>';

    try {
        const maxLever = document.getElementById('maxLever').value;
        const res = await fetch('/market/futures/scan?minVolume=' + minVolume + '&granularity=' + granularity + '&maxLever=' + maxLever);
        const json = await res.json();
        if (json.error) throw new Error(json.error);

        const data = json.data || [];
        const scannedAt = new Date(json.scanned_at).toLocaleTimeString('ko-KR');
        statusEl.className = 'status done';
        statusEl.textContent = scannedAt + ' 기준 · 총 ' + data.length + '개 발견';

        renderSections(data);
    } catch (e) {
        statusEl.className = 'status';
        statusEl.textContent = '오류: ' + e.message;
        document.getElementById('sections').innerHTML =
            '<div class="empty-section" style="grid-column:1/-1;background:#2a252a;border-radius:8px;padding:40px;color:#ef5350">스캔 실패: ' + e.message + '</div>';
    } finally {
        btn.disabled = false;
    }
}

function renderSections(data) {
    const container = document.getElementById('sections');
    container.innerHTML = SECTIONS.map((sec, idx) => {
        const items = data.filter(d =>
            d.position === sec.position &&
            d.duration_min >= sec.min &&
            d.duration_min <= sec.max
        ).sort((a, b) => a.duration_min - b.duration_min);

        const posClass = sec.position === 'LONG' ? 'long' : 'short';
        const headerHtml = '<div class="section-header ' + posClass + '">' +
            '<span>' + sec.label + '</span>' +
            '<span style="color:#ccc;font-weight:400">' + sec.durLabel + '</span>' +
            '<span class="count">' + items.length + '개</span></div>';

        let bodyHtml;
        if (items.length === 0) {
            bodyHtml = '<div class="empty-section">해당 없음</div>';
        } else {
            bodyHtml = '<table><thead><tr>' +
                '<th>심볼</th><th>현재가</th><th>강도</th><th>경과</th><th>24h</th><th>거래량</th>' +
                '</tr></thead><tbody>' +
                items.map(d => {
                    const change = parseFloat(d.change_24h);
                    const changeClass = change >= 0 ? 'change-pos' : 'change-neg';
                    const changeStr = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
                    const link = 'https://www.bitget.com/futures/usdt/' + d.symbol;
                    const durClass = d.duration_min <= 5 ? 'dur-fresh' : d.duration_min <= 10 ? 'dur-mid' : 'dur-old';
                    return '<tr>' +
                        '<td><a class="symbol-link" href="' + link + '" target="_blank">' + d.symbol.replace('USDT','') + '</a></td>' +
                        '<td>' + formatPrice(d.current_price) + '</td>' +
                        '<td>' + d.strength.toFixed(3) + '%</td>' +
                        '<td><span class="duration-badge ' + durClass + '">' + d.duration_min + '분</span></td>' +
                        '<td class="' + changeClass + '">' + changeStr + '</td>' +
                        '<td>$' + formatVolume(d.volume_24h_usdt) + '</td>' +
                        '</tr>';
                }).join('') +
                '</tbody></table>';
        }

        return '<div class="section">' + headerHtml + bodyHtml + '</div>';
    }).join('');
}

function formatPrice(p) {
    if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (p >= 1) return p.toFixed(4);
    if (p >= 0.01) return p.toFixed(5);
    return p.toFixed(6);
}

function formatVolume(v) {
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B';
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
    return v.toFixed(0);
}

// --- 자동 스캔 알림 ---
let alertInterval = null;
let alertRunning = false;

function toggleAlert() {
    if (alertRunning) {
        stopAlert();
    } else {
        startAlert();
    }
}

async function startAlert() {
    // 브라우저 알림 권한 요청
    if (Notification.permission === 'default') {
        await Notification.requestPermission();
    }
    if (Notification.permission !== 'granted') {
        alert('알림 권한을 허용해주세요.');
        return;
    }

    alertRunning = true;
    const btn = document.getElementById('alertBtn');
    btn.textContent = '알림 중지';
    btn.style.background = '#4caf50';

    // 즉시 1회 실행 + 60초 간격
    runAlertScan();
    alertInterval = setInterval(runAlertScan, 60000);
}

function stopAlert() {
    alertRunning = false;
    clearInterval(alertInterval);
    alertInterval = null;
    const btn = document.getElementById('alertBtn');
    btn.textContent = '알림 시작';
    btn.style.background = '#a51d2d';
}

async function runAlertScan() {
    const statusEl = document.getElementById('status');
    const granularity = document.getElementById('granularity').value;
    const minVolume = document.getElementById('minVolume').value || 5000000;
    const maxLever = document.getElementById('maxLever').value;

    statusEl.className = 'status scanning';
    statusEl.textContent = '알림 스캔 중...';

    try {
        const res = await fetch('/market/futures/scan?minVolume=' + minVolume + '&granularity=' + granularity + '&maxLever=' + maxLever);
        const json = await res.json();
        if (json.error) throw new Error(json.error);

        const data = json.data || [];
        const newCoins = data.filter(d => d.duration_min <= 1);

        const scannedAt = new Date(json.scanned_at).toLocaleTimeString('ko-KR');
        statusEl.className = 'status done';
        statusEl.textContent = scannedAt + ' · 총 ' + data.length + '개 · 신규 ' + newCoins.length + '개';

        // 결과도 화면에 반영
        renderSections(data);

        // 신규 감지 시 데스크톱 알림
        if (newCoins.length > 0) {
            const longCoins = newCoins.filter(d => d.position === 'LONG');
            const shortCoins = newCoins.filter(d => d.position === 'SHORT');
            let body = '';
            if (longCoins.length > 0) body += 'LONG: ' + longCoins.map(d => d.symbol.replace('USDT','')).join(', ') + '\\n';
            if (shortCoins.length > 0) body += 'SHORT: ' + shortCoins.map(d => d.symbol.replace('USDT','')).join(', ');

            new Notification('MA 정배열 신규 감지 (' + newCoins.length + '개)', {
                body: body,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📊</text></svg>',
                requireInteraction: true,
            });
        }
    } catch (e) {
        statusEl.className = 'status';
        statusEl.textContent = '알림 스캔 오류: ' + e.message;
    }
}
</script>
</body>
</html>`;
        res.header('Content-Type', 'text/html');
        res.send(html);
    }

    @Post('job/run')
    async runJob(@Body() body: any, @Res() res: Response) {
        try {
            const { exchange, symbol, base_time, holding_minutes, side } = body;
            const baseTime = new Date(base_time);

            await this.marketService.calculateTradeResult(exchange, symbol, baseTime, {
                holdingMinutes: holding_minutes ? parseInt(holding_minutes) : undefined,
                side: side,
            });

            res.json({ status: 'OK', message: 'Job executed successfully' });
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
}
