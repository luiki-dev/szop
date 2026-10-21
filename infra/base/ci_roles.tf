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

  # Data, not configuration: the database's log files, the SQL text
  # Performance Insights keeps (the demo turns it off; this keeps a later
  # change from publishing it) and DynamoDB's items (Szop has no table). These
  # are every such read ReadOnlyAccess grants for RDS, ECS, ECR and DynamoDB
  # (checked against v190; OP-096, PH-12c spec, The plan role). ECS's reads
  # return configuration only: task definitions hold no secret values. Pulling
  # an image (ecr:BatchGetImage, ecr:GetDownloadUrlForLayer) stays allowed:
  # the image holds only the public code.
  statement {
    sid    = "DenyDataReads"
    effect = "Deny"
    actions = [
      "rds:DownloadDBLogFilePortion",
      "rds:DownloadCompleteDBLogFile",
      "pi:DescribeDimensionKeys",
      "pi:GetDimensionKeyDetails",
      "pi:GetResourceMetrics",
      "dynamodb:GetItem",
      "dynamodb:BatchGetItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:PartiQLSelect",
      "dynamodb:GetRecords",
      "dynamodb:ReadDataForReplication",
      "dynamodb:SearchVectors",
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

# The deploy role: what demo-up.yml assumes in the demo environment and
# demo-down.yml in the demo-teardown environment. The trust names those two
# environments only; the owner created both, with their protection, before
# the role trusted them. GitHub creates an environment, with no protection,
# the first time a job names it, so a role that trusted an environment before
# it exists would trust any job that names it (ADR 0032, decision 10). A pull
# request's token carries another subject and never matches.
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
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:luiki-dev@290870182/szop@1380292421:environment:demo-teardown"]
    }

    # main only, in AWS too: the environment's branch rule is a GitHub setting
    # that this policy cannot see, so a loosened rule still unlocks nothing
    # (ADR 0032, decision 14). demo, which runs from any branch, has its own
    # statement below.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:ref"
      values   = ["refs/heads/main"]
    }
  }

  # demo-up.yml deploys from any branch, so there is no ref pin: the owner's
  # required review on the demo environment is the gate (ADR 0012, decision
  # 16; ADR 0032, decisions 10 and 14).
  statement {
    sid     = "GitHubDemo"
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

    # The immutable subject for a job that names the demo environment
    # (ADR 0032, decision 13).
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:luiki-dev@290870182/szop@1380292421:environment:demo"]
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
# request (ADR 0032, decision 3). The inline policy reaches the demo's state
# and its lock file; the managed policies further down hold what infra/demo's
# resources need.
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

# What infra/demo's resources need, in customer managed policies, one per
# area: a role's inline policies share 10,240 characters, which the coming
# phases would exceed, while each managed policy holds 6,144 (PH-12b spec,
# decision 9). Every create, change and delete is scoped by the tags
# project = szop and group = demo: in the request when creating, on the
# resource when changing or deleting. Base and bootstrap carry project = szop
# too, so group = demo is what keeps the role away from base (ADR 0010,
# decision 16; PH-12b spec, decision 8). No IAM role is created or changed:
# the app's roles are base's (app_roles.tf) and are only passed, and the
# service-linked roles of Elastic Load Balancing, ECS and RDS already exist in
# the account.

# The VPC, its subnets, the internet gateway, the public route table and the
# security groups with their rules: the load balancer's, and from PH-12c the
# task's and the database's (EC2).
data "aws_iam_policy_document" "ci_deploy_demo_network" {
  # Refresh and the provider's waits. EC2's Describe actions support no
  # resource scoping.
  statement {
    sid       = "ReadNetwork"
    actions   = ["ec2:Describe*"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }
  }

  # Creates, with both tags in the request. The parent each create also names
  # (the VPC of a subnet, a route table or a security group; the security
  # group of a rule) is not in these resources: a request tag says nothing
  # about the parent, which is allowed by DemoNetworkResources only when it
  # carries the tags. Hence three statements, so no create's parent type
  # shares a statement with it.
  statement {
    sid     = "CreateVpcAndGateway"
    actions = ["ec2:CreateVpc", "ec2:CreateInternetGateway"]
    resources = [
      "arn:aws:ec2:*:*:vpc/*",
      "arn:aws:ec2:*:*:internet-gateway/*",
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/group"
      values   = ["demo"]
    }
  }

  statement {
    sid     = "CreateInVpc"
    actions = ["ec2:CreateSubnet", "ec2:CreateRouteTable", "ec2:CreateSecurityGroup"]
    resources = [
      "arn:aws:ec2:*:*:subnet/*",
      "arn:aws:ec2:*:*:route-table/*",
      "arn:aws:ec2:*:*:security-group/*",
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/group"
      values   = ["demo"]
    }
  }

  # aws_vpc_security_group_ingress_rule and _egress_rule tag the rule they
  # create.
  statement {
    sid       = "CreateSecurityGroupRule"
    actions   = ["ec2:AuthorizeSecurityGroupIngress", "ec2:AuthorizeSecurityGroupEgress"]
    resources = ["arn:aws:ec2:*:*:security-group-rule/*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/group"
      values   = ["demo"]
    }
  }

  # Tagging within those creates only, so CreateTags cannot bring an existing
  # resource within the role's reach.
  statement {
    sid       = "TagOnCreate"
    actions   = ["ec2:CreateTags"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "ec2:CreateAction"
      values = [
        "CreateVpc",
        "CreateSubnet",
        "CreateInternetGateway",
        "CreateRouteTable",
        "CreateSecurityGroup",
        "AuthorizeSecurityGroupIngress",
        "AuthorizeSecurityGroupEgress",
      ]
    }
  }

  # Changes, tag changes and deletes, and the parents of the creates above,
  # on resources that already carry both tags. RevokeSecurityGroupEgress: the
  # provider removes AWS's default allow-all egress rule when it creates the
  # group.
  statement {
    sid = "DemoNetworkResources"
    actions = [
      "ec2:ModifyVpcAttribute",
      "ec2:DeleteVpc",
      "ec2:CreateSubnet",
      "ec2:ModifySubnetAttribute",
      "ec2:DeleteSubnet",
      "ec2:AttachInternetGateway",
      "ec2:DetachInternetGateway",
      "ec2:DeleteInternetGateway",
      "ec2:CreateRouteTable",
      "ec2:CreateRoute",
      "ec2:ReplaceRoute",
      "ec2:DeleteRoute",
      "ec2:AssociateRouteTable",
      "ec2:ReplaceRouteTableAssociation",
      "ec2:DisassociateRouteTable",
      "ec2:DeleteRouteTable",
      "ec2:CreateSecurityGroup",
      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:RevokeSecurityGroupIngress",
      "ec2:AuthorizeSecurityGroupEgress",
      "ec2:RevokeSecurityGroupEgress",
      "ec2:ModifySecurityGroupRules",
      "ec2:UpdateSecurityGroupRuleDescriptionsIngress",
      "ec2:DeleteSecurityGroup",
      "ec2:CreateTags",
      "ec2:DeleteTags",
    ]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/group"
      values   = ["demo"]
    }
  }
}

