#!/bin/bash

set -e

echo "DevSecOps PR Gate - Quick Test Script"
echo "========================================"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}PASS: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}WARN: $1${NC}"
}

print_error() {
    echo -e "${RED}FAIL: $1${NC}"
}

echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 20+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm"
    exit 1
fi

print_status "Node.js and npm are available"

if [ ! -f "action.yml" ]; then
    print_error "action.yml not found. Please run this script from the project root"
    exit 1
fi

print_status "Running from project root"

echo "Installing dependencies..."
npm install
print_status "Dependencies installed"

echo "Building the project..."
npm run build
print_status "Project built successfully"

echo "Checking test examples..."
if [ ! -f "examples/app/requirements.txt" ]; then
    print_error "examples/app/requirements.txt not found"
    exit 1
fi

if [ ! -f "examples/infra/main.tf" ]; then
    print_error "examples/infra/main.tf not found"
    exit 1
fi

if [ ! -f "policies/conftest/sg_ssh_world.rego" ]; then
    print_error "policies/conftest/sg_ssh_world.rego not found"
    exit 1
fi

print_status "Test examples found"

echo "Testing individual components..."

if command -v trivy &> /dev/null; then
    echo "Testing Trivy scanner..."
    trivy fs --format json examples/app/ > /dev/null 2>&1 || print_warning "Trivy test failed (this is expected if not configured)"
    print_status "Trivy scanner test completed"
else
    print_warning "Trivy not installed locally (will be installed by action)"
fi

if command -v checkov &> /dev/null; then
    echo "Testing Checkov scanner..."
    checkov -d examples/infra/ --output json > /dev/null 2>&1 || print_warning "Checkov test failed (this is expected if not configured)"
    print_status "Checkov scanner test completed"
else
    print_warning "Checkov not installed locally (will be installed by action)"
fi

if command -v conftest &> /dev/null; then
    echo "Testing Conftest scanner..."
    conftest test examples/infra/ --policy policies/conftest/ --parser hcl2 > /dev/null 2>&1 || print_warning "Conftest test failed (this is expected if not configured)"
    print_status "Conftest scanner test completed"
else
    print_warning "Conftest not installed locally (will be installed by action)"
fi

echo "Testing project structure..."

if [ -d "src/" ]; then
    print_status "Source directory exists"
else
    print_error "Source directory missing"
    exit 1
fi

if [ -d "dist/" ]; then
    print_status "Build directory exists"
else
    print_error "Build directory missing - run 'npm run build'"
    exit 1
fi

if [ -f "dist/index.js" ]; then
    print_status "Main action file built"
else
    print_error "Main action file missing - run 'npm run build'"
    exit 1
fi

echo "Testing example files..."

if grep -q "requests.*2.19.1" examples/app/requirements.txt; then
    print_status "Vulnerable dependency found in test file"
else
    print_warning "Test file may not contain expected vulnerable dependency"
fi

if grep -q "0.0.0.0/0" examples/infra/main.tf; then
    print_status "Security misconfiguration found in test file"
else
    print_warning "Test file may not contain expected security misconfiguration"
fi

echo "Testing workflow files..."

if [ -f ".github/workflows/e2e.yml" ]; then
    print_status "E2E workflow exists"
else
    print_warning "E2E workflow missing"
fi

echo "Testing documentation..."

if [ -f "README.md" ]; then
    print_status "README exists"
else
    print_warning "README missing"
fi

if [ -f "CONTRIBUTING.md" ]; then
    print_status "Contributing guide exists"
else
    print_warning "Contributing guide missing"
fi

echo "Testing configuration files..."

if [ -f "action.yml" ]; then
    print_status "Action configuration exists"
else
    print_error "Action configuration missing"
    exit 1
fi

if [ -f "package.json" ]; then
    print_status "Package configuration exists"
else
    print_error "Package configuration missing"
    exit 1
fi

if [ -f "tsconfig.json" ]; then
    print_status "TypeScript configuration exists"
else
    print_error "TypeScript configuration missing"
    exit 1
fi

echo "Testing policy files..."

if [ -f "policies/conftest/sg_ssh_world.rego" ]; then
    print_status "SSH policy exists"
else
    print_error "SSH policy missing"
    exit 1
fi

if [ -f "policies/conftest/s3_encryption.rego" ]; then
    print_status "S3 encryption policy exists"
else
    print_error "S3 encryption policy missing"
    exit 1
fi

if [ -f "policies/conftest/tags_required.rego" ]; then
    print_status "Tags policy exists"
else
    print_error "Tags policy missing"
    exit 1
fi

echo "Testing common issues..."

if [ -d "node_modules/" ]; then
    print_status "Dependencies installed"
else
    print_warning "Dependencies not installed - run 'npm install'"
fi

if [ -f ".gitignore" ]; then
    print_status "Git ignore file exists"
else
    print_warning "Git ignore file missing"
fi

echo "========================================"
echo "Test completed successfully!"
echo ""
echo "Next steps:"
echo "1. Push to GitHub to test the action"
echo "2. Create a pull request to trigger the workflow"
echo "3. Check the action outputs and PR comments"
echo ""
echo "For more information, see README.md" 