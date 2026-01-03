import { DB_DATABASE, DB_HOST, DB_PASSWORD, DB_USER } from '@/common/config/info.config';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as mysql from 'mysql2/promise';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private pool!: mysql.Pool;

    async onModuleInit() {
        this.pool = mysql.createPool({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_DATABASE,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            timezone: 'Z', // UTC
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
        });

        // Test connection
        try {
            const connection = await this.pool.getConnection();
            connection.release();
            console.log('Database connected successfully');
        } catch (error) {
            console.error('Database connection failed:', error);
        }
    }

    async onModuleDestroy() {
        if (this.pool) {
            await this.pool.end();
        }
    }

    async query(sql: string, params: any[] = []): Promise<any> {
        const [rows] = await this.pool.execute(sql, params);
        return rows;
    }

    async execute(sql: string, params: any[] = []): Promise<any> {
        const [result] = await this.pool.execute(sql, params);
        return result;
    }
}
