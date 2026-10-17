# GitHub Actions signs in to AWS with a short-lived OpenID Connect (OIDC)
# token instead of a stored key (ADR 0010, decision 15). AWS trusts tokens
# issued by this provider; which workflow may turn a token into credentials is
# decided by each role's trust policy (ci_roles.tf), never by the provider.
#
# No thumbprint_list: AWS validates GitHub's certificate chain against its own
# library of trusted root certificate authorities and no longer uses the
# thumbprint, and the pinned AWS provider makes the argument optional.
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}