resource "aws_iam_policy" "ci_deploy_demo_network" {
  name        = "szop-ci-deploy-demo-network"
  description = "The demo's VPC, subnets, internet gateway, route table and security group."
  policy      = data.aws_iam_policy_document.ci_deploy_demo_network.json
}

resource "aws_iam_role_policy_attachment" "ci_deploy_demo_network" {
  role       = aws_iam_role.ci_deploy.name
  policy_arn = aws_iam_policy.ci_deploy_demo_network.arn
}

# The application load balancer, its listeners and the certificate of the
# HTTPS listener (Elastic Load Balancing and ACM).
data "aws_iam_policy_document" "ci_deploy_demo_load_balancer" {
  # Refresh and the provider's waits. The ELB Describe* reads support no
  # resource scoping; the ACM reads are on * for simplicity.
  statement {
    sid = "ReadLoadBalancersAndCertificates"
    actions = [
      "elasticloadbalancing:Describe*",
      "acm:DescribeCertificate",
      "acm:ListCertificates",
      "acm:ListTagsForCertificate",
    ]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }
  }

  # A load balancer, with both tags in the request. A listener needs them in
  # the request and on its load balancer, the one resource CreateListener
  # names.
  statement {
    sid       = "CreateLoadBalancer"
    actions   = ["elasticloadbalancing:CreateLoadBalancer"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/group"
      values   = ["demo"]
    }
  }

  statement {
    sid       = "CreateListener"
    actions   = ["elasticloadbalancing:CreateListener"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/group"
      values   = ["demo"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/group"
      values   = ["demo"]
    }
  }

  # Tagging within those creates only.
  statement {
    sid       = "TagOnCreate"
    actions   = ["elasticloadbalancing:AddTags"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "elasticloadbalancing:CreateAction"
      values   = ["CreateLoadBalancer", "CreateListener"]
    }
  }

  # Changes, tag changes and deletes on a load balancer or listener that
  # carries both tags; a redeploy changes the HTTPS listener's fixed response
  # in place.
  statement {
    sid = "DemoLoadBalancers"
    actions = [
      "elasticloadbalancing:ModifyLoadBalancerAttributes",
      "elasticloadbalancing:ModifyCapacityReservation",
      "elasticloadbalancing:SetSecurityGroups",
      "elasticloadbalancing:SetSubnets",
      "elasticloadbalancing:SetIpAddressType",
      "elasticloadbalancing:DeleteLoadBalancer",
      "elasticloadbalancing:ModifyListener",
      "elasticloadbalancing:ModifyListenerAttributes",
      "elasticloadbalancing:DeleteListener",
      "elasticloadbalancing:AddTags",
      "elasticloadbalancing:RemoveTags",
    ]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/group"
      values   = ["demo"]
    }
  }

  # A certificate, with both tags in the request. ACM has no key like
  # ec2:CreateAction, so AddTagsToCertificate with these tags could also tag
  # an existing certificate and bring it within reach. Accepted: the account
  # holds no certificate outside the demo (PH-12b spec, The deploy role).
  statement {
    sid       = "RequestCertificate"
    actions   = ["acm:RequestCertificate", "acm:AddTagsToCertificate"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/group"
      values   = ["demo"]
    }
  }

  # Changes, tag changes and deletes on a certificate that carries both tags.
  # GetCertificate returns the public certificate only, never its private key.
  statement {
    sid = "DemoCertificates"
    actions = [
      "acm:GetCertificate",
      "acm:UpdateCertificateOptions",
      "acm:AddTagsToCertificate",
      "acm:RemoveTagsFromCertificate",
      "acm:DeleteCertificate",
    ]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/group"
      values   = ["demo"]
    }
  }
}

