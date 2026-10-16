# The domain is public and never varies, so it is written here rather than
# kept in terraform.tfvars (ADR 0030).
locals {
  domain       = "dzwoniec.com"
  app_hostname = "szop.${local.domain}"
}
