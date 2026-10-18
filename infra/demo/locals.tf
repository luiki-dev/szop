locals {
  # Base's names. They are written here a second time, and change together
  # with infra/base/locals.tf: demo finds base's resources by name, not
  # through its state (PH-12b spec, decision 1).
  domain       = "dzwoniec.com"
  app_hostname = "szop.${local.domain}"

  # Two availability zones: the load balancer needs two, and PH-12c's
  # database subnet group does too.
  zone_a = "eu-central-1a"
  zone_b = "eu-central-1b"

  # PH-12b spec, decision 2.
  vpc_cidr       = "10.0.0.0/16"
  public_a_cidr  = "10.0.0.0/24"
  public_b_cidr  = "10.0.1.0/24"
  private_a_cidr = "10.0.10.0/24"
  private_b_cidr = "10.0.11.0/24"

  # What the load balancer answers until PH-12c puts the app behind it. It
  # names the commit, so demo-up can wait until this run's code answers
  # (PH-12b spec, decision 3). A fixed response's body is limited to 1024
  # bytes (checked by the HTTPS listener's precondition), so there are no
  # styles or scripts. A destroy has no commit, so null becomes "none"
  # instead of failing the template.
  placeholder_page = <<-EOT
    <!doctype html><html lang="en"><meta charset="utf-8"><title>Szop demo</title>
    <h1>The Szop demo is up</h1>
    <p>The app arrives in PH-12c. Deployed from commit <code>${coalesce(var.deployed_commit, "none")}</code>.</p></html>
  EOT
}