resource "aws_iam_policy" "ci_deploy_demo_load_balancer" {
  name        = "szop-ci-deploy-demo-load-balancer"
  description = "The demo's load balancer, its listeners and its certificate."
  policy      = data.aws_iam_policy_document.ci_deploy_demo_load_balancer.json
}

resource "aws_iam_role_policy_attachment" "ci_deploy_demo_load_balancer" {
  role       = aws_iam_role.ci_deploy.name
  policy_arn = aws_iam_policy.ci_deploy_demo_load_balancer.arn
}

# The szop record and the certificate's validation record in base's zone
# (Route 53, a global service: no region condition).
data "aws_iam_policy_document" "ci_deploy_demo_dns" {
  # infra/demo finds the zone by name, which pages through the zones (PH-12b
  # spec, decision 1). These two support no resource scoping.
  statement {
    sid       = "FindZone"
    actions   = ["route53:ListHostedZones", "route53:ListHostedZonesByName"]
    resources = ["*"]
  }

  # The lookup reads the zone and its tags; the records' refresh lists them.
  statement {
    sid = "ReadZone"
    actions = [
      "route53:GetHostedZone",
      "route53:ListTagsForResource",
      "route53:ListTagsForResources",
      "route53:ListResourceRecordSets",
    ]
    resources = [aws_route53_zone.main.arn]
  }

  # The provider waits until a change is in sync.
  statement {
    sid       = "ReadChanges"
    actions   = ["route53:GetChange"]
    resources = ["arn:aws:route53:::change/*"]
  }

  # Only szop.dzwoniec.com (an A alias) and the certificate's validation
  # CNAME _<token>.szop.dzwoniec.com. The apex's CAA, MX, DKIM, SPF and DMARC
  # records stay out of reach.
  statement {
    sid       = "ChangeDemoRecords"
    actions   = ["route53:ChangeResourceRecordSets"]
    resources = [aws_route53_zone.main.arn]

    condition {
      test     = "ForAllValues:StringLike"
      variable = "route53:ChangeResourceRecordSetsNormalizedRecordNames"
      values   = [local.app_hostname, "_*.${local.app_hostname}"]
    }

    condition {
      test     = "ForAllValues:StringEquals"
      variable = "route53:ChangeResourceRecordSetsRecordTypes"
      values   = ["A", "CNAME"]
    }
  }
}

