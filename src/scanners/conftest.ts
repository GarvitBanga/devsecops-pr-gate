import * as core from '@actions/core';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ConftestScanner {
  async scan(path: string, policyPath: string, version?: string, additionalArgs?: string): Promise<{
    denyCount: number;
    findings: Array<{
      rule: string;
      message: string;
      resource: string;
    }>;
  }> {
    try {
      core.info(`Running Conftest scan on: ${path} with policies: ${policyPath}`);

      await this.ensureConftestInstalled(version);

      const args = additionalArgs ? ` ${additionalArgs}` : '';
      const command = `conftest test ${path} --policy ${policyPath} --parser hcl2 --output json${args}`;

      core.info(`Executing: ${command}`);
      const { stdout } = await execAsync(command);

      const results = JSON.parse(stdout);

      return this.parseConftestResults(results);

    } catch (error) {
      core.warning(`Conftest scan failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        denyCount: 0,
        findings: []
      };
    }
  }

  private async ensureConftestInstalled(version?: string): Promise<void> {
    try {
      await execAsync('conftest --version');
      core.info('Conftest is already installed');
    } catch {
      core.info('Installing Conftest...');
      const conftestVersion = version || 'v0.55.0';
              await execAsync(`curl -L -o conftest.tar.gz https://github.com/open-policy-agent/conftest/releases/download/${conftestVersion}/conftest_${conftestVersion}_Linux_x86_64.tar.gz`);
      await execAsync('tar xzf conftest.tar.gz');
      await execAsync('sudo mv conftest /usr/local/bin/');
      await execAsync('chmod +x /usr/local/bin/conftest');
    }
  }

  private parseConftestResults(results: any): {
    denyCount: number;
    findings: Array<{
      rule: string;
      message: string;
      resource: string;
    }>;
  } {
    const findings: Array<{
      rule: string;
      message: string;
      resource: string;
    }> = [];

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