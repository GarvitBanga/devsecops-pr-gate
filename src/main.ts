import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';
import { TrivyScanner } from './scanners/trivy';
import { CheckovScanner } from './scanners/checkov';
import { ConftestScanner } from './scanners/conftest';
import { CommentManager } from './github';
import { SummaryRenderer } from './render/summary';

interface ScanResults {
  trivy: {
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
  };
  checkov: {
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
  };
  opa: {
    denyCount: number;
    findings: Array<{
      rule: string;
      message: string;
      resource: string;
    }>;
  };
}

export async function run(): Promise<void> {
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

    const trivyScanner = new TrivyScanner();
    const checkovScanner = new CheckovScanner();
    const conftestScanner = new ConftestScanner();
    const commentManager = new CommentManager();
    const summaryRenderer = new SummaryRenderer();

    const [trivyResults, checkovResults, opaResults] = await Promise.all([
      trivyScanner.scan(pathsApp, trivyVersion, trivyArgs),
      checkovScanner.scan(pathsIac, checkovVersion, checkovArgs),
      conftestScanner.scan(pathsIac, opaPolicyPath, conftestVersion, conftestArgs)
    ]);

    core.info(`DEBUG: Trivy results - Critical: ${trivyResults.critical}, High: ${trivyResults.high}`);
    core.info(`DEBUG: Checkov results - Critical: ${checkovResults.critical}, High: ${checkovResults.high}`);
    core.info(`DEBUG: OPA results - Deny count: ${opaResults.denyCount}`);

    const results: ScanResults = {
      trivy: trivyResults,
      checkov: checkovResults,
      opa: opaResults
    };

    const hasBlockers = determineBlockers(results, failOn);
    core.info(`DEBUG: Has blockers: ${hasBlockers}, Fail on: ${failOn}`);

    const summary = summaryRenderer.render(results, commentTitle, failOn);
    const commentUrl = await commentManager.createOrUpdateComment(summary);

    await uploadScanReports(results);

    core.info('DEBUG: Setting outputs...');
    core.setOutput('comment-url', commentUrl);
    core.setOutput('trivy-high', results.trivy.high.toString());
    core.setOutput('trivy-critical', results.trivy.critical.toString());
    core.setOutput('checkov-high', results.checkov.high.toString());
    core.setOutput('checkov-critical', results.checkov.critical.toString());
    core.setOutput('opa-deny-count', results.opa.denyCount.toString());
    core.setOutput('has-blockers', hasBlockers.toString());
    core.info('DEBUG: All outputs set successfully');

    if (hasBlockers) {
      core.setFailed(`DevSecOps PR Gate: Found ${failOn.toUpperCase()} or higher severity issues that must be resolved before merge.`);
    } else {
      core.info('DevSecOps PR Gate: All checks passed!');
    }

  } catch (error) {
    core.setFailed(`DevSecOps PR Gate failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function determineBlockers(results: ScanResults, failOn: string): boolean {
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

async function uploadScanReports(results: ScanResults): Promise<void> {
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

    fs.writeFileSync(
      path.join(artifactsDir, 'devsecops-summary.json'),
      JSON.stringify(summaryReport, null, 2)
    );

    core.info('Scan reports uploaded as artifacts in devsecops-reports/');
  } catch (error) {
    core.warning(`Failed to upload scan reports: ${error}`);
  }
} 