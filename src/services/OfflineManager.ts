import { ErrorReport } from '../types';

interface QueuedReport {
  report: ErrorReport;
  timestamp: number;
  attempts: number;
}

export class OfflineManager {
  private queue: QueuedReport[] = [];
  private isOnline: boolean = navigator.onLine;
  private maxQueueSize: number = 50;
  private maxAge: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor(maxQueueSize?: number, maxAge?: number) {
    this.maxQueueSize = maxQueueSize || 50;
    this.maxAge = maxAge || 24 * 60 * 60 * 1000;
    
    this.setupNetworkListeners();
    this.loadPersistedQueue();
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private loadPersistedQueue(): void {
    try {
      const stored = localStorage.getItem('errorReporter_queue');
      if (stored) {
        this.queue = JSON.parse(stored);
        this.cleanupOldReports();
      }
    } catch (error) {
      console.warn('[ErrorReporter] Failed to load persisted queue:', error);
    }
  }

  private persistQueue(): void {
    try {
      localStorage.setItem('errorReporter_queue', JSON.stringify(this.queue));
    } catch (error) {
      console.warn('[ErrorReporter] Failed to persist queue:', error);
    }
  }

  private cleanupOldReports(): void {
    const now = Date.now();
    this.queue = this.queue.filter(item => now - item.timestamp < this.maxAge);
  }

  queueReport(report: ErrorReport): void {
    this.cleanupOldReports();
    
    // Remove oldest reports if queue is full
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }

    this.queue.push({
      report,
      timestamp: Date.now(),
      attempts: 0,
    });

    this.persistQueue();
  }

  async processQueue(): Promise<void> {
    if (!this.isOnline || this.queue.length === 0) {
      return;
    }

    const toProcess = [...this.queue];
    this.queue = [];

    for (const queuedReport of toProcess) {
      try {
        await this.sendReport(queuedReport.report);
        // Success - don't re-queue
      } catch (error) {
        queuedReport.attempts++;
        
        // Re-queue if not too many attempts
        if (queuedReport.attempts < 3) {
          this.queue.push(queuedReport);
        }
      }
    }

    this.persistQueue();
  }

  private async sendReport(report: ErrorReport): Promise<void> {
    // This will be implemented by the main ErrorReporter class
    throw new Error('sendReport method should be implemented by the main ErrorReporter class');
  }

  // Method to be called by ErrorReporter
  setSendReportFunction(sendFn: (report: ErrorReport) => Promise<void>): void {
    this.sendReport = sendFn;
  }

  isOnlineNow(): boolean {
    return this.isOnline;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clearQueue(): void {
    this.queue = [];
    this.persistQueue();
  }

  getQueuedReports(): readonly QueuedReport[] {
    return this.queue;
  }
}