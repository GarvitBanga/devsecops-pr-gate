export declare class TrivyScanner {
    scan(path: string, version?: string, additionalArgs?: string): Promise<{
        critical: number;
        high: number;
        medium: number;
        low: number;
        findings: Array<{
            vulnerability: string;
            severity: string;
            description: string;
            package: string;
        }>;
    }>;
    private ensureTrivyInstalled;
    private parseTrivyResults;
}
//# sourceMappingURL=trivy.d.ts.map