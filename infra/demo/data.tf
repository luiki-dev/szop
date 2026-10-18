# Base's hosted zone, found by name (PH-12b spec, decision 1). The lookup
# fails if base has not been applied.
data "aws_route53_zone" "main" {
  name         = local.domain
  private_zone = false
}
