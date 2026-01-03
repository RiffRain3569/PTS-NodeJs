import { getCandleMinute } from './src/common/apis/bithumb.api';

async function test() {
    console.log('Testing Bithumb V1 API with Custom Date Format...');
    try {
        const market = 'KRW-BTC';
        // Format: yyyy-MM-dd HH:mm:ss
        const now = new Date();
        const to = now.toISOString().replace('T', ' ').slice(0, 19);
        const count = 10;
        console.log(`Requesting ${market}, to=${to}, count=${count}`);

        const res = await getCandleMinute({ market, to, count });
        console.log('Response:', JSON.stringify(res).slice(0, 500));
    } catch (e: any) {
        console.error('Error:', e.message || e);
    }
}

test();
