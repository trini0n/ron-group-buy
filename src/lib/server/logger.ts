/**
 * Simple logger utility with structured logging
 * Following low-cardinality logging pattern with stable message strings
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

function formatLog(level: LogLevel, context: LogContext, message: string): void {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    ...context
  };

  if (level === 'error') {
    console.error(JSON.stringify(logData));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logData));
  } else {
    console.log(JSON.stringify(logData));
  }
}

export const logger = {
  debug(context: LogContext, message: string): void {
    if (import.meta.env.DEV) {
      formatLog('debug', context, message);
    }
  },
  
  info(context: LogContext, message: string): void {
    formatLog('info', context, message);
  },
  
  warn(context: LogContext, message: string): void {
    formatLog('warn', context, message);
  },
  
  error(context: LogContext, message: string): void {
    formatLog('error', context, message);
  }
};
