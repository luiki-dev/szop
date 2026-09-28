# Glossary

Acronyms and terms used across Szop's documentation. Common ones (API, UI, HTTP, JSON, SQL, URL) are not listed.

## Acronyms

| Acronym | Stands for | Meaning |
|---|---|---|
| **ACM** | AWS Certificate Manager | Issues free TLS certificates for domains you control, for use on AWS load balancers. |
| **ADR** | Architecture Decision Record | A short document recording one significant decision: its context, the options considered, the choice and its consequences. Ours live in `docs/decisions/`. |
| **ALB** | Application Load Balancer | AWS's HTTP(S) load balancer: it decrypts HTTPS and forwards requests to healthy targets. Fronts Szop's demo. |
| **ARN** | Amazon Resource Name | The unique identifier of an AWS resource, such as `arn:aws:ssm:eu-central-1:…:parameter/…`. |
| **AWS** | Amazon Web Services | Amazon's cloud platform, the largest hyperscaler. Szop's demo environment runs on it (see ADR 0008). |
| **AZ** | Availability Zone | One of several separate data centers within an AWS region, with independent power and networking. |
| **CalVer** | Calendar Versioning | Version numbers built from the release date, such as `2026.10.0`. Considered, not used (see ADR 0009). |
| **CDK** | Cloud Development Kit | AWS's infrastructure-as-code tool in general-purpose languages such as TypeScript. Considered, not used (see ADR 0008). |
| **CI/CD** | Continuous Integration / Continuous Delivery (or Deployment) | Automatically building and testing every change (CI), and automatically releasing it (CD). |
| **CORS** | Cross-Origin Resource Sharing | Browser rules deciding when a page from one domain may call an API on another domain. Not needed when frontend and API share one origin. |
| **CDN** | Content Delivery Network | A network of servers around the world that serves static files close to users and can absorb or filter traffic floods in front of the application. |
| **CRUD** | Create, Read, Update, Delete | The four basic operations on data. |
| **CRLF / LF** | Carriage Return + Line Feed / Line Feed | The two conventions for ending a line of text: Windows uses CRLF, Linux and macOS use LF. Szop's repository uses LF only. |
| **DKIM** | DomainKeys Identified Mail | A signature on outgoing email, checked against a key published in DNS, proving the mail really comes from the domain. |
| **DNS** | Domain Name System | The internet's directory that turns names (`demo.example.com`) into addresses. |
| **DoS** | Denial of Service | An attack that makes a service unavailable, either by flooding it with traffic (volumetric) or by making it exhaust resources such as database space (resource exhaustion). |
| **E2E** | End-to-end | A test that drives the real app in a real browser, through every layer (SPA → API → database), the way a user would. Szop has one E2E journey per use case (see ADR 0007). |
| **ECR** | Elastic Container Registry | AWS's storage for container images. |
| **ECS** | Elastic Container Service | AWS's service for running containers. Szop's demo runs one ECS task on Fargate. |
| **EKS** | Elastic Kubernetes Service | AWS's managed Kubernetes. Far more than Szop needs; not used (see ADR 0008). |
| **ESM** | ECMAScript Modules | The standard JavaScript module system (`import` / `export`). Replaces CommonJS (`require`), the older Node-only format. Szop uses ESM everywhere. |
| **HCL** | HashiCorp Configuration Language | The language Terraform configuration is written in. |
| **HTTPS** | HTTP Secure | HTTP encrypted with TLS. |
| **IaC** | Infrastructure as Code | Describing servers, networks and databases in files kept in git, and letting a tool create them, instead of clicking in a console. Szop uses Terraform. |
| **IAM** | Identity and Access Management | AWS's system of users, roles and permissions deciding who may do what. |
| **JWT** | JSON Web Token | A signed token carrying claims about a user. An alternative to server-side sessions; not used in Szop. |
| **LTS** | Long-Term Support | A release line that receives fixes for an extended period. Even-numbered Node.js releases (22, 24, …) become LTS. |
| **MFA** | Multi-Factor Authentication | Logging in with a second proof besides the password, such as a code from an authenticator app. |
| **MVP** | Minimum Viable Product | The smallest release that is useful on its own. In the requirements, `[MVP]` marks what the first release contains. |
| **MSW** | Mock Service Worker | A library that intercepts the app's HTTP requests at the network level and answers them with fake responses. Szop's component tests use it, so the real API client runs unchanged. |
| **NAT** | Network Address Translation | Here: a NAT gateway lets resources in a private subnet reach the internet. Costs about $32 a month on AWS; not used (see ADR 0008). |
| **OAuth / OIDC** | Open Authorization / OpenID Connect | Standards for logging in through another provider ("Sign in with Google"). Relevant for the social-login future extension. Also how CI is expected to log in to AWS without stored keys (see ADR 0008). |
| **ORM** | Object-Relational Mapper | A library that maps database tables to objects or types in code and builds queries. Drizzle is ours. |
| **PaaS** | Platform as a Service | A hosting service where you hand over the app and the platform runs it (Render, Railway, Fly.io, Heroku). Considered, not used (see ADR 0008). |
| **PR** | Pull Request | A request to merge a branch into another (usually `main`), where the change can be reviewed and checked by CI before it lands. |
| **RDS** | Relational Database Service | AWS's managed database servers. Szop's demo uses RDS for PostgreSQL. |
| **REST** | Representational State Transfer | An API style where URLs name resources (`/api/lists/42`) and HTTP methods say what to do with them (`GET`, `POST`, `PATCH`, `DELETE`). |
| **SDK** | Software Development Kit | A library for calling a platform from code, such as the AWS SDK for JavaScript. |
| **SEO** | Search Engine Optimization | Making pages rank well in search engines. Irrelevant for private data such as shopping lists. |
| **SemVer** | Semantic Versioning | Version numbers of the form `MAJOR.MINOR.PATCH`, where each part says what kind of change a release holds. Szop uses one version for the whole repository, `0.x` until the MVP is complete (see ADR 0009). |
| **SES** | Simple Email Service | AWS's email-sending service. Szop's demo sends its emails through it. |
| **SMTP** | Simple Mail Transfer Protocol | The protocol for sending email. |
| **SPA** | Single-Page Application | A web app where the browser loads one page once and JavaScript renders every screen after that, without full page reloads. Szop's frontend is one. |
| **SSM** | (AWS) Systems Manager | A family of AWS operations tools. Its **Parameter Store** holds Szop's app secrets; its Session Manager plugin powers ECS Exec. |
| **SSO** | Single Sign-On | One login giving access to several systems. IAM Identity Center is AWS's SSO; it hands out short-lived credentials. |
| **SSR** | Server-Side Rendering | Generating a page's HTML on the server for each request. The main strength of frameworks like Next.js; not used in Szop. |
| **TDD** | Test-Driven Development | Writing a failing test first, then the code that makes it pass, then tidying up ("red, green, refactor"). Szop uses it for domain rules, services and API routes (see ADR 0007). |
| **TLS** | Transport Layer Security | The encryption behind HTTPS. |
| **vCPU** | Virtual CPU | A share of a processor as cloud providers sell it. Szop's demo task gets a quarter of one. |
| **VPC** | Virtual Private Cloud | A private network inside AWS, divided into subnets. |
| **VPS** | Virtual Private Server | A rented virtual machine you manage yourself (Hetzner, DigitalOcean). Considered, not used (see ADR 0008). |
| **WAF** | Web Application Firewall | A filter in front of an app that blocks malicious or excessive requests. Not used by the demo (see ADR 0008). |
| **WASM** | WebAssembly | A compact binary format that browsers and Node.js can run at near-native speed. PGlite is PostgreSQL compiled to it; considered for tests, not used (see ADR 0007). |
| **WSL** | Windows Subsystem for Linux | A Linux environment running inside Windows. Szop is developed in WSL 2 with Ubuntu. |

