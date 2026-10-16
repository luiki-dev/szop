output "app_hostname" {
  description = "The app's name; infra/demo points it at the load balancer and issues its certificate."
  value       = local.app_hostname
}
