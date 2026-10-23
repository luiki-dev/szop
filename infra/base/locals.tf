# The domain is public and never varies, so it is written here rather than
# kept in terraform.tfvars (ADR 0030).
locals {
  domain       = "dzwoniec.com"
  app_hostname = "szop.${local.domain}"

  # The value of the TXT record that proves to GitHub that the owner's account
  # controls the domain, so no other account's Pages site can claim it (PH-34
  # spec, decision 8). GitHub issues it and it is public in DNS.
  github_pages_challenge = "7fa28fb3d40f43f0d66b7070ea57a5"
}
