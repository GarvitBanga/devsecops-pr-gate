terraform {
  required_version = ">= 1.0"
}

provider "aws" {
  region = "us-west-2"
}

# Intentional security issue: SSH open to world
resource "aws_security_group_rule" "ssh_world" {
  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.example.id
}

resource "aws_security_group" "example" {
  name_prefix = "example-"
  vpc_id      = "vpc-12345678"
}

# S3 bucket without encryption (another intentional issue)
resource "aws_s3_bucket" "example" {
  bucket = "my-example-bucket-12345"
  
  # Missing server_side_encryption_configuration
}

# Resource without required tags
resource "aws_instance" "example" {
  ami           = "ami-12345678"
  instance_type = "t3.micro"
  
  # Missing tags
} 