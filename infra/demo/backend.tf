# Only the backend and the provider until PH-12, so a destroy has nothing to do
# (ADR 0011, decision 2). The demo's state, in the bucket bootstrap created
# (ADR 0008, decision 7); S3's native lock: a .tflock file next to the state.
terraform {
  backend "s3" {
    bucket       = "szop-tfstate-ntrtcr"
    key          = "demo/terraform.tfstate"
    region       = "eu-central-1"
    use_lockfile = true
    encrypt      = true
  }
}
