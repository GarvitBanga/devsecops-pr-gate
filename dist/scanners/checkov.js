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
exports.CheckovScanner = void 0;
const core = __importStar(require("@actions/core"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class CheckovScanner {
    async scan(path, version, additionalArgs) {
        try {
            core.info(`Running Checkov scan on: ${path}`);
            await this.ensureCheckovInstalled(version);
            const args = additionalArgs ? ` ${additionalArgs}` : '';
            const command = `checkov -d ${path} --output json --output-file-path checkov-results${args}`;
            core.info(`Executing: ${command}`);
            await execAsync(command);
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('checkov-results.json', 'utf8'));
            return this.parseCheckovResults(results);
        }
        catch (error) {
            core.warning(`Checkov scan failed: ${error instanceof Error ? error.message : String(error)}`);
            return {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                findings: []
            };
        }
    }
    async ensureCheckovInstalled(version) {
        try {
            await execAsync('checkov --version');
            core.info('Checkov is already installed');
        }
        catch {
            core.info('Installing Checkov...');
            const checkovVersion = version || '2.3.0';
            try {
                await execAsync(`pip install checkov==${checkovVersion}`);
                core.info('Checkov installed via pip');
            }
            catch (pipError) {
                core.warning(`Pip installation failed: ${pipError}`);
                try {
                    await execAsync(`curl -L https://github.com/bridgecrewio/checkov/releases/download/${checkovVersion}/checkov-linux-x86_64 -o checkov`);
                    await execAsync('chmod +x checkov');
                    await execAsync('sudo mv checkov /usr/local/bin/');
                    core.info('Checkov installed via binary');
                }
                catch (binaryError) {
                    core.warning(`Binary installation failed: ${binaryError}`);
                    throw new Error('Failed to install Checkov via both pip and binary methods');
                }
            }
        }
    }
    parseCheckovResults(results) {
        const findings = [];
        let critical = 0;
        let high = 0;
        let medium = 0;
        let low = 0;
        if (results.results && results.results.failed_checks) {
            for (const check of results.results.failed_checks) {
                const severity = check.severity?.toLowerCase() || 'unknown';
                switch (severity) {
                    case 'critical':
                        critical++;
                        break;
                    case 'high':
                        high++;
                        break;
                    case 'medium':
                        medium++;
                        break;
                    case 'low':
                        low++;
                        break;
                }
                if (findings.length < 10) {
                    findings.push({
                        check: check.check_id || 'Unknown',
                        severity: check.severity || 'Unknown',
                        description: check.check_name || 'No description available',
                        resource: check.resource || 'Unknown'
                    });
                }
            }
        }
        core.info(`Checkov scan completed: ${critical} critical, ${high} high, ${medium} medium, ${low} low issues found`);
        return {
            critical,
            high,
            medium,
            low,
            findings
        };
    }
}
exports.CheckovScanner = CheckovScanner;
//# sourceMappingURL=checkov.js.map