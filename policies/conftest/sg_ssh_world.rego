package main

deny[msg] {
  input.planned_values.root_module.resources[_].type == "aws_security_group_rule"
  resource := input.planned_values.root_module.resources[_]
  resource.type == "aws_security_group_rule"
  resource.values.from_port == 22
  resource.values.to_port == 22
  cidr := resource.values.cidr_blocks[_]
  cidr == "0.0.0.0/0"
  msg := sprintf("SSH port 22 open to world (0.0.0.0/0) in resource %s", [resource.address])
} 