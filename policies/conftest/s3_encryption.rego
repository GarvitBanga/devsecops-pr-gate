package rules.s3_encryption

deny[msg] {
  input.resource_type == "aws_s3_bucket"
  not input.sse_enabled
  msg := sprintf("S3 encryption disabled for %s", [input.address])
} 