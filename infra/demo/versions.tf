terraform {
  # Any 1.x from 1.16; the exact version is in .terraform-version.
  required_version = "~> 1.16"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.68"
    }
  }
}
