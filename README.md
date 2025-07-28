# DevSecOps PR Gate

Automated security scanning for pull requests using Trivy, Checkov, and OPA/Conftest.

## Quick Start

Add to `.github/workflows/pr-gate.yml`:

```yaml
name: DevSecOps PR Gate
on: [pull_request]

permissions:
  contents: read
  pull-requests: write

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: DevSecOps PR Gate
        uses: your-username/devsecops-pr-gate@v0.1
        with:
          paths-app: 'app/'
          paths-iac: 'infra/'
          fail-on: 'high'
          opa-policy-path: 'policies/conftest'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Features

- **Trivy**: Scans dependencies and containers
- **Checkov**: Checks Terraform/CloudFormation
- **OPA/Conftest**: Enforces custom policies
- **PR Comments**: Posts sticky comments
- **Blocking**: Fails PRs based on severity

## Configuration

| Input | Description | Default |
|-------|-------------|---------|
| `paths-app` | App code directory | `app/` |
| `paths-iac` | Infrastructure directory | `infra/` |
| `fail-on` | Block on: critical, high, off | `high` |
| `opa-policy-path` | Policy directory | `policies/conftest` |

## Outputs

- `comment-url`: PR comment URL
- `trivy-high/critical`: Trivy finding counts
- `checkov-high/critical`: Checkov finding counts
- `opa-deny-count`: Policy violations
- `has-blockers`: Whether PR is blocked

## Example

The action creates a sticky PR comment like this:

**Summary**
| Tool    | Critical | High | Status |
|---------|---------:|-----:|:------:|
| Trivy   | 0        | 2    | FAIL     |
| Checkov | 0        | 1    | FAIL     |
| OPA     | –        | –    | FAIL     |

**Top Issues**
- Trivy: `requests 2.19.1` – HIGH – CVE-2021-33503
- Checkov: `aws_security_group_rule.ssh_world` – HIGH – CKV_AWS_23
- OPA: SSH access open to world

*Merge blocked - findings ≥ high exist.*

## Development

```bash
npm install
npm run build
```


## License

MIT 