import pino, { LoggerOptions, Logger as PinoLogger } from 'pino';

export type { PinoLogger };

export function createLogger(options: LoggerOptions = {}): PinoLogger {
  const base: LoggerOptions = {
    name: 'aptifum',
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  if (process.env.NODE_ENV !== 'production') {
    base.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
    };
  }
  return pino({ ...base, ...options });
}
