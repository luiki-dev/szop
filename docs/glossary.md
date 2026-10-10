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
| **CDN** | Content Delivery Network | A network of servers around the world that serves static files close to users and can absorb or filter traffic floods in front of the application. |
| **CI/CD** | Continuous Integration / Continuous Delivery (or Deployment) | **CI:** every change is built and checked automatically, here by GitHub Actions on every PR. **CD:** every change that passes the checks can be released or deployed at the push of a button; continuous *deployment* goes further and deploys every change by itself. |
| **CLI** | Command-line interface | A program used by typing commands in a terminal, such as `git`, `gh`, `terraform` or the AWS CLI. |
| **CLS** | Cumulative Layout Shift | A Core Web Vital: how much visible content jumps around while a page loads. "Good" is at most 0.1 ([NFR-3](requirements/functional-requirements.md#nfr-3)). |
| **CORS** | Cross-Origin Resource Sharing | Browser rules deciding when a page from one domain may call an API on another domain. Not needed when frontend and API share one origin. |
| **CRLF / LF** | Carriage Return + Line Feed / Line Feed | The two conventions for ending a line of text: Windows uses CRLF, Linux and macOS use LF. Szop's repository uses LF only. |
| **CRUD** | Create, Read, Update, Delete | The four basic operations on data. |
| **CSP** | Content Security Policy | An HTTP header telling the browser which sources a page may load scripts, styles and other content from, which limits the damage of an injected script. Szop allows only its own files and no inline scripts (see ADR 0012). |
| **CSRF** | Cross-Site Request Forgery | An attack where another site makes the victim's browser send a request, with the victim's cookies, that changes data. Countered by `SameSite` cookies and by refusing unsafe requests whose `Sec-Fetch-Site` or `Origin` header shows they came from another site (see ADR 0012). |
| **DKIM** | DomainKeys Identified Mail | A signature on outgoing email, checked against a key published in DNS, proving the mail really comes from the domain. |
| **DMARC** | Domain-based Message Authentication, Reporting and Conformance | A DNS record telling receiving mail servers what to do with mail that fails the SPF and DKIM checks, which stops others sending mail in the domain's name. |
| **DNS** | Domain Name System | The internet's directory that turns names (`demo.example.com`) into addresses. |
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
| **IDOR** | Insecure Direct Object Reference | A hole where a request names a record by its ID and the server does not check that the caller may use it, for example an item pointing at another user's category. Closed in Szop by resolving every ID within the workspace (see ADR 0012). |
| **INP** | Interaction to Next Paint | A Core Web Vital: how long the page takes to visibly respond to a tap, click or key press. "Good" is at most 200 ms ([NFR-3](requirements/functional-requirements.md#nfr-3)). |
| **JSX** | JavaScript XML | HTML-like syntax inside JavaScript or TypeScript, used to write React components. It has been used in `apps/web` since [PH-05](roadmap.md#ph-05-spa-skeleton). |
| **JWT** | JSON Web Token | A signed token carrying claims about a user. An alternative to server-side sessions; not used in Szop. |
| **LCP** | Largest Contentful Paint | A Core Web Vital: when the largest piece of content (usually the main text block or image) appears. "Good" is at most 2.5 s ([NFR-3](requirements/functional-requirements.md#nfr-3)). |
| **LTS** | Long-Term Support | A release line that receives fixes for an extended period. Even-numbered Node.js releases (22, 24, …) become LTS. |
| **MFA** | Multi-Factor Authentication | Logging in with a second proof besides the password, such as a code from an authenticator app. |
| **MSW** | Mock Service Worker | A library that intercepts the app's HTTP requests at the network level and answers them with fake responses. Szop's component tests use it, so the real API client runs unchanged. |
| **MVP** | Minimum Viable Product | The smallest release that is useful on its own. In the requirements, `[MVP]` marks what the first release contains. |
| **NAT** | Network Address Translation | Here: a NAT gateway lets resources in a private subnet reach the internet. Costs about $32 a month on AWS; not used (see ADR 0008). |
| **NFR** | Non-functional requirement | A quality the system must have rather than something it does: supported browsers, accessibility, performance. Szop's are [NFR-1 to NFR-3](requirements/functional-requirements.md#3-non-functional-requirements). |
| **nvm** | Node Version Manager | A tool that installs and switches Node.js versions per user. Szop's `.nvmrc` tells it which one to use. |
| **OAuth / OIDC** | Open Authorization / OpenID Connect | Standards for logging in through another provider ("Sign in with Google"). Relevant for the social-login future extension. Also how CI logs in to AWS without stored keys: GitHub signs a token saying which repository the job belongs to and which environment, branch or PR event it runs for, and AWS exchanges it for short-lived credentials (see ADR 0010 and ADR 0012). |
| **OFL** | SIL Open Font License | A free license for fonts: they may be used, bundled and shipped with software, but not sold on their own. Gabarito is under it (see ADR 0022). |
| **OpenSSF** | Open Source Security Foundation | A Linux Foundation project for open-source security. Its **Scorecard** rates a repository's security practices. Not used yet (see ADR 0010). |
| **ORM** | Object-Relational Mapper | A library that maps database tables to objects or types in code and builds queries. Drizzle is ours. |
| **PaaS** | Platform as a Service | A hosting service where you hand over the app and the platform runs it (Render, Railway, Fly.io, Heroku). Considered, not used (see ADR 0008). |
| **PAT** | Personal Access Token | A GitHub token that acts as the person who created it, with the permissions they chose. Considered for release-please, not used: Szop uses a GitHub App (see ADR 0010). |
| **PR** | Pull Request | A request to merge a branch into another (usually `main`), where the change can be reviewed and checked by CI before it lands. |
| **PWA** | Progressive Web App | A web app that can be installed on a phone's home screen and caches its files with a service worker, so it starts without a network. A future option for Szop. |
| **RDS** | Relational Database Service | AWS's managed database servers. Szop's demo uses RDS for PostgreSQL. |
| **REST** | Representational State Transfer | An API style where URLs name resources (`/api/lists/42`) and HTTP methods say what to do with them (`GET`, `POST`, `PATCH`, `DELETE`). |
| **RLS** | Row-Level Security | A PostgreSQL feature that filters every query by policies attached to a table, such as "only this workspace's rows". Considered for Szop, not used (see ADR 0012). |
| **S3** | Simple Storage Service | AWS's file (object) storage. Holds Szop's Terraform state. |
| **SBOM** | Software Bill of Materials | A machine-readable list of everything inside a piece of software, such as every package in a container image. Not produced yet (see ADR 0010). |
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
| **SSM** | (AWS) Systems Manager | A family of AWS operations tools. Its **Parameter Store** holds Szop's app secrets; its Session Manager plugin powers ECS Exec. |
| **SSO** | Single Sign-On | One login giving access to several systems. IAM Identity Center is AWS's SSO; it hands out short-lived credentials. |
| **SSR** | Server-Side Rendering | Generating a page's HTML on the server for each request. The main strength of frameworks like Next.js; not used in Szop. |
| **STRIDE** | Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege | A checklist of six kinds of threat, used to examine each entry point of a system so that none is forgotten. Szop's [threat model](architecture/threat-model.md) uses it. |
| **SVG** | Scalable Vector Graphics | An image format describing shapes rather than pixels, so it stays sharp at any size. Lucide's icons and Szop's raccoon are SVG. |
| **TDD** | Test-Driven Development | Writing a failing test first, then the code that makes it pass, then tidying up ("red, green, refactor"). Szop uses it for domain rules, services and API routes (see ADR 0007). |
| **TLS** | Transport Layer Security | The encryption behind HTTPS. |
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
| **Accessibility check (axe)** | An automated scan of a page for barriers to people using assistive technology, such as a missing label or low contrast. axe-core is the common engine; Szop runs it in the E2E journeys. |
| **actionlint** | A static checker for GitHub Actions workflow files: syntax, expressions, `needs:` and, through shellcheck, the shell scripts of `run:` steps. Runs in CI's `workflows` job. |
| **Anonymous user** | A server-side user without email or password, created automatically for a guest. Registering links it to a real account. |
| **Baseline (web features)** | A label for web features that work in all major browsers. "Widely available" means they have done so for at least 30 months; Vite's default build target is based on it. |
| **Bastion host** | A server kept only as an entry point for reaching private resources (such as a database) over SSH. Szop uses ECS Exec instead. |
| **Big design up front** | Designing a system in full detail before building any of it. Criticized because the decisions are made without feedback from working software. Szop decides direction up front and details per phase (see ADR 0004). |
| **Bisect (git)** | `git bisect` finds the commit that introduced a bug by binary search: it checks out commits between a known good and a known bad one, and you mark each as good or bad. |
| **Branch protection / ruleset** | GitHub rules that guard branches or tags, for example "no direct pushes to `main`" or "a version tag can never move". **Rulesets** are the newer mechanism; Szop uses them (see ADR 0009). |
| **Brotli** | A compression format for web files, smaller than gzip. Szop's build writes Brotli and gzip copies of every text file, and the server sends whichever the browser accepts. |
| **Bundle** | The JavaScript and CSS files a build tool (Vite) produces from the source code for the browser to download. |
| **Changelog** | A file (`CHANGELOG.md`) listing what changed in each released version. Szop's is written by release-please from the commit messages. |
| **Checkpoint (PostgreSQL)** | The moment PostgreSQL writes all changed data from memory to disk. `DROP DATABASE` waits for one, so Szop's tests run their drops together and share it (see ADR 0020). |
| **Clickjacking** | Showing a site inside an invisible frame on another page, so that the user clicks its buttons without knowing. Prevented by the CSP's `frame-ancestors 'none'`. |
| **CodeQL** | GitHub's code analysis engine: it finds security vulnerabilities and coding errors in the code and in the workflows. Free for public repositories; Szop uses its default setup (see ADR 0010). |
| **Commitlint** | A tool that checks commit messages against a convention, here Conventional Commits, run by a `commit-msg` git hook. |
| **Composite action** | A reusable group of GitHub Actions steps kept in the repository (`.github/actions/<name>/action.yml`) and called from workflows like any action. Szop's `setup` action installs pnpm, Node and the dependencies for every CI job. |
| **Composite foreign key** | A foreign key made of several columns. In Szop, references between workspace-owned tables include `workspace_id`, such as `(workspace_id, category_id) → categories (workspace_id, id)`, so the database refuses a reference into another workspace (see ADR 0012). |
| **Connection pool** | A set of open database connections that the app lends to queries and takes back, so each query does not pay for opening a new connection. node-postgres's `Pool` is one; Szop's API creates it in `createDatabase`. |
| **Container / Docker** | A container packages a program with everything it needs and runs it isolated from the rest of the machine. Docker is the most common tool for building and running containers. Szop runs PostgreSQL in one during development. |
| **Content hash (fingerprint)** | A short hash of a file's content that the build puts in the file's name (`index-3f9a1c.js`). A changed file gets a new name, so the old one can be cached forever. Vite fingerprints everything under `assets/`. |
| **Conventional Commits** | A convention for commit messages, `type(scope): description` (`feat(api): add list sharing`), that tells both people and tools what kind of change a commit is. Szop uses it (see ADR 0009). |
| **Cookie prefix** | A cookie name starting with `__Host-` or `__Secure-`, which the browser accepts only with matching attributes. `__Host-` requires `Secure`, the path `/` and no `Domain`, so no other subdomain can set or overwrite the cookie. |
| **Cooldown (Dependabot)** | A waiting period before Dependabot proposes a new version of a dependency, so malicious releases are usually found and removed before they are offered. Szop uses 7 days (see ADR 0010). |
| **Core Web Vitals** | Google's three metrics of how a page feels to use: LCP (loading), INP (responsiveness) and CLS (visual stability), each with a "good" threshold. |
| **CSS-in-JS** | Writing styles in JavaScript that a library turns into `<style>` elements at run time (Emotion, styled-components). Ruled out for Szop by its Content Security Policy. |
| **Dark mode** | Light text on a dark background. Szop follows the system setting, which the browser exposes to CSS as `prefers-color-scheme`. |
| **Data router (React Router)** | React Router's mode in which the routes are one array handed to `createBrowserRouter`, and a route may have a `loader` that fetches data. Szop uses the mode but not the `loader`: TanStack Query fetches data. |
| **Definition of done** | The checklist every piece of work must meet before it counts as finished. Szop's is kept in `docs/development/definition-of-done.md`. |
| **Dependabot** | GitHub's built-in bot that warns about vulnerable dependencies (alerts) and opens PRs updating them (version and security updates). |
| **Dependency injection** | Handing a component the things it depends on (database client, email sender) from outside instead of it creating them. NestJS and Spring do it with a container; Szop passes dependencies explicitly. |
| **Design tokens** | Named values for the basic visual choices — colors, spacing, font sizes — used everywhere instead of raw values, so the look can be changed in one place. Szop's come in two tiers: a palette, and semantic roles (`primary`, `muted`) that point into it ([visual design](architecture/visual-design.md#3-design-tokens)). |
| **Dev container** | A development environment defined in the repository and run inside a container, so every machine gets identical tools. Considered for Szop, not used (see ADR 0005). |
| **Discriminated union** | A choice between data shapes told apart by one field, such as `status` being `"ok"` or `"error"`. Zod's `discriminatedUnion` validates such a body and gives TypeScript the matching type. |
| **Docker Compose** | A Docker tool that starts a set of containers described in a `compose.yaml` file. A **named volume** in it keeps a container's data (such as the database files) when the container is recreated. |
| **Domain rules** | Business logic independent of HTTP and storage — e.g. how list items are ordered, how totals are computed. Szop keeps them in `packages/shared`. |
| **ECS Exec** | Opening a shell inside a running ECS task (`aws ecs execute-command`). Szop's way to run `psql` against the demo database. |
| **ECS task, task definition, service** | A **task definition** describes a container to run (image, CPU, memory, environment); a **task** is one running copy; an ECS **service** keeps the wanted number of tasks running and replaces failed ones. |
| **Encapsulation (Fastify)** | Fastify's rule that what a plugin registers (routes, hooks, decorators) stays inside that plugin and its children unless the plugin says otherwise. Szop's feature routes are plugins, so a hook for one feature does not leak into another. |
| **Environment (GitHub)** | A named deployment target in a repository (Szop: `demo`, `demo-teardown`, `release`) with its own secrets, variables and rules: which branches may use it, and which people must approve a job before it starts (required reviewers). AWS roles can trust only jobs running in a given environment. |
| **Ephemeral environment** | An environment created on demand from infrastructure-as-code files and destroyed when no longer needed, paid for only while it exists. Szop's demo is one. |
| **ETag** | A version tag the server sends with a response. The browser sends it back to ask whether its copy is still current, and gets `304 Not Modified`, with no body, if so. `@fastify/static` sends one with every file. |
| **Event bus** | An in-process publish/subscribe mechanism: code publishes "list 42 changed", listeners (such as the WebSocket hub) react. |
| **Fargate** | AWS's way of running ECS tasks without managing servers: you state CPU and memory, AWS provides the machine. |
| **Flaky test** | A test that sometimes passes and sometimes fails without any change to the code, usually because of timing or shared state. Treated as a bug in Szop. |
| **Flat config** | ESLint's configuration format since version 9: one `eslint.config.js` exporting an array of config objects, applied in order. |
| **Formatter** | A tool that rewrites code into one consistent layout (indentation, quotes, line breaks). Szop uses Prettier. |
| **Git flow** | A branching model with long-lived `main` and `develop` branches plus `feature/*`, `release/*` and `hotfix/*` branches, made for software released in numbered versions. Considered, not used (see ADR 0009). |
| **Git hook** | A script Git runs at a fixed moment, for example before a commit is created (a **pre-commit hook**). Szop's hooks, managed by husky, format and lint the staged files (pre-commit, lint-staged) and check the message (commit-msg, commitlint). |
| **GitHub Actions: workflow, job, runner** | GitHub's CI/CD service. A **workflow** is a YAML file in `.github/workflows/` started by an event (a push, a PR, a schedule, a button); it holds **jobs**, which run in parallel unless one needs another, each on a fresh virtual machine, the **runner**. |
| **GitHub App** | An integration registered on GitHub with its own identity (`name[bot]`) and narrowly chosen permissions; it gets tokens that expire within an hour. Szop's release-please runs as one (see ADR 0010). |
| **GitHub flow** | A branching model where `main` is always releasable and every change is made on a short-lived branch merged through a pull request. Szop uses it (see ADR 0009). |
| **GitHub Projects** | GitHub's planning tool: a project collects issues from one or more repositories and shows them as a table, a board or a timeline, with custom fields such as a status. Szop's project tracks its phases, open points and decision work (see ADR 0024). |
| **GitOps** | Running infrastructure from git: merging a change to the main branch applies it automatically. Considered for `infra/base`, not used (see ADR 0010). |
| **Graceful shutdown** | Stopping a server by refusing new connections and letting requests in flight finish before the process exits, instead of cutting them off. Szop's API does it on SIGINT and SIGTERM, so tsx's restarts and ECS's task stops lose no request. |
| **Haul** | In Szop's list screen, the dark tray at the bottom that collects the checked items, shows how far along the shopping is and opens into a drawer listing them all (see `visual-design.md`). |
| **Headless component library** | A library providing components' behavior and accessibility (focus, keyboard, dialogs) without any looks, styled by the app. Szop uses Base UI. |
| **Health check** | A request a load balancer or orchestrator sends regularly (Szop: `GET /api/health`) to decide whether an instance should receive traffic or be replaced. |
| **Hook (Claude Code)** | A command Claude Code runs at a fixed moment, for example before a tool call (a `PreToolUse` hook), configured in `settings.json`. It can block the call by exiting with code 2. Szop's refuses force pushes, deletions and tag pushes (see ADR 0015). Unrelated to git hooks despite the name. |
| **Hook (Fastify)** | A function Fastify calls at a fixed point of a request's lifecycle (`onRequest`, `preHandler`, …). |
| **Hook (React)** | A function starting with `use` (`useState`, `useList`) that lets a component use state or other React features. Unrelated to Fastify hooks despite the name. |
| **Hyperscaler** | One of the very large cloud providers offering hundreds of services worldwide: AWS, Microsoft Azure, Google Cloud. |
| **Immutable tag** | A container image tag that, once pushed, can never point at a different image. Szop's registry enforces it, so a version always means the same code. |
| **IndexedDB** | A database built into the browser for storing structured data locally. Considered for guest workspaces, not used (see ADR 0002). |
| **IPv6 /64 block** | The range of IPv6 addresses sharing their first 64 bits — typically what one household or device is given. Rate limits group addresses by it, since one machine can switch between billions of addresses inside its block. |
| **Issue form** | A YAML file in `.github/ISSUE_TEMPLATE/` that turns GitHub's "new issue" page into a form with labelled fields, so issues of one kind share one shape. |
| **Job summary** | The page of a GitHub Actions run (its *Summary* tab) where a job can write Markdown. Szop's `test` job shows Vitest's test report and a coverage table there. |
| **jsdom** | A simulated browser DOM that runs inside Node.js, so component tests can render and click without a real browser. It has no layout engine. |
| **k-anonymity** | Sending only part of a secret's hash, so that the answer covers many possible secrets and the server cannot tell which one was meant. Have I Been Pwned's password check works this way: only the first 5 characters of a SHA-1 hash leave the server. |
| **Lazy creation** | Creating something only when it is first needed. Szop creates a guest's workspace on their first change, not on their first visit. |
| **Least privilege** | Giving every identity only the permissions it needs, so a leak or bug can do little harm. Szop's app role may only send email and accept ECS Exec sessions. |
| **Lighthouse** | Google's tool, built into Chrome, that loads a page while simulating a slow phone and reports performance, accessibility and other scores. |
| **lint-staged** | A tool that runs commands (here ESLint and Prettier) only on the files staged for a commit. |
| **Linter** | A tool that analyzes code for bugs and bad patterns without running it. Szop uses ESLint. |
| **Merge commit, squash merge, rebase merge** | GitHub's three ways to merge a PR. A **merge commit** keeps the branch's commits and adds one commit joining the histories; a **squash merge** turns the whole branch into one new commit; a **rebase merge** replays each commit on top of `main`. Szop uses merge commits (see ADR 0009). |
| **Merge ref** | `refs/pull/<N>/merge`, a hidden branch where GitHub keeps a test merge of a PR's branch into the current `main`. CI checks this merge commit, so it tests what `main` would look like after the merge. |
| **Migration** | A versioned script that changes the database schema; applied in order in every environment. |
| **Milestone** | On GitHub, a named group of issues with a progress bar of how many are closed. Szop has one per roadmap stage, and one for the definition work before the first phase (see ADR 0024). |
| **Minor units** | The smallest unit of a currency (cents, grosze). Szop stores money as integers in minor units. |
| **Monorepo** | One repository holding several packages (here: `apps/web`, `apps/api`, `packages/shared` and the `e2e/` tests, plus the Terraform code in `infra/`). |
| **Multi-stage build** | A Dockerfile with several stages: one with the full toolchain compiles the app, and the final image copies only the result, staying small. |
| **Mutation testing** | Changing the code on purpose (a *mutant*, for example `<` flipped to `<=`) and checking that some test fails. A mutant that no test notices shows a gap in the tests. Szop uses StrykerJS for it. |
| **Named volume** | Storage that Docker keeps apart from any container, so data survives the container's removal. PostgreSQL's data lives in one (`postgres-data` in `compose.yaml`); `docker compose down -v` deletes it. |
| **Nonce (CSP)** | A random value the server puts in the Content Security Policy and on the inline scripts or styles it allows, new for every response. Szop serves a static `index.html`, so it uses none. |
| **Open point** | Something still undecided or not yet done that has been left to a later topic or phase. Szop tracks every one in `docs/open-points.md`, with an `OP-` ID (see ADR 0011). |
| **OpenAPI** | A standard, machine-readable description of a REST API, from which documentation and clients can be generated. |
| **Optimistic update** | Updating the screen immediately as if a request succeeded, then correcting it if the server disagrees. |
| **Origin** | The scheme, domain and port of a URL (`https://example.com`). Cookies and browser security rules work per origin. |
| **Performance budget** | Limits a project agrees not to exceed so it stays fast as it grows, such as "at most 200 KB of JavaScript" or "LCP at most 2.5 s". |
| **Phantom dependency** | A package your code imports without declaring it, working only because something else happened to install it. It breaks when that other package changes. pnpm prevents it. |
| **Phase** | One step of the implementation roadmap (`docs/roadmap.md`), with a `PH-` ID, taken through its own brainstorm, design approval and implementation, on one branch and in one PR. Phases are grouped into stages (see ADR 0014). |
| **Plugin (Fastify)** | A function that receives the Fastify instance and options and adds routes, hooks or decorators to it, registered with `app.register`. Szop's `buildApp` registers one plugin per feature, each with the services it needs as options. |
| **Precompression** | Writing compressed copies of files (Brotli `.br`, gzip `.gz`) at build time, so the server never compresses per request and the strongest settings are affordable. Szop's Vite build does it ([ADR 0023](decisions/0023-production-build-and-serving-details.md)). |
| **Property-based testing** | Testing a rule against hundreds of generated inputs instead of a few hand-picked examples, checking a property that must always hold ("a parent category always comes before its children"). Szop uses fast-check. |
| **Proxy (dev server)** | The Vite dev server forwarding requests for `/api/*` to the API, so the browser sees a single origin during development. |
| **Push protection** | A GitHub secret scanning feature that rejects a push containing a recognized secret, such as an access key, before it reaches the repository. |
| **Query key** | The name TanStack Query caches an answer under, such as `["health"]`. Two components asking with the same key share one request and one answer, and the key is how a cached answer is refreshed. |
| **Quota** | A cap on how much data one workspace may hold (for example 200 lists). |
| **Rate limit** | A cap on how many requests of a kind are accepted in a time window (for example 10 guest creations per hour per IP address); excess requests get HTTP status 429. |
| **Region** | A geographic area where a cloud provider runs data centers, such as AWS's `eu-central-1` (Frankfurt). |
| **Release PR (release-please)** | A pull request that release-please keeps open, holding the next version number and changelog entry, computed from the Conventional Commits merged so far. Merging it creates the version tag and the GitHub Release. |
| **Repository (pattern)** | In the backend, the layer that is the only one talking to the database (`repository.ts` in each feature module), offering functions such as "find this item" and hiding the SQL. Not to be confused with a git repository. In Szop every repository function requires the workspace ID (see ADR 0012). |
| **Required status check** | A CI check that must pass before GitHub allows a PR to be merged. GitHub matches it by job name. Szop requires `ci-ok`, which sums up every job of `ci.yml`, and `pr-title` (see ADR 0010 and ADR 0018). |
| **Role (IAM)** | A set of AWS permissions assumed temporarily by a person or service, instead of permanent keys. ECS uses a **task execution role** (to pull the image and read secrets) and a **task role** (what the app itself may do). |
| **Rolling update** | Replacing the running copies of an app one by one: a copy on the new version starts, passes its health check, then an old one stops, so the app stays up. How ECS redeploys Szop's demo with a new image. |
| **Rolling-wave planning** | Planning near work in detail and far work only roughly, refining the far part as it comes closer. Szop's roadmap splits the stages up to the MVP into phases and keeps the Later stage rough (see ADR 0014). |
| **Rollout** | Getting a new version to its users: releasing and deploying it, often gradually (to a few users first, or behind feature flags). Szop has no users and no permanent environment, so it has no rollout in this sense. |
| **Root module (Terraform)** | A folder of Terraform configuration applied on its own, with its own state. Szop has three: `bootstrap`, `base` and `demo`. |
| **Runner** | The machine that runs one CI job. Szop uses GitHub-hosted runners: a fresh `ubuntu-24.04` virtual machine for every job, thrown away afterwards. |
| **Scale to zero** | A platform stopping all instances of an app when no requests arrive, and starting one on the next request. Cheap, but the first request waits. |
| **Script injection** | A CI attack where attacker-controlled text, such as a PR title, is pasted into a shell script by `${{ … }}` and runs as code. Avoided by passing such values through environment variables. |
| **Security group** | A firewall attached to an AWS resource, listing who may connect on which port. Can allow another security group as the source. |
| **Seed data** | The predefined catalog, categories and units copied into every new workspace. |
| **Server state** | Data in the frontend that is a cached copy of data owned by the server. |
| **SES sandbox** | The starting state of an SES account: mail goes only to verified addresses, up to 200 a day. Leaving it takes a request to AWS. |
| **Session / session cookie** | The server's record of a logged-in (or anonymous) user, and the browser cookie that identifies it on each request. |
| **shadcn/ui** | A collection of styled React components that a command-line tool copies into the project as source code, built on a headless library and Tailwind CSS. |
| **Shield Standard** | AWS's free, always-on protection against common network-level floods, covering every load balancer. |
| **Skeleton placeholder** | Gray shapes in the layout of the content that is still loading, shown instead of a spinner. |
| **Snapshot test** | A test that saves the output (for example rendered HTML) on its first run and fails when later output differs. Szop avoids them for rendered markup, because updating a snapshot without reading it is too easy. |
| **SPA fallback** | Answering the app's own paths, such as `/lists/42`, with `index.html`, so the client-side router can render them on a reload or from a shared link. Szop's API does it for every GET or HEAD path that is not `/api` or under `/api/` and whose last segment has no dot: a dot marks a file, so `/lists/milk.2` gets a 404 instead ([ADR 0023](decisions/0023-production-build-and-serving-details.md)). |
| **Spec / implementation plan** | The two working documents of a larger phase: the spec describes the agreed design, the plan lists the steps to build it. Kept in `docs/superpowers/`. |
| **Spike** | A short, time-boxed investigation that answers one question, such as whether a library works as hoped. Its output is an answer, not code to keep; in Szop it runs before the brainstorm of the phase that needs it (see ADR 0014). |
| **Stage** | A milestone on Szop's roadmap with an exit criterion, such as "every MVP requirement delivered, `1.0.0` released". It groups phases and has no branch or PR of its own (see ADR 0014). |
| **Storybook** | A separate local web app for building and reviewing components on their own, in all their states. Not used by Szop for now. |
| **Sub-issue** | An issue placed under a parent issue on GitHub; the parent shows its sub-issues and how many are closed. In Szop, each open point is a sub-issue of the phase that settles it (see ADR 0024). |
| **Subnet (public, private)** | A slice of a VPC's addresses. A public subnet has a route to the internet; a private one does not. |
| **Supply-chain attack** | Attacking software through something it depends on, such as a hijacked npm package or GitHub action, instead of attacking it directly. |
| **Tabular figures** | Digits that all have the same width (the `tnum` font feature, `tabular-nums` in Tailwind), so numbers line up in columns. |
| **Tailwind CSS** | A styling tool where small single-purpose classes (`px-4`, `text-base`) are written in the markup and compiled at build time into a stylesheet holding only the classes used. |
| **Template database** | A PostgreSQL database used as a pattern for creating others (`CREATE DATABASE … TEMPLATE`). Szop's tests migrate one template, then copy it for each test worker. |
| **Template injection** | zizmor's name for script injection: a `${{ … }}` expression inside a `run:` script is pasted into the script before the shell runs it, so attacker-controlled text such as a PR title runs as code. Fixed by passing the value through `env:`. |
| **Terraform, Terraform state** | The infrastructure-as-code tool Szop uses. It records what it created in a **state** file, kept in S3, and compares it with the configuration to decide what to create, change or delete. |
| **Test coverage** | The share of the code that the tests execute, counted in statements, branches, functions and lines. It shows what no test touches, not whether the tests are good, so Szop measures it and never gates on it. |
| **Test double / fake** | Anything standing in for a real dependency in a test. A **fake** is a simple working implementation (an email sender that records emails instead of sending them); a **mock** is preprogrammed to expect certain calls. |
| **Testing pyramid / testing trophy** | Two shapes for a test suite. The pyramid puts most tests at the bottom as unit tests with mocked collaborators. The trophy puts most tests in the middle as integration tests against real components, such as a real database. Szop's suite is trophy-shaped (see ADR 0007). |
| **Threat model** | A description of what a system protects, who could attack it and through which paths, and what guards each one. Szop's is a living page, [threat-model.md](architecture/threat-model.md). |
| **Toast** | A short message that appears briefly at the edge of the screen and goes away by itself, optionally with an action such as Undo. |
| **Trunk-based development** | A branching model where everyone commits to `main` (the trunk) directly or through branches living less than a day. Needs strong automated tests. Considered, not used (see ADR 0009). |
| **Trust policy (IAM)** | The part of an IAM role that says who may assume it. Szop's CI roles trust only OIDC tokens for a given environment or PR event, such as jobs in the `demo` environment; the token does not say which workflow file runs, so the environment's own rules (a required reviewer, allowed branches) decide who gets that far (see ADR 0012). |
| **Type-aware linting** | Linting that uses TypeScript's type information, so a rule can know, for example, that a call returns a promise. |
| **Type stripping** | Running TypeScript by deleting the type annotations instead of compiling it, which Node.js does itself, stably since Node 24.12. It does not check types. The API runs this way in production ([ADR 0023](decisions/0023-production-build-and-serving-details.md)) and the Claude Code push hook always does (see ADR 0016); in development the API uses tsx instead, for its watch mode (see ADR 0005). |
| **Utility class** | A CSS class that does one thing, such as `p-4` for padding. Tailwind CSS is built on them. |
| **V8** | The JavaScript engine inside Chrome and Node.js. Vitest measures test coverage with V8's built-in instrumentation. |
| **Variable font** | One font file containing every weight (and sometimes width), instead of one file per weight. |
| **Vertical slice** | A piece of work that delivers one capability through every layer at once (database, API, UI, tests, deployment), as opposed to building one layer at a time. |
| **Visual companion** | A browser tab the superpowers brainstorming workflow opens to show mockups and visual options during a brainstorm. Its files live in `.superpowers/`, which git ignores. |
| **Vitest project** | One named group of tests inside a Vitest run, with its own configuration. Szop has three: `api`, from `apps/api/vitest.config.ts`, `web`, from `apps/web/vitest.config.ts`, and `hooks`, for the push hook's tests, which is defined inline. |
| **Walking skeleton** | The thinnest possible version of the whole system that runs end to end (here: SPA → API → database, built by CI and deployed) and does almost nothing yet. Built early to test the foundation decisions. |
| **WebSocket** | A persistent two-way connection between browser and server, letting the server push messages (used for live updates). |
| **Workspace** | Everything one user owns: lists, templates, catalog, categories, units, settings. |
| **Workspace (pnpm)** | Unrelated to the above: one package of the monorepo (`apps/web`, `apps/api`, `packages/shared`, `e2e/`) as pnpm manages it. pnpm links workspaces to each other so they can import one another. |
| **Worktree (git)** | An extra working directory of the same repository, with another branch checked out, so two branches can be worked on side by side. Not used by default in Szop (see ADR 0009). |
| **Write-only argument** | A Terraform resource setting whose value is sent to the provider but never saved in the state file. Used for secrets. |
| **X-Forwarded-For** | An HTTP header listing the addresses a request passed through. Each proxy appends the address it saw, but the client can write anything at the start, so only entries added by trusted proxies count. Szop trusts exactly one, the load balancer (see ADR 0012). |
| **zizmor** | A security linter for GitHub Actions workflows: it finds template injection, excessive token permissions, unpinned actions and impostor commits. Runs in CI's `workflows` job. |
| **Zod** | A TypeScript library for defining data schemas that give both compile-time types and runtime validation. |
