import * as core from '@actions/core';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

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

      const jsonPath = await this.convertTerraformToJson(terraformPath);
      
      const args = additionalArgs ? ` ${additionalArgs}` : '';
      const isJsonFile = jsonPath.endsWith('.json');
      const parser = isJsonFile ? 'json' : 'hcl2';
      
      const absoluteJsonPath = path.resolve(jsonPath);
      const absolutePolicyPath = path.resolve(policyPath);
      const command = `conftest test ${absoluteJsonPath} --policy ${absolutePolicyPath} --parser ${parser} --output json${args}`;

      core.info(`Executing: ${command}`);
      try {
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr) {
          core.warning(`Conftest stderr: ${stderr}`);
        }
        
        core.info(`Conftest stdout: ${stdout}`);
        const results = JSON.parse(stdout);
        
        return this.parseConftestResults(results);
      } catch (execError) {
        core.error(`Conftest execution failed: ${execError}`);
        if (execError instanceof Error && 'stderr' in execError) {
          core.error(`Conftest stderr: ${(execError as any).stderr}`);
        }
        throw execError;
      }

    } catch (error) {
      core.warning(`Conftest scan failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        denyCount: 0,
        findings: []
      };
    }
  }

  private async convertTerraformToJson(terraformPath: string): Promise<string> {
    try {
      const tfFiles = await this.findTerraformFiles(terraformPath);
      if (tfFiles.length === 0) {
        throw new Error('No Terraform files found');
      }

      const jsonPath = path.join(terraformPath, 'terraform.json');
      if (fs.existsSync(jsonPath)) {
        core.info(`Using pre-generated Terraform JSON: ${jsonPath}`);
        return jsonPath;
      }

      core.warning('No pre-generated terraform.json found, falling back to raw file scanning');
      return terraformPath;

    } catch (error) {
      core.warning(`Failed to process Terraform files: ${error instanceof Error ? error.message : String(error)}`);
      core.info('Falling back to scanning raw Terraform files with Conftest');
      return terraformPath;
    }
  }

  private async findTerraformFiles(dir: string): Promise<string[]> {
    const files = await fs.promises.readdir(dir);
    return files.filter(file => file.endsWith('.tf'));
  }

  private async initializeTerraform(terraformPath: string): Promise<void> {
    try {
      await execAsync(`cd ${terraformPath} && terraform init`);
    } catch (error) {
      core.warning(`Terraform init failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async ensureConftestInstalled(version?: string): Promise<void> {
    try {
      await execAsync('conftest --version');
      core.info('Conftest is already installed');
    } catch {
      core.info('Installing Conftest...');
      const conftestVersion = version || 'v0.45.0';
      try {
        const versionWithoutV = conftestVersion.replace('v', '');
        await execAsync(`curl -L -o conftest.tar.gz https://github.com/open-policy-agent/conftest/releases/download/${conftestVersion}/conftest_${versionWithoutV}_Linux_x86_64.tar.gz`);
        await execAsync('tar -xzf conftest.tar.gz');
        await execAsync('sudo mv conftest /usr/local/bin/');
        await execAsync('chmod +x /usr/local/bin/conftest');
        await execAsync('rm conftest.tar.gz');
      } catch (error) {
        core.warning(`Direct download failed, trying alternative method: ${error}`);
        const versionWithoutV = conftestVersion.replace('v', '');
        await execAsync(`wget -O conftest.tar.gz https://github.com/open-policy-agent/conftest/releases/download/${conftestVersion}/conftest_${versionWithoutV}_Linux_x86_64.tar.gz`);
        await execAsync('tar -xzf conftest.tar.gz');
        await execAsync('sudo mv conftest /usr/local/bin/');
        await execAsync('chmod +x /usr/local/bin/conftest');
        await execAsync('rm conftest.tar.gz');
      }
    }
  }

  private async ensureTerraformInstalled(): Promise<void> {
    try {
      await execAsync('terraform --version');
      core.info('Terraform is already installed');
    } catch {
      core.info('Installing Terraform...');
      await execAsync('curl -fsSL https://releases.hashicorp.com/terraform/1.5.0/terraform_1.5.0_linux_amd64.zip -o terraform.zip');
      await execAsync('unzip terraform.zip');
      await execAsync('sudo mv terraform /usr/local/bin/');
      await execAsync('chmod +x /usr/local/bin/terraform');
      await execAsync('rm terraform.zip');
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