# tflint's configuration for every root module under infra/ (ADR 0029).
# Run through scripts/check-infra.sh; see docs/development/tools/tflint.md.

# The bundled Terraform rules: unused declarations, missing version
# constraints, deprecated syntax, untyped variables, naming.
plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

# AWS-specific mistakes: invalid instance types, regions, names. Updated by
# hand: Dependabot does not see tflint plugins.
plugin "aws" {
  enabled = true
  version = "0.49.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}
