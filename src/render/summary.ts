export class SummaryRenderer {
  render(results: any, title: string, failOn: string): string {
    const hasBlockers = this.determineBlockers(results, failOn);
    
    let markdown = `<!-- devsecops-pr-gate:do-not-remove -->\n\n### ${title}\n\n`;
    
    markdown += '**Summary**\n';
    markdown += '| Tool    | Critical | High | Status |\n';
    markdown += '|---------|---------:|-----:|:------:|\n';
    
    const trivyStatus = this.getStatus(results.trivy, failOn);
    const checkovStatus = this.getStatus(results.checkov, failOn);
    const opaStatus = results.opa.denyCount > 0 ? 'FAIL' : 'PASS';
    
    markdown += `| Trivy   | ${results.trivy.critical}        | ${results.trivy.high}    | ${trivyStatus}     |\n`;
    markdown += `| Checkov | ${results.checkov.critical}        | ${results.checkov.high}    | ${checkovStatus}     |\n`;
    markdown += `| OPA     | –        | –    | ${opaStatus}     |\n\n`;
    
    markdown += '**Top Issues**\n';
    
    if (results.trivy.findings.length > 0) {
      for (const finding of results.trivy.findings.slice(0, 3)) {
        markdown += `- Trivy: \`${finding.package}\` – ${finding.severity.toUpperCase()} – ${finding.vulnerability} (${finding.description})\n`;
      }
      if (results.trivy.findings.length > 3) {
        markdown += `- *... and ${results.trivy.findings.length - 3} more Trivy findings. See full report in artifacts.*\n`;
      }
    }
    
    if (results.checkov.findings.length > 0) {
      for (const finding of results.checkov.findings.slice(0, 3)) {
        markdown += `- Checkov: \`${finding.resource}\` – ${finding.severity.toUpperCase()} – ${finding.check}\n`;
      }
      if (results.checkov.findings.length > 3) {
        markdown += `- *... and ${results.checkov.findings.length - 3} more Checkov findings. See full report in artifacts.*\n`;
      }
    }
    
    if (results.opa.findings.length > 0) {
      for (const finding of results.opa.findings.slice(0, 3)) {
        markdown += `- OPA: ${finding.message} at ${finding.resource}\n`;
      }
      if (results.opa.findings.length > 3) {
        markdown += `- *... and ${results.opa.findings.length - 3} more OPA findings. See full report in artifacts.*\n`;
      }
    }
    
    if (results.trivy.findings.length === 0 && results.checkov.findings.length === 0 && results.opa.findings.length === 0) {
      markdown += '- No security issues found!\n';
    }
    
    markdown += '\n';
    
    if (hasBlockers) {
      markdown += `*Merge blocked - findings ≥ ${failOn} exist.*\n`;
    } else {
      markdown += '*All security checks passed! Ready for merge.*\n';
    }
    
    return markdown;
  }

  private getStatus(toolResults: any, failOn: string): string {
    const hasBlockers = this.determineBlockers({ trivy: toolResults, checkov: toolResults }, failOn);
    return hasBlockers ? 'FAIL' : 'PASS';
  }

  private determineBlockers(results: any, failOn: string): boolean {
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
} 