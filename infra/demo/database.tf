# The demo's database (ADR 0008, decision 19; PH-12c spec, infra/demo: the
# database): RDS PostgreSQL in the private subnets, recreated every session,
# so there are no backups and no final snapshot.

# Reached from the app's tasks only, on PostgreSQL's port. No egress rule: the
# database opens no connection of its own.
resource "aws_security_group" "db" {
  name        = "szop-demo-db"
  description = "Database of the Szop demo"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "szop-demo-db" }
}

resource "aws_vpc_security_group_ingress_rule" "db_from_task" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL from the app tasks"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.task.id

  tags = { Name = "szop-demo-db-from-task" }
}

resource "aws_db_subnet_group" "main" {
  name       = "szop-demo"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  tags = { Name = "szop-demo" }
}

resource "aws_db_instance" "main" {
  identifier = "szop-demo"

  # The major version of compose.yaml's postgres image; RDS picks its newest
  # minor version and applies minor upgrades (PH-12c spec, decision 14).
  engine                     = "postgres"
  engine_version             = "18"
  auto_minor_version_upgrade = true

  instance_class    = "db.t4g.micro"
  allocated_storage = 20
  storage_type      = "gp3"

  # RDS's AWS managed key, aws/rds.
  storage_encrypted = true

  multi_az               = false
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false

  db_name  = "szop"
  username = "szop_admin"

  # RDS creates the master password and keeps it in Secrets Manager, so it
  # never enters the state; db-setup gets it from there (OP-016; PH-12c spec,
  # decision 5).
  manage_master_user_password = true

  # No parameter group is named, so the engine's default applies, whose
  # rds.force_ssl is on from PostgreSQL 15: the database refuses connections
  # without TLS.

  # Recreated every session (ADR 0008, decision 19).
  backup_retention_period = 0
  skip_final_snapshot     = true
  deletion_protection     = false
  apply_immediately       = true

  performance_insights_enabled = false
  monitoring_interval          = 0

  tags = { Name = "szop-demo" }
}
