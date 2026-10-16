# SES's sender identity is the whole domain (ADR 0030, decision 7): Szop may
# send from the apex or any subdomain, and the address is chosen in PH-18.
# Easy DKIM: SES signs every message with keys it rotates itself, and the
# domain is verified once the three DKIM records below resolve.
resource "aws_sesv2_email_identity" "domain" {
  email_identity = local.domain

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

# One CNAME per DKIM token. count is a literal 3, not the tokens' length:
# the tokens are unknown until SES creates the identity, and count or
# for_each over unknown values fails at plan time. Easy DKIM always returns
# three.
resource "aws_route53_record" "dkim" {
  count = 3

  zone_id = aws_route53_zone.main.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${local.domain}"
  type    = "CNAME"
  ttl     = 3600
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

# DMARC: receivers reject mail that claims to be from the domain but fails
# DKIM and SPF, which covers every subdomain too. Alignment stays relaxed
# (the default), so mail from an address on szop.dzwoniec.com aligns with
# DKIM's d=dzwoniec.com. No report address (rua): the domain has no mailbox.
resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_dmarc.${local.domain}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=DMARC1; p=reject"]
}

# SPF: no server may send with the domain as its envelope sender. SES uses
# its own amazonses.com envelope, so Szop's mail passes DMARC through DKIM.
# Route 53 keeps one TXT record set per name: a later TXT value on the apex
# joins this records list instead of becoming a second resource.
resource "aws_route53_record" "apex_txt" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain
  type    = "TXT"
  ttl     = 3600
  records = ["v=spf1 -all"]
}
