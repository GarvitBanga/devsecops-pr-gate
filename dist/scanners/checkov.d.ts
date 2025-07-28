export declare class CheckovScanner {
    scan(path: string, version?: string, additionalArgs?: string): Promise<{
        critical: number;
        high: number;
        medium: number;
        low: number;
        findings: Array<{
            check: string;
            severity: string;
            description: string;
            resource: string;
        }>;
    }>;
    private ensureCheckovInstalled;
    private parseCheckovResults;
}
//# sourceMappingURL=checkov.d.ts.map