# Base's resources, found by name (PH-12b spec, decision 1). Each lookup fails
# if base has not been applied.
data "aws_route53_zone" "main" {
  name         = local.domain
  private_zone = false
}

# The app's two roles, which the task definitions name (PH-12c spec,
# infra/base: the app's roles and secret).
data "aws_iam_role" "task_execution" {
  name = local.task_execution_role
}

data "aws_iam_role" "task" {
  name = local.task_role
}

# The registry the app's image is pulled from.
data "aws_ecr_repository" "app" {
  name = local.image_repository
}

# The account, for the ARN of szop_app's password (locals.tf).
data "aws_caller_identity" "current" {}
