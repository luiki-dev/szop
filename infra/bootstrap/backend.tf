# Bootstrap's own state, moved into the bucket it created after the first
# apply (ADR 0029). S3's native lock: a .tflock file next to the state, no
# DynamoDB table.
terraform {
  backend "s3" {
    bucket       = "szop-tfstate-ntrtcr"
    key          = "bootstrap/terraform.tfstate"
    region       = "eu-central-1"
    use_lockfile = true
    encrypt      = true
  }
}
