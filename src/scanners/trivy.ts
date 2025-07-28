import * as core from '@actions/core';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class TrivyScanner {
  async scan(path: string, version?: string, additionalArgs?: string): Promise<{
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
  }> {
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

    } catch (error) {
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

  private async ensureTrivyInstalled(version?: string): Promise<void> {
    try {
      await execAsync('trivy --version');
      core.info('Trivy is already installed');
    } catch {
      core.info('Installing Trivy...');
      const trivyVersion = version || 'v0.48.0';
      await execAsync(`curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin ${trivyVersion}`);
    }
  }

  private parseTrivyResults(results: any): {
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
  } {
    const findings: Array<{
      vulnerability: string;
      severity: string;
      description: string;
      package: string;
    }> = [];

    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    core.info(`DEBUG: Parsing Trivy results, Results exists: ${!!results.Results}`);
    if (results.Results) {
      core.info(`DEBUG: Found ${results.Results.length} result entries`);
      for (const result of results.Results) {
        core.info(`DEBUG: Result has Vulnerabilities: ${!!result.Vulnerabilities}, count: ${result.Vulnerabilities?.length || 0}`);
        if (result.Vulnerabilities) {
          for (const vuln of result.Vulnerabilities) {
            const severity = vuln.Severity?.toLowerCase() || 'unknown';
            
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