resource "aws_iam_policy" "ci_deploy_demo_dns" {
  name        = "szop-ci-deploy-demo-dns"
  description = "The demo's records in the dzwoniec.com zone."
  policy      = data.aws_iam_policy_document.ci_deploy_demo_dns.json
}

resource "aws_iam_role_policy_attachment" "ci_deploy_demo_dns" {
  role       = aws_iam_role.ci_deploy.name
  policy_arn = aws_iam_policy.ci_deploy_demo_dns.arn
}

# The database: the RDS instance, its subnet group, and the secret RDS keeps
# the master password in (RDS, Secrets Manager and KMS). The database's
# security group is in szop-ci-deploy-demo-network.
data "aws_iam_policy_document" "ci_deploy_demo_database" {
  # Refresh and the provider's waits; the engine versions a create checks.
  statement {
    sid       = "ReadDatabases"
    actions   = ["rds:Describe*", "rds:ListTagsForResource"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }
  }

  # Creates, with both tags in the request. The subnet group an instance names
  # is allowed by UseSubnetGroup only when it carries the tags, so the two
  # creates have a statement each, as in the network policy.
  statement {
    sid       = "CreateSubnetGroup"
    actions   = ["rds:CreateDBSubnetGroup"]
    resources = ["arn:aws:rds:*:*:subgrp:*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/group"
      values   = ["demo"]
    }
  }

  # The instance's password must be RDS-managed and the instance must not be
  # publicly accessible: the provider sends both, as CloudTrail shows
  # ("manageMasterUserPassword":true, "publiclyAccessible":false), so the role
  # cannot create an instance with a password of its own or one open to the
  # internet (PH-12d spec, decision 12). A request that omits a key does not
  # match either, which is the safe side. The security group and the private
  # subnet group still keep the database off the internet; this condition
  # guards the request too. No other statement grants CreateDBInstance on
  # db: resources, or these conditions would be bypassed.
  statement {
    sid       = "CreateInstance"
    actions   = ["rds:CreateDBInstance"]
    resources = ["arn:aws:rds:*:*:db:*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/group"
      values   = ["demo"]
    }

    condition {
      test     = "Bool"
      variable = "rds:ManageMasterUserPassword"
      values   = ["true"]
    }

    condition {
      test     = "Bool"
      variable = "rds:PubliclyAccessible"
      values   = ["false"]
    }
  }

  # The instance uses the engine's default parameter and option groups, which
  # RDS owns and which carry no tags.
  statement {
    sid     = "UseDefaultGroups"
    actions = ["rds:CreateDBInstance"]
    resources = [
      "arn:aws:rds:*:*:pg:default.*",
      "arn:aws:rds:*:*:og:default:*",
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }
  }

  # Tagging within those creates. RDS has no key like ec2:CreateAction, so
  # AddTagsToResource with these tags could also tag an existing instance or
  # subnet group and bring it within reach. Accepted: the account holds no
  # RDS resource outside the demo, as for ACM.
  statement {
    sid     = "TagOnCreate"
    actions = ["rds:AddTagsToResource"]
    resources = [
      "arn:aws:rds:*:*:db:*",
      "arn:aws:rds:*:*:subgrp:*",
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/group"
      values   = ["demo"]
    }
  }

  # The subnet group an instance's create names, once it carries both tags. Its
  # own statement, on subnet groups only: CreateDBInstance on the instance
  # itself must stay with CreateInstance, whose conditions on the password and
  # public access would otherwise be bypassed by a grant on "*" that matches
  # the instance's tags (PH-12d task review).
  statement {
    sid       = "UseSubnetGroup"
    actions   = ["rds:CreateDBInstance"]
    resources = ["arn:aws:rds:*:*:subgrp:*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/group"
      values   = ["demo"]
    }
  }

  # Changes, tag changes and deletes on what already carries both tags.
  statement {
    sid = "DemoDatabases"
    actions = [
      "rds:ModifyDBInstance",
      "rds:DeleteDBInstance",
      "rds:ModifyDBSubnetGroup",
      "rds:DeleteDBSubnetGroup",
      "rds:AddTagsToResource",
      "rds:RemoveTagsFromResource",
    ]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/group"
      values   = ["demo"]
    }
  }

  # manage_master_user_password: RDS creates the master password's secret
  # with the caller's permissions, and deletes it with the instance itself.
  # It names its secrets rds!db-<id>. The caller never reads the value.
  # Only through RDS: CloudTrail shows PH-12c's two CreateSecret calls made
  # with this role's identity but with invokedBy rds.amazonaws.com, so
  # aws:ViaAWSService is the condition that fits; the role cannot call Secrets
  # Manager for such a secret itself. TagResource is needed too: RDS copies
  # the instance's tags onto the secret as it creates it, which CloudTrail
  # logs as no call of its own, and PH-12d's first demo was refused without
  # it (PH-12d spec, decision 12).
  statement {
    sid       = "CreateMasterSecret"
    actions   = ["secretsmanager:CreateSecret", "secretsmanager:TagResource"]
    resources = ["arn:aws:secretsmanager:*:*:secret:rds!db-*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "Bool"
      variable = "aws:ViaAWSService"
      values   = ["true"]
    }
  }

  # RDS also describes the key that encrypts that secret, Secrets Manager's
  # AWS managed key aws/secretsmanager (metadata only).
  statement {
    sid       = "DescribeSecretKey"
    actions   = ["kms:DescribeKey"]
    resources = ["arn:aws:kms:*:*:key/*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }
  }
}

