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
