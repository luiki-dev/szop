locals {
  # Base's names. They are written here a second time, and change together
  # with infra/base: demo finds base's resources by name, not through its
  # state (PH-12b spec, decision 1).
  domain                  = "dzwoniec.com"
  app_hostname            = "szop.${local.domain}"
  task_execution_role     = "szop-app-task-execution"
  task_role               = "szop-app-task"
  db_app_password_name    = "/szop/db-app-password"
  better_auth_secret_name = "/szop/better-auth-secret"
  image_repository        = "szop"
  log_group               = "/szop/app"

  # The parameter's ARN is built from the account and the name, not looked up:
  # data "aws_ssm_parameter" would read the password into the state (ADR 0008,
  # decision 22). The name starts with a slash, so none follows "parameter".
  db_app_password_arn    = "arn:aws:ssm:${local.region}:${data.aws_caller_identity.current.account_id}:parameter${local.db_app_password_name}"
  better_auth_secret_arn = "arn:aws:ssm:${local.region}:${data.aws_caller_identity.current.account_id}:parameter${local.better_auth_secret_name}"

  region = "eu-central-1"

  # Two availability zones: the load balancer needs two, and the database's
  # subnet group does too.
  zone_a = "eu-central-1a"
  zone_b = "eu-central-1b"

  # PH-12b spec, decision 2.
  vpc_cidr       = "10.0.0.0/16"
  public_a_cidr  = "10.0.0.0/24"
  public_b_cidr  = "10.0.1.0/24"
  private_a_cidr = "10.0.10.0/24"
  private_b_cidr = "10.0.11.0/24"

  # The load balancer's nodes live in the public subnets, so the app believes
  # X-Forwarded-For from these ranges only (PH-12c spec, decision 10).
  trusted_proxies = join(",", [local.public_a_cidr, local.public_b_cidr])
}
