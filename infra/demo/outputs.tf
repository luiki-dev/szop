# The value demo-down reads to destroy with the code that created the demo
# (ADR 0032, decision 6).
output "deployed_commit" {
  description = "The commit the demo was deployed from."
  value       = var.deployed_commit
}

output "url" {
  description = "Where the demo answers."
  value       = "https://${local.app_hostname}"
}

# What demo-up's run-task and update-service need after the apply (PH-12c
# spec, demo-up.yml).
output "cluster" {
  description = "The ECS cluster the app runs in."
  value       = aws_ecs_cluster.main.name
}

output "db_setup_task_definition" {
  description = "The ARN of db-setup's task definition revision, for run-task."
  value       = aws_ecs_task_definition.db_setup.arn
}

output "service" {
  description = "The app's ECS service."
  value       = aws_ecs_service.app.name
}

output "task_subnets" {
  description = "The subnets db-setup's task runs in, comma-separated: the public ones, as the app's."
  value       = join(",", [aws_subnet.public_a.id, aws_subnet.public_b.id])
}

output "task_security_group" {
  description = "The security group of the app's and db-setup's tasks."
  value       = aws_security_group.task.id
}