resource "aws_iam_policy" "ci_deploy_demo_database" {
  name        = "szop-ci-deploy-demo-database"
  description = "The demo's database instance, its subnet group and its master password's secret."
  policy      = data.aws_iam_policy_document.ci_deploy_demo_database.json
}

resource "aws_iam_role_policy_attachment" "ci_deploy_demo_database" {
  role       = aws_iam_role.ci_deploy.name
  policy_arn = aws_iam_policy.ci_deploy_demo_database.arn
}

# The app's service: the ECS cluster, the two task definitions, the service
# and its target group (ECS and Elastic Load Balancing), passing the app's
# roles to ECS (IAM), and what demo-up does after the apply: run db-setup and
# scale the service.
data "aws_iam_policy_document" "ci_deploy_demo_service" {
  # Refresh, the provider's waits, and demo-up's describe-tasks and waits.
  # ECS's reads return configuration and task states, never a secret value.
  statement {
    sid       = "ReadEcs"
    actions   = ["ecs:Describe*", "ecs:List*"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }
  }

  # Creates, with both tags in the request: a cluster, a task definition of
  # the families szop-demo-*, and a service in the cluster szop-demo.
  statement {
    sid     = "CreateEcsResources"
    actions = ["ecs:CreateCluster", "ecs:RegisterTaskDefinition", "ecs:CreateService"]
    resources = [
      "arn:aws:ecs:*:*:cluster/*",
      "arn:aws:ecs:*:*:task-definition/szop-demo-*:*",
      "arn:aws:ecs:*:*:service/szop-demo/*",
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/group"
      values   = ["demo"]
    }
  }

  # Tagging within those creates only, and on db-setup's task, which run-task
  # tags with its task definition's tags (--propagate-tags TASK_DEFINITION).
  statement {
    sid       = "TagOnCreate"
    actions   = ["ecs:TagResource"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "ecs:CreateAction"
      values   = ["CreateCluster", "RegisterTaskDefinition", "CreateService", "RunTask"]
    }
  }

  # Changes, tag changes and deletes on what already carries both tags.
  # demo-up's update-service sets the service's count; Terraform scales it to
  # zero before deleting it.
  statement {
    sid = "DemoEcsResources"
    actions = [
      "ecs:UpdateService",
      "ecs:DeleteService",
      "ecs:DeleteCluster",
      "ecs:TagResource",
      "ecs:UntagResource",
    ]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/group"
      values   = ["demo"]
    }
  }

  # Terraform deregisters a revision when it replaces or destroys a task
  # definition. The action supports no resource and no tag condition, so it
  # reaches every revision; the account holds none outside the demo, and a
  # deregistered revision only stops starting new tasks.
  statement {
    sid       = "DeregisterTaskDefinitions"
    actions   = ["ecs:DeregisterTaskDefinition"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }
  }

  # demo-up's one-off db-setup task, in the demo's cluster only. The app's
  # task definition is started by the service, never by run-task.
  statement {
    sid       = "RunDbSetup"
    actions   = ["ecs:RunTask"]
    resources = ["arn:aws:ecs:eu-central-1:${var.account_id}:task-definition/szop-demo-db-setup:*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = ["arn:aws:ecs:eu-central-1:${var.account_id}:cluster/szop-demo"]
    }
  }

  # demo-up stops a db-setup task that outlives its deadline. Only db-setup's
  # tasks: the task's Name tag comes from its task definition (run-task
  # --propagate-tags), and the app's tasks carry another, so the role cannot
  # stop the running app (PH-12d spec, decision 12).
  statement {
    sid       = "StopDbSetup"
    actions   = ["ecs:StopTask"]
    resources = ["arn:aws:ecs:eu-central-1:${var.account_id}:task/szop-demo/*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = ["arn:aws:ecs:eu-central-1:${var.account_id}:cluster/szop-demo"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/Name"
      values   = ["szop-demo-db-setup"]
    }
  }

  # The target group, with both tags in the request. ECS registers and
  # deregisters the tasks itself, through its service-linked role.
  statement {
    sid       = "CreateTargetGroup"
    actions   = ["elasticloadbalancing:CreateTargetGroup"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/group"
      values   = ["demo"]
    }
  }

  # The tags CreateTargetGroup puts on the new group, allowed only within that
  # create (elasticloadbalancing:CreateAction), as TagOnCreate does for the
  # load balancer and its listeners.
  statement {
    sid       = "TagTargetGroupOnCreate"
    actions   = ["elasticloadbalancing:AddTags"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "elasticloadbalancing:CreateAction"
      values   = ["CreateTargetGroup"]
    }
  }

  # Changes and deletes on a target group that carries both tags. Its tag
  # changes and reads are in szop-ci-deploy-demo-load-balancer, which covers
  # every load balancing resource.
  statement {
    sid = "DemoTargetGroups"
    actions = [
      "elasticloadbalancing:ModifyTargetGroup",
      "elasticloadbalancing:ModifyTargetGroupAttributes",
      "elasticloadbalancing:DeleteTargetGroup",
    ]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/project"
      values   = ["szop"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/group"
      values   = ["demo"]
    }
  }

  # The two task definitions name the app's roles, and run-task starts a task
  # with them; both need the caller to pass them, to ECS tasks only. IAM is
  # global: no region condition.
  statement {
    sid       = "PassAppRoles"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.app_task_execution.arn, aws_iam_role.app_task.arn]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }

  # infra/demo finds the two roles by name.
  statement {
    sid       = "ReadAppRoles"
    actions   = ["iam:GetRole"]
    resources = [aws_iam_role.app_task_execution.arn, aws_iam_role.app_task.arn]
  }

  # The parameters' metadata, never their values. The action supports no
  # resource scoping.
  statement {
    sid       = "DescribeParameters"
    actions   = ["ssm:DescribeParameters"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }
  }
}

