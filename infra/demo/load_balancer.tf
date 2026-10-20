# Open to the internet on the two web ports; out only to the app's tasks, on
# the app's port.
resource "aws_security_group" "alb" {
  name        = "szop-demo-alb"
  description = "Load balancer of the Szop demo"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "szop-demo-alb" }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from the internet"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"

  tags = { Name = "szop-demo-alb-https" }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from the internet, redirected to HTTPS"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"

  tags = { Name = "szop-demo-alb-http" }
}

resource "aws_vpc_security_group_egress_rule" "alb_to_task" {
  security_group_id            = aws_security_group.alb.id
  description                  = "The app's port on the app's tasks"
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
  referenced_security_group_id = aws_security_group.task.id

  tags = { Name = "szop-demo-alb-to-task" }
}

resource "aws_lb" "main" {
  name               = "szop-demo"
  load_balancer_type = "application"
  internal           = false
  ip_address_type    = "ipv4"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  drop_invalid_header_fields = true

  # The demo is destroyed every session.
  enable_deletion_protection = false

  # Nothing else ties the load balancer to the gateway. Created before its
  # VPC has one, an internet-facing load balancer fails with InvalidSubnet,
  # which the provider does not retry; on destroy this makes the load
  # balancer go before the gateway is detached (PH-12b spec, The load
  # balancer).
  depends_on = [aws_internet_gateway.main]

  tags = { Name = "szop-demo" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = { Name = "szop-demo-http" }
}

# Forwards to the app's tasks (PH-12c spec, infra/demo: the service).
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"

  # TLS 1.3 and 1.2 with strong ciphers only, post-quantum key exchange
  # where the browser offers it (PH-12b spec, decision 4).
  ssl_policy      = "ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09"
  certificate_arn = aws_acm_certificate_validation.main.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  # Preconditions are skipped when the listener is destroyed, so demo-down
  # works without a commit (PH-12b spec, decision 7).
  lifecycle {
    precondition {
      condition     = var.deployed_commit != null
      error_message = "deployed_commit is required to create or change the demo, so that demo-down can destroy it with the same code (ADR 0011, decision 7). Pass -var deployed_commit=$(git rev-parse HEAD)."
    }
  }

  tags = { Name = "szop-demo-https" }
}
