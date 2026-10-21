# nginx

nginx is a web server and reverse proxy: it accepts HTTP requests and passes each one on to one of several servers behind it. In Szop it runs only in [Docker Compose](docker-compose.md)'s `scale` profile, in front of two instances of the container image, standing in for the demo's load balancer. `pnpm check:scale` starts it; nothing else uses it, and it needs no install, since it runs from its official image.

## Why Szop uses it

- **Two instances locally and in CI:** [ADR 0036](../../decisions/0036-scalability-and-isolation.md), decision 14. The demo runs two ECS tasks behind an Application Load Balancer (ALB); a problem between them should show up on the developer's machine and in CI first. Something has to spread requests over two containers the way the ALB does, and nginx is the most common tool for it, small and configured in one file.
- **Not a production component:** the demo uses the ALB, never nginx. The profile proves the app behaves with two instances, not nginx's own settings.
- **Two named upstreams, not one replicated service:** nginx resolves a host name once, when it starts, so a Compose service with `deploy.replicas: 2` behind one name depends on how Docker's DNS answers at that moment. Naming `app-a` and `app-b` keeps the setup plain (PH-37 spec, decision 9).

## Configuration

**`compose.yaml`**, the `nginx` service: the image `nginx:1.30.6-alpine`, pinned to an exact version of nginx's stable line (an even minor number; odd ones are the mainline). Dependabot proposes updates through the `docker-compose` entry of `.github/dependabot.yml`, as for PostgreSQL. A proposal of an odd minor version is mainline; prefer waiting for the next stable one. The configuration file is mounted read-only over the image's `default.conf`, and port 8080 inside is published on `127.0.0.1:8081`. The image's start scripts log that they cannot modify the read-only file, which is expected.

**`compose/nginx-scale.conf`**:

- `upstream app { zone app 64k; server app-a:3000; server app-b:3000; }`: the two instances, in Compose's network by service name. nginx sends each request to the next one in turn (round-robin, its default).
- `zone app 64k`: a block of memory shared by nginx's worker processes, which holds the upstream's state, the turn included. The official image starts one worker per CPU, and without a shared zone each worker keeps its own turn, starting at `app-a`. Each new connection may land on another worker, so nearly every request went to `app-a`: the first run of `pnpm check:scale` saw exactly that.
- `listen 8080`: a port above 1024, the one Compose publishes.
- `proxy_pass http://app` with `Host` and `X-Forwarded-For` set, as a load balancer does. The apps run with `TRUSTED_PROXIES: none`, so they log nginx's address as the client's; the check needs nothing more.

## Everyday use

- `pnpm check:scale` starts and checks the profile, then removes it ([Scripts](../scripts.md#the-database-and-the-container-image), [testing guide](../testing.md#running-the-tests)).
- To keep it running and try it by hand: `docker compose exec postgres psql -U szop -d postgres -c 'CREATE DATABASE szop_scale'`, then `docker compose --profile scale up --no-build --wait` (after `pnpm check:image` or `docker compose --profile app build app` built the image), and ask <http://127.0.0.1:8081/api/health> a few times: `instance` alternates. `docker compose --profile scale down` removes it.
- **`nginx reached 1 instance(s), not 2`:** an upstream server is missing, or the `zone` line is gone.

## Official documentation

- Load balancing with nginx: <https://nginx.org/en/docs/http/load_balancing.html>
- The `upstream` module, `zone` included: <https://nginx.org/en/docs/http/ngx_http_upstream_module.html>
- The official image: <https://hub.docker.com/_/nginx>
