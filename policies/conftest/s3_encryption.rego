package main

deny[msg] {
  some name
  bucket := input.resource.aws_s3_bucket[name]
  not bucket.server_side_encryption_configuration
  msg := sprintf("S3 encryption disabled for aws_s3_bucket.%s", [name])
} 