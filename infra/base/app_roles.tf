# The app's two roles (PH-12c spec, infra/base: the app's roles and secret).
# They live in base, so the demo's deploy role never creates or changes an IAM
# role: it only passes these two to ECS. infra/demo finds them by name.

# ECS tasks of this account only, in Frankfurt: the source conditions keep
# another account's task from being handed these roles (the confused deputy
# problem).
data "aws_iam_policy_document" "app_task_trust" {
  statement {
    sid     = "EcsTasks"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.account_id]
    }

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:ecs:eu-central-1:${var.account_id}:*"]
    }
  }
}

# The task execution role: what ECS itself uses to start a task (pull the
# image, create the log stream, fetch the secrets into the environment). The
# code in the container never holds it. Both task definitions, the app's and
# db-setup's, use it (PH-12c spec, decision 11). Not AWS's
# AmazonECSTaskExecutionRolePolicy, which pulls from every registry and writes
# to every log group.
resource "aws_iam_role" "app_task_execution" {
  name               = "szop-app-task-execution"
  assume_role_policy = data.aws_iam_policy_document.app_task_trust.json
}

data "aws_iam_policy_document" "app_task_execution" {
  # A registry login token is account-wide, so it supports no resource.
  statement {
    sid       = "LogInToRegistry"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  # Pulling the image from the registry szop only.
  statement {
    sid = "PullImage"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [aws_ecr_repository.app.arn]
  }

  # The awslogs driver writes each container's lines to its own stream in
  # /szop/app.
  statement {
    sid       = "WriteLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.app.arn}:log-stream:*"]
  }

  # szop_app's password, for DATABASE_PASSWORD in the app and
  # APP_DATABASE_PASSWORD in db-setup. The Better Auth secret joins in PH-18,
  # when the app first reads it.
  statement {
    sid       = "ReadAppDatabasePassword"
    actions   = ["ssm:GetParameters"]
    resources = [aws_ssm_parameter.db_app_password.arn]
  }

  # The master password RDS keeps in Secrets Manager, for db-setup's
  # DATABASE_PASSWORD. Only a task definition that names the secret gets it,
  # and only the deploy role registers task definitions, so the app's
  # container never sees it. RDS names its secrets rds!db-<id>; Task 6
  # narrows this if RDS copies the instance's tags to the secret.
  statement {
    sid       = "ReadMasterPassword"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:eu-central-1:${var.account_id}:secret:rds!db-*"]
  }
}

resource "aws_iam_role_policy" "app_task_execution" {
  name   = "task-execution"
  role   = aws_iam_role.app_task_execution.id
  policy = data.aws_iam_policy_document.app_task_execution.json
}

# The task role: what the code in the container may call. Today that is only
# ECS Exec's channel (ADR 0008, decision 20); sending email through SES joins
# in PH-18.
resource "aws_iam_role" "app_task" {
  name               = "szop-app-task"
  assume_role_policy = data.aws_iam_policy_document.app_task_trust.json
}

data "aws_iam_policy_document" "app_task" {
  # ECS Exec: the agent ECS injects opens its session through Systems Manager's
  # message channels. These actions support no resource scoping.
  statement {
    sid = "EcsExec"
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "app_task" {
  name   = "ecs-exec"
  role   = aws_iam_role.app_task.id
  policy = data.aws_iam_policy_document.app_task.json
}
