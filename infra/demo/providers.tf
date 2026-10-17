provider "aws" {
  region = "eu-central-1"

  # Terraform stops if the credentials belong to any other account.
  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      project = "szop"
      group   = "demo"
    }
  }
}
