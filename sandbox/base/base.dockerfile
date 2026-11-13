# syntax=docker/dockerfile:1
# The overlay: files staged under /out land on the workload as they are.
FROM scratch
COPY files/ /usr/local/share/claude-base/
