output "app_hostname" {
  description = "The app's name; infra/demo points it at the load balancer and issues its certificate."
  value       = local.app_hostname
}

output "ecr_repository_url" {
  description = "Where images are pushed and pulled: <account>.dkr.ecr.eu-central-1.amazonaws.com/szop."
  value       = aws_ecr_repository.app.repository_url
}

output "log_group_name" {
  description = "The CloudWatch log group the app writes to."
  value       = aws_cloudwatch_log_group.app.name
}

output "better_auth_secret_arn" {
  description = "The ARN of the Better Auth secret, for the task definition's secrets and the task execution role."
  value       = aws_ssm_parameter.better_auth_secret.arn
}

output "zone_id" {
  description = "The hosted zone of dzwoniec.com; infra/demo writes the szop record and the certificate's validation record into it."
  value       = aws_route53_zone.main.zone_id
}

output "domain_name" {
  description = "The domain."
  value       = local.domain
}
