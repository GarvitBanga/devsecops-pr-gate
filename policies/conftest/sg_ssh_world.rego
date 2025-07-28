package rules.ssh_world

deny[msg] {
  input.resource_type == "aws_security_group_rule"
  input.from_port == 22
  input.to_port == 22
  some cidr
  input.cidr_blocks[_] == cidr
  cidr == "0.0.0.0/0"
  msg := sprintf("SSH port 22 open to world (0.0.0.0/0)")
} 