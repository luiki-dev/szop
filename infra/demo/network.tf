# The demo's network (ADR 0008, decision 16; PH-12b spec, decision 2): a VPC
# with two public subnets for the load balancer and the app's tasks and two
# private ones for RDS. No NAT gateway and no VPC endpoints.
resource "aws_vpc" "main" {
  cidr_block = local.vpc_cidr

  # RDS and the ECS task need both.
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "szop-demo" }
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_a_cidr
  availability_zone       = local.zone_a
  map_public_ip_on_launch = false

  tags = { Name = "szop-demo-public-a" }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_b_cidr
  availability_zone       = local.zone_b
  map_public_ip_on_launch = false

  tags = { Name = "szop-demo-public-b" }
}

# No route beyond the VPC: the VPC's main route table, which only knows the
# local route, serves them.
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_a_cidr
  availability_zone = local.zone_a

  tags = { Name = "szop-demo-private-a" }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_b_cidr
  availability_zone = local.zone_b

  tags = { Name = "szop-demo-private-b" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "szop-demo" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "szop-demo-public" }
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}
