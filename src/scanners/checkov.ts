import * as core from '@actions/core';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CheckovScanner {
  async scan(path: string, version?: string, additionalArgs?: string): Promise<{
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
  }> {
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

    } catch (error) {
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

  private async ensureCheckovInstalled(version?: string): Promise<void> {
    try {
      await execAsync('checkov --version');
      core.info('Checkov is already installed');
    } catch {
      core.info('Installing Checkov...');
      const checkovVersion = version || '3.1.0';
      await execAsync(`pip install checkov==${checkovVersion}`);
    }
  }

  private parseCheckovResults(results: any): {
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
  } {
    const findings: Array<{
      check: string;
      severity: string;
      description: string;
      resource: string;
    }> = [];

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