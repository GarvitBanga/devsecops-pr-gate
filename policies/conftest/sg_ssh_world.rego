package rules.ssh_world

deny[msg] {
  input.resource_type == "aws_security_group_rule"
  input.cidr == "0.0.0.0/0"
  input.port == 22
  msg := sprintf("SSH open to world at %s", [input.address])
} 