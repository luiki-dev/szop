# szop.dzwoniec.com points at the load balancer. The zone's CAA record already
# lets Amazon issue certificates (ADR 0030, decision 6).
resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.app_hostname
  type    = "A"

  alias {
    name    = aws_lb.main.dns_name
    zone_id = aws_lb.main.zone_id

    # There is only one target.
    evaluate_target_health = false
  }
}
