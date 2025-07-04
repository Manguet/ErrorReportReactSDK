import { Breadcrumb } from '../types';

export class BreadcrumbManager {
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs: number = 50;

  constructor(maxBreadcrumbs: number = 50) {
    this.maxBreadcrumbs = maxBreadcrumbs;
  }

  addBreadcrumb(
    message: string,
    category: string = 'custom',
    level: Breadcrumb['level'] = 'info',
    data?: Record<string, any>
  ): void {
    const breadcrumb: Breadcrumb = {
      timestamp: Date.now(),
      message,
      category,
      level,
      data,
    };

    this.breadcrumbs.push(breadcrumb);

    // Keep only the latest breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  // Convenience methods for common breadcrumb types
  logNavigation(from: string, to: string, data?: Record<string, any>): void {
    this.addBreadcrumb(
      `Navigation: ${from} → ${to}`,
      'navigation',
      'info',
      { from, to, ...data }
    );
  }

  logUserAction(action: string, data?: Record<string, any>): void {
    this.addBreadcrumb(
      `User action: ${action}`,
      'user',
      'info',
      { action, ...data }
    );
  }

  logHttpRequest(
    method: string,
    url: string,
    statusCode?: number,
    data?: Record<string, any>
  ): void {
    const level = statusCode && statusCode >= 400 ? 'error' : 'info';
    this.addBreadcrumb(
      `${method} ${url}${statusCode ? ` (${statusCode})` : ''}`,
      'http',
      level,
      { method, url, statusCode, ...data }
    );
  }

  logConsole(level: string, message: string, data?: Record<string, any>): void {
    this.addBreadcrumb(
      `Console ${level}: ${message}`,
      'console',
      level === 'error' ? 'error' : level === 'warn' ? 'warning' : 'info',
      { level, ...data }
    );
  }

  logClick(element: string, data?: Record<string, any>): void {
    this.addBreadcrumb(
      `Clicked: ${element}`,
      'ui',
      'info',
      { element, ...data }
    );
  }
}