/**
 * Verbose Logging System
 * ======================
 * Captures all application events, sync operations, and errors for debugging.
 * Logs are stored in memory and can be viewed in the LogsModal.
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  SYNC = "SYNC",
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();

  private addLog(level: LogLevel, category: string, message: string, data?: unknown) {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(entry);

    // Keep only the last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify listeners
    this.notifyListeners();

  }

  debug(category: string, message: string, data?: unknown) {
    this.addLog(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: unknown) {
    this.addLog(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: unknown) {
    this.addLog(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, data?: unknown) {
    this.addLog(LogLevel.ERROR, category, message, data);
  }

  sync(category: string, message: string, data?: unknown) {
    this.addLog(LogLevel.SYNC, category, message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    this.notifyListeners();
  }

  subscribe(callback: (logs: LogEntry[]) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach((callback) => callback(this.getLogs()));
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {} as Record<LogLevel, number>,
      byCategory: {} as Record<string, number>,
    };

    this.logs.forEach((log) => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
    });

    return stats;
  }
}

// Singleton instance
export const logger = new Logger();
