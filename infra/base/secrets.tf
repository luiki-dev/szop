# The Better Auth signing secret (ADR 0008, decisions 21 and 22; ADR 0030).
# Secret values never enter Terraform state: the password is ephemeral (never
# stored in state or plan files) and reaches AWS through value_wo, a
# write-only argument, so state keeps only value_wo_version.
#
# Letters and digits only, so the value never needs quoting in an
# environment variable.
ephemeral "random_password" "better_auth_secret" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "better_auth_secret" {
  name     = "/szop/better-auth-secret"
  type     = "SecureString"
  value_wo = ephemeral.random_password.better_auth_secret.result

  # A write-only value is sent only when this number changes. To rotate the
  # secret, raise it by one and apply: a new password is generated and stored,
  # and the app reads it at its next start, which signs everyone out. Changing
  # the password's settings alone sends nothing.
  value_wo_version = 1
}
