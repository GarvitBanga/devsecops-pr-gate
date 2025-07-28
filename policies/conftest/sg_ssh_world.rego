package main

deny[msg] {
  some name
  sg := input.resource.aws_security_group_rule[name]
  sg.type == "ingress"
  sg.from_port <= 22
  sg.to_port >= 22
  sg.cidr_blocks[_] == "0.0.0.0/0"
  msg := sprintf("SSH open to world in aws_security_group_rule.%s", [name])
} 