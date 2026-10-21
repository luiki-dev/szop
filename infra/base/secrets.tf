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

# The password of szop_app, the database role the app connects as (PH-12c
# spec, decisions 4 and 7). The same pattern as the Better Auth secret, so the
# value never enters state. It lives in base, so it outlives each session's
# database: db-setup, run by demo-up, creates the role with it or sets it
# again. Letters and digits only: db-setup accepts printable ASCII only, and
# the value never needs quoting.
ephemeral "random_password" "db_app_password" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "db_app_password" {
  name     = "/szop/db-app-password"
  type     = "SecureString"
  value_wo = ephemeral.random_password.db_app_password.result

  # To rotate the password, raise this by one and apply base: a new password
  # is generated and stored. The next demo-up runs db-setup, which sets it on
  # szop_app, and starts tasks that read it. Until then, a task a running
  # demo restarts reads the new password, which the database does not know
  # yet, so rotate while the demo is down or run demo-up right after.
  value_wo_version = 1
}
