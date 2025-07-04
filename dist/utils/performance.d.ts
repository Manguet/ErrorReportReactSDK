export declare const debounce: <T extends (...args: any[]) => any>(func: T, wait: number) => ((...args: Parameters<T>) => void);
export declare const throttle: <T extends (...args: any[]) => any>(func: T, wait: number) => ((...args: Parameters<T>) => void);
export declare const createLazyLoader: <T>(loader: () => Promise<T>) => () => Promise<T>;
export declare const truncateString: (str: string, maxLength: number) => string;
export declare const safeStringify: (obj: any, maxDepth?: number) => string;
export declare class EventListenerManager {
    private listeners;
    add(element: EventTarget, event: string, handler: EventListener, options?: AddEventListenerOptions): void;
    cleanup(): void;
}
export declare const getBrowserCapabilities: () => {
    supportsLocalStorage: boolean;
    supportsSessionStorage: boolean;
    supportsFetch: boolean;
    supportsWebWorkers: boolean;
    supportsNavigationAPI: boolean;
};
export declare const createMinimalErrorReporter: () => {
    reportError: (error: Error) => void;
    isEnabled: () => boolean;
};
//# sourceMappingURL=performance.d.ts.map