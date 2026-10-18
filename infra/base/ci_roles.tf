# The roles GitHub Actions assumes through the OIDC provider (github_oidc.tf):
# ADR 0010, decisions 15 and 16; ADR 0012, decision 17; ADR 0032.

# The plan role: what infra-plan.yml assumes on a pull request from this
# repository. It can read the infrastructure and nothing else. A pull request
# from a fork gets no OIDC token, so it never reaches this role.
data "aws_iam_policy_document" "ci_plan_trust" {
  statement {
    sid     = "GitHubPullRequests"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # The token's subject for any workflow run triggered by a pull_request
    # event in this repository. The repository uses GitHub's immutable
    # subject, so the owner and the repository are named with their numeric
    # IDs: a repository recreated under the same name gets another ID and is
    # not trusted (ADR 0032, decision 13).
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:luiki-dev@290870182/szop@1380292421:pull_request"]
    }
  }
}

resource "aws_iam_role" "ci_plan" {
  name               = "szop-ci-plan"
  assume_role_policy = data.aws_iam_policy_document.ci_plan_trust.json

  # The shortest session AWS allows for a role is one hour.
  max_session_duration = 3600
}

# Read access to every service's configuration, which is what terraform plan
# needs to refresh state. It includes access-analyzer:ValidatePolicy, which
# infra-plan.yml uses (checked against the live policy, version v190).
resource "aws_iam_role_policy_attachment" "ci_plan_read_only" {
  role       = aws_iam_role.ci_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# ReadOnlyAccess is broader than a public plan log should show, so explicit
# denies take back what must stay private (an explicit deny beats any allow).
# Everything infra-plan.yml prints is public (ADR 0010, decision 16).
data "aws_iam_policy_document" "ci_plan_denies" {
  # Secret values. ssm:DescribeParameters, which returns metadata only, stays
  # allowed through ReadOnlyAccess. The AWS provider calls GetParameter with
  # decryption when it refreshes aws_ssm_parameter, so infra-plan.yml plans
  # base with -refresh=false instead of loosening this deny (ADR 0032, decision 11).
  statement {
    sid    = "DenySecretValues"
    effect = "Deny"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath",
      "ssm:GetParameterHistory",
      "secretsmanager:GetSecretValue",
    ]
    resources = ["*"]
  }

  # S3 objects in every bucket except the two states a plan reads (base/ and
  # demo/ in the state bucket), which also keeps bootstrap's state unreadable
  # (ADR 0010, decision 16). The plan reads no other S3 object.
  statement {
    sid     = "DenyObjectsOutsideState"
    effect  = "Deny"
    actions = ["s3:GetObject", "s3:GetObjectVersion"]
    not_resources = [
      "arn:aws:s3:::szop-tfstate-ntrtcr/base/*",
      "arn:aws:s3:::szop-tfstate-ntrtcr/demo/*",
    ]
  }

  # Log lines can hold anything the app printed (ADR 0012, decision 17).
  statement {
    sid    = "DenyLogContents"
    effect = "Deny"
    actions = [
      "logs:GetLogEvents",
      "logs:FilterLogEvents",
      "logs:StartQuery",
      "logs:StartLiveTail",
    ]
    resources = ["*"]
  }

  # What the account spends is not public. ReadOnlyAccess grants reads in
  # these services; the whole service is denied, since the plan role needs no
  # billing action (OP-094, ADR 0032).
  statement {
    sid    = "DenyBillingAndCost"
    effect = "Deny"
    actions = [
      "ce:*",
      "budgets:*",
      "billing:*",
      "aws-portal:*",
      "cur:*",
      "bcm-data-exports:*",
      "invoicing:*",
      "payments:*",
      "freetier:*",
      "consolidatedbilling:*",
      "cost-optimization-hub:*",
      "savingsplans:*",
      "tax:*",
      "purchase-orders:*",
      "billingconductor:*",
    ]
    resources = ["*"]
  }

  # A pull request could print the owner's contact details into a public log
  # (ADR 0032, decision 5).
  statement {
    sid    = "DenyAccountContacts"
    effect = "Deny"
    actions = [
      "account:GetPrimaryEmail",
      "account:GetContactInformation",
      "account:GetAlternateContact",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "ci_plan_denies" {
  name   = "denies"
  role   = aws_iam_role.ci_plan.id
  policy = data.aws_iam_policy_document.ci_plan_denies.json
}

# The deploy role: what demo-down.yml assumes in the demo-teardown environment.
# The trust names that one environment only. GitHub creates an environment, with
# no protection, the first time a job names it, so a role that trusted an
# environment before it exists would trust any job that names it (ADR 0032,
# decision 10). A pull request's token carries another subject and never matches.
data "aws_iam_policy_document" "ci_deploy_trust" {
  statement {
    sid     = "GitHubDemoTeardown"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # The token's subject, in the immutable form, for a job that names the
    # demo-teardown environment (ADR 0032, decision 13).
    # demo is added in PH-12, in the pull request in which the owner creates
    # that environment with its required reviewer (ADR 0032, decision 10).
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:luiki-dev@290870182/szop@1380292421:environment:demo-teardown"]
    }
  }
}

resource "aws_iam_role" "ci_deploy" {
  name               = "szop-ci-deploy"
  assume_role_policy = data.aws_iam_policy_document.ci_deploy_trust.json

  # The shortest session AWS allows for a role is one hour.
  max_session_duration = 3600
}

# The role grows with infra/demo, phase by phase: each phase that adds a
# resource to infra/demo adds the permissions it needs here, in the same pull
# request (ADR 0032, decision 3). Today infra/demo has no resources, so the
# role only reaches the demo's state and its lock file.
data "aws_iam_policy_document" "ci_deploy_state" {
  # The whole bucket can be listed, though only the demo's state is readable.
  # S3 answers a request for a missing object with 404 only when the caller may
  # list the bucket, and with 403 otherwise; Terraform treats only 404 as "no
  # state yet", so a prefix limit would fail every run until a state exists
  # (ADR 0032, decision 12). The role sees key names, never other objects'
  # contents. The backend's env:/ listing is covered by this too.
  statement {
    sid       = "ListStateBucket"
    actions   = ["s3:ListBucket"]
    resources = ["arn:aws:s3:::szop-tfstate-ntrtcr"]
  }

  statement {
    sid       = "ReadWriteDemoState"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["arn:aws:s3:::szop-tfstate-ntrtcr/demo/terraform.tfstate"]
  }

  # use_lockfile: Terraform writes the lock next to the state and deletes it
  # when the run ends.
  statement {
    sid       = "ManageDemoLock"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["arn:aws:s3:::szop-tfstate-ntrtcr/demo/terraform.tfstate.tflock"]
  }
}

resource "aws_iam_role_policy" "ci_deploy_state" {
  name   = "state"
  role   = aws_iam_role.ci_deploy.id
  policy = data.aws_iam_policy_document.ci_deploy_state.json
}
