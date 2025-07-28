package main

deny[msg] {
  input.planned_values.root_module.resources[_].type == "aws_instance"
  resource := input.planned_values.root_module.resources[_]
  resource.type == "aws_instance"
  not resource.values.tags
  msg := sprintf("Missing required tags (owner, env) on %s in resource %s", [resource.type, resource.address])
} 