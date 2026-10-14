output "state_bucket_name" {
  description = "The bucket every root module keeps its state in."
  value       = aws_s3_bucket.state.bucket
}