resource "aws_iam_policy" "ci_deploy_demo_service" {
  name        = "szop-ci-deploy-demo-service"
  description = "The demo's ECS cluster, task definitions, service and target group, db-setup's run and the app's roles."
  policy      = data.aws_iam_policy_document.ci_deploy_demo_service.json
}

resource "aws_iam_role_policy_attachment" "ci_deploy_demo_service" {
  role       = aws_iam_role.ci_deploy.name
  policy_arn = aws_iam_policy.ci_deploy_demo_service.arn
}

# Pushing the app's image to the registry szop (ECR), and infra/demo's lookup
# of the registry. Pushing is not a change to base's infrastructure: tags are
# immutable, so no image can be overwritten, and the lifecycle policy stays
# base's (ADR 0010, decision 16; PH-12c spec, The deploy role).
data "aws_iam_policy_document" "ci_deploy_image" {
  # A registry login token is account-wide, so it supports no resource.
  statement {
    sid       = "LogInToRegistry"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["eu-central-1"]
    }
  }

  # docker push uploads the missing layers and the manifest; demo-up's
  # describe-images checks whether the tag is there already. The lookup reads
  # the repository, its tags and its newest images.
  statement {
    sid = "PushImage"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
      "ecr:BatchGetImage",
      "ecr:DescribeImages",
      "ecr:DescribeRepositories",
      "ecr:ListTagsForResource",
    ]
    resources = [aws_ecr_repository.app.arn]
  }
}

resource "aws_iam_policy" "ci_deploy_image" {
  name        = "szop-ci-deploy-image"
  description = "Pushing the app's image to the registry szop."
  policy      = data.aws_iam_policy_document.ci_deploy_image.json
}

resource "aws_iam_role_policy_attachment" "ci_deploy_image" {
  role       = aws_iam_role.ci_deploy.name
  policy_arn = aws_iam_policy.ci_deploy_image.arn
}
