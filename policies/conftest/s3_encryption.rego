package main

deny[msg] {
  input.planned_values.root_module.resources[_].type == "aws_s3_bucket"
  resource := input.planned_values.root_module.resources[_]
  resource.type == "aws_s3_bucket"
  not resource.values.server_side_encryption_configuration
  msg := sprintf("S3 bucket missing server-side encryption configuration in resource %s", [resource.address])
} 