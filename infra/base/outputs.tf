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
