# The domain's hosted zone (ADR 0030, decisions 3 and 4). Registering the
# domain through Route 53 created it, and the registration points at its four
# name servers. This block hands it to Terraform: the first plan shows it
# imported, not created. The block does nothing once the zone is in state,
# and stays to record where the zone came from.
import {
  to = aws_route53_zone.main
  id = "Z011808631BEGI0POK3WD"
}

# Never destroyed: a new zone gets new name servers, and the whole domain
# stops resolving until the registration points at them. The zone's own NS
# and SOA records are AWS's and stay outside Terraform. The comment is the
# registrar's, kept so the import does not rewrite it.
resource "aws_route53_zone" "main" {
  name    = local.domain
  comment = "HostedZone created by Route53 Registrar"

  lifecycle {
    prevent_destroy = true
  }
}

# Only Amazon's certificate authority may issue certificates for the domain
# and its subdomains; every other authority must refuse, even if an attacker
# passes its validation. A page served through another authority (for
# example GitHub Pages, with Let's Encrypt) adds that authority here.
resource "aws_route53_record" "caa" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain
  type    = "CAA"
  ttl     = 3600
  records = ["0 issue \"amazon.com\""]
}

# Null MX (RFC 7505): the domain receives no mail, so senders fail at once
# instead of retrying for days. A mailbox on the domain replaces it.
resource "aws_route53_record" "null_mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain
  type    = "MX"
  ttl     = 3600
  records = ["0 ."]
}
