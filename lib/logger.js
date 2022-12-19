const winston = require('winston');
require('winston-daily-rotate-file');
require('dotenv').config();

const {createLogger, format, transports} = winston;

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.errors({stack: true}),
        format.splat(),
        format.json()
    ),
    transports: [
        new transports.File({filename: __dirname + '/../logs/app-error.log', level: 'error'}),
        new transports.File({filename: __dirname + '/../logs/app-combined.log'}),
        new transports.DailyRotateFile({
            filename: __dirname + '/../logs/app-combined-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '1m',
        }),
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
            )
        })
    ]
});

module.exports = logger;