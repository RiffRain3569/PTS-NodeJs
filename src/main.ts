import * as crypto from 'crypto';
import './setup-env'; // Must be the first import to load envs before other imports

// NestJS v11 requires Node 20+, but user is on Node 18.
// Polyfill global.crypto for @nestjs/schedule compatibility.
if (!global.crypto) {
    (global as any).crypto = crypto;
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { PORT } from '@/common/config/info.config';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Express global middlewares can be used here too
    // app.use(express.json());

    const port = PORT || 3030;
    await app.listen(port);
    console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
