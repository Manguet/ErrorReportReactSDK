import { ErrorReport } from '../types';
interface QueuedReport {
    report: ErrorReport;
    timestamp: number;
    attempts: number;
}
export declare class OfflineManager {
    private queue;
    private isOnline;
    private maxQueueSize;
    private maxAge;
    constructor(maxQueueSize?: number, maxAge?: number);
    private setupNetworkListeners;
    private loadPersistedQueue;
    private persistQueue;
    private cleanupOldReports;
    queueReport(report: ErrorReport): void;
    processQueue(): Promise<void>;
    private sendReport;
    setSendReportFunction(sendFn: (report: ErrorReport) => Promise<void>): void;
    isOnlineNow(): boolean;
    getQueueSize(): number;
    clearQueue(): void;
    getQueuedReports(): readonly QueuedReport[];
}
export {};
//# sourceMappingURL=OfflineManager.d.ts.map