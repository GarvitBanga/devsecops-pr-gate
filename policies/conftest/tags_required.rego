package rules.tags_required

deny[msg] {
  input.resource_type == "aws_instance"
  not input.tags
  msg := sprintf("Missing required tags (owner, env) on %s", [input.resource_type])
} 