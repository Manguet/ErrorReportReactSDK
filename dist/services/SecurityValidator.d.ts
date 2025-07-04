export interface SecurityConfig {
    allowedDomains?: string[];
    requireHttps?: boolean;
    validateToken?: boolean;
    maxPayloadSize?: number;
}
export declare class SecurityValidator {
    private config;
    constructor(config?: SecurityConfig);
    validateApiUrl(url: string): {
        isValid: boolean;
        error?: string;
    };
    validateProjectToken(token: string): {
        isValid: boolean;
        error?: string;
    };
    validatePayloadSize(payload: string): {
        isValid: boolean;
        error?: string;
    };
    sanitizeData(data: Record<string, any>): Record<string, any>;
    private isSuspiciousUrl;
    private containsSuspiciousPatterns;
    private sanitizeString;
    private isProductionEnvironment;
    updateConfig(config: Partial<SecurityConfig>): void;
}
//# sourceMappingURL=SecurityValidator.d.ts.map