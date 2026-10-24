# Glossary

Acronyms and terms used across Szop's documentation. Common ones (API, UI, HTTP, JSON, SQL, URL) are not listed.

## Acronyms

| Acronym | Stands for | Meaning |
|---|---|---|
| **ACL** | Access Control List | A list of rules saying who may do what to a resource. In S3, per-object ACLs are switched off (`BucketOwnerEnforced`) and policies decide instead; in AWS WAF, a *web ACL* is the container of a firewall's rules. |
| **ACM** | AWS Certificate Manager | Issues free TLS certificates for domains you control, for use on AWS load balancers. |
| **ADR** | Architecture Decision Record | A short document recording one significant decision: its context, the options considered, the choice and its consequences. Ours live in `docs/decisions/`. |
| **ALB** | Application Load Balancer | AWS's HTTP(S) load balancer: it decrypts HTTPS and forwards requests to healthy targets. Fronts Szop's demo. |
| **ARN** | Amazon Resource Name | The unique identifier of an AWS resource, such as `arn:aws:ssm:eu-central-1:…:parameter/…`. |
| **AWS** | Amazon Web Services | Amazon's cloud platform, the largest hyperscaler. Szop's demo environment runs on it (see ADR 0008). |
| **AZ** | Availability Zone | One of several separate data centers within an AWS region, with independent power and networking. |
| **CA** | Certificate Authority | An organisation whose signature on a TLS certificate vouches that the certificate belongs to the name it carries. A client trusts a list of CAs, a CA bundle; with `DATABASE_TLS=verify-full` the API trusts only Amazon's RDS bundle (see ADR 0033). |
| **CAA** | Certification Authority Authorization | A DNS record naming the certificate authorities allowed to issue certificates for a domain. Szop's allows Amazon and Let's Encrypt at the apex and only Amazon on `szop.dzwoniec.com` (see ADR 0030 and ADR 0044). |
| **CalVer** | Calendar Versioning | Version numbers built from the release date, such as `2026.10.0`. Considered, not used (see ADR 0009). |
| **CDK** | Cloud Development Kit | AWS's infrastructure-as-code tool in general-purpose languages such as TypeScript. Considered, not used (see ADR 0008). |
| **CDN** | Content Delivery Network | A network of servers around the world that serves static files close to users and can absorb or filter traffic floods in front of the application. |
| **CI/CD** | Continuous Integration / Continuous Delivery (or Deployment) | **CI:** every change is built and checked automatically, here by GitHub Actions on every PR. **CD:** every change that passes the checks can be released or deployed at the push of a button; continuous *deployment* goes further and deploys every change by itself. |
| **CIDR** | Classless Inter-Domain Routing | A way to write a range of IP addresses as an address and a prefix length, such as `10.0.0.0/16` (every address starting with `10.0.`). `TRUSTED_PROXIES` takes them (see ADR 0025). |
| **CLI** | Command-line interface | A program used by typing commands in a terminal, such as `git`, `gh`, `terraform` or the AWS CLI. |
| **CLS** | Cumulative Layout Shift | A Core Web Vital: how much visible content jumps around while a page loads. "Good" is at most 0.1 ([NFR-3](requirements/functional-requirements.md#nfr-3)). |
| **CORP** | Cross-Origin Resource Policy | A response header with which a server says which origins' pages may receive its responses (`same-origin`, `same-site`, `cross-origin`). Helmet sends `same-origin`; `/api/health` sends `same-site`, so the landing page can tell that the demo answers (see ADR 0046). |
| **CORS** | Cross-Origin Resource Sharing | Browser rules deciding when a page from one domain may call an API on another domain. Not needed when frontend and API share one origin. |
| **CRLF / LF** | Carriage Return + Line Feed / Line Feed | The two conventions for ending a line of text: Windows uses CRLF, Linux and macOS use LF. Szop's repository uses LF only. |
| **CRUD** | Create, Read, Update, Delete | The four basic operations on data. |
| **CSP** | Content Security Policy | An HTTP header telling the browser which sources a page may load scripts, styles and other content from, which limits the damage of an injected script. Szop allows only its own files and no inline scripts (see ADR 0012). |
| **CSRF** | Cross-Site Request Forgery | An attack where another site makes the victim's browser send a request, with the victim's cookies, that changes data. Countered by `SameSite` cookies and by refusing unsafe requests whose `Sec-Fetch-Site` or `Origin` header shows they came from another site (see ADR 0012). |
| **CVE** | Common Vulnerabilities and Exposures | The public catalog of known security flaws in software, each with an ID such as `CVE-2026-12345`, the affected versions and, once one exists, the fixed version. Image scanners such as Trivy list the CVEs in an image's packages; since PH-35 CI scans Szop's image on every PR that rebuilds it (see ADR 0041). |
| **DKIM** | DomainKeys Identified Mail | A signature on outgoing email, checked against a key published in DNS, proving the mail really comes from the domain. |
| **DMARC** | Domain-based Message Authentication, Reporting and Conformance | A DNS record telling receiving mail servers what to do with mail that fails the SPF and DKIM checks, which stops others sending mail in the domain's name. |
| **DNS** | Domain Name System | The internet's directory that turns names (`szop.dzwoniec.com`) into addresses. |
| **DOM** | Document Object Model | The browser's tree of objects representing a page; JavaScript reads and changes the page through it. |
| **DoS** | Denial of Service | An attack that makes a service unavailable, either by flooding it with traffic (volumetric) or by making it exhaust resources such as database space (resource exhaustion). |
| **E2E** | End-to-end | A test that drives the real app in a real browser, through every layer (SPA → API → database), the way a user would. Szop has one E2E journey per use case (see ADR 0007). |
| **EC2** | Elastic Compute Cloud | AWS's virtual machines. Szop does not manage any: Fargate runs its container without them. |
| **ECR** | Elastic Container Registry | AWS's storage for container images. |
| **ECS** | Elastic Container Service | AWS's service for running containers. Szop's demo runs one ECS task on Fargate. |
| **EKS** | Elastic Kubernetes Service | AWS's managed Kubernetes. Far more than Szop needs; not used (see ADR 0008). |
| **ESM** | ECMAScript Modules | The standard JavaScript module system (`import` / `export`). Replaces CommonJS (`require`), the older Node-only format. Szop uses ESM everywhere. |
| **GHSA** | GitHub Security Advisory | An entry in GitHub's advisory database describing a vulnerability in a package, such as `GHSA-67mh-4wv8-2f99`; `pnpm audit` and Dependabot report them. |
| **GUI** | Graphical user interface | A program used through windows and buttons rather than typed commands, such as the AWS console. |
| **HCL** | HashiCorp Configuration Language | The language Terraform configuration is written in. |
| **HCP** | HashiCorp Cloud Platform | HashiCorp's hosted services; HCP Terraform stores Terraform state and runs Terraform remotely. Szop keeps state in its own S3 bucket instead. |
| **HSTS** | HTTP Strict Transport Security | An HTTP header telling the browser to use only HTTPS for a domain from then on, so the first plain-HTTP request cannot be intercepted. |
| **HTTPS** | HTTP Secure | HTTP encrypted with TLS. |
| **IaC** | Infrastructure as Code | Describing servers, networks and databases in files kept in git, and letting a tool create them, instead of clicking in a console. Szop uses Terraform. |
| **IAM** | Identity and Access Management | AWS's system of users, roles and permissions deciding who may do what. |
| **ICANN** | Internet Corporation for Assigned Names and Numbers | The body that runs the domain name system's registries and accredits registrars. |
| **IDOR** | Insecure Direct Object Reference | A hole where a request names a record by its ID and the server does not check that the caller may use it, for example an item pointing at another user's category. Closed in Szop by resolving every ID within the workspace (see ADR 0012). |
| **IGW** | Internet Gateway | The door between an AWS VPC and the internet. A subnet is public when its route table sends `0.0.0.0/0` (all addresses) through the gateway. Szop's demo has one (see ADR 0034). |
| **INP** | Interaction to Next Paint | A Core Web Vital: how long the page takes to visibly respond to a tap, click or key press. "Good" is at most 200 ms ([NFR-3](requirements/functional-requirements.md#nfr-3)). |
| **JSX** | JavaScript XML | HTML-like syntax inside JavaScript or TypeScript, used to write React components. It has been used in `apps/web` since [PH-05](roadmap.md#ph-05-spa-skeleton). |
| **JWT** | JSON Web Token | A signed token carrying claims about a user. An alternative to server-side sessions; not used in Szop. |
| **KMS** | (AWS) Key Management Service | AWS's service for encryption keys. A customer-managed key costs $1 a month; Szop's state bucket uses S3-managed keys instead (SSE-S3), which Trivy's `AWS-0132` flags and Szop accepts (see ADR 0041). |
| **LCP** | Largest Contentful Paint | A Core Web Vital: when the largest piece of content (usually the main text block or image) appears. "Good" is at most 2.5 s ([NFR-3](requirements/functional-requirements.md#nfr-3)). |
| **LCU** | Load Balancer Capacity Unit | The unit AWS bills a load balancer's traffic in, on top of its hourly price: new connections, active connections, bytes and rule evaluations, whichever is highest. A demo's traffic uses a tiny fraction of one. |
| **LLM** | Large Language Model | An AI model trained on large amounts of text, such as the Claude models behind Claude Code. graphify sends docs through one to build its graph (see ADR 0031). |
| **LTS** | Long-Term Support | A release line that receives fixes for an extended period. Even-numbered Node.js releases (22, 24, …) become LTS. |
| **MCP** | Model Context Protocol | An open protocol that lets an AI assistant call tools and read data served by another program, such as graphify's query server (see ADR 0031). |
| **MFA** | Multi-Factor Authentication | Logging in with a second proof besides the password, such as a code from an authenticator app. |
| **MSW** | Mock Service Worker | A library that intercepts the app's HTTP requests at the network level and answers them with fake responses. Szop's component tests use it, so the real API client runs unchanged. |
| **MVP** | Minimum Viable Product | The smallest release that is useful on its own. In the requirements, `[MVP]` marks what the first release contains. |
| **MX** | Mail Exchanger | The DNS record naming the servers that receive a domain's mail. Szop's is a null MX, `0 .`, saying it receives none (see ADR 0030). |
| **NAT** | Network Address Translation | In AWS: a NAT gateway lets resources in a private subnet reach the internet. Costs about $32 a month on AWS; not used (see ADR 0008). In WSL: its default networking mode, where Windows hands the Linux side a private address; the alternative, mirrored mode, broke Playwright's start (see the [setup guide](development/setup.md#the-end-to-end-journeys)). |
| **NFR** | Non-functional requirement | A quality the system must have rather than something it does: supported browsers, accessibility, performance. Szop's are [NFR-1 to NFR-3](requirements/functional-requirements.md#3-non-functional-requirements). |
| **nvm** | Node Version Manager | A tool that installs and switches Node.js versions per user. Szop's `.nvmrc` tells it which one to use. |
| **OAuth / OIDC** | Open Authorization / OpenID Connect | Standards for logging in through another provider ("Sign in with Google"). Relevant for the social-login future extension. Also how CI logs in to AWS without stored keys: GitHub signs a token saying which repository the job belongs to and which environment, branch or PR event it runs for, and AWS exchanges it for short-lived credentials (see ADR 0010 and ADR 0012). |
| **OFL** | SIL Open Font License | A free license for fonts: they may be used, bundled and shipped with software, but not sold on their own. Gabarito is under it (see ADR 0022). |
| **OKLCH** | Oklab Lightness, Chroma, Hue | A way of writing colors as lightness, colorfulness and hue, in a color space built so that equal steps look equally different to the eye. Tailwind CSS v4 writes its palette in it; Szop's contrast test lets the browser convert it to sRGB (see ADR 0048). |
| **OpenSSF** | Open Source Security Foundation | A Linux Foundation project for open-source security. Its **Scorecard** rates a repository's security practices. Not used yet (see ADR 0010). |
| **ORM** | Object-Relational Mapper | A library that maps database tables to objects or types in code and builds queries. Drizzle is ours. |
| **OSS** | Open-Source Software | Software whose source anyone may read, change and share. In "Redis OSS", AWS's name for the open-source Redis engine on ElastiCache, next to Valkey, its open-source fork. |
| **PaaS** | Platform as a Service | A hosting service where you hand over the app and the platform runs it (Render, Railway, Fly.io, Heroku). Considered, not used (see ADR 0008). |
| **PAT** | Personal Access Token | A GitHub token that acts as the person who created it, with the permissions they chose. Considered for release-please, not used: Szop uses a GitHub App (see ADR 0010). |
| **PID** | Process Identifier | The number the operating system gives a running process. Inside a container, the first process is PID 1 and receives the stop signal (`SIGTERM`); Szop's API is PID 1 and handles it itself (see ADR 0028). |
| **PR** | Pull Request | A request to merge a branch into another (usually `main`), where the change can be reviewed and checked by CI before it lands. |
| **PWA** | Progressive Web App | A web app that can be installed on a phone's home screen and caches its files with a service worker, so it starts without a network. A future option for Szop. |
| **RDS** | Relational Database Service | AWS's managed database servers. Szop's demo uses RDS for PostgreSQL. |
| **REST** | Representational State Transfer | An API style where URLs name resources (`/api/lists/42`) and HTTP methods say what to do with them (`GET`, `POST`, `PATCH`, `DELETE`). |
| **RLS** | Row-Level Security | A PostgreSQL feature that filters every query by policies attached to a table, such as "only this workspace's rows". Considered for Szop, not used (see ADR 0012). |
| **S3** | Simple Storage Service | AWS's file (object) storage. Holds Szop's Terraform state. |
| **SBOM** | Software Bill of Materials | A machine-readable list of everything inside a piece of software, such as every package in a container image. Not produced yet (see ADR 0010). |
| **SCRAM** | Salted Challenge Response Authentication Mechanism | How PostgreSQL checks a password without the password being sent: client and server prove they know it through a salted, hashed exchange. Szop's is SCRAM-SHA-256, which uses the SHA-256 hash. It is built on SASL, the Simple Authentication and Security Layer, a framework for such exchanges. PostgreSQL stores a password as a *SCRAM verifier* ([term](#terms)). |
| **SDK** | Software Development Kit | A library for calling a platform from code, such as the AWS SDK for JavaScript. |
| **SemVer** | Semantic Versioning | Version numbers of the form `MAJOR.MINOR.PATCH`, where each part says what kind of change a release holds. Szop uses one version for the whole repository, `0.x` until the MVP is complete (see ADR 0009). |
| **SEO** | Search Engine Optimization | Making pages rank well in search engines. Irrelevant for private data such as shopping lists. |
| **SES** | Simple Email Service | AWS's email-sending service. Szop's demo sends its emails through it. |
| **SHA** | Secure Hash Algorithm | A family of hash functions. A git **commit SHA** is the commit's hash, the 40-character ID that names exactly one commit. Szop's workflows pin every action to one (see ADR 0010). |
| **SIGINT** | Signal Interrupt | The signal a terminal sends to a running program when you press Ctrl+C. Szop's API closes gracefully when it gets one. |
| **SIGTERM** | Signal Terminate | The signal that asks a program to stop politely: sent by tsx when it restarts the API, and by ECS when it stops a task. Szop's API closes gracefully when it gets one. |
| **SMTP** | Simple Mail Transfer Protocol | The protocol for sending email. |
| **SPA** | Single-Page Application | A web app where the browser loads one page once and JavaScript renders every screen after that, without full page reloads. Szop's frontend is one. |
| **SPF** | Sender Policy Framework | A DNS record listing which servers may send mail for a domain. |
| **sRGB** | standard Red Green Blue | The common color space of screens and the web, with each color as red, green and blue from 0 to 255. WCAG's contrast formula is defined on it (see ADR 0048). |
| **SSE** | Server-Side Encryption | Data encrypted by the service that stores it. SSE-S3, used for Szop's state bucket, encrypts with keys S3 manages itself. |
| **SSE-S3** | Server-Side Encryption with Amazon S3 managed keys | S3's default encryption: every object is encrypted with keys S3 creates, holds and rotates itself, at no cost and with no IAM to manage. Szop's state bucket uses it; the alternative is a customer-managed key in KMS (see ADR 0029 and ADR 0041). |
| **SSM** | (AWS) Systems Manager | A family of AWS operations tools. Its **Parameter Store** holds Szop's app secrets; its Session Manager plugin powers ECS Exec. |
| **SSO** | Single Sign-On | One login giving access to several systems. IAM Identity Center is AWS's SSO; it hands out short-lived credentials. |
| **SSR** | Server-Side Rendering | Generating a page's HTML on the server for each request. The main strength of frameworks like Next.js; not used in Szop. |
| **STRIDE** | Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege | A checklist of six kinds of threat, used to examine each entry point of a system so that none is forgotten. Szop's [threat model](architecture/threat-model.md) uses it. |
| **STS** | (AWS) Security Token Service | AWS's service for temporary credentials. A CI job presents GitHub's OIDC token to it and receives credentials for a role that last at most an hour (`sts:AssumeRoleWithWebIdentity`); `aws sts get-caller-identity` shows who the current credentials belong to. See ADR 0010 and ADR 0032. |
| **SVG** | Scalable Vector Graphics | An image format describing shapes rather than pixels, so it stays sharp at any size. Lucide's icons and Szop's raccoon are SVG. |
| **TDD** | Test-Driven Development | Writing a failing test first, then the code that makes it pass, then tidying up ("red, green, refactor"). Szop uses it for domain rules, services and API routes (see ADR 0007). |
| **TLS** | Transport Layer Security | The encryption behind HTTPS. |
| **UUID** | Universally Unique Identifier | A 128-bit random identifier, such as `3f2c…`, practically never repeated. Szop's request IDs fall back to one where the load balancer sent no trace ID (ADR 0036). |
| **vCPU** | Virtual CPU | A share of a processor as cloud providers sell it. Szop's demo task gets a quarter of one. |
| **VPC** | Virtual Private Cloud | A private network inside AWS, divided into subnets. |
| **VPS** | Virtual Private Server | A rented virtual machine you manage yourself (Hetzner, DigitalOcean). Considered, not used (see ADR 0008). |
| **WAF** | Web Application Firewall | A filter in front of an app that blocks malicious or excessive requests. Not used by the demo (see ADR 0008). |
| **WASM** | WebAssembly | A compact binary format that browsers and Node.js can run at near-native speed. PGlite is PostgreSQL compiled to it; considered for tests, not used (see ADR 0007). |
| **WCAG** | Web Content Accessibility Guidelines | The W3C's standard for accessible web content, with levels A, AA and AAA. Szop targets WCAG 2.2 AA ([NFR-2](requirements/functional-requirements.md#nfr-2)). |
| **WSL** | Windows Subsystem for Linux | A Linux environment running inside Windows. Szop is developed in WSL 2 with Ubuntu. |
| **YAML** | YAML Ain't Markup Language | A text format for configuration, based on indentation. GitHub Actions workflows and `compose.yaml` are written in it. |

## Requirement ID prefixes

Used in [functional-requirements.md](requirements/functional-requirements.md) and referenced across the docs.

| Prefix | Area |
|---|---|
| **[ACC](requirements/functional-requirements.md#accounts-and-guest-mode-acc)** | Accounts and guest mode |
| **[LST](requirements/functional-requirements.md#shopping-lists-lst)** | Shopping lists |
| **[ITM](requirements/functional-requirements.md#list-items-itm)** | List items |
| **[ORD](requirements/functional-requirements.md#list-display-and-ordering-ord)** | List display and ordering |
| **[CAT](requirements/functional-requirements.md#categories-cat)** | Categories |
| **[PRD](requirements/functional-requirements.md#catalog-prd)** | Catalog (products) |
| **[UNT](requirements/functional-requirements.md#units-unt)** | Units |
| **[TPL](requirements/functional-requirements.md#templates-tpl)** | Templates |
| **[SHR](requirements/functional-requirements.md#sharing-shr)** | Sharing |
| **[SYN](requirements/functional-requirements.md#live-updates-syn)** | Live updates (synchronization) |
| **[NET](requirements/functional-requirements.md#connectivity-net)** | Connectivity (network) |
| **[LIM](requirements/functional-requirements.md#limits-lim)** | Limits (quotas and rate limits) |
| **[NFR](requirements/functional-requirements.md#3-non-functional-requirements)** | Non-functional requirements (browsers, accessibility, performance) |
| **[UC](requirements/functional-requirements.md#4-use-cases)** | Use case |
| **FR** | Functional requirement (general name for any of the IDs above, apart from NFR) |

## Terms

| Term | Meaning |
|---|---|
| **Access Analyzer (IAM)** | An AWS service that checks IAM policy documents against AWS's own rules and reports errors, security warnings, warnings and suggestions, for example a trust policy that could name a branch. Szop runs it on every IAM policy in the plan of a PR that changes `infra/`, and an error or a security warning blocks the PR (see ADR 0032, decision 4, and ADR 0041). |
| **Access key** | A long-lived AWS credential pair (an ID and a secret) for an IAM user. It works until someone deletes it, so a leaked one is the most common way AWS accounts are compromised; Szop has none, and uses IAM Identity Center's short-lived credentials instead (ADR 0029). |
| **Accessibility check (axe)** | An automated scan of a page for barriers to people using assistive technology, such as a missing label or low contrast. **axe** (axe-core) is the common rule engine; Szop runs it in the E2E journeys through `@axe-core/playwright`, in light and dark mode (see [Playwright](development/tools/playwright.md)). It finds only part of the problems: keyboard and screen-reader use still need people. |
| **Advisory lock (PostgreSQL)** | A lock on a number the application picks, which PostgreSQL holds for one connection until it is released: `pg_advisory_lock` waits for it, `pg_try_advisory_lock` gives up at once. Since PH-37, Szop's tasks take one around migrations, and from PH-31 around the cleanup job, so only one task does them at a time (ADR 0036, ADR 0040). It belongs to the session, not to a transaction, so it outlives a connection given back to a pool unless it is released first. |
| **actionlint** | A static checker for GitHub Actions workflow files: syntax, expressions, `needs:` and, through shellcheck, the shell scripts of `run:` steps. Runs in the pre-commit hook, in `pnpm check:workflows` and in CI's `workflows` job. |
| **Alias record (Route 53)** | An `A` record that holds the name of an AWS resource, such as a load balancer, instead of an IP address; Route 53 answers with the resource's current addresses. Allowed at a zone's root, where a CNAME is not, and free to query. `szop.dzwoniec.com` is one (see ADR 0034). |
| **Anonymous user** | A server-side user without email or password, created automatically for a guest. Registering links it to a real account. |
| **awsvpc** | The network mode of Szop's ECS tasks: each task gets its own network interface with a private IP address in a subnet, so a security group attaches to the task itself and a load balancer's target group can register it by IP address. |
| **Backend (Terraform)** | Where a root module keeps its state. Szop's modules use the S3 backend: one bucket, one key per module. |
| **Baseline (web features)** | A label for web features that work in all major browsers. "Widely available" means they have done so for at least 30 months; Vite's default build target is based on it. |
| **Bastion host** | A server kept only as an entry point for reaching private resources (such as a database) over SSH. Szop uses ECS Exec instead. |
| **Big design up front** | Designing a system in full detail before building any of it. Criticized because the decisions are made without feedback from working software. Szop decides direction up front and details per phase (see ADR 0004). |
| **Bisect (git)** | `git bisect` finds the commit that introduced a bug by binary search: it checks out commits between a known good and a known bad one, and you mark each as good or bad. |
| **Branch protection / ruleset** | GitHub rules that guard branches or tags, for example "no direct pushes to `main`" or "a version tag can never move". **Rulesets** are the newer mechanism; Szop uses them (see ADR 0009). |
| **Brotli** | A compression format for web files, smaller than gzip. Szop's build writes Brotli and gzip copies of every text file, and the server sends whichever the browser accepts. |
| **Browser context** | In Playwright, an isolated browser session, like a new private window: its own cookies, storage and pages. Every E2E test gets a fresh one, so tests share no state and can run in parallel. |
| **Build argument** | A value passed to `docker build` (`--build-arg`) that exists only while the image is built, declared in the Dockerfile with `ARG`. Szop's `GIT_COMMIT` argument is copied into an environment variable of the same name, so the image carries the commit it was built from and `/api/health` reports it (PH-12d). |
| **BuildKit** | Docker's build engine: it runs a Dockerfile's steps, in parallel where it can, caches each step's result and supports cache mounts that never end up in the image. Szop's builds use it locally and in CI (see ADR 0028). |
| **Bundle** | The JavaScript and CSS files a build tool (Vite) produces from the source code for the browser to download. |
| **Bypass list** | The actors a GitHub ruleset does not apply to. The `version-tags` ruleset lists only the release App, so it alone can create a `v*` tag; an empty list means nobody can, as the first release found out (see ADR 0043). |
| **Changelog** | A file (`CHANGELOG.md`) listing what changed in each released version. Szop's is written by release-please from the commit messages. |
| **Checkpoint (PostgreSQL)** | The moment PostgreSQL writes all changed data from memory to disk. `DROP DATABASE` waits for one, so Szop's tests run their drops together and share it (see ADR 0020). |
| **Clickjacking** | Showing a site inside an invisible frame on another page, so that the user clicks its buttons without knowing. Prevented by the CSP's `frame-ancestors 'none'`. |
| **Cloud session** | A Claude Code session that runs in a container in the cloud instead of on the owner's machine. The container is thrown away after a period of inactivity, so its tools are installed by a setup script (see ADR 0043 and the setup guide). |
| **CodeQL** | GitHub's code analysis engine: it finds security vulnerabilities and coding errors in the code and in the workflows. Free for public repositories; Szop uses its default setup (see ADR 0010). |
| **Commitlint** | A tool that checks commit messages against a convention, here Conventional Commits, run by a `commit-msg` git hook. |
| **Composite action** | A reusable group of GitHub Actions steps kept in the repository (`.github/actions/<name>/action.yml`) and called from workflows like any action. Szop's `setup` action installs pnpm, Node and the dependencies for every CI job. |
| **Composite foreign key** | A foreign key made of several columns. In Szop, references between workspace-owned tables include `workspace_id`, such as `(workspace_id, category_id) → categories (workspace_id, id)`, so the database refuses a reference into another workspace (see ADR 0012). |
| **Connection pool** | A set of open database connections that the app lends to queries and takes back, so each query does not pay for opening a new connection. node-postgres's `Pool` is one; Szop's API creates it in `createDatabase`. |
| **Container / Docker** | A container packages a program with everything it needs and runs it isolated from the rest of the machine. Docker is the most common tool for building and running containers. Szop runs PostgreSQL in one during development, and packs the app itself into a container image, which AWS runs (see ADR 0028). |
| **Content hash (fingerprint)** | A short hash of a file's content that the build puts in the file's name (`index-3f9a1c.js`). A changed file gets a new name, so the old one can be cached forever. Vite fingerprints everything under `assets/`. |
| **Conventional Commits** | A convention for commit messages, `type(scope): description` (`feat(api): add list sharing`), that tells both people and tools what kind of change a commit is. Szop uses it (see ADR 0009). |
| **Cookie prefix** | A cookie name starting with `__Host-` or `__Secure-`, which the browser accepts only with matching attributes. `__Host-` requires `Secure`, the path `/` and no `Domain`, so no other subdomain can set or overwrite the cookie. |
| **Cooldown (Dependabot)** | A waiting period before Dependabot proposes a new version of a dependency, so malicious releases are usually found and removed before they are offered. Szop uses 7 days (see ADR 0010). |
| **Core Web Vitals** | Google's three metrics of how a page feels to use: LCP (loading), INP (responsiveness) and CLS (visual stability), each with a "good" threshold. |
| **Cost allocation tag** | A tag that AWS's billing can group costs by, once the owner activates it. Szop activates `project` and `group`, which every resource carries, so Cost Explorer can show what each module costs; the data starts from activation (see the [runbook](operations/demo-environment.md#3-region-and-billing-preferences)). |
| **CSP guard** | The part of Szop's E2E tests (`e2e/support/test.ts`) that listens for the browser's `securitypolicyviolation` events on every page and fails the test if there was any (see [Testing guide](development/testing.md#the-csp-guard)). |
| **CSS-in-JS** | Writing styles in JavaScript that a library turns into `<style>` elements at run time (Emotion, styled-components). Ruled out for Szop by its Content Security Policy. |
| **Customer-managed key (KMS)** | An encryption key you create in KMS and control yourself: who may use it, when it rotates, when it is deleted. It costs about $1 a month and needs IAM permissions for everything that uses it. The alternative is a key the service manages for you, such as SSE-S3 or RDS's AWS managed key. Szop uses none (see ADR 0041, decision 9). |
| **Dark mode** | Light text on a dark background. Szop follows the system setting, which the browser exposes to CSS as `prefers-color-scheme`. |
| **Data router (React Router)** | React Router's mode in which the routes are one array handed to `createBrowserRouter`, and a route may have a `loader` that fetches data. Szop uses the mode but not the `loader`: TanStack Query fetches data. |
| **Data source (Terraform)** | A `data` block that reads something that already exists and that the module does not manage, such as base's hosted zone found by its name, where a `resource` block creates and owns its object. `infra/demo` uses one (see ADR 0034, decision 1). |
| **db-setup** | Szop's one-off ECS task, `node src/db-setup.ts`: it connects to RDS as the master user and creates or updates the database role `szop_app`, makes it the database's owner, and exits `0`. `demo-up` runs it once per deploy, after the infrastructure exists and before the app starts. |
| **Definition of done** | The checklist every piece of work must meet before it counts as finished. Szop's is kept in `docs/development/definition-of-done.md`. |
| **Dependabot** | GitHub's built-in bot that warns about vulnerable dependencies (alerts) and opens PRs updating them (version and security updates). |
| **Dependency injection** | Handing a component the things it depends on (database client, email sender) from outside instead of it creating them. NestJS and Spring do it with a container; Szop passes dependencies explicitly. |
| **Deployment circuit breaker (ECS)** | An ECS service setting that counts the tasks of a deployment that fail to start or fail their health checks and, at a threshold, marks the deployment `FAILED` so ECS stops launching tasks. It can also roll back to the previous version. Szop turns it on with rollback off and ECS's default threshold, three failures in a row for one wanted task ([ADR 0036](decisions/0036-scalability-and-isolation.md), decision 3). |
| **Deregistration delay** | How long a load balancer's target group waits, after a target is deregistered, for its in-flight requests before the target is removed: 300 seconds by default, 30 in Szop. A target with no in-flight requests and no active connections is deregistered at once, without waiting. Also called connection draining. |
| **Digest (image)** | A hash of a container image's content, such as `sha256:173f…`, that names exactly one image forever, unlike a tag, which its publisher can move. Szop pins its base image by tag and digest (see ADR 0028). |
| **Design tokens** | Named values for the basic visual choices — colors, spacing, font sizes — used everywhere instead of raw values, so the look can be changed in one place. Szop's come in two tiers: a palette, and semantic roles (`primary`, `muted`) that point into it ([visual design](architecture/visual-design.md#3-design-tokens)). |
| **Dev container** | A development environment defined in the repository and run inside a container, so every machine gets identical tools. Considered for Szop, not used (see ADR 0005). |
| **Discriminated union** | A choice between data shapes told apart by one field, such as `status` being `"ok"` or `"error"`. Zod's `discriminatedUnion` validates such a body and gives TypeScript the matching type. |
| **DNS validation (ACM)** | Proving to ACM that you control a domain by creating a CNAME record it names, such as `_<token>.szop.dzwoniec.com`, in the domain's zone. Szop's demo does it per session with Terraform; the record is the validation record (see ADR 0034). |
| **Docker Compose** | A Docker tool that starts a set of containers described in a `compose.yaml` file. A **named volume** in it keeps a container's data (such as the database files) when the container is recreated. |
| **Domain rules** | Business logic independent of HTTP and storage — e.g. how list items are ordered, how totals are computed. Szop keeps them in `packages/shared`. |
| **ECS Exec** | Opening a shell inside a running ECS task (`aws ecs execute-command`), through an agent ECS adds to the container and Systems Manager's message channels. Szop's way to query the demo database, with Node and the app's `pg` instead of `psql`, which the image does not have. It needs a writable root filesystem. |
| **ECS task, task definition, service** | A **task definition** describes a container to run (image, CPU, memory, environment, roles); it is never edited, and each change registers a new **revision** of its **family**. A **task** is one running copy; an ECS **service** keeps the wanted number of tasks running and replaces failed ones. |
| **Egress proxy** | The server a cloud session's outgoing connections go through; it allows only the hosts the environment's network policy lists, and refuses the rest (`curl` shows `CONNECT tunnel failed, response 403`). |
| **ElastiCache** | AWS's managed Redis, Valkey and Memcached. Szop's demo gets one Redis OSS node in its private subnets from PH-39 (ADR 0036). |
| **Encapsulation (Fastify)** | Fastify's rule that what a plugin registers (routes, hooks, decorators) stays inside that plugin and its children unless the plugin says otherwise. Szop's feature routes are plugins, so a hook for one feature does not leak into another. Wrapping a plugin with `fastify-plugin` is how it says otherwise: Szop's security plugins use it so their hooks reach every route (see ADR 0025). |
| **Environment (GitHub)** | A named deployment target in a repository (Szop: `demo`, `demo-teardown`, `release`) with its own secrets, variables and rules: which branches may use it, and which people must approve a job before it starts (required reviewers). AWS roles can trust only jobs running in a given environment. A **deployment branch rule** limits which branches may use the environment: Szop's `demo-teardown` allows only `main`. A **required reviewer** must approve each job before it starts: Szop's `demo` has the owner, and allows any branch. |
| **Ephemeral environment** | An environment created on demand from infrastructure-as-code files and destroyed when no longer needed, paid for only while it exists. Szop's demo is one. |
| **ETag** | A version tag the server sends with a response. The browser sends it back to ask whether its copy is still current, and gets `304 Not Modified`, with no body, if so. `@fastify/static` sends one with every file. |
| **Event bus** | A publish/subscribe mechanism: code publishes "list 42 changed", listeners (such as the WebSocket hub) react. Szop's is backed by Redis publish/subscribe, so an event published on one task reaches the listeners on every task (ADR 0036). |
| **Execution role / task role (ECS)** | Two IAM roles of an ECS task. The **task execution role** is used by ECS itself, around the container: it pulls the image, creates the log stream and fetches the secrets into the environment. The **task role** is what the code inside the container uses to call AWS. Szop's are `szop-app-task-execution` and `szop-app-task`. |
| **Expand and contract** | Changing a database schema in steps that the running version survives: first add what the new code needs (expand), and remove what the old code used only in a later release, once nothing reads it (contract). Needed when old and new versions serve side by side during a rolling update. |
| **Explicit deny (IAM)** | A `Deny` statement in an IAM policy. It beats every allow, whichever policy the allow is in, so it takes back part of a broad grant. Szop's plan role has `ReadOnlyAccess` and explicit denies on secret values, log contents, billing and contact details (see ADR 0032). |
| **Fargate** | AWS's way of running ECS tasks without managing servers: you state CPU and memory, AWS provides the machine. |
| **Fetch metadata** | Request headers such as `Sec-Fetch-Site` that the browser sets to say where a request comes from (`same-origin`, `same-site`, `cross-site` or `none`). Page scripts cannot set them, which makes them a defense against cross-site request forgery (CSRF): Szop refuses every unsafe request not marked `same-origin` (see ADR 0025). |
| **Fix forward** | Repairing a failed deploy by deploying a corrected version, not by returning to the previous one. Szop's circuit breaker does not roll back, because the old code may not work on a database the new version already migrated ([ADR 0036](decisions/0036-scalability-and-isolation.md), decision 3). |
| **Fixture (Playwright)** | Something Playwright prepares for a test and passes to it by name, such as `page` or `context`; `test.extend` adds or wraps them. The CSP guard is a wrapped `context` and a `cspViolations` fixture. |
| **Flaky test** | A test that sometimes passes and sometimes fails without any change to the code, usually because of timing or shared state. Treated as a bug in Szop ([ADR 0007](decisions/0007-testing-strategy.md), decision 16): CI retries a failed E2E test once and fails the run if it passes only on the retry. |
| **Flat config** | ESLint's configuration format since version 9: one `eslint.config.js` exporting an array of config objects, applied in order. |
| **Formatter** | A tool that rewrites code into one consistent layout (indentation, quotes, line breaks). Szop uses Prettier. |
| **Git flow** | A branching model with long-lived `main` and `develop` branches plus `feature/*`, `release/*` and `hotfix/*` branches, made for software released in numbered versions. Considered, not used (see ADR 0009). |
| **Git hook** | A script Git runs at a fixed moment, for example before a commit is created (a **pre-commit hook**). Szop's hooks, managed by husky, format and lint the staged files (pre-commit, lint-staged) and check the message (commit-msg, commitlint). |
| **GitHub Actions: workflow, job, runner** | GitHub's CI/CD service. A **workflow** is a YAML file in `.github/workflows/` started by an event (a push, a PR, a schedule, a button); it holds **jobs**, which run in parallel unless one needs another, each on a fresh virtual machine, the **runner**. |
| **GitHub App** | An integration registered on GitHub with its own identity (`name[bot]`) and narrowly chosen permissions; it gets tokens that expire within an hour. Szop's release-please runs as one (see ADR 0010). |
| **GitHub flow** | A branching model where `main` is always releasable and every change is made on a short-lived branch merged through a pull request. Szop uses it (see ADR 0009). |
| **GitHub Pages** | GitHub's free hosting for static files. Szop's landing page, `apps/landing/`, is deployed to it by `pages.yml` and served on `dzwoniec.com`; Pages obtains the HTTPS certificate itself, from Let's Encrypt. |
| **GitHub Projects** | GitHub's planning tool: a project collects issues from one or more repositories and shows them as a table, a board or a timeline, with custom fields such as a status. Szop's project tracks its phases, open points and decision work (see ADR 0024). |
| **GitOps** | Running infrastructure from git: merging a change to the main branch applies it automatically. Considered for `infra/base`, not used (see ADR 0010). |
| **Grace period (ECS)** | The seconds after a task starts during which ECS ignores the load balancer's health checks, so a slow image pull or a long migration does not get the task killed before it listens. ECS also counts a new task healthy only once it has passed, so it sets how long two versions serve side by side during a deploy. Szop's is 60 seconds (PH-12d). |
| **Graceful shutdown** | Stopping a server by refusing new connections and letting requests in flight finish before the process exits, instead of cutting them off. Szop's API does it on SIGINT and SIGTERM, so tsx's restarts and ECS's task stops lose no request. |
| **Haul** | In Szop's list screen, the dark tray at the bottom that collects the checked items, shows how far along the shopping is and opens into a drawer listing them all (see `visual-design.md`). |
| **Headless component library** | A library providing components' behavior and accessibility (focus, keyboard, dialogs) without any looks, styled by the app. Szop uses Base UI. |
| **Health check** | A request a load balancer or orchestrator sends regularly (Szop: `GET /api/live` every 10 seconds) to decide whether an instance should receive traffic or be replaced. |
| **Hook (Claude Code)** | A command Claude Code runs at a fixed moment, for example before a tool call (a `PreToolUse` hook), configured in `settings.json`. It can block the call by exiting with code 2. Szop's refuses force pushes, deletions and tag pushes (see ADR 0015). Unrelated to git hooks despite the name. |
| **Hook (Fastify)** | A function Fastify calls at a fixed point of a request's lifecycle (`onRequest`, `preHandler`, …). |
| **Hook (React)** | A function starting with `use` (`useState`, `useList`) that lets a component use state or other React features. Unrelated to Fastify hooks despite the name. |
| **Hosted zone** | Route 53's container for one domain's DNS records, served by four name servers chosen when the zone is created. Szop's zone for `dzwoniec.com` was created by the domain's purchase and imported into `infra/base`; it is never destroyed, since a new zone would get other name servers and the domain would stop resolving (see ADR 0030). |
| **Hyperscaler** | One of the very large cloud providers offering hundreds of services worldwide: AWS, Microsoft Azure, Google Cloud. |
| **Image scanner (vulnerability scanner)** | A tool that lists every package in a container image, the operating system's and the language's, and looks each up in a database of known vulnerabilities (CVEs), reporting each one's severity and whether a fixed version exists. Szop uses Trivy's (see ADR 0041). |
| **Immutable subject (GitHub OIDC)** | The form of the token's `sub` claim that names the owner and the repository with their numeric IDs, for example `repo:luiki-dev@290870182/szop@1380292421:pull_request`, so a repository recreated under the same name does not match a trust policy written for the old one. Szop's CI roles trust it (see ADR 0032, decision 13). |
| **Immutable tag** | A container image tag that, once pushed, can never point at a different image. Szop's registry enforces it, so a version always means the same code. |
| **IndexedDB** | A database built into the browser for storing structured data locally. Considered for guest workspaces, not used (see ADR 0002). |
| **Instance ID** | Szop's name for one running copy of the API: 8 hexadecimal characters drawn at random when the process starts. `/api/health` reports it as `instance`, so the watch script and `pnpm check:scale` can see which copy answered (ADR 0040). |
| **IPv6 /64 block** | The range of IPv6 addresses sharing their first 64 bits — typically what one household or device is given. Rate limits group addresses by it, since one machine can switch between billions of addresses inside its block. |
| **Issue form** | A YAML file in `.github/ISSUE_TEMPLATE/` that turns GitHub's "new issue" page into a form with labelled fields, so issues of one kind share one shape. |
| **Job summary** | The page of a GitHub Actions run (its *Summary* tab) where a job can write Markdown. Szop's `test` job shows Vitest's test report and a coverage table there. |
| **jsdom** | A simulated browser DOM that runs inside Node.js, so component tests can render and click without a real browser. It has no layout engine. |
| **k-anonymity** | Sending only part of a secret's hash, so that the answer covers many possible secrets and the server cannot tell which one was meant. Have I Been Pwned's password check works this way: only the first 5 characters of a SHA-1 hash leave the server. |
| **Let's Encrypt** | A free certificate authority that issues certificates automatically. GitHub Pages gets the landing page's certificate from it, so the CAA record on `dzwoniec.com` has to allow `letsencrypt.org`. |
| **Lazy creation** | Creating something only when it is first needed. Szop creates a guest's workspace on their first change, not on their first visit. |
| **Least privilege** | Giving every identity only the permissions it needs, so a leak or bug can do little harm. Szop's app role may only accept ECS Exec sessions today (and send email from PH-18). |
| **Lighthouse** | Google's tool, built into Chrome, that loads a page while simulating a slow phone and reports performance, accessibility and other scores. |
| **lint-staged** | A tool that runs commands (here ESLint and Prettier) only on the files staged for a commit. |
| **Linter** | A tool that analyzes code for bugs and bad patterns without running it. Szop uses ESLint. |
| **Listener (load balancer)** | The part of a load balancer that waits on one port and protocol and applies an **action** to each request: forward it to targets, redirect it, or answer with a fixed response. Szop's demo has one on port 80, which redirects to HTTPS, and one on port 443, which forwards every request to the app's target group. |
| **Liveness and readiness** | Two kinds of health check: liveness asks whether the process is alive (if not, restart it), readiness whether it can do its work right now, its database included. Szop's load balancer checks liveness (`/api/live`), and `/api/health` reports readiness (ADR 0036, PH-12d). |
| **Master user (RDS)** | The first account of an RDS instance, whose password RDS can generate and keep in Secrets Manager. It can create roles and databases, but RDS withholds a real superuser. Szop's is `szop_admin`; only `db-setup` uses it, and the app connects as `szop_app` instead. |
| **Merge commit, squash merge, rebase merge** | GitHub's three ways to merge a PR. A **merge commit** keeps the branch's commits and adds one commit joining the histories; a **squash merge** turns the whole branch into one new commit; a **rebase merge** replays each commit on top of `main`. Szop uses merge commits (see ADR 0009). |
| **Merge ref** | `refs/pull/<N>/merge`, a hidden branch where GitHub keeps a test merge of a PR's branch into the current `main`. CI checks this merge commit, so it tests what `main` would look like after the merge. |
| **Migration** | A versioned script that changes the database schema; applied in order in every environment. |
| **Milestone** | On GitHub, a named group of issues with a progress bar of how many are closed. Szop has one per roadmap stage, and one for the definition work before the first phase (see ADR 0024). |
| **Minor units** | The smallest unit of a currency (cents, grosze). Szop stores money as integers in minor units. |
| **Misconfiguration scanner** | A tool that reads infrastructure code (Terraform, a Dockerfile) and compares it with a library of security rules, such as "a security group should not admit the whole internet", before anything is applied. Szop uses Trivy's config scan; an accepted finding gets an inline exception with its reason (see ADR 0041). |
| **Monorepo** | One repository holding several packages (here: `apps/web`, `apps/api`, `packages/shared` and the `e2e/` tests, plus the Terraform code in `infra/`). |
| **Multi-stage build** | A Dockerfile with several stages: one with the full toolchain compiles the app, and the final image copies only the result, staying small. |
| **Mutation testing** | Changing the code on purpose (a *mutant*, for example `<` flipped to `<=`) and checking that some test fails. A mutant that no test notices shows a gap in the tests. Szop uses StrykerJS for it. |
| **Named volume** | Storage that Docker keeps apart from any container, so data survives the container's removal. PostgreSQL's data lives in one (`postgres-data` in `compose.yaml`); `docker compose down -v` deletes it. |
| **Nonce (CSP)** | A random value the server puts in the Content Security Policy and on the inline scripts or styles it allows, new for every response. Szop serves a static `index.html`, so it uses none. |
| **One-off task (ECS)** | A task started once with `aws ecs run-task`, outside any service: it runs its command, stops and leaves an exit code. `db-setup` is one. |
| **Opaque response** | What a browser gives a page for a `no-cors` request to another origin that sends no CORS headers: the request completes, but the page can read neither the status nor the body. The landing page uses it to tell that the demo answers, without a change to the application. |
| **Open point** | Something still undecided or not yet done that has been left to a later topic or phase. Szop tracks every one, open or closed, as a GitHub issue labelled `open-point`, with an `OP-` ID, a sub-issue of the phase that will settle it (see [ADR 0027](decisions/0027-open-points-on-github.md), decision 2). The register that held them before is archived in `docs/archive/`. |
| **OpenAPI** | A standard, machine-readable description of a REST API, from which documentation and clients can be generated. |
| **Optimistic update** | Updating the screen immediately as if a request succeeded, then correcting it if the server disagrees. |
| **Origin** | The scheme, domain and port of a URL (`https://example.com`). Cookies and browser security rules work per origin. |
| **Performance budget** | Limits a project agrees not to exceed so it stays fast as it grows, such as "at most 200 KB of JavaScript" or "LCP at most 2.5 s". |
| **Permission set** | In IAM Identity Center, a named set of permissions a user is given on an account, such as `AdministratorAccess`. Signing in creates a role from it in the account. |
| **Phantom dependency** | A package your code imports without declaring it, working only because something else happened to install it. It breaks when that other package changes. pnpm prevents it. |
| **Phase** | One step of the implementation roadmap (`docs/roadmap.md`), with a `PH-` ID, taken through its own brainstorm, design approval and implementation, on one branch and in one PR. Phases are grouped into stages (see ADR 0014). |
| **Playwright** | A library that drives real browsers from code, with a test runner around it. Szop's E2E journeys use it, with axe for accessibility checks (see [Playwright](development/tools/playwright.md)). |
| **Plugin (Fastify)** | A function that receives the Fastify instance and options and adds routes, hooks or decorators to it, registered with `app.register`. Szop's `buildApp` registers one plugin per feature, each with the services it needs as options. |
| **Precompression** | Writing compressed copies of files (Brotli `.br`, gzip `.gz`) at build time, so the server never compresses per request and the strongest settings are affordable. Szop's Vite build does it ([ADR 0023](decisions/0023-production-build-and-serving-details.md)). |
| **Precondition (Terraform)** | A check in a resource's `lifecycle` block that Terraform runs before it creates or changes the resource, failing with the author's message. Skipped when the resource is destroyed. The demo's HTTPS listener uses one to refuse an apply without `deployed_commit` (see ADR 0034). |
| **Profile (Compose)** | A label on a Docker Compose service that starts it only when asked for with `--profile <name>`. Szop's `app` service, the container image, has the profile `app`, so `docker compose up` alone still starts PostgreSQL only. |
| **Property-based testing** | Testing a rule against hundreds of generated inputs instead of a few hand-picked examples, checking a property that must always hold ("a parent category always comes before its children"). Szop uses fast-check. |
| **Proxy (dev server)** | The Vite dev server forwarding requests for `/api/*` to the API, so the browser sees a single origin during development. |
| **Push protection** | A GitHub secret scanning feature that rejects a push containing a recognized secret, such as an access key, before it reaches the repository. |
| **Query key** | The name TanStack Query caches an answer under, such as `["health"]`. Two components asking with the same key share one request and one answer, and the key is how a cached answer is refreshed. |
| **Quota** | A cap on how much data one workspace may hold (for example 200 lists). |
| **Rate limit** | A cap on how many requests of a kind are accepted in a time window (for example 10 guest creations per hour per IP address); excess requests get HTTP status 429. |
| **Redis** | An in-memory data store, used for counters, caches and publish/subscribe messaging between processes. Szop uses it for the rate-limit counters and the event bus across tasks (ADR 0036). |
| **Region** | A geographic area where a cloud provider runs data centers, such as AWS's `eu-central-1` (Frankfurt). |
| **Release PR (release-please)** | A pull request that release-please keeps open, holding the next version number, computed from the Conventional Commits merged so far, and the release's notes, one line per merged PR (see ADR 0042). Merging it creates the version tag and the GitHub Release. |
| **Repository (pattern)** | In the backend, the layer that is the only one talking to the database (`repository.ts` in each feature module), offering functions such as "find this item" and hiding the SQL. Not to be confused with a git repository. In Szop every repository function requires the workspace ID (see ADR 0012). |
| **Required status check** | A CI check that must pass before GitHub allows a PR to be merged. GitHub matches it by job name. Szop requires `ci-ok`, which sums up every job of `ci.yml`, and `pr-title` (see ADR 0010 and ADR 0018). |
| **Role (IAM)** | A set of AWS permissions assumed temporarily by a person or service, instead of permanent keys. ECS uses a **task execution role** (to pull the image and read secrets) and a **task role** (what the app itself may do). |
| **Rolling update** | Replacing the running copies of an app one by one: a copy on the new version starts, passes its health check, then an old one stops, so the app stays up. How ECS redeploys Szop's demo with a new image. |
| **Rolling-wave planning** | Planning near work in detail and far work only roughly, refining the far part as it comes closer. Szop's roadmap splits the stages up to the MVP into phases and keeps the Later stage rough (see ADR 0014). |
| **Rollout** | Getting a new version to its users: releasing and deploying it, often gradually (to a few users first, or behind feature flags). Szop has no users and no permanent environment, so it has no rollout in this sense. |
| **Root module (Terraform)** | A folder of Terraform configuration applied on its own, with its own state. Szop has three: `bootstrap`, `base` and `demo`. |
| **Round-robin** | Spreading requests over several servers by sending each to the next one in turn. nginx's default in the `scale` profile; the ALB does the same by default. |
| **Route table** | A list of rules in a VPC, "traffic for this address range goes there". A subnet follows the table it is associated with, or the VPC's main one. Szop's public route table sends everything not local through the internet gateway; the private subnets use the main table, which has only the local route. |
| **Runner** | The machine that runs one CI job. Szop uses GitHub-hosted runners: a fresh `ubuntu-24.04` virtual machine for every job, thrown away afterwards. |
| **SASLprep** | The normalization (RFC 4013) that PostgreSQL applies to a password before hashing it, so that look-alike characters match. `db-setup` does not apply it, so it accepts printable ASCII passwords only, where normalization changes nothing. |
| **Scale to zero** | A platform stopping all instances of an app when no requests arrive, and starting one on the next request. Cheap, but the first request waits. |
| **Scheduled workflow** | A GitHub Actions workflow with an `on: schedule:` cron line, started by GitHub at those times (UTC) from the file on the default branch. Szop's `demo-down` runs every night this way. GitHub may start it late and disables it in a public repository after 60 days without activity. |
| **SCRAM verifier** | The form in which PostgreSQL stores a password: `SCRAM-SHA-256$<iterations>:<salt>$<stored key>:<server key>`. The server accepts a ready-made verifier in `CREATE ROLE … PASSWORD`, which lets `db-setup` hash the password in the task and never send it in cleartext. |
| **Script injection** | A CI attack where attacker-controlled text, such as a PR title, is pasted into a shell script by `${{ … }}` and runs as code. Avoided by passing such values through environment variables. |
| **Security group** | A firewall attached to an AWS resource, listing who may connect on which port. Can allow another security group as the source. |
| **Seed data** | The predefined catalog, categories and units copied into every new workspace. |
| **Server state** | Data in the frontend that is a cached copy of data owned by the server. |
| **Service-linked role** | An IAM role that AWS creates and manages for one AWS service (for example `AWSServiceRoleForECS`), which the service assumes to act in the account. Created once per account; CI's roles may not create them. |
| **SES sandbox** | The starting state of an SES account: mail goes only to verified addresses, up to 200 a day. Leaving it takes a request to AWS. |
| **Session / session cookie** | The server's record of a logged-in (or anonymous) user, and the browser cookie that identifies it on each request. |
| **shadcn/ui** | A collection of styled React components that a command-line tool copies into the project as source code, built on a headless library and Tailwind CSS. |
| **Shield Standard** | AWS's free, always-on protection against common network-level floods, covering every load balancer. |
| **Simple request** | A request a browser sends to another site without asking it first (without a CORS *preflight*): a GET, HEAD or POST whose body has one of the content types an HTML form can send (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`). Szop accepts only JSON bodies, which closes it (see ADR 0025). |
| **Skeleton placeholder** | Gray shapes in the layout of the content that is still loading, shown instead of a spinner. |
| **Snapshot test** | A test that saves the output (for example rendered HTML) on its first run and fails when later output differs. Szop avoids them for rendered markup, because updating a snapshot without reading it is too easy. |
| **SPA fallback** | Answering the app's own paths, such as `/lists/42`, with `index.html`, so the client-side router can render them on a reload or from a shared link. Szop's API does it for every GET or HEAD path that is not `/api` or under `/api/` and whose last segment has no dot: a dot marks a file, so `/lists/milk.2` gets a 404 instead ([ADR 0023](decisions/0023-production-build-and-serving-details.md)). |
| **Spec / implementation plan** | The two working documents of a larger phase: the spec describes the agreed design, the plan lists the steps to build it. Kept in `docs/superpowers/`. |
| **Spike** | A short, time-boxed investigation that answers one question, such as whether a library works as hoped. Its output is an answer, not code to keep; in Szop it runs before the brainstorm of the phase that needs it (see ADR 0014). |
| **Stage** | A milestone on Szop's roadmap with an exit criterion, such as "every MVP requirement delivered, `1.0.0` released". It groups phases and has no branch or PR of its own (see ADR 0014). |
| **State (Terraform)** | Terraform's record of the real objects it created and their attributes, which `plan` compares with the code. Szop's lives in the bucket `szop-tfstate-ntrtcr`. |
| **State lock (Terraform)** | A guard that stops two runs from writing the same state at once. With `use_lockfile`, Terraform creates a `.tflock` file next to the state for the length of a run. Not to be confused with the provider lock file, `.terraform.lock.hcl`. |
| **Storybook** | A separate local web app for building and reviewing components on their own, in all their states. Not used by Szop for now. |
| **Sub-issue** | An issue placed under a parent issue on GitHub; the parent shows its sub-issues and how many are closed. In Szop, each open point is a sub-issue of the phase that settles it (see ADR 0024). |
| **Subnet (public, private)** | A slice of a VPC's addresses. A public subnet has a route to the internet; a private one does not. |
| **Subnet group (RDS)** | The list of subnets an RDS instance may be placed in, in at least two availability zones. Szop's holds the two private subnets. |
| **Supply-chain attack** | Attacking software through something it depends on, such as a hijacked npm package or GitHub action, instead of attacking it directly. |
| **Tabular figures** | Digits that all have the same width (the `tnum` font feature, `tabular-nums` in Tailwind), so numbers line up in columns. |
| **Tag Editor (AWS)** | The console page *Resource Groups & Tag Editor → Tag Editor*, which searches the tagged resources of the regions you select, by tag. Global services show under us-east-1, and it never lists IAM roles, DNS records or other things AWS cannot tag. Szop uses it to check that a teardown left nothing (see the [runbook](operations/demo-environment.md#checking-that-nothing-is-left)). |
| **Tag-based condition (IAM)** | A condition in an IAM policy on the tags of what an action touches: `aws:RequestTag/…` for the tags in a request that creates something, `aws:ResourceTag/…` for the tags on an existing resource. Szop's deploy role may change only resources tagged `project` = `szop` and `group` = `demo` (see ADR 0034). |
| **Tailwind CSS** | A styling tool where small single-purpose classes (`px-4`, `text-base`) are written in the markup and compiled at build time into a stylesheet holding only the classes used. |
| **Template database** | A PostgreSQL database used as a pattern for creating others (`CREATE DATABASE … TEMPLATE`). Szop's tests migrate one template, then copy it for each test worker. |
| **Template injection** | zizmor's name for script injection: a `${{ … }}` expression inside a `run:` script is pasted into the script before the shell runs it, so attacker-controlled text such as a PR title runs as code. Fixed by passing the value through `env:`. |
| **Terraform, Terraform state** | The infrastructure-as-code tool Szop uses. It records what it created in a **state** file, kept in S3, and compares it with the configuration to decide what to create, change or delete. |
| **Test coverage** | The share of the code that the tests execute, counted in statements, branches, functions and lines. It shows what no test touches, not whether the tests are good, so Szop measures it and never gates on it. |
| **Test double / fake** | Anything standing in for a real dependency in a test. A **fake** is a simple working implementation (an email sender that records emails instead of sending them); a **mock** is preprogrammed to expect certain calls. |
| **Testing pyramid / testing trophy** | Two shapes for a test suite. The pyramid puts most tests at the bottom as unit tests with mocked collaborators. The trophy puts most tests in the middle as integration tests against real components, such as a real database. Szop's suite is trophy-shaped (see ADR 0007). |
| **Threat model** | A description of what a system protects, who could attack it and through which paths, and what guards each one. Szop's is a living page, [threat-model.md](architecture/threat-model.md). |
| **Toast** | A short message that appears briefly at the edge of the screen and goes away by itself, optionally with an action such as Undo. |
| **Trace (Playwright)** | Playwright's recording of a test: its actions, the page's DOM before and after each, the network requests and the browser's console. It is opened in the trace viewer to see why a test failed (see [Testing guide](development/testing.md#reading-a-failed-run)). |
| **Trivy** | Aqua Security's open-source security scanner. Szop runs it as a pinned, checksum-checked binary in two CI jobs and in `pnpm check:scan`: its config scan reads the Terraform code and the Dockerfile, its image scan the container image (see [Trivy](development/tools/trivy.md) and ADR 0041). |
| **Trunk-based development** | A branching model where everyone commits to `main` (the trunk) directly or through branches living less than a day. Needs strong automated tests. Considered, not used (see ADR 0009). |
| **Trust policy (IAM)** | The part of an IAM role that says who may assume it. Szop's CI roles trust only OIDC tokens for a given environment or PR event, such as jobs in the `demo-teardown` environment; the token does not say which workflow file runs, so the environment's own rules (a required reviewer, allowed branches) decide who gets that far; the deploy role also checks the token's `ref` claim, so only `main` gets through (see ADR 0012 and ADR 0032, decision 14). |
| **Type-aware linting** | Linting that uses TypeScript's type information, so a rule can know, for example, that a call returns a promise. |
| **Type stripping** | Running TypeScript by deleting the type annotations instead of compiling it, which Node.js does itself, stably since Node 24.12. It does not check types. The API runs this way in production ([ADR 0023](decisions/0023-production-build-and-serving-details.md)) and the Claude Code push hook always does (see ADR 0016); in development the API uses tsx instead, for its watch mode (see ADR 0005). |
| **Utility class** | A CSS class that does one thing, such as `p-4` for padding. Tailwind CSS is built on them. |
| **uv** | A fast Python package and tool manager. Szop uses it only to install zizmor (`uv tool install`), which is a Python tool (see the [setup guide](development/setup.md#9-actionlint-zizmor-and-uv)). |
| **V8** | The JavaScript engine inside Chrome and Node.js. Vitest measures test coverage with V8's built-in instrumentation. |
| **Variable font** | One font file containing every weight (and sometimes width), instead of one file per weight. |
| **Vertical slice** | A piece of work that delivers one capability through every layer at once (database, API, UI, tests, deployment), as opposed to building one layer at a time. |
| **Visual companion** | A browser tab the superpowers brainstorming workflow opens to show mockups and visual options during a brainstorm. Its files live in `.superpowers/`, which git ignores. |
| **Vitest project** | One named group of tests inside a Vitest run, with its own configuration. Szop has three: `api`, from `apps/api/vitest.config.ts`, `web`, from `apps/web/vitest.config.ts`, and `hooks`, for the push hook's tests, which is defined inline. |
| **Walking skeleton** | The thinnest possible version of the whole system that runs end to end (here: SPA → API → database, built by CI and deployed) and does almost nothing yet. Built early to test the foundation decisions. |
| **WebSocket** | A persistent two-way connection between browser and server, letting the server push messages (used for live updates). |
| **WHOIS** | The public lookup of who registered a domain, through which registrar and until when. Route 53's privacy protection hides the owner's contact details from it. |
| **Workspace** | Everything one user owns: lists, templates, catalog, categories, units, settings. |
| **Workspace (pnpm)** | Unrelated to the above: one package of the monorepo (`apps/web`, `apps/api`, `packages/shared`, `e2e/`) as pnpm manages it. pnpm links workspaces to each other so they can import one another. |
| **Worktree (git)** | An extra working directory of the same repository, with another branch checked out, so two branches can be worked on side by side. Not used by default in Szop (see ADR 0009). |
| **Write-only argument** | A Terraform resource setting whose value is sent to the provider but never saved in the state file. Used for secrets. |
| **X-Forwarded-For** | An HTTP header listing the addresses a request passed through. Each proxy appends the address it saw, but the client can write anything at the start, so only entries added by trusted proxies are believed. Szop trusts the load balancer by its addresses, listed in the `TRUSTED_PROXIES` setting, not by a number of hops (see ADR 0025). |
| **zizmor** | A security linter for GitHub Actions workflows: it finds template injection, excessive token permissions, unpinned actions and impostor commits. Runs in the pre-commit hook, in `pnpm check:workflows` and in CI's `workflows` job. |
| **Zod** | A TypeScript library for defining data schemas that give both compile-time types and runtime validation. |
