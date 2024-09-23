import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";

const logger = createLogger({
    level: process.env.NODE_ENV !== "production" ? "debug" : "info",
    format: format.combine(
        format.timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json(),
    ),
    transports: [
        new transports.File({
            filename: "./logs/app-error.log",
            level: "error",
        }),
        new transports.DailyRotateFile({
            filename: "./logs/app-error-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            maxSize: "1m",
            level: "error",
        }),
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.timestamp({
                    format: "YYYY-MM-DD HH:mm:ss",
                }),
                format.printf(
                    (info) =>
                        `${info.timestamp} ${info.level}: ${info.message}`,
                ),
            ),
        }),
    ],
});

export default logger;
