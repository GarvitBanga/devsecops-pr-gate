"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConftestScanner = void 0;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
class ConftestScanner {
    async scan(terraformPath, policyPath, version, additionalArgs) {
        try {
            core.info(`Running Conftest scan on: ${terraformPath} with policies: ${policyPath}`);
            await this.ensureConftestInstalled(version);
            await this.ensureTerraformInstalled();
            const result = await this.runConftest(terraformPath, policyPath, additionalArgs ? [additionalArgs] : []);
            return {
                denyCount: result.denies,
                findings: result.details.map(detail => ({
                    rule: 'OPA Policy',
                    message: detail,
                    resource: 'Terraform'
                }))
            };
        }
        catch (error) {
            core.warning(`Conftest scan failed: ${error instanceof Error ? error.message : String(error)}`);
            return {
                denyCount: 0,
                findings: []
            };
        }
    }
    async runConftest(targetPath, policyPath, extraArgs = []) {
        let parserArgs = [];
        let target = targetPath;
        const targetStats = fs.statSync(targetPath);
        if (targetStats.isDirectory()) {
            parserArgs = ['--parser', 'hcl2'];
            core.info('Using HCL2 parser for Terraform directory');
        }
        else if (targetPath.endsWith('.json')) {
            parserArgs = ['--parser', 'json'];
            core.info('Using JSON parser for .json file');
        }
        else {
            parserArgs = ['--parser', 'hcl2'];
            core.info('Using HCL2 parser for file');
        }
        const args = ['test', target, '--policy', policyPath, ...parserArgs, '--output', 'json', ...extraArgs];
        core.info(`Executing: conftest ${args.join(' ')}`);
        let stdout = '';
        let stderr = '';
        const code = await exec.exec('conftest', args, {
            ignoreReturnCode: true,
            listeners: {
                stdout: (data) => (stdout += data.toString()),
                stderr: (data) => (stderr += data.toString()),
            },
        });
        if (code > 1) {
            core.warning(`Conftest execution error (exit ${code}): ${stderr || '(no stderr)'}`);
            return { denies: 0, details: [] };
        }
        if (!stdout.trim()) {
            core.info('Conftest produced no output; assuming 0 denies.');
            return { denies: 0, details: [] };
        }
        try {
            const parsed = JSON.parse(stdout);
            const failures = [];
            let denyCount = 0;
            for (const res of parsed) {
                if (!res?.failures)
                    continue;
                for (const f of res.failures) {
                    denyCount++;
                    failures.push(f?.msg ?? JSON.stringify(f));
                }
            }
            return { denies: denyCount, details: failures };
        }
        catch (e) {
            core.warning(`Failed to parse Conftest JSON: ${e.message}`);
            return { denies: 0, details: [] };
        }
    }
    async ensureConftestInstalled(version) {
        try {
            await exec.exec('conftest', ['--version']);
            core.info('Conftest is already installed');
        }
        catch {
            core.info('Installing Conftest...');
            const conftestVersion = version || 'v0.45.0';
            try {
                const versionWithoutV = conftestVersion.replace('v', '');
                await exec.exec('curl', ['-L', '-o', 'conftest.tar.gz', `https://github.com/open-policy-agent/conftest/releases/download/${conftestVersion}/conftest_${versionWithoutV}_Linux_x86_64.tar.gz`]);
                await exec.exec('tar', ['-xzf', 'conftest.tar.gz']);
                await exec.exec('chmod', ['+x', 'conftest']);
                core.info('Conftest binary extracted and made executable');
                await exec.exec('sudo', ['mv', 'conftest', '/usr/local/bin/']);
                await exec.exec('chmod', ['+x', '/usr/local/bin/conftest']);
                await exec.exec('rm', ['conftest.tar.gz']);
            }
            catch (error) {
                core.warning(`Direct download failed, trying alternative method: ${error}`);
                const versionWithoutV = conftestVersion.replace('v', '');
                await exec.exec('wget', ['-O', 'conftest.tar.gz', `https://github.com/open-policy-agent/conftest/releases/download/${conftestVersion}/conftest_${versionWithoutV}_Linux_x86_64.tar.gz`]);
                await exec.exec('tar', ['-xzf', 'conftest.tar.gz']);
                await exec.exec('chmod', ['+x', 'conftest']);
                core.info('Conftest binary extracted and made executable (fallback method)');
                await exec.exec('sudo', ['mv', 'conftest', '/usr/local/bin/']);
                await exec.exec('chmod', ['+x', '/usr/local/bin/conftest']);
                await exec.exec('rm', ['conftest.tar.gz']);
            }
        }
    }
    async ensureTerraformInstalled() {
        try {
            await exec.exec('terraform', ['--version']);
            core.info('Terraform is already installed');
        }
        catch {
            core.info('Installing Terraform...');
            await exec.exec('curl', ['-fsSL', 'https://releases.hashicorp.com/terraform/1.5.0/terraform_1.5.0_linux_amd64.zip', '-o', 'terraform.zip']);
            await exec.exec('unzip', ['terraform.zip']);
            await exec.exec('sudo', ['mv', 'terraform', '/usr/local/bin/']);
            await exec.exec('chmod', ['+x', '/usr/local/bin/terraform']);
            await exec.exec('rm', ['terraform.zip']);
        }
    }
}
exports.ConftestScanner = ConftestScanner;
//# sourceMappingURL=conftest.js.map