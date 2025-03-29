module.exports = {
    apps: [
        {
            name: 'my-app',
            script: 'node',
            args: '-r module-alias/register ./dist/src/app.js',
            env: {
                NODE_ENV: 'production',
            },
            watch: false,
            ignore_watch: ['node_modules', 'logs'], // 변경 감지 무시할 폴더
            restart_delay: 5000, // 서버가 다운된 후 5초 뒤 재시작
            out_file: './logs/stdout.log',
            error_file: './logs/error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
    ],
};
