# The certificate is created per session and destroyed with the demo
# (ADR 0030, decision 5). create_before_destroy: a redeploy that replaces it
# never leaves the listener without one.
resource "aws_acm_certificate" "main" {
  domain_name       = local.app_hostname
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "szop-demo" }
}

# ACM gives the same name and value for the same account and domain every
# session, so allow_overwrite lets this take over a record that an
# interrupted destroy left behind instead of failing the apply.
resource "aws_route53_record" "certificate_validation" {
  for_each = {
    for option in aws_acm_certificate.main.domain_validation_options : option.domain_name => {
      name   = option.resource_record_name
      type   = option.resource_record_type
      record = option.resource_record_value
    }
  }

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
  allow_overwrite = true
}

# Waits until ACM has issued the certificate; the HTTPS listener uses this
# resource's ARN, so it is created only afterwards.
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}
