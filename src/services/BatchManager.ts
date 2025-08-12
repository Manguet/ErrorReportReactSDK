import { BatchConfig, BatchStats, ErrorReport } from '../types';

export class BatchManager {
  private config: BatchConfig;
  private currentBatch: ErrorReport[] = [];
  private batchTimeout?: number;
  private stats: BatchStats = {
    currentSize: 0,
    totalBatches: 0,
    totalErrors: 0,
    averageBatchSize: 0
  };
  private sendFunction?: (errors: ErrorReport[]) => Promise<void>;

  constructor(config?: Partial<BatchConfig>) {
    this.config = {
      batchSize: 10,
      batchTimeout: 5000,
      maxPayloadSize: 1048576, // 1MB
      ...config
    };
  }

  configure(config: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setSendFunction(sendFn: (errors: ErrorReport[]) => Promise<void>): void {
    this.sendFunction = sendFn;
  }

  addToBatch(error: ErrorReport): void {
    this.currentBatch.push(error);
    this.stats.currentSize = this.currentBatch.length;
    this.stats.totalErrors++;

    // Check if we should send the batch
    if (this.shouldSendBatch()) {
      this.sendBatch();
    } else if (!this.batchTimeout) {
      // Start timeout for partial batch
      this.startBatchTimeout();
    }
  }

  async flush(): Promise<void> {
    if (this.currentBatch.length > 0) {
      await this.sendBatch();
    }
  }

  getStats(): BatchStats {
    return { ...this.stats };
  }

  private shouldSendBatch(): boolean {
    if (this.currentBatch.length >= this.config.batchSize) {
      return true;
    }

    // Check payload size
    const payloadSize = this.calculatePayloadSize();
    return payloadSize >= this.config.maxPayloadSize;
  }

  private calculatePayloadSize(): number {
    try {
      return new TextEncoder().encode(JSON.stringify(this.currentBatch)).length;
    } catch {
      // Fallback estimation
      return JSON.stringify(this.currentBatch).length * 2;
    }
  }

  private startBatchTimeout(): void {
    this.batchTimeout = window.setTimeout(() => {
      if (this.currentBatch.length > 0) {
        this.sendBatch();
      }
    }, this.config.batchTimeout);
  }

  private clearBatchTimeout(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = undefined;
    }
  }

  private async sendBatch(): Promise<void> {
    if (this.currentBatch.length === 0) {
      return;
    }

    const batch = [...this.currentBatch];
    this.currentBatch = [];
    this.stats.currentSize = 0;
    this.clearBatchTimeout();

    try {
      if (this.sendFunction) {
        await this.sendFunction(batch);
        
        // Update stats on successful send
        this.stats.totalBatches++;
        this.stats.lastSentAt = Date.now();
        this.updateAverageBatchSize(batch.length);
      }
    } catch (error) {
      // On failure, we could implement retry logic or queuing
      console.error('Failed to send batch:', error);
      throw error;
    }
  }

  private updateAverageBatchSize(batchSize: number): void {
    const totalErrors = this.stats.totalErrors;
    const totalBatches = this.stats.totalBatches;
    
    if (totalBatches > 0) {
      this.stats.averageBatchSize = totalErrors / totalBatches;
    }
  }

  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  reset(): void {
    this.currentBatch = [];
    this.stats = {
      currentSize: 0,
      totalBatches: 0,
      totalErrors: 0,
      averageBatchSize: 0
    };
    this.clearBatchTimeout();
  }
}