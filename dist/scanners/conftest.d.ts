export declare class ConftestScanner {
    scan(path: string, policyPath: string, version?: string, additionalArgs?: string): Promise<{
        denyCount: number;
        findings: Array<{
            rule: string;
            message: string;
            resource: string;
        }>;
    }>;
    private ensureConftestInstalled;
    private parseConftestResults;
}
//# sourceMappingURL=conftest.d.ts.map