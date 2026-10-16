# The app's log lines (ADR 0008, decision 27). In base, so a session's logs
# survive its teardown; PH-12's task definition writes to it.
resource "aws_cloudwatch_log_group" "app" {
  name              = "/szop/app"
  retention_in_days = 7
}