## Requirement ID prefixes

Used in [functional-requirements.md](requirements/functional-requirements.md) and referenced across the docs.

| Prefix | Area |
|---|---|
| **ACC** | Accounts and guest mode |
| **LST** | Shopping lists |
| **ITM** | List items |
| **ORD** | List display and ordering |
| **CAT** | Categories |
| **PRD** | Catalog (products) |
| **UNT** | Units |
| **TPL** | Templates |
| **SHR** | Sharing |
| **SYN** | Live updates (synchronization) |
| **NET** | Connectivity (network) |
| **LIM** | Limits (quotas and rate limits) |
| **UC** | Use case |
| **FR** | Functional requirement (general name for any of the IDs above) |

## Terms

| Term | Meaning |
|---|---|
| **Accessibility check (axe)** | An automated scan of a page for barriers to people using assistive technology, such as a missing label or low contrast. axe-core is the common engine; Szop runs it in the E2E journeys. |
| **Anonymous user** | A server-side user without email or password, created automatically for a guest. Registering links it to a real account. |
| **Bastion host** | A server kept only as an entry point for reaching private resources (such as a database) over SSH. Szop uses ECS Exec instead. |
| **Big design up front** | Designing a system in full detail before building any of it. Criticized because the decisions are made without feedback from working software. Szop decides direction up front and details per phase (see ADR 0004). |
| **Bundle** | The JavaScript and CSS files a build tool (Vite) produces from the source code for the browser to download. |
| **Definition of done** | The checklist every piece of work must meet before it counts as finished. Szop's is in ADR 0004: tests pass, CI green, deployed, docs updated. |
| **Design tokens** | Named values for the basic visual choices — colors, spacing, font sizes — used everywhere instead of raw values, so the look can be changed in one place. |
| **Bisect (git)** | `git bisect` finds the commit that introduced a bug by binary search: it checks out commits between a known good and a known bad one, and you mark each as good or bad. |
| **Branch protection / ruleset** | GitHub rules that guard branches or tags, for example "no direct pushes to `main`" or "a version tag can never move". **Rulesets** are the newer mechanism; Szop uses them (see ADR 0009). |
| **Changelog** | A file (`CHANGELOG.md`) listing what changed in each released version. Szop's is written by release-please from the commit messages. |
| **Commitlint** | A tool that checks commit messages against a convention, here Conventional Commits, run by a `commit-msg` git hook. |
| **Container / Docker** | A container packages a program with everything it needs and runs it isolated from the rest of the machine. Docker is the most common tool for building and running containers. Szop runs PostgreSQL in one during development. |
| **Dev container** | A development environment defined in the repository and run inside a container, so every machine gets identical tools. Considered for Szop, not used (see ADR 0005). |
| **Docker Compose** | A Docker tool that starts a set of containers described in a `compose.yaml` file. A **named volume** in it keeps a container's data (such as the database files) when the container is recreated. |
| **Conventional Commits** | A convention for commit messages, `type(scope): description` (`feat(api): add list sharing`), that tells both people and tools what kind of change a commit is. Szop uses it (see ADR 0009). |
| **Dependency injection** | Handing a component the things it depends on (database client, email sender) from outside instead of it creating them. NestJS and Spring do it with a container; Szop passes dependencies explicitly. |
| **Domain rules** | Business logic independent of HTTP and storage — e.g. how list items are ordered, how totals are computed. Szop keeps them in `packages/shared`. |
| **ECS Exec** | Opening a shell inside a running ECS task (`aws ecs execute-command`). Szop's way to run `psql` against the demo database. |
| **ECS task, task definition, service** | A **task definition** describes a container to run (image, CPU, memory, environment); a **task** is one running copy; an ECS **service** keeps the wanted number of tasks running and replaces failed ones. |
| **Ephemeral environment** | An environment created on demand from infrastructure-as-code files and destroyed when no longer needed, paid for only while it exists. Szop's demo is one. |
| **Event bus** | An in-process publish/subscribe mechanism: code publishes "list 42 changed", listeners (such as the WebSocket hub) react. |
| **Fargate** | AWS's way of running ECS tasks without managing servers: you state CPU and memory, AWS provides the machine. |
| **Flaky test** | A test that sometimes passes and sometimes fails without any change to the code, usually because of timing or shared state. Treated as a bug in Szop. |
| **Formatter** | A tool that rewrites code into one consistent layout (indentation, quotes, line breaks). Szop uses Prettier. |
| **Git hook** | A script Git runs at a fixed moment, for example before a commit is created (a **pre-commit hook**). Szop's formats and lints the files being committed. |
| **Health check** | A request a load balancer or orchestrator sends regularly (Szop: `GET /api/health`) to decide whether an instance should receive traffic or be replaced. |
| **Git flow** | A branching model with long-lived `main` and `develop` branches plus `feature/*`, `release/*` and `hotfix/*` branches, made for software released in numbered versions. Considered, not used (see ADR 0009). |
| **GitHub flow** | A branching model where `main` is always releasable and every change is made on a short-lived branch merged through a pull request. Szop uses it (see ADR 0009). |
| **Hook (Fastify)** | A function Fastify calls at a fixed point of a request's lifecycle (`onRequest`, `preHandler`, …). |
| **Hook (React)** | A function starting with `use` (`useState`, `useList`) that lets a component use state or other React features. Unrelated to Fastify hooks despite the name. |
| **Hyperscaler** | One of the very large cloud providers offering hundreds of services worldwide: AWS, Microsoft Azure, Google Cloud. |
| **Immutable tag** | A container image tag that, once pushed, can never point at a different image. Szop's registry enforces it, so a version always means the same code. |
| **IndexedDB** | A database built into the browser for storing structured data locally. Considered for guest workspaces, not used (see ADR 0002). |
| **Least privilege** | Giving every identity only the permissions it needs, so a leak or bug can do little harm. Szop's app role may only send email. |
| **Merge commit, squash merge, rebase merge** | GitHub's three ways to merge a PR. A **merge commit** keeps the branch's commits and adds one commit joining the histories; a **squash merge** turns the whole branch into one new commit; a **rebase merge** replays each commit on top of `main`. Szop uses merge commits (see ADR 0009). |
| **Migration** | A versioned script that changes the database schema; applied in order in every environment. |
| **IPv6 /64 block** | The range of IPv6 addresses sharing their first 64 bits — typically what one household or device is given. Rate limits group addresses by it, since one machine can switch between billions of addresses inside its block. |
| **jsdom** | A simulated browser DOM that runs inside Node.js, so component tests can render and click without a real browser. It has no layout engine. |
| **Linter** | A tool that analyzes code for bugs and bad patterns without running it. Szop uses ESLint. |
| **Lazy creation** | Creating something only when it is first needed. Szop creates a guest's workspace on their first change, not on their first visit. |
| **Minor units** | The smallest unit of a currency (cents, grosze). Szop stores money as integers in minor units. |
| **Monorepo** | One repository holding several packages (here: `apps/web`, `apps/api`, `packages/shared`). |
| **Multi-stage build** | A Dockerfile with several stages: one with the full toolchain compiles the app, and the final image copies only the result, staying small. |
| **Mutation testing** | Changing the code on purpose (a *mutant*, for example `<` flipped to `<=`) and checking that some test fails. A mutant that no test notices shows a gap in the tests. Szop uses StrykerJS for it. |
| **OpenAPI** | A standard, machine-readable description of a REST API, from which documentation and clients can be generated. |
| **Optimistic update** | Updating the screen immediately as if a request succeeded, then correcting it if the server disagrees. |
| **Origin** | The scheme, domain and port of a URL (`https://szop.app`). Cookies and browser security rules work per origin. |
| **Phantom dependency** | A package your code imports without declaring it, working only because something else happened to install it. It breaks when that other package changes. pnpm prevents it. |
| **Phase** | One step of the implementation roadmap, taken through its own brainstorm, design approval and implementation. |
| **Property-based testing** | Testing a rule against hundreds of generated inputs instead of a few hand-picked examples, checking a property that must always hold ("a parent category always comes before its children"). Szop uses fast-check. |
| **Proxy (dev server)** | The Vite dev server forwarding requests for `/api/*` to the API, so the browser sees a single origin during development. |
| **Push protection** | A GitHub secret scanning feature that rejects a push containing a recognized secret, such as an access key, before it reaches the repository. |
| **Quota** | A cap on how much data one workspace may hold (for example 200 lists). |
| **Rate limit** | A cap on how many requests of a kind are accepted in a time window (for example 10 guest creations per hour per IP address); excess requests get HTTP status 429. |
| **Release PR (release-please)** | A pull request that release-please keeps open, holding the next version number and changelog entry, computed from the Conventional Commits merged so far. Merging it creates the version tag and the GitHub Release. |
| **Region** | A geographic area where a cloud provider runs data centers, such as AWS's `eu-central-1` (Frankfurt). |
| **Role (IAM)** | A set of AWS permissions assumed temporarily by a person or service, instead of permanent keys. ECS uses a **task execution role** (to pull the image and read secrets) and a **task role** (what the app itself may do). |
| **Root module (Terraform)** | A folder of Terraform configuration applied on its own, with its own state. Szop has three: `bootstrap`, `base` and `demo`. |
| **Scale to zero** | A platform stopping all instances of an app when no requests arrive, and starting one on the next request. Cheap, but the first request waits. |
| **Security group** | A firewall attached to an AWS resource, listing who may connect on which port. Can allow another security group as the source. |
| **Seed data** | The predefined catalog, categories and units copied into every new workspace. |
| **Server state** | Data in the frontend that is a cached copy of data owned by the server. |
| **SES sandbox** | The starting state of an SES account: mail goes only to verified addresses, up to 200 a day. Leaving it takes a request to AWS. |
| **Session / session cookie** | The server's record of a logged-in (or anonymous) user, and the browser cookie that identifies it on each request. |
| **Shield Standard** | AWS's free, always-on protection against common network-level floods, covering every load balancer. |
| **Snapshot test** | A test that saves the output (for example rendered HTML) on its first run and fails when later output differs. Szop avoids them for rendered markup, because updating a snapshot without reading it is too easy. |
| **Spec / implementation plan** | The two working documents of a larger phase: the spec describes the agreed design, the plan lists the steps to build it. Kept in `docs/superpowers/`. |
| **Subnet (public, private)** | A slice of a VPC's addresses. A public subnet has a route to the internet; a private one does not. |
| **Template database** | A PostgreSQL database used as a pattern for creating others (`CREATE DATABASE … TEMPLATE`). Szop's tests migrate one template, then copy it for each test worker. |
| **Terraform, Terraform state** | The infrastructure-as-code tool Szop uses. It records what it created in a **state** file, kept in S3, and compares it with the configuration to decide what to create, change or delete. |
| **Test double / fake** | Anything standing in for a real dependency in a test. A **fake** is a simple working implementation (an email sender that records emails instead of sending them); a **mock** is preprogrammed to expect certain calls. |
| **Testing pyramid / testing trophy** | Two shapes for a test suite. The pyramid puts most tests at the bottom as unit tests with mocked collaborators. The trophy puts most tests in the middle as integration tests against real components, such as a real database. Szop's suite is trophy-shaped (see ADR 0007). |
| **Trunk-based development** | A branching model where everyone commits to `main` (the trunk) directly or through branches living less than a day. Needs strong automated tests. Considered, not used (see ADR 0009). |
| **Type stripping** | Running TypeScript by deleting the type annotations instead of compiling it, which Node.js can now do itself. It does not check types. Szop uses tsx instead (see ADR 0005). |
| **V8** | The JavaScript engine inside Chrome and Node.js. Vitest measures test coverage with V8's built-in instrumentation. |
| **Vertical slice** | A piece of work that delivers one capability through every layer at once (database, API, UI, tests, deployment), as opposed to building one layer at a time. |
| **Walking skeleton** | The thinnest possible version of the whole system that runs end to end (here: SPA → API → database, built by CI and deployed) and does almost nothing yet. Built early to test the foundation decisions. |
| **WebSocket** | A persistent two-way connection between browser and server, letting the server push messages (used for live updates). |
| **Worktree (git)** | An extra working directory of the same repository, with another branch checked out, so two branches can be worked on side by side. Not used by default in Szop (see ADR 0009). |
| **Workspace** | Everything one user owns: lists, templates, catalog, categories, units, settings. |
| **Workspace (pnpm)** | Unrelated to the above: one package of the monorepo (`apps/web`, `apps/api`, `packages/shared`) as pnpm manages it. pnpm links workspaces to each other so they can import one another. |
| **Write-only argument** | A Terraform resource setting whose value is sent to the provider but never saved in the state file. Used for secrets. |
| **Zod** | A TypeScript library for defining data schemas that give both compile-time types and runtime validation. |
