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

# Only Amazon's certificate authority and Let's Encrypt may issue
# certificates for the domain and its subdomains; every other authority must
# refuse, even if an attacker passes its validation. Amazon's issues the
# app's certificates. Let's Encrypt is here because GitHub Pages obtains the
# landing page's certificate from it and accepts no other (PH-34 spec,
# decision 3). The szop name has a record of its own below.
resource "aws_route53_record" "caa" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain
  type    = "CAA"
  ttl     = 3600
  records = ["0 issue \"amazon.com\"", "0 issue \"letsencrypt.org\""]
}

# A CAA record on a name takes precedence over its parent's, so the app's name
# stays with Amazon alone, as ADR 0030, decision 6 decided, although the apex
# now allows Let's Encrypt too. infra/demo's A record on the same name does
# not conflict with it: they are different record types.
resource "aws_route53_record" "caa_app" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.app_hostname
  type    = "CAA"
  ttl     = 3600
  records = ["0 issue \"amazon.com\""]
}

# The landing page on dzwoniec.com is served by GitHub Pages (PH-34). These
# are the addresses GitHub documents for an apex domain: four IPv4 and four
# IPv6.
resource "aws_route53_record" "pages_a" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain
  type    = "A"
  ttl     = 3600
  records = ["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"]
}

resource "aws_route53_record" "pages_aaaa" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain
  type    = "AAAA"
  ttl     = 3600
  records = ["2606:50c0:8000::153", "2606:50c0:8001::153", "2606:50c0:8002::153", "2606:50c0:8003::153"]
}

# GitHub Pages redirects www to the apex when this name points at the account's
# Pages host.
resource "aws_route53_record" "pages_www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${local.domain}"
  type    = "CNAME"
  ttl     = 3600
  records = ["luiki-dev.github.io"]
}

# Proves to GitHub that this account controls the domain, so another account's
# Pages site cannot claim it.
resource "aws_route53_record" "pages_challenge" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_github-pages-challenge-luiki-dev.${local.domain}"
  type    = "TXT"
  ttl     = 3600
  records = [local.github_pages_challenge]
}

# Null MX (RFC 7505): the domain receives no mail, so senders fail at once
# instead of retrying for days. A mailbox on the domain, or sending mail from
# an address on the apex, replaces it (RFC 7505 asks senders not to use a
# null-MX domain in From).
resource "aws_route53_record" "null_mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain
  type    = "MX"
  ttl     = 3600
  records = ["0 ."]
}
