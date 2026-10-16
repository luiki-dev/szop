terraform {
  # Any 1.x from 1.16; the exact version is in .terraform-version. Write-only
  # arguments (secrets.tf) need 1.11 or later.
  required_version = "~> 1.16"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.68"
    }
    # The ephemeral password of secrets.tf.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}
