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
exports.TrivyScanner = void 0;
const core = __importStar(require("@actions/core"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class TrivyScanner {
    async scan(path, version, additionalArgs) {
        try {
            core.info(`Running Trivy filesystem scan on: ${path}`);
            await this.ensureTrivyInstalled(version);
            const args = additionalArgs ? ` ${additionalArgs}` : '';
            const command = `trivy fs --format json --output trivy-results.json${args} ${path}`;
            core.info(`Executing: ${command}`);
            await execAsync(command);
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('trivy-results.json', 'utf8'));
            core.info(`DEBUG: Trivy raw results structure: ${JSON.stringify(Object.keys(results))}`);
            if (results.Results) {
                core.info(`DEBUG: Trivy has ${results.Results.length} results`);
            }
            return this.parseTrivyResults(results);
        }
        catch (error) {
            core.warning(`Trivy scan failed: ${error instanceof Error ? error.message : String(error)}`);
            return {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                findings: []
            };
        }
    }
    async ensureTrivyInstalled(version) {
        try {
            await execAsync('trivy --version');
            core.info('Trivy is already installed');
        }
        catch {
            core.info('Installing Trivy...');
            const trivyVersion = version || 'v0.48.0';
            try {
                await execAsync(`curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin ${trivyVersion}`);
            }
            catch (error) {
                core.warning(`Direct installation failed, trying with sudo: ${error}`);
                try {
                    await execAsync(`curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sudo sh -s -- -b /usr/local/bin ${trivyVersion}`);
                }
                catch (sudoError) {
                    core.warning(`Sudo installation also failed: ${sudoError}`);
                    await execAsync(`curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b ./bin ${trivyVersion}`);
                    process.env.PATH = `./bin:${process.env.PATH}`;
                }
            }
        }
    }
    parseTrivyResults(results) {
        const findings = [];
        let critical = 0;
        let high = 0;
        let medium = 0;
        let low = 0;
        core.info(`DEBUG: Parsing Trivy results, Results exists: ${!!results.Results}`);
        core.info(`DEBUG: Full Trivy results structure: ${JSON.stringify(Object.keys(results))}`);
        if (results.Results) {
            core.info(`DEBUG: Found ${results.Results.length} result entries`);
            for (const result of results.Results) {
                core.info(`DEBUG: Result has Vulnerabilities: ${!!result.Vulnerabilities}, count: ${result.Vulnerabilities?.length || 0}`);
                if (result.Vulnerabilities) {
                    for (const vuln of result.Vulnerabilities) {
                        const severity = vuln.Severity?.toLowerCase() || 'unknown';
                        core.info(`DEBUG: Found vulnerability: ${vuln.VulnerabilityID} with severity: ${severity}`);
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
                                vulnerability: vuln.VulnerabilityID || 'Unknown',
                                severity: vuln.Severity || 'Unknown',
                                description: vuln.Description || 'No description available',
                                package: vuln.PkgName || 'Unknown'
                            });
                        }
                    }
                }
            }
        }
        core.info(`Trivy scan completed: ${critical} critical, ${high} high, ${medium} medium, ${low} low vulnerabilities found`);
        return {
            critical,
            high,
            medium,
            low,
            findings
        };
    }
}
exports.TrivyScanner = TrivyScanner;
//# sourceMappingURL=trivy.js.map