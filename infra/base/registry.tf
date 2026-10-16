# The one image repository (ADR 0008, decisions 12 and 13; ADR 0030). Tags are
# immutable, so a published version can never be overwritten. Basic scanning
# on push is free; scanning in CI is OP-090. force_delete = false: Terraform
# refuses to destroy the repository while it holds images.
resource "aws_ecr_repository" "app" {
  name                 = "szop"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }
}

# ECR has no "keep" action, only "expire". An image matched by a rule can
# never be expired by a rule of lower priority (a higher rulePriority number),
# so rule 1 shields released images by matching them with a count that is
# never reached. Rule 2 must stay last: ECR requires the tagStatus "any" rule
# to have the highest rulePriority. A release image carries its commit hash
# and its v* version on the same digest, so rule 1 matches it. Commit hashes
# are hexadecimal and never start with "v". Rule 2 still counts the shielded
# images: it ranks every image by push time, releases included, so an image
# without a v* tag is kept only while it is among the 10 newest overall.
resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep released images: v* tags are never expired."
        selection = {
          tagStatus      = "tagged"
          tagPatternList = ["v*"]
          countType      = "imageCountMoreThan"
          countNumber    = 9999
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep the 10 newest images of any kind; older ones expire unless a v* tag shields them."
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = { type = "expire" }
      },
    ]
  })
}
