# The app on ECS with Fargate (ADR 0008, decisions 10 and 16; PH-12c spec,
# infra/demo: the service): one cluster, the app's task definition and
# db-setup's, and a service behind the load balancer.

# Reached from the load balancer only, on the app's port. Out: HTTPS to
# anywhere, for ECR, CloudWatch Logs, Systems Manager, Secrets Manager and ECS
# Exec (the public subnets have no VPC endpoints), and PostgreSQL to the
# database.
resource "aws_security_group" "task" {
  name        = "szop-demo-task"
  description = "App tasks of the Szop demo"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "szop-demo-task" }
}

resource "aws_vpc_security_group_ingress_rule" "task_from_alb" {
  security_group_id            = aws_security_group.task.id
  description                  = "The app's port from the load balancer"
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
  referenced_security_group_id = aws_security_group.alb.id

  tags = { Name = "szop-demo-task-from-alb" }
}

resource "aws_vpc_security_group_egress_rule" "task_https" {
  security_group_id = aws_security_group.task.id
  description       = "HTTPS to AWS's endpoints"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"

  tags = { Name = "szop-demo-task-https" }
}

resource "aws_vpc_security_group_egress_rule" "task_to_db" {
  security_group_id            = aws_security_group.task.id
  description                  = "PostgreSQL to the database"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.db.id

  tags = { Name = "szop-demo-task-to-db" }
}

resource "aws_ecs_cluster" "main" {
  name = "szop-demo"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = { Name = "szop-demo" }
}

locals {
  # The image demo-up built from this commit. A destroy has no commit, so null
  # becomes "none" instead of failing the template; the HTTPS listener's
  # precondition stops a create or change without one.
  image = "${data.aws_ecr_repository.app.repository_url}:${coalesce(var.deployed_commit, "none")}"

  # The database settings both containers share; DATABASE_USER and the
  # password differ.
  database_environment = [
    { name = "DATABASE_HOST", value = aws_db_instance.main.address },
    { name = "DATABASE_PORT", value = tostring(aws_db_instance.main.port) },
    { name = "DATABASE_NAME", value = aws_db_instance.main.db_name },
    { name = "DATABASE_TLS", value = "verify-full" },
  ]
}

# The app: 0.25 vCPU and 512 MB (ADR 0008, decision 10). The root filesystem
# stays writable, since ECS Exec's agent writes into the container (PH-12c
# spec, decision 16). WEB_ROOT is not set here: the image's ENV sets it to
# where the Dockerfile copies the SPA.
resource "aws_ecs_task_definition" "app" {
  family                   = "szop-demo-app"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = data.aws_iam_role.task_execution.arn
  task_role_arn            = data.aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name                   = "app"
      image                  = local.image
      essential              = true
      readonlyRootFilesystem = false

      portMappings = [{ containerPort = 3000, protocol = "tcp" }]

      environment = concat(local.database_environment, [
        { name = "HOST", value = "0.0.0.0" },
        { name = "PORT", value = "3000" },
        { name = "LOG_LEVEL", value = "info" },
        { name = "DATABASE_USER", value = "szop_app" },
        { name = "TRUSTED_PROXIES", value = local.trusted_proxies },
      ])

      # ECS fetches the value when the task starts; the task definition holds
      # only where it is (ADR 0008, decision 22).
      secrets = [
        { name = "DATABASE_PASSWORD", valueFrom = local.db_app_password_arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = local.log_group
          awslogs-region        = local.region
          awslogs-stream-prefix = "app"
        }
      }
    }
  ])

  tags = { Name = "szop-demo-app" }
}

# db-setup: the same image, roles and log group, another command. It connects
# as the master user and creates or updates szop_app, the role the app
# connects as; demo-up runs it once per deploy (PH-12c spec, decisions 4, 5
# and 11). Only this task definition names the master password's secret.
resource "aws_ecs_task_definition" "db_setup" {
  family                   = "szop-demo-db-setup"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = data.aws_iam_role.task_execution.arn
  task_role_arn            = data.aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name                   = "db-setup"
      image                  = local.image
      essential              = true
      readonlyRootFilesystem = false
      command                = ["node", "src/db-setup.ts"]

      environment = concat(local.database_environment, [
        { name = "DATABASE_USER", value = aws_db_instance.main.username },
        { name = "APP_DATABASE_USER", value = "szop_app" },
      ])

      # The password key of the secret RDS keeps the master password in.
      secrets = [
        { name = "DATABASE_PASSWORD", valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::" },
        { name = "APP_DATABASE_PASSWORD", valueFrom = local.db_app_password_arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = local.log_group
          awslogs-region        = local.region
          awslogs-stream-prefix = "db-setup"
        }
      }
    }
  ])

  tags = { Name = "szop-demo-db-setup" }
}

# The tasks register by IP address (awsvpc). The health check and the
# deregistration delay keep the load balancer's defaults until PH-12d tunes
# them (PH-12c spec, decision 12; OP-075).
resource "aws_lb_target_group" "app" {
  name        = "szop-demo-app"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  protocol    = "HTTP"
  port        = 3000

  health_check {
    path = "/api/health"
  }

  tags = { Name = "szop-demo-app" }
}

# Created at zero tasks: demo-up runs db-setup first, then sets the count to
# one, and Terraform leaves the count alone from then on (PH-12c spec,
# decision 6). Each task gets a public IP address in a public subnet, its way
# to AWS's endpoints without a NAT gateway (ADR 0008, decision 16).
resource "aws_ecs_service" "app" {
  name            = "szop-demo-app"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  launch_type     = "FARGATE"
  desired_count   = 0

  network_configuration {
    subnets          = [aws_subnet.public_a.id, aws_subnet.public_b.id]
    security_groups  = [aws_security_group.task.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 3000
  }

  # The migrations run at startup; failed health checks count only after a
  # minute (PH-12c spec, decision 12).
  health_check_grace_period_seconds = 60

  # ECS Exec, for debugging (ADR 0008, decision 20; PH-12c spec, decision 16).
  enable_execute_command = true

  # demo-up waits itself, after scaling to one.
  wait_for_steady_state = false

  # A service cannot attach to a target group that no listener uses.
  depends_on = [aws_lb_listener.https]

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = { Name = "szop-demo-app" }
}
