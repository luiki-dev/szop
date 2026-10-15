variable "account_id" {
  description = "The ID of Szop's AWS account; Terraform refuses to run against any other."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.account_id))
    error_message = "account_id must be the 12-digit AWS account ID, in quotes."
  }
}

variable "alert_email" {
  description = "Where AWS Budgets sends its alerts."
  type        = string

  validation {
    condition     = can(regex("^[^@[:space:]]+@[^@[:space:]]+$", var.alert_email))
    error_message = "alert_email must be an email address."
  }
}
