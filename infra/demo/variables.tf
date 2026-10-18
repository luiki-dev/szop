variable "account_id" {
  description = "The ID of Szop's AWS account; Terraform refuses to run against any other."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.account_id))
    error_message = "account_id must be the 12-digit AWS account ID, in quotes."
  }
}

variable "deployed_commit" {
  description = "The commit the demo is deployed from. Required to create or change the demo, not to destroy it; demo-up passes it (PH-12b spec, decision 7)."
  type        = string
  default     = null

  validation {
    condition     = var.deployed_commit == null || can(regex("^[0-9a-f]{40}$", var.deployed_commit))
    error_message = "deployed_commit must be the full 40-digit commit hash, in lowercase."
  }
}
