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
exports.run = run;
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const trivy_1 = require("./scanners/trivy");
const checkov_1 = require("./scanners/checkov");
const conftest_1 = require("./scanners/conftest");
const github_1 = require("./github");
const summary_1 = require("./render/summary");
async function run() {
    try {
        const pathsApp = core.getInput('paths-app', { required: false }) || 'app/';
        const pathsIac = core.getInput('paths-iac', { required: false }) || 'infra/';
        const failOn = core.getInput('fail-on', { required: false }) || 'high';
        const opaPolicyPath = core.getInput('opa-policy-path', { required: false }) || 'policies/conftest';
        const trivyVersion = core.getInput('trivy-version', { required: false });
        const checkovVersion = core.getInput('checkov-version', { required: false });
        const conftestVersion = core.getInput('conftest-version', { required: false });
        const trivyArgs = core.getInput('trivy-args', { required: false });
        const checkovArgs = core.getInput('checkov-args', { required: false });
        const conftestArgs = core.getInput('conftest-args', { required: false });
        const commentTitle = core.getInput('comment-title', { required: false }) || 'DevSecOps PR Gate';
        core.info('Starting DevSecOps PR Gate scan...');
        const trivyScanner = new trivy_1.TrivyScanner();
        const checkovScanner = new checkov_1.CheckovScanner();
        const conftestScanner = new conftest_1.ConftestScanner();
        const commentManager = new github_1.CommentManager();
        const summaryRenderer = new summary_1.SummaryRenderer();
        const [trivyResults, checkovResults, opaResults] = await Promise.all([
            trivyScanner.scan(pathsApp, trivyVersion, trivyArgs),
            checkovScanner.scan(pathsIac, checkovVersion, checkovArgs),
            conftestScanner.scan(pathsIac, opaPolicyPath, conftestVersion, conftestArgs)
        ]);
        const results = {
            trivy: trivyResults,
            checkov: checkovResults,
            opa: opaResults
        };
        const hasBlockers = determineBlockers(results, failOn);
        const summary = summaryRenderer.render(results, commentTitle, failOn);
        const commentUrl = await commentManager.createOrUpdateComment(summary);
        await uploadScanReports(results);
        core.setOutput('comment-url', commentUrl);
        core.setOutput('trivy-high', results.trivy.high.toString());
        core.setOutput('trivy-critical', results.trivy.critical.toString());
        core.setOutput('checkov-high', results.checkov.high.toString());
        core.setOutput('checkov-critical', results.checkov.critical.toString());
        core.setOutput('opa-deny-count', results.opa.denyCount.toString());
        core.setOutput('has-blockers', hasBlockers.toString());
        if (hasBlockers) {
            core.setFailed(`DevSecOps PR Gate: Found ${failOn.toUpperCase()} or higher severity issues that must be resolved before merge.`);
        }
        else {
            core.info('DevSecOps PR Gate: All checks passed!');
        }
    }
    catch (error) {
        core.setFailed(`DevSecOps PR Gate failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function determineBlockers(results, failOn) {
    switch (failOn.toLowerCase()) {
        case 'critical':
            return results.trivy.critical > 0 || results.checkov.critical > 0;
        case 'high':
            return results.trivy.critical > 0 || results.trivy.high > 0 ||
                results.checkov.critical > 0 || results.checkov.high > 0;
        case 'off':
            return false;
        default:
            return results.trivy.critical > 0 || results.trivy.high > 0 ||
                results.checkov.critical > 0 || results.checkov.high > 0;
    }
}
async function uploadScanReports(results) {
    try {
        const artifactsDir = path.join(process.cwd(), 'devsecops-reports');
        if (!fs.existsSync(artifactsDir)) {
            fs.mkdirSync(artifactsDir, { recursive: true });
        }
        const summaryReport = {
            timestamp: new Date().toISOString(),
            summary: {
                trivy: {
                    critical: results.trivy.critical,
                    high: results.trivy.high,
                    medium: results.trivy.medium,
                    low: results.trivy.low,
                    total: results.trivy.critical + results.trivy.high + results.trivy.medium + results.trivy.low
                },
                checkov: {
                    critical: results.checkov.critical,
                    high: results.checkov.high,
                    medium: results.checkov.medium,
                    low: results.checkov.low,
                    total: results.checkov.critical + results.checkov.high + results.checkov.medium + results.checkov.low
                },
                opa: {
                    denyCount: results.opa.denyCount,
                    total: results.opa.denyCount
                }
            },
            findings: {
                trivy: results.trivy.findings,
                checkov: results.checkov.findings,
                opa: results.opa.findings
            }
        };
        fs.writeFileSync(path.join(artifactsDir, 'devsecops-summary.json'), JSON.stringify(summaryReport, null, 2));
        core.info('Scan reports uploaded as artifacts in devsecops-reports/');
    }
    catch (error) {
        core.warning(`Failed to upload scan reports: ${error}`);
    }
}
//# sourceMappingURL=main.js.map