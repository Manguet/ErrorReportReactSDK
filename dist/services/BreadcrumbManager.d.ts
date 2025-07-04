import { Breadcrumb } from '../types';
export declare class BreadcrumbManager {
    private breadcrumbs;
    private maxBreadcrumbs;
    constructor(maxBreadcrumbs?: number);
    addBreadcrumb(message: string, category?: string, level?: Breadcrumb['level'], data?: Record<string, any>): void;
    getBreadcrumbs(): Breadcrumb[];
    clearBreadcrumbs(): void;
    logNavigation(from: string, to: string, data?: Record<string, any>): void;
    logUserAction(action: string, data?: Record<string, any>): void;
    logHttpRequest(method: string, url: string, statusCode?: number, data?: Record<string, any>): void;
    logConsole(level: string, message: string, data?: Record<string, any>): void;
    logClick(element: string, data?: Record<string, any>): void;
}
//# sourceMappingURL=BreadcrumbManager.d.ts.map