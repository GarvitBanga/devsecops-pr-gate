package rules.s3_encryption

deny[msg] {
  input.resource_type == "aws_s3_bucket"
  not input.server_side_encryption_configuration
  msg := sprintf("S3 bucket missing server-side encryption configuration", [])
} 