/**
 * Persistent Debug Logger
 * Logs survive crashes and can be retrieved from localStorage
 */

interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'perf';
  category: string;
  message: string;
  data?: any;
  userAgent: string;
  url: string;
}

const MAX_LOGS = 200;
const STORAGE_KEY = 'foxy_debug_logs';

class DebugLogger {
  private logs: LogEntry[] = [];
  private isPC: boolean;

  constructor() {
    // Detect if PC/Desktop
    this.isPC = !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    
    // Load existing logs
    this.loadLogs();
    
    // Log session start
    this.info('SESSION', 'Debug logger initialized', {
      isPC: this.isPC,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      memory: (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      } : 'not available'
    });

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.error('UNCAUGHT_ERROR', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('UNHANDLED_REJECTION', event.reason?.message || 'Promise rejected', {
        reason: event.reason,
      });
    });

    // Log before unload (crash detection)
    window.addEventListener('beforeunload', () => {
      this.info('SESSION', 'Page unloading');
      this.saveLogs();
    });

    // Periodic auto-save — reduce frequency to avoid serialization pressure
    setInterval(() => this.saveLogs(), 10000);
  }

  private createEntry(
    level: LogEntry['level'],
    category: string,
    message: string,
    data?: any
  ): LogEntry {
    return {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry);
    
    // Keep only recent logs
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(-MAX_LOGS);
    }

    // Also log to console
    const prefix = `[${entry.category}]`;
    const style = 'font-weight: bold; color: #f59e0b;';
    
    if (entry.data) {
      console.log(`%c${prefix} ${entry.message}`, style, entry.data);
    } else {
      console.log(`%c${prefix} ${entry.message}`, style);
    }
  }

  info(category: string, message: string, data?: any) {
    this.addLog(this.createEntry('info', category, message, data));
  }

  warn(category: string, message: string, data?: any) {
    this.addLog(this.createEntry('warn', category, message, data));
  }

  error(category: string, message: string, data?: any) {
    this.addLog(this.createEntry('error', category, message, data));
    this.saveLogs(); // Immediately save on error
  }

  perf(category: string, message: string, data?: any) {
    if (this.isPC) {
      // Only log performance on PC since that's where the issue is
      this.addLog(this.createEntry('perf', category, message, data));
    }
  }

  private loadLogs() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load debug logs:', e);
    }
  }

  private saveLogs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      console.error('Failed to save debug logs:', e);
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  clearLogs() {
    this.logs = [];
    localStorage.removeItem(STORAGE_KEY);
    this.info('SESSION', 'Logs cleared');
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  isDesktop(): boolean {
    return this.isPC;
  }
}

// Singleton instance
export const debugLogger = new DebugLogger();