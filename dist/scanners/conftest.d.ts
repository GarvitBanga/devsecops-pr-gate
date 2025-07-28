export declare class ConftestScanner {
    scan(terraformPath: string, policyPath: string, version?: string, additionalArgs?: string): Promise<{
        denyCount: number;
        findings: Array<{
            rule: string;
            message: string;
            resource: string;
        }>;
    }>;
    private runConftest;
    private ensureConftestInstalled;
    private ensureTerraformInstalled;
}
//# sourceMappingURL=conftest.d.ts.map