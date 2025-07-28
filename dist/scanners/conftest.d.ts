export declare class ConftestScanner {
    scan(path: string, policyPath: string, version?: string, additionalArgs?: string): Promise<{
        denyCount: number;
        findings: Array<{
            rule: string;
            message: string;
            resource: string;
        }>;
    }>;
    private convertTerraformToJson;
    private findTerraformFiles;
    private initializeTerraform;
    private ensureConftestInstalled;
    private ensureTerraformInstalled;
    private parseConftestResults;
}
//# sourceMappingURL=conftest.d.ts.map