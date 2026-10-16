# Base's state, in the bucket bootstrap created (ADR 0008, decision 7). S3's
# native lock: a .tflock file next to the state, no DynamoDB table.
terraform {
  backend "s3" {
    bucket       = "szop-tfstate-ntrtcr"
    key          = "base/terraform.tfstate"
    region       = "eu-central-1"
    use_lockfile = true
    encrypt      = true
  }
}
