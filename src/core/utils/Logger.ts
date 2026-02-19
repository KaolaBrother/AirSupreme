export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStorageEntries: number;
}

class LoggerManager {
  private config: LoggerConfig = {
    minLevel: Boolean(import.meta.env.DEV) ? LogLevel.DEBUG : LogLevel.INFO,
    enableConsole: true,
    enableStorage: Boolean(import.meta.env.DEV),
    maxStorageEntries: 1000,
  };

  private logHistory: LogEntry[] = [];
  private moduleLoggers: Map<string, Logger> = new Map();

  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setMinLevel(level: LogLevel): void {
    this.config.minLevel = level;
  }

  getLogger(module: string): Logger {
    if (!this.moduleLoggers.has(module)) {
      this.moduleLoggers.set(module, new Logger(module, this));
    }
    return this.moduleLoggers.get(module)!;
  }

  log(entry: LogEntry): void {
    if (entry.level < this.config.minLevel) {
      return;
    }

    if (this.config.enableStorage) {
      this.logHistory.push(entry);
      if (this.logHistory.length > this.config.maxStorageEntries) {
        this.logHistory.shift();
      }
    }

    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.module}]`;
    const levelTag = this.getLevelTag(entry.level);

    const args: unknown[] = [prefix, levelTag, entry.message];
    if (entry.data !== undefined) {
      args.push(entry.data);
    }

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(...args);
        break;
      case LogLevel.INFO:
        console.info(...args);
        break;
      case LogLevel.WARN:
        console.warn(...args);
        break;
      case LogLevel.ERROR:
        console.error(...args);
        break;
    }
  }

  private getLevelTag(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '🔍';
      case LogLevel.INFO:
        return 'ℹ️';
      case LogLevel.WARN:
        return '⚠️';
      case LogLevel.ERROR:
        return '❌';
      default:
        return '•';
    }
  }

  getHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  getHistoryByLevel(level: LogLevel): LogEntry[] {
    return this.logHistory.filter((e) => e.level === level);
  }

  getHistoryByModule(module: string): LogEntry[] {
    return this.logHistory.filter((e) => e.module === module);
  }

  clearHistory(): void {
    this.logHistory = [];
  }

  exportHistory(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }
}

class Logger {
  constructor(
    private readonly module: string,
    private readonly manager: LoggerManager
  ) {}

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    this.manager.log({
      timestamp: new Date().toISOString().split('T')[1].slice(0, 12),
      level,
      module: this.module,
      message,
      data,
    });
  }
}

export const loggerManager = new LoggerManager();

export function getLogger(module: string): Logger {
  return loggerManager.getLogger(module);
}
