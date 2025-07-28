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
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ConftestScanner {
    async scan(path, policyPath, version, additionalArgs) {
        try {
            core.info(`Running Conftest scan on: ${path} with policies: ${policyPath}`);
            await this.ensureConftestInstalled(version);
            const jsonPath = await this.convertTerraformToJson(path);
            const args = additionalArgs ? ` ${additionalArgs}` : '';
            const command = `conftest test ${jsonPath} --policy ${policyPath} --parser json --output json${args}`;
            core.info(`Executing: ${command}`);
            const { stdout } = await execAsync(command);
            const results = JSON.parse(stdout);
            return this.parseConftestResults(results);
        }
        catch (error) {
            core.warning(`Conftest scan failed: ${error instanceof Error ? error.message : String(error)}`);
            return {
                denyCount: 0,
                findings: []
            };
        }
    }
    async convertTerraformToJson(terraformPath) {
        try {
            const tfFiles = await this.findTerraformFiles(terraformPath);
            if (tfFiles.length === 0) {
                throw new Error('No Terraform files found');
            }
            await this.initializeTerraform(terraformPath);
            const planPath = path.join(terraformPath, 'plan.out');
            await execAsync(`cd ${terraformPath} && terraform plan -out=plan.out`);
            const jsonPath = path.join(terraformPath, 'terraform.json');
            await execAsync(`cd ${terraformPath} && terraform show -json plan.out > terraform.json`);
            core.info(`Converted Terraform to JSON: ${jsonPath}`);
            return jsonPath;
        }
        catch (error) {
            core.warning(`Failed to convert Terraform to JSON: ${error instanceof Error ? error.message : String(error)}`);
            return terraformPath;
        }
    }
    async findTerraformFiles(dir) {
        const files = await fs.promises.readdir(dir);
        return files.filter(file => file.endsWith('.tf'));
    }
    async initializeTerraform(terraformPath) {
        try {
            await execAsync(`cd ${terraformPath} && terraform init`);
        }
        catch (error) {
            core.warning(`Terraform init failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async ensureConftestInstalled(version) {
        try {
            await execAsync('conftest --version');
            core.info('Conftest is already installed');
        }
        catch {
            core.info('Installing Conftest...');
            const conftestVersion = version || 'v0.55.0';
            await execAsync(`curl -L -o conftest.tar.gz https://github.com/open-policy-agent/conftest/releases/download/${conftestVersion}/conftest_${conftestVersion}_Linux_x86_64.tar.gz`);
            await execAsync('tar xzf conftest.tar.gz');
            await execAsync('sudo mv conftest /usr/local/bin/');
            await execAsync('chmod +x /usr/local/bin/conftest');
        }
    }
    parseConftestResults(results) {
        const findings = [];
        let denyCount = 0;
        if (Array.isArray(results)) {
            for (const result of results) {
                if (result.failures) {
                    for (const failure of result.failures) {
                        denyCount++;
                        if (findings.length < 10) {
                            findings.push({
                                rule: failure.msg || 'Unknown rule',
                                message: failure.msg || 'No message available',
                                resource: result.filepath || 'Unknown'
                            });
                        }
                    }
                }
            }
        }
        core.info(`Conftest scan completed: ${denyCount} policy violations found`);
        return {
            denyCount,
            findings
        };
    }
}
exports.ConftestScanner = ConftestScanner;
//# sourceMappingURL=conftest.js.map