import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';

export class ConftestScanner {
  async scan(terraformPath: string, policyPath: string, version?: string, additionalArgs?: string): Promise<{
    denyCount: number;
    findings: Array<{
      rule: string;
      message: string;
      resource: string;
    }>;
  }> {
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

    } catch (error) {
      core.warning(`Conftest scan failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        denyCount: 0,
        findings: []
      };
    }
  }

  private async runConftest(targetPath: string, policyPath: string, extraArgs: string[] = []): Promise<{ denies: number; details: string[] }> {
    let parserArgs: string[] = [];
    let target = targetPath;

    const looksLikeJsonFile = targetPath.endsWith('.json') && fs.existsSync(targetPath);
    if (looksLikeJsonFile) {
      parserArgs = ['--parser', 'json'];
      core.info('Using JSON parser for .json file');
    } else {
      if (!fs.existsSync(targetPath)) {
        core.warning(`Conftest target path not found: ${targetPath}`);
        return { denies: 0, details: [] };
      }
      parserArgs = ['--parser', 'hcl2'];
      core.info('Using HCL2 parser for Terraform files');
    }

    const args = ['test', target, '--policy', policyPath, ...parserArgs, '--output', 'json', ...extraArgs];
    core.info(`Executing: conftest ${args.join(' ')}`);

    let stdout = '';
    let stderr = '';
    const code = await exec.exec('conftest', args, {
      ignoreReturnCode: true, 
      listeners: {
        stdout: (data: Buffer) => (stdout += data.toString()),
        stderr: (data: Buffer) => (stderr += data.toString()),
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
      const failures: string[] = [];
      let denyCount = 0;
      for (const res of parsed) {
        if (!res?.failures) continue;
        for (const f of res.failures) {
          denyCount++;
          failures.push(f?.msg ?? JSON.stringify(f));
        }
      }
      return { denies: denyCount, details: failures };
    } catch (e) {
      core.warning(`Failed to parse Conftest JSON: ${(e as Error).message}`);
      return { denies: 0, details: [] };
    }
  }

  private async ensureConftestInstalled(version?: string): Promise<void> {
    try {
      await exec.exec('conftest', ['--version']);
      core.info('Conftest is already installed');
    } catch {
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
      } catch (error) {
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

  private async ensureTerraformInstalled(): Promise<void> {
    try {
      await exec.exec('terraform', ['--version']);
      core.info('Terraform is already installed');
    } catch {
      core.info('Installing Terraform...');
      await exec.exec('curl', ['-fsSL', 'https://releases.hashicorp.com/terraform/1.5.0/terraform_1.5.0_linux_amd64.zip', '-o', 'terraform.zip']);
      await exec.exec('unzip', ['terraform.zip']);
      await exec.exec('sudo', ['mv', 'terraform', '/usr/local/bin/']);
      await exec.exec('chmod', ['+x', '/usr/local/bin/terraform']);
      await exec.exec('rm', ['terraform.zip']);
    }
  }
} 