# Demo environment runbook

How to set up, run and take down Szop's environment on AWS, step by step. Szop runs on AWS as an on-demand demo: created for a session and destroyed after it ([ADR 0008](../decisions/0008-hosting.md)). Its infrastructure is Terraform code in three root modules, applied in this order and destroyed in the reverse one:

| Module | Holds | Applied | Chapter |
|---|---|---|---|
| `infra/bootstrap` | The state bucket every module keeps its state in, and the budget alerts | Once, from the owner's machine | [Applying bootstrap](#applying-bootstrap) |
| `infra/base` | Permanent resources: the DNS zone, the email identity, the image registry, the Better Auth secret, the password of the app's database role, the log group, the app's two roles for Elastic Container Service (ECS), and CI's access to AWS: the GitHub OpenID Connect (OIDC) provider and the roles `szop-ci-plan` and `szop-ci-deploy` | From the owner's machine, when it changes | [Buying the domain](#buying-the-domain), [Applying base](#applying-base) |
| `infra/demo` | One demo session: network, load balancer, certificate, the `szop` DNS record, the database on Amazon Relational Database Service (RDS) and the app on ECS | By CI's `demo-up` button, and destroyed by `demo-down`, by hand and every night | [Spinning up](#spinning-up), [Debugging](#debugging), [Tearing down](#tearing-down) |

Shutting Szop down for good is the reverse of this table: [Tearing down](#tearing-down) for `infra/demo`, then [Destroying base](#destroying-base), then [Destroying bootstrap](#destroying-bootstrap).

Why each piece exists is in the [stack overview](../architecture/stack-overview.md#12-where-szop-runs); how Terraform works here is on the [Terraform page](../development/tools/terraform.md); what each module creates is drawn in [AWS resources](../architecture/aws-resources.md). The tools come from [setup guide, section 8](../development/setup.md#8-terraform-tflint-and-the-aws-cli).

**Every command in this runbook assumes `export AWS_PROFILE=szop`** in the terminal, and a current sign-in (`aws sso login`). Lines marked **⚠️ Don't** are mistakes that are hard to undo; read them before the step, not after.

## Contents

- [One-time account setup](#one-time-account-setup)
  - [1. Take stock and clean up](#1-take-stock-and-clean-up)
  - [2. Secure the root user](#2-secure-the-root-user)
  - [3. Region and billing preferences](#3-region-and-billing-preferences)
  - [4. IAM Identity Center](#4-iam-identity-center)
  - [5. Sign in from the CLI](#5-sign-in-from-the-cli)
  - [6. Remove every long-lived key](#6-remove-every-long-lived-key)
- [Applying bootstrap](#applying-bootstrap)
  - [Part 1: the first apply, with local state](#part-1-the-first-apply-with-local-state)
  - [Part 2: moving the state into the bucket](#part-2-moving-the-state-into-the-bucket)
- [Destroying bootstrap](#destroying-bootstrap)
- [Buying the domain](#buying-the-domain)
- [Applying base](#applying-base)
  - [The first apply](#the-first-apply)
  - [Checks](#checks)
  - [Rotating the Better Auth secret](#rotating-the-better-auth-secret)
  - [The app's roles and database password](#the-apps-roles-and-database-password)
  - [CI's roles and variables](#cis-roles-and-variables)
  - [Cost allocation tags](#cost-allocation-tags)
- [Spinning up](#spinning-up)
  - [Service-linked roles](#service-linked-roles)
  - [Pressing the button](#pressing-the-button)
  - [Watching a redeploy](#watching-a-redeploy)
  - [A failed deployment](#a-failed-deployment)
  - [When a run fails](#when-a-run-fails)
  - [Spinning up from your machine](#spinning-up-from-your-machine)
- [Debugging](#debugging)
  - [The app's log](#the-apps-log)
  - [Finding the task](#finding-the-task)
  - [A shell in the task](#a-shell-in-the-task)
  - [Querying the database](#querying-the-database)
  - [Checking the client address](#checking-the-client-address)
  - [Reading a failed db-setup](#reading-a-failed-db-setup)
  - [A task that does not stay up](#a-task-that-does-not-stay-up)
  - [The migration check](#the-migration-check)
  - [A failed destroy](#a-failed-destroy)
- [Checking that no password is in a state](#checking-that-no-password-is-in-a-state)
- [What a demo costs](#what-a-demo-costs)
- [Tearing down](#tearing-down)
  - [With the button](#with-the-button)
  - [Checking that nothing is left](#checking-that-nothing-is-left)
  - [The nightly run](#the-nightly-run)
  - [From your machine](#from-your-machine)
- [Destroying base](#destroying-base)

## One-time account setup

Szop uses an AWS account that was used only for learning and runs nothing else ([ADR 0029](../decisions/0029-aws-account-and-terraform-bootstrap-details.md), decisions 1 to 3). These six steps leave it with: no IAM users and no access keys anywhere; a root user with multi-factor authentication (MFA), not used day to day; and one person signing in through IAM Identity Center, with credentials that expire after hours. Do them in order: step 6 removes the old way in only after step 5 proves the new one works.

### 1. Take stock and clean up

Sign in to the console the way you do today.

1. **IAM → Users.** Write down every user, and on each user's *Security credentials* tab, its access keys. **Do not delete them yet:** one of them is probably how your CLI signs in today. Step 6 removes them.
2. **IAM → Roles.** Delete the roles you created while learning. Leave the **service-linked roles** alone: their path starts with `/aws-service-role/` and AWS manages them.
3. **Leftover resources, in every region.** *Resource Groups & Tag Editor → Tag Editor*, Regions: *All regions*, Resource types: *All supported resource types*, *Search resources*. Delete anything you no longer need: instances, volumes, buckets, load balancers, databases. Then *Billing and Cost Management → Bills*: the charges by service for the last few months should be $0 or covered by credits; a service with charges is still running somewhere. The bill is the more complete list, since Tag Editor misses some resource types: a line for WAF (about $5 a month per web ACL), for example, means a web ACL is left, often next to the CloudFront distribution or load balancer it protects. Szop uses neither WAF nor CloudFront ([ADR 0008](../decisions/0008-hosting.md), decisions 11 and 18): detach the web ACL from its resources (its *Associated AWS resources* tab), delete it, then delete the resource if it is a leftover too.
4. **The root user's access keys.** Signed in as root: *account menu (top right) → Security credentials → Access keys*. There must be none; delete any that exist.

**Check:** Tag Editor (Regions: *All regions*) shows nothing you did not mean to keep; the root user has no access keys. (Global services such as Route 53 and IAM show up under us-east-1 there, and IAM roles never show up at all: the Tag Editor cannot list them, so IAM → Roles above is the check for those.)

### 2. Secure the root user

The root user can do everything, including closing the account, and no policy can limit it.

1. Signed in as root: *account menu → Security credentials → Multi-factor authentication (MFA) → Assign MFA device*.
2. Choose a **passkey or security key**, or an **authenticator app**, and follow the prompts. Register a second device if you have one: losing the only one means a recovery process with AWS Support.
3. Keep the root password in a password manager.

**Check:** the *Multi-factor authentication* section lists your device.

⚠️ **Don't:** create access keys for root, ever. After this step, root is used only for the few tasks only root can do.

### 3. Region and billing preferences

1. **Default region:** *account menu (top right) → Settings → Localization and default Region → Edit*: **Default Region: Europe (Frankfurt)**, then *Save*. Everything Szop creates lives there ([ADR 0008](../decisions/0008-hosting.md), decision 8), and every console session now starts there. On the page of a global service (Billing, IAM, Organizations), the region menu shows every region with a lock: those services have no region, so the menu is unused there. Open a regional service, such as *Console Home*, to switch regions by hand.
2. On *Billing and Cost Management → Home*, note your plan and the remaining credits. On the Free plan, the page shows when it ends. The budget that bootstrap creates watches the spending ([Applying bootstrap](#applying-bootstrap)); no other billing alert is needed.
3. **Let IAM see the billing pages.** By default only the root user sees most of *Billing and Cost Management*: until root turns on *IAM user and role access to Billing information*, every IAM user and role, the Identity Center administrator role included, is answered with "Access denied · IAM user access not activated" on pages such as *Cost allocation tags* and *Cost Explorer*. Sign in **as the root user** (its email address and password, with MFA), then *account menu (top right) → Account → IAM user and role access to Billing information → Edit → Activate IAM Access → Update*. The switch grants nothing by itself: it lets IAM policies decide, and `AdministratorAccess` already allows billing. CI's plan role is denied billing and cost reads on purpose, because everything its job prints is public ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decision 5). Then sign out of root. The tags are activated after the first apply of base ([Cost allocation tags](#cost-allocation-tags)); on an account whose setup is already done, do this step as root now, and the tag step right after.

**Check:** as root, *IAM user and role access to Billing information* shows *Activated*.

### 4. IAM Identity Center

IAM Identity Center is AWS's single sign-on (SSO): you sign in once, with MFA, and get short-lived credentials for the account.

**Before you click:** enabling it creates an **AWS Organization** with this account as its management account, and **creating an organization upgrades the account from the Free plan to the Paid plan.** The Paid plan has no fixed fee: you pay only for usage your credits do not cover, and the credits keep applying for up to 12 months from sign-up. The budget alerts of [Applying bootstrap](#applying-bootstrap) then watch the spending.

1. Check the console's region is **Frankfurt**. Open **IAM Identity Center → Enable**, and choose the option **with AWS Organizations** (the organization instance). Confirm.

   ⚠️ **Don't:** enable it in any other region. Identity Center lives in one region, and moving it means deleting it and starting over.

2. **MFA for every sign-in.** *Settings → Authentication → Multi-factor authentication → Configure*: prompt users for MFA **every time they sign in**; allow **security keys and built-in authenticators** and **authenticator apps**; if a user has no MFA device, **require them to register one at sign-in**. Save.
3. **Your user.** *Users → Add user*: a username (for example your first name), your email address, first and last name. *Next* through the group page (no groups), *Add user*. AWS sends an invitation email: open it, set a password, and register an MFA device when asked.
4. **The permission set.** *Permission sets → Create permission set → Predefined permission set → AdministratorAccess → Next*. Set **Session duration** to **8 hours**. *Next → Create*.
5. **The assignment.** *AWS accounts* shows the organization's tree. Its top entry, **Root**, is the organization's root container, not the root user: expand it, and tick **your account** under it, not Root itself. The account's row shows its name (chosen when the account was created), its 12-digit ID and the root user's email address; no users are listed on this page. Then *Assign users or groups* → the *Users* tab, where your user from step 3 appears → tick it → *Next* → **AdministratorAccess** → *Next → Submit*.
6. On the *Dashboard* (or *Settings*), copy the **AWS access portal URL**, which looks like `https://d-xxxxxxxxxx.awsapps.com/start`. Step 5 needs it.

**Check:** open the access portal URL in a private window, sign in with your new user, password and MFA. The portal lists the account with **AdministratorAccess**.

⚠️ **Don't:** paste the account ID, the portal URL or your email address into a commit, an issue or a PR. The repository is public.

### 5. Sign in from the CLI

`aws configure sso` writes a profile named `szop` to `~/.aws/config`. It holds where to sign in and which role to use; no key is stored anywhere.

```bash
aws configure sso
#   SSO session name (Recommended): szop
#   SSO start URL: the AWS access portal URL from step 4
#   SSO region: eu-central-1
#   SSO registration scopes [sso:account:access]: press Enter
#   (the browser opens: sign in and allow access)
#   then, if asked, pick the account and AdministratorAccess
#   Default client Region: eu-central-1
#   CLI default output format: json
#   Profile name: szop

aws sso login --profile szop
aws sts get-caller-identity --profile szop
```

**Check:** the last command prints an `Arn` like `arn:aws:sts::<account>:assumed-role/AWSReservedSSO_AdministratorAccess_…/<your user>`: a role assumed through Identity Center, not an IAM user.

### 6. Remove every long-lived key

Only now that step 5 works:

1. Sign in to the console **through the access portal** (step 4's URL), not with your old IAM user.
2. **IAM → Users**: for each user from step 1, open *Security credentials* and **deactivate**, then **delete**, every access key. Then delete the user itself (*Users → select → Delete*).
3. On your machine, open `~/.aws/credentials` and delete every `aws_access_key_id` and `aws_secret_access_key` line, with its `[profile]` header. If nothing is left, delete the file.
4. Open `~/.aws/config` and delete every section except `[profile szop]` and `[sso-session szop]`: the old `[default]` and the profiles of your old IAM user.

On this machine `~/.aws` is a link to the Windows user's `.aws` folder, so the Windows side changes with it, which is intended.

**Check:**

```bash
env -u AWS_PROFILE aws sts get-caller-identity   # must FAIL: "Unable to locate credentials"
aws sts get-caller-identity --profile szop        # works: the assumed role, as in step 5
```

The first command failing is the point: a command that forgets the profile now stops, instead of quietly running as an old user with a key that never expires.

⚠️ **Don't:** delete the IAM user or its key before step 5's check passes; you would lose the CLI's way in until Identity Center works.

## Applying bootstrap

`infra/bootstrap` creates the S3 bucket every module keeps its state in, `szop-tfstate-ntrtcr`, and the monthly budget with its email alerts. The bucket cannot hold bootstrap's own state before it exists, so bootstrap is applied in two parts: first with a local state file, then its state moves into the bucket ([ADR 0029](../decisions/0029-aws-account-and-terraform-bootstrap-details.md), decision 4).

### Part 1: the first apply, with local state

```bash
export AWS_PROFILE=szop
aws sso login
cd ~/workspace/szop/infra/bootstrap
mv backend.tf backend.tf.off      # set the S3 backend aside: its bucket does not exist yet
cp terraform.tfvars.example terraform.tfvars
```

`backend.tf` points at the bucket this part creates, so `terraform init` would fail with it in place; Part 2 puts it back. (`git status` shows it as deleted until then.)

Edit `terraform.tfvars`: your 12-digit account ID (in quotes; `aws sts get-caller-identity --query Account --output text` prints it) and the address the budget alerts go to. git ignores this file.

Check that the bucket's name is free; S3 names are shared by every AWS account in the world:

```bash
aws s3api head-bucket --bucket szop-tfstate-ntrtcr
```

- `An error occurred (404) … Not Found`: the name is free. Go on.
- JSON with `"BucketRegion": "eu-central-1"`: the bucket is already yours, so bootstrap was applied before. Stop and check the state.
- Any other error (`403 Forbidden`, or `301`/`400` for a bucket in another region): another account owns the name. Stop; the name in the code must change.

Then:

```bash
terraform init      # downloads the AWS provider; "Terraform has been successfully initialized!"
terraform plan -input=false    # read it: "Plan: 8 to add, 0 to change, 0 to destroy."
terraform apply                # shows the same plan; type yes
```

The plan's eight resources: the bucket, its versioning, public access block, ownership controls, encryption, policy and lifecycle rule, and the budget. `apply` ends with `Apply complete! Resources: 8 added, 0 changed, 0 destroyed.` and the output `state_bucket_name = "szop-tfstate-ntrtcr"`.

Then check that the bucket is protected against a stray destroy:

```bash
terraform plan -destroy   # must end with an error: "Instance cannot be destroyed"
```

**Look at what was created:**

- *Billing and Cost Management → Budgets → `szop-monthly`*: a $10 monthly budget with two alerts, *Forecasted > $5.00* and *Actual > $10.00*, to your address. Budget emails need no confirmation. The forecast needs some usage history, so no email in the first weeks is normal.
- *S3 → `szop-tfstate-ntrtcr`*: *Properties* shows versioning enabled and SSE-S3 encryption; *Permissions* shows all public access blocked, *Bucket owner enforced* and the policy denying requests without TLS; *Management* shows the lifecycle rule.

The state is now the file `terraform.tfstate` in `infra/bootstrap`, the only record of what Terraform created until Part 2.

⚠️ **Don't:**

- commit `terraform.tfvars` or `terraform.tfstate` (git ignores them; don't force-add them);
- put `backend.tf` back before the apply has finished: Part 2 does;
- delete `terraform.tfstate` before Part 2;
- run `terraform destroy`.

### Part 2: moving the state into the bucket

`infra/bootstrap/backend.tf` tells Terraform to keep bootstrap's state in the bucket, under `bootstrap/terraform.tfstate`, with S3's native lock. Put it back and move the state there:

```bash
cd ~/workspace/szop/infra/bootstrap
mv backend.tf.off backend.tf      # git status is clean again
terraform init -migrate-state
#   "Do you want to copy existing state to the new backend?" Enter yes
terraform plan
#   must say: "No changes. Your infrastructure matches the configuration."
aws s3 ls s3://szop-tfstate-ntrtcr/bootstrap/
#   lists terraform.tfstate, and no .tflock (the lock exists only during a run)
rm terraform.tfstate terraform.tfstate.backup
```

From now on, every `plan` and `apply` in bootstrap reads and writes the state in the bucket, and holds the lock while it runs.

⚠️ **Don't:**

- delete the local state files before `terraform plan` says *No changes*;
- answer `no` to the copy question and go on: the bucket would start with an empty state, and the next plan would try to create everything again;
- run `terraform apply` "to be sure": the plan is the check.

## Destroying bootstrap

Only when Szop is shut down for good, and only **after `infra/demo` ([Tearing down](#tearing-down)) and `infra/base` ([Destroying base](#destroying-base)) are destroyed**: their states live in this bucket.

1. Delete `infra/bootstrap/backend.tf`, then run `terraform init -migrate-state` and answer `yes`: the state moves back into a local file.
2. Delete the `lifecycle { prevent_destroy = true }` block of `aws_s3_bucket.state` in `state_bucket.tf`.
3. Empty the bucket, every version and delete marker included: *S3 → `szop-tfstate-ntrtcr` → Empty*, and confirm.
4. `terraform destroy`, read the plan (8 to destroy), type `yes`.

The changes of steps 1 and 2 stay on your machine; they are not committed.

## Buying the domain

Szop's domain is `dzwoniec.com`, registered through Route 53, AWS's DNS service and domain registrar; the app lives at `szop.dzwoniec.com` ([ADR 0030](../decisions/0030-domain-and-base-infrastructure-details.md), decisions 1 and 2). Buying it is done once, by hand: Terraform can only manage what exists.

**Before you click:**

- **It is paid at once, by card, and not refundable.** A `.com` costs about $15 a year. AWS promotional credits do not cover domain registrations.
- **The budget alert fires this month.** `szop-monthly` alerts when the actual cost passes $10, and it ignores credits, so the registration triggers the email. That is expected, not a forgotten demo.
- Sign in to the console through the access portal, not as root.

**Register it:**

1. *Route 53 → Domains → Registered domains → Register domains.* Search for `dzwoniec.com`, *Select*, *Proceed to checkout*.
2. **Duration:** 1 year. **Auto-renew: on.** Without it, the domain lapses after a year and anyone can buy it.
3. **Contacts:** your real name, address, phone and email, the same for the registrant, administrative and technical contacts. ICANN (the body that runs domain names) requires them to be accurate.
4. **Privacy protection: on** for every contact (the default): WHOIS, the public lookup of domain owners, then shows the registrar's details instead of yours.
5. Review, accept the terms, *Submit*. *Route 53 → Domains → Requests* shows the progress; registration takes minutes, sometimes hours.

**Right after:**

1. **Confirm the registrant email.** ICANN's rules make the registrar send a verification link to the registrant address. **If it is not clicked within 15 days, the domain is suspended**: it stops resolving until it is.
2. **Transfer lock.** *Registered domains → `dzwoniec.com`*: *Transfer lock* is **On**. It stops the domain being moved to another registrar without you.
3. **The hosted zone.** Registration creates a **hosted zone** for `dzwoniec.com` on its own: the container of the domain's DNS records, served by four AWS name servers, which the registration points at. Read its ID:

   ```bash
   aws route53 list-hosted-zones-by-name --dns-name dzwoniec.com \
     --query 'HostedZones[0].[Id,Config.Comment]' --output text
   #   /hostedzone/Z0123456789ABCDEFGHIJ   HostedZone created by Route53 Registrar
   ```

   The part after `/hostedzone/` is the zone ID. It is not secret: `infra/base` commits it in its `import` block, which hands the zone to Terraform ([Applying base](#applying-base)).

**Check:**

```bash
aws route53domains get-domain-detail --region us-east-1 --domain-name dzwoniec.com \
  --query '[AutoRenew,StatusList,Nameservers[].Name]'
#   true, a status list with "clientTransferProhibited", and four ns-….awsdns-… names
dig +short NS dzwoniec.com
#   the same four names (empty for a while after registration; DNS takes time to catch up)
```

The domains API exists only in `us-east-1`, hence `--region`.

⚠️ **Don't:**

- delete or recreate the hosted zone: a new zone gets different name servers, and the whole domain stops resolving until the registration points at them and caches expire, up to two days;
- add records to the zone by hand: `infra/base` owns its records, and a hand-made one makes Terraform fail with "already exists";
- turn auto-renew off.

## Applying base

`infra/base` holds what outlives every demo: the domain's zone with its Certification Authority Authorization (CAA), Mail Exchanger (MX) and mail records, SES's identity for `dzwoniec.com`, the image registry `szop`, the Better Auth secret and the log group `/szop/app` ([ADR 0030](../decisions/0030-domain-and-base-infrastructure-details.md)), the app's two roles and the password of its database role ([PH-12c](../roadmap.md#ph-12c-app-on-ecs-and-rds)), and CI's access to AWS: the GitHub OIDC provider and the two roles `szop-ci-plan` and `szop-ci-deploy` ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md)). It is applied from your machine after [Buying the domain](#buying-the-domain), and again whenever its code changes: first from the PR's branch, then from `main` after the merge.

### The first apply

```bash
export AWS_PROFILE=szop
aws sso login
cd ~/workspace/szop/infra/base
cp terraform.tfvars.example terraform.tfvars   # the first time only
```

Edit `terraform.tfvars`: your 12-digit account ID, in quotes. git ignores the file.

```bash
terraform init                  # "Terraform has been successfully initialized!"
terraform plan -input=false     # read it: "Plan: 1 to import, 12 to add, 1 to change, 0 to destroy."
terraform apply                 # the same plan; type yes
```

The zone is the one to **import** and to update in place: Terraform adopts the zone the purchase created, and its name servers stay as they are. The update only adds the tags `project` and `group` (the default tags every resource gets, so Cost Explorer can group base's cost) and records `force_destroy = false` (Terraform's own setting, nothing on AWS). The twelve to add are the registry and its lifecycle policy, the log group, the secret, the CAA and MX records, the SES identity, its three DKIM records, and the DMARC and SPF records. The secret's value appears nowhere in the plan: it is generated during `apply`, sent to AWS and forgotten.

⚠️ **Stop** if the plan shows the zone as `+ create` or `-/+` (replace), or if its `~ update` changes anything besides `tags_all` and `force_destroy`, for example `comment` or `name`: the import did not match. Compare the zone ID and comment in `dns.tf` with [Buying the domain](#buying-the-domain)'s command.

### Checks

```bash
terraform plan                  # "No changes. Your infrastructure matches the configuration."
terraform plan -destroy         # must end with an error: "Instance cannot be destroyed" (the zone)

dig +short NS dzwoniec.com      # the four ns-….awsdns-… names of the registration
dig +short CAA dzwoniec.com     # 0 issue "amazon.com"
dig +short MX dzwoniec.com      # 0 .
dig +short TXT dzwoniec.com     # "v=spf1 -all"
dig +short TXT _dmarc.dzwoniec.com   # "v=DMARC1; p=reject"

aws sesv2 get-email-identity --email-identity dzwoniec.com \
  --query '[VerifiedForSendingStatus,DkimAttributes.Status]'
#   [true, "SUCCESS"]; minutes to an hour after the apply, while the DKIM records spread

aws resourcegroupstaggingapi get-resources --tag-filters Key=group,Values=base \
  --query 'ResourceTagMappingList[].ResourceARN'
#   the repository, the log group, the two parameters and the SES identity

aws resourcegroupstaggingapi get-resources --region us-east-1 --tag-filters Key=group,Values=base \
  --query 'ResourceTagMappingList[].ResourceARN'
#   the zone: Route 53 is global, and its tags are listed in us-east-1
```

**The secret is not in the state.** Once, after the first apply, and after every rotation (the same check for `szop_app`'s password, and for the master password in the demo's state, is in [Checking that no password is in a state](#checking-that-no-password-is-in-a-state)):

```bash
secret=$(aws ssm get-parameter --name /szop/better-auth-secret --with-decryption \
  --query Parameter.Value --output text)
terraform state pull | grep -c -- "$secret"   # must print 0
unset secret
```

### Rotating the Better Auth secret

In `secrets.tf`, raise `value_wo_version` by one, commit it on a branch, and apply as above: the plan shows one change, `~ value_wo_version`. Terraform generates a new password and overwrites the parameter. A running demo keeps the old value until its task restarts; the new value signs everyone out, which a demo can afford. Then repeat the state check.

⚠️ **Don't:**

- set the parameter's value by hand: the next rotation overwrites it, and the code no longer says where it came from;
- add a `value` argument to the parameter "to see it": it would write the secret into the state;
- remove `prevent_destroy` from the zone, or run `terraform destroy` here, unless Szop is shut down for good ([Destroying base](#destroying-base)).

### The app's roles and database password

[PH-12c](../roadmap.md#ph-12c-app-on-ecs-and-rds) adds to base what the app on ECS needs before a demo can run it ([ADR 0038](../decisions/0038-app-on-ecs-and-rds-details.md)):

- the two roles `szop-app-task-execution` and `szop-app-task`, each trusted by `ecs-tasks.amazonaws.com` for tasks of this account only. The **task execution role** is what ECS uses to start a task: it pulls the image from the registry `szop`, writes to the log group `/szop/app` and fetches the secrets into the container's environment (`/szop/db-app-password`, and the master password RDS keeps in Secrets Manager, which only `db-setup`'s task definition names). The code in the container never holds it. The **task role** is what the code in the container may call: today only the four `ssmmessages:` actions that ECS Exec needs;
- the SSM parameter `/szop/db-app-password`, the password of the database role `szop_app` that the app connects as. Terraform generates it (64 letters and digits) and sends it through a write-only argument, as for the Better Auth secret, so it never enters the state. It lives in base because the database is recreated for every session, and the role with it, but the password need not change: `db-setup` creates the role with it at each `demo-up`;
- the deploy role's three new managed policies, `szop-ci-deploy-demo-database`, `szop-ci-deploy-demo-service` and `szop-ci-deploy-image`, with the extra egress rules in `szop-ci-deploy-demo-network`, and the plan role's `DenyDataReads` statement.

Apply it from the PR's branch as for every base change, then check:

```bash
terraform plan                  # "No changes. Your infrastructure matches the configuration."

aws iam list-attached-role-policies --role-name szop-ci-deploy --query 'AttachedPolicies[].PolicyName'
#   six, in any order: szop-ci-deploy-demo-network, -load-balancer, -dns, -database, -service, and szop-ci-deploy-image
aws iam get-role --role-name szop-app-task-execution --query Role.AssumeRolePolicyDocument
#   "ecs-tasks.amazonaws.com", with aws:SourceAccount and aws:SourceArn conditions; the same for szop-app-task
aws ssm describe-parameters --parameter-filters Key=Name,Values=/szop/db-app-password \
  --query 'Parameters[].[Name,Type]' --output text
#   /szop/db-app-password   SecureString
```

The plan comment of the PR shows IAM Access Analyzer's findings for the new and changed policies; the known trust-policy findings stay accepted ([CI/CD](../development/ci-cd.md#the-plan-comment)). After the merge, apply base again from `main`; the plan must show no changes. Then check that the password is not in the state ([Checking that no password is in a state](#checking-that-no-password-is-in-a-state)).

**Rotating `szop_app`'s password.** In `secrets.tf`, raise `value_wo_version` of `aws_ssm_parameter.db_app_password` by one, commit it on a branch and apply: the plan shows one change. The next `demo-up` runs `db-setup`, which sets the new password on the role, and starts tasks that read it. A task that a running demo restarts before then reads the new password, which the database does not know yet, so rotate while the demo is down, or press `demo-up` right after.

⚠️ **Don't:**

- put `szop_app`'s password, or the master password, anywhere by hand: a `value` argument, a `data "aws_ssm_parameter"` or a `data "aws_secretsmanager_secret_version"` would write it into the state;
- set the parameter in the console: the next rotation overwrites it, and the role's password and the parameter would disagree until `db-setup` runs.

### CI's roles and variables

The apply that adds the CI roles ([PH-11](../roadmap.md#ph-11-ci-access-to-aws-and-the-teardown-safety-net)) shows `Plan: 6 to add, 0 to change, 0 to destroy.` on top of what base already holds: the OIDC provider, the two roles, the plan role's `ReadOnlyAccess` attachment and the two roles' inline policies. Apply it from the PR's branch, as above, and check:

```bash
terraform plan                  # "No changes. Your infrastructure matches the configuration."

aws iam get-role --role-name szop-ci-deploy --query Role.AssumeRolePolicyDocument
#   two statements, each with "token.actions.githubusercontent.com:sub" an exact value:
#   GitHubDemoTeardown: "repo:luiki-dev@290870182/szop@1380292421:environment:demo-teardown",
#     and "token.actions.githubusercontent.com:ref" exactly "refs/heads/main"
#   GitHubDemo: "repo:luiki-dev@290870182/szop@1380292421:environment:demo",
#     and NO "ref" condition: demo-up runs from any branch
aws iam get-role --role-name szop-ci-plan --query Role.AssumeRolePolicyDocument
#   "token.actions.githubusercontent.com:sub" is exactly "repo:luiki-dev@290870182/szop@1380292421:pull_request"

aws iam list-attached-role-policies --role-name szop-ci-deploy --query 'AttachedPolicies[].PolicyName'
#   szop-ci-deploy-demo-network, szop-ci-deploy-demo-load-balancer and szop-ci-deploy-demo-dns, in any order
#   (and since PH-12c also -database, -service and szop-ci-deploy-image: see "The app's roles and database password")
aws iam list-role-policies --role-name szop-ci-deploy
#   one inline policy, "state"
```

The `GitHubDemo` statement has no `ref` condition because `demo-up` runs from any branch; what stands between a branch's code and the deploy role is the owner's approval of the `demo` environment, so that environment must exist with its reviewer **before** this statement does ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decisions 10 and 14). If it is missing, a job that names `demo` creates it with no protection and gets credentials unapproved. The first three managed policies hold what PH-12b's `infra/demo` needs (the network, the load balancer with its certificate, and the `szop` record and certificate-validation record in the zone); PH-12c adds three more for the database, the ECS service and the image push. Each is limited to resources tagged `project` = `szop` and `group` = `demo`, or to those two record names in the zone ([PH-12b spec](../superpowers/specs/2026-10-18-PH-12b-network-and-the-demo-up-button-design.md#the-deploy-role)); the plan comment of the PR that changes them shows IAM Access Analyzer's findings.

Both trust policies also hold `"token.actions.githubusercontent.com:aud": "sts.amazonaws.com"`. These two conditions are what keeps every other repository, branch and workflow from getting the roles' credentials. The `@` numbers are the owner's and the repository's GitHub IDs, which the immutable subject adds ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decision 13); they are public, unlike the account ID.

**Store the two role ARNs** (Amazon Resource Names, the roles' unique IDs) as repository variables, which the workflows read as `vars.AWS_PLAN_ROLE_ARN` and `vars.AWS_DEPLOY_ROLE_ARN`. They are base's outputs. In the browser: *Settings → Secrets and variables → Actions → Variables → New repository variable*. Or with the GitHub CLI, from `infra/base`:

```bash
gh variable set AWS_PLAN_ROLE_ARN --repo luiki-dev/szop --body "$(terraform output -raw ci_plan_role_arn)"
gh variable set AWS_DEPLOY_ROLE_ARN --repo luiki-dev/szop --body "$(terraform output -raw ci_deploy_role_arn)"
```

No access key and no account ID is stored in GitHub: the workflows read the account ID from the credentials they receive. The ARNs contain the account ID. It is not a secret, and the credentials step of both workflows prints the ARN in its public log; still, keep the ARNs and the account ID out of commits, issues and PRs, where nothing needs them.

**Create the `demo-teardown` environment first**, before `demo-down.yml` reaches `main` ([GitHub settings](../development/github-settings.md#environments)): no reviewer, deployment branches limited to `main`. A job that names an environment that does not exist creates it with no protection at all. The plan comment of the PR that adds the roles needs the variables, so these steps come before it.

**Create the `demo` environment before applying base with the `GitHubDemo` statement** (the apply of [PH-12b](../roadmap.md#ph-12b-network-and-the-demo-up-button)): you as the only required reviewer, *Prevent self-review* off (you are the only person who can press the button, so with it on you could never approve your own run), and deployment branches set to *No restriction*. The same environment must exist before `demo-up.yml` runs on any branch. **Check that its protection is really saved** before applying: once created, run

```bash
gh api repos/luiki-dev/szop/environments/demo --jq '.protection_rules[].type'
```

It must print `required_reviewers`. The first `demo` environment of PH-12b was saved without its reviewer (GitHub reported no protection rules), and base was then applied with the trust that names it; an environment without the reviewer gives the deploy role to any run on any branch without your approval ([ADR 0034](../decisions/0034-network-and-demo-up-details.md), Settled while building). The apply adds the three managed policies and their attachments and updates the deploy role's trust; read the plan, which must change nothing else.

After the merge, apply base again from `main`, as for every base PR ([ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 9); the plan must show no changes.

⚠️ **Don't:**

- add `repo:luiki-dev@290870182/szop@1380292421:environment:demo` to the deploy role's trust by hand, or apply it before the `demo` environment exists with its required reviewer: GitHub creates a missing environment unprotected ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decision 10);
- widen a CI role in the console: the plan comment and IAM Access Analyzer check the roles' policies only when they change in code.

### Cost allocation tags

Once the access portal works (step 5) and a resource that carries the tags exists, which `infra/bootstrap` and `infra/base` provide, make the cost reports group by them. Signed in through the access portal, *Billing and Cost Management → Cost allocation tags*: under *User-defined cost allocation tags*, select `group` and `project`, then *Activate*. These are the two tags every Szop resource carries, so Cost Explorer can group the spending by module ([ADR 0008](../decisions/0008-hosting.md), decision 26). A tag shows in the list only after a resource carrying it exists, which can take up to 24 hours, and its cost data starts from the moment of activation, never earlier: do it before the first demo, not after. This needs step 3's *Activate IAM Access* first ([OP-094](https://github.com/luiki-dev/szop/issues/209)).

**Check:** *Cost allocation tags* opens for your Identity Center user and lists `group` and `project` as *Active*.

## Spinning up

`infra/demo` is created by the **`demo-up`** workflow, by hand ([ADR 0010](../decisions/0010-ci-cd.md), decision 11; [ADR 0034](../decisions/0034-network-and-demo-up-details.md); the app and its database since [PH-12c](../roadmap.md#ph-12c-app-on-ecs-and-rds)). A demo is 33 resources:

- the network, the load balancer and the DNS: a VPC, two public and two private subnets, an internet gateway and the public route table with its two associations; the load balancer with its security group, that group's two ingress rules (HTTP and HTTPS) and its egress rule to the app's tasks, and the load balancer's two listeners; the HTTPS certificate with its DNS validation record and the validation that waits for the certificate to be issued (`aws_acm_certificate_validation`); the `szop` DNS record (19 resources, plus the egress rule);
- the database: its security group and the one ingress rule on port 5432, a subnet group of the two private subnets, and the RDS instance `szop-demo` (PostgreSQL 18, `db.t4g.micro`, 20 GB);
- the app: the tasks' security group with its three rules, the ECS cluster `szop-demo`, the task definitions `szop-demo-app` and `szop-demo-db-setup`, the target group `szop-demo-app` and the ECS service `szop-demo-app`.

RDS also creates a secret in Secrets Manager for the database's master password. Terraform does not count it as a resource, and RDS deletes it with the instance. `https://szop.dzwoniec.com` then shows the app's status page: `API: ok`, `Database: up` and the schema version.

Before the first press, base must be applied with PH-12c's roles and policies ([The app's roles and database password](#the-apps-roles-and-database-password)), the `demo` environment must exist with you as its reviewer ([CI's roles and variables](#cis-roles-and-variables)), and the service-linked roles must exist ([Service-linked roles](#service-linked-roles)).

### Service-linked roles

ECS and RDS each use a **service-linked role**, an IAM role that AWS creates and manages for one service. If the account does not have one yet, the first `terraform apply` that needs it fails with an error that names it; the deploy role cannot create service-linked roles on purpose, so the owner creates each once:

```bash
aws iam get-role --role-name AWSServiceRoleForECS --query Role.Arn --output text
aws iam get-role --role-name AWSServiceRoleForRDS --query Role.Arn --output text
#   an ARN each; "NoSuchEntity" means the role is missing
aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com   # only if missing
aws iam create-service-linked-role --aws-service-name rds.amazonaws.com   # only if missing
```

The load balancer's role, `AWSServiceRoleForElasticLoadBalancing`, has existed since [PH-12b](../roadmap.md#ph-12b-network-and-the-demo-up-button).

### Pressing the button

1. On GitHub: *Actions → demo-up → Run workflow*. Choose the branch in *Use workflow from*: the one you want checked, usually the PR's branch. Leave `ref` empty to deploy that branch's latest commit, or type a branch, a tag or a **full 40-digit commit hash** to deploy that instead. A short hash is refused: checkout would look it up as a branch name. Then *Run workflow*.
2. Open the run. Two jobs start at once and need no approval. `enable-teardown` turns green in seconds: it switches the nightly `demo-down` back on if GitHub had disabled it. `build` builds the image of the commit with Docker, holding no AWS credentials, and keeps it as the workflow artifact `image` (under a minute on PH-12c's first demo). The job `deploy` waits for you and for both: *Review deployments* → tick `demo` → *Approve and deploy*. Approve only code you have read; the job gets the deploy role's credentials ([threat model](../architecture/threat-model.md#who-can-act-and-through-which-path)). *Reject* ends the run without touching AWS. **Approve within a day:** the artifact is kept for one day. If it has expired, `deploy` fails at *Download the image*; press `demo-up` again.
3. Wait for `deploy` to turn green. It does these steps, in order:
   1. checks the commit out and compares it with the one `build` built the image from; if the branch moved while you were approving, it stops (press `demo-up` again);
   2. downloads the image and loads it into Docker, before any AWS credentials exist, so the artifact is in hand first ([ADR 0012](../decisions/0012-security-baseline.md), decision 18);
   3. takes the deploy role and runs `terraform init`;
   4. **pushes the image to the registry** `szop` as `szop:<commit>`, unless that tag is already there (tags are immutable, so an image that was pushed once is kept). The push comes before the apply because on a redeploy Terraform swaps the task definition at once, and the new task must find its image;
   5. **applies `infra/demo`** with the commit passed as `deployed_commit`. The service is created with zero tasks. The certificate is issued first, which takes a few minutes ([ADR 0030](../decisions/0030-domain-and-base-infrastructure-details.md), decision 5), and a new database takes about 5 minutes (5 minutes 0 seconds on the first demo);
   6. **runs `db-setup`** as a one-off ECS task: it connects to the database as the master user and creates or updates the role `szop_app`, which the app connects as, and makes it the database's owner. It must stop with exit code 0 within 10 minutes (it needs about a minute: Fargate pulls the image and starts). At the deadline the workflow stops the task itself, so a stuck one does not run on;
   7. **starts the app**. On a fresh demo (the service wants 0 tasks) it sets the wanted count to 1 and forces a new deployment, so the circuit breaker watches the first start too; on a redeploy Terraform's new task definition has already started a deployment, and the count is left alone. If the last deployment failed and this run changes no task definition (the same commit pressed again), it forces a new deployment, since Terraform starts none. Then, every 10 seconds for up to 15 minutes, it reads the primary deployment, waiting until it is the one this run expects: `COMPLETED` with one deployment left and as many tasks running as wanted, at least one, is success, and `FAILED` stops the run at once ([A failed deployment](#a-failed-deployment)). The task pulls the image, runs the migrations and passes the load balancer's health checks;
   8. **waits for the app**: asks `https://szop.dzwoniec.com/api/health` every 10 seconds, for up to 10 minutes, until it answers `200` with `"status":"ok"` and the commit just deployed, so DNS, the certificate, the load balancer, the app and its database all work, and the old task no longer answers. Every wait runs to a deadline in seconds, not to a count of tries, so a slow request cannot stretch it.

   The first demo with the app took about 9 minutes from the approval: about 6 for the apply, 5 of them the database, then a minute each for `db-setup` and the start; the job's limit is 45 minutes, which the three deadlines (35 minutes together), the apply and the state lock's wait need. **A redeploy** over a running demo took about 3 minutes on PH-12c's defaults: the push, an apply that only registers the two new task definitions, `db-setup`, which finds the role and resets its password, and about a minute and a half while the new task starts, passes the health check and replaces the old one. **On PH-12d's settings** a redeploy takes about 4 minutes from the approval (3 minutes 41 seconds on its last demo): a minute for the push and Terraform's setup, 12 seconds of apply, a minute for `db-setup` and a minute and a half for the start, most of it the 60-second grace period. With a grace period of 120 seconds the start took 3 minutes, which is why it is 60 ([PH-12d spec](../superpowers/specs/2026-10-21-PH-12d-safe-redeploys-design.md), decision 8). A fresh demo on PH-12d took about 10 minutes from the approval, the database 5 of them; its start took 3 minutes (2:55), because that run had the 120-second grace period: a redeploy at 120 seconds took as long (3:03), and the fix-forward at 60 seconds 1:34. Scaling from zero with `--force-new-deployment` also started two tasks and stopped one a minute later, which added no time. The first run before PH-12c, with no database, took about 4 minutes.
4. Read the run's **summary**: the URL, the commit and the image (and whether this run pushed it or found it in the registry), the result of each step above, and that `demo-down` destroys the demo at the next 01:17 UTC unless pressed sooner.

**Check:** open both addresses in a browser.

- `https://szop.dzwoniec.com` shows the status page: `API: ok`, `Database: up` and the schema version (`0000_init` today), with a valid certificate (the padlock; issued by Amazon).
- `http://szop.dzwoniec.com` redirects to the HTTPS address (a 301). From a terminal: `curl -sI http://szop.dzwoniec.com`, whose first line is `HTTP/1.1 301` and whose `location` header names the HTTPS address.

The demo now exists until `demo-down` removes it ([Tearing down](#tearing-down)). Pressing `demo-up` again while it is up deploys the new commit on top: it pushes the new image, registers a new task definition revision and updates the service in place, and leaves the database alone. A redeploy keeps the demo up: ECS starts the new task beside the old one and stops the old one only once the new one is healthy ([Watching a redeploy](#watching-a-redeploy)). Two presses never run at the same time (the second waits for the first). GitHub keeps only one waiting run per concurrency group, so a third press replaces a run that is still waiting: that run is cancelled.

⚠️ **Don't:** leave a demo up by accident. An approved run stays up until `demo-down` runs, at the latest at 01:17 UTC; press `demo-down` when you are done. A demo costs about $0.08 an hour ([What a demo costs](#what-a-demo-costs)).

### Watching a redeploy

[PH-12d](../roadmap.md#ph-12d-safe-redeploys) makes a redeploy keep the demo up: ECS starts the new task beside the old one, and the old one stops only once the new one is healthy ([ADR 0036](../decisions/0036-scalability-and-isolation.md), decision 3). `scripts/watch-demo.sh` shows it from your machine. It asks `/api/health` once a second and prints the time, the HTTP status (`000` for no answer), the first 12 characters of the commit and the schema version. It needs bash and `curl`, and no AWS credentials.

```bash
scripts/watch-demo.sh                                  # https://szop.dzwoniec.com/api/health
scripts/watch-demo.sh http://127.0.0.1:8080/api/health # another URL, for instance pnpm image:up's
```

To watch a redeploy, start the script on a running demo, press `demo-up` with another commit ([Pressing the button](#pressing-the-button)), and let the script run until the run is green. Ctrl+C stops it and prints a summary: the requests, how many were not `200`, and each commit seen with the times it was first and last seen. The format, with made-up commits:

```text
16:52:48  200  5ee7d2e04b90  0000_init
16:52:49  200  5ee7d2e04b90  0000_init
16:52:50  200  b1c4f0a97d3e  0000_init  <- new commit
...
Requests: 412, not 200: 0
Commit 5ee7d2e04b90: first seen 16:41:02, last seen 16:52:49
Commit b1c4f0a97d3e: first seen 16:52:50, last seen 16:58:31
```

A good redeploy shows `200` on every line from the press to the end, and the switch to the new commit. While both tasks are healthy the load balancer routes each request on its own, so the commits may alternate for a few lines before the new one stays; `<- new commit` marks every change, including a line back to the old commit. A `000` or a `503` line means a request found no task able to answer. The same script is the check for the redeploys of [PH-37](../roadmap.md#ph-37-two-tasks) and [PH-38](../roadmap.md#ph-38-autoscaling).

What happens in a redeploy, and why it takes the time it does:

1. Terraform registers the new task definition and updates the service. ECS starts the new task beside the old one (the service allows up to 200% of its wanted count and demands 100% healthy).
2. The new task runs its migrations, then listens. The load balancer asks `/api/live` every 10 seconds and sends it requests after 2 answers, so about 20 seconds after it listens. ECS ignores failed checks for the first 60 seconds of a task, so a slow image pull or a long migration does not get it killed, and counts the new task healthy only once those 60 seconds have passed: until then both versions serve.
3. ECS deregisters the old task. The load balancer stops sending it new requests at once and gives it up to 30 seconds (the deregistration delay) to finish those it holds; then ECS sends `SIGTERM`, and the app closes within 15 seconds ([ADR 0033](../decisions/0033-app-ready-for-the-cloud-details.md), decision 6). AWS documents that a deregistering target with no in-flight requests and no active connections is deregistered at once, without waiting for the delay. This is why PH-12c's redeploy did not wait the default 300 seconds, and why the runbook's earlier explanation of that wait was wrong.

Measured on PH-12d's last demo, with a request every second from two machines: the new task registered 21 seconds after it started and was healthy 10 to 15 seconds later; ECS deregistered the old task 62 seconds after the new one registered, the grace period; the old target drained for about 25 seconds, the requests it held keeping it from ending at once; the deployment completed a minute later, once the old task had stopped. Both versions answered for about 50 seconds. With the grace period at 120 seconds they answered for two minutes. Every request was answered `200`.

**A page load can mix two versions of the SPA during the overlap** ([OP-103](https://github.com/luiki-dev/szop/issues/249), decided in [PH-37](../roadmap.md#ph-37-two-tasks)). While both tasks are healthy, the load balancer routes each request on its own, so a browser can get `index.html` from the new task and ask the old one for an asset only the new build has. The old task answers `404` and the page loads blank until a reload. With one task the window lasts about a minute, the grace period. The watch script does not see it, since it asks the API, not the SPA.

### A failed deployment

When the new task keeps failing, the deployment is marked `FAILED` and the old task keeps serving. ECS's deployment circuit breaker does this after the default threshold of three tasks in a row that fail to start or fail their health checks; with `rollback` off, it only stops launching tasks ([ADR 0036](../decisions/0036-scalability-and-isolation.md), decision 3). On PH-12d's demo, with a commit whose app exits at startup, the deployment was `FAILED` 4 minutes 55 seconds after `Start the app` began, and all 532 requests of the watch script meanwhile were answered `200` by the old task.

What you see:

- **In the run:** `Start the app` fails at once, not after its 15 minutes. Its log prints the deployment's reason (it begins with `ECS deployment circuit breaker`), the service's latest five events, and `The deployment failed: the circuit breaker stopped it; the previous version keeps serving`. The summary shows the step failed and `Wait for the app` skipped.
- **On the demo:** the watch script keeps printing `200` with the old commit. `/api/health` never shows the new one.

What to do: fix forward. A rollback would start the old version on a database its migration check may refuse. Find why the task failed ([A task that does not stay up](#a-task-that-does-not-stay-up)), fix it on the branch and press `demo-up` again; the new run deploys the fix. A code fix needs a new commit; pressing `demo-up` again on the same commit starts a new deployment of it, which helps only after a transient failure (the database unreachable during the migrations, a Fargate or ECR hiccup). The failed run's apply has already recorded the new commit as `deployed_commit`, so a `demo-down` before the fix-forward run destroys with the failed branch's code ([A failed destroy](#a-failed-destroy)). If the failed task had already run a migration, the database holds it: the fix must keep working with it ([Migrations and rolling deploys](../development/tools/drizzle.md#migrations-and-rolling-deploys)).

### When a run fails

Open the run and read the failed step. `deploy` needs `enable-teardown` and `build`: if either fails, `deploy` is skipped, so no demo is created while the nightly destroy may be off or the image is missing.

| Failed step | What it means | What to do |
|---|---|---|
| `enable-teardown` (`gh workflow enable`) | GitHub refused or was unreachable. `deploy` is skipped, so nothing was created | *Re-run failed jobs*: `deploy` then runs after `enable-teardown` and waits for your approval as usual. If it keeps failing, enable `demo-down` by hand (*Actions → demo-down → ⋯ → Enable workflow*) and press `demo-up` again |
| `build`: the Docker build fails | The Dockerfile's `pnpm install` or build failed on that commit | Read the step's log as you would a failed `docker` job of CI ([Reading a failed run](../development/ci-cd.md#reading-a-failed-run), item 10); fix it on the branch and press `demo-up` again. Nothing in AWS was touched |
| `deploy` stays on "Waiting" | It needs your approval | *Review deployments* ([Pressing the button](#pressing-the-button)). A run nobody approves expires after 30 days, but its image artifact after one |
| `actions/checkout` fails, often with `couldn't find remote ref` | `ref` is a short hash or a name that does not exist | Run again with a branch, a tag or the full 40-digit hash |
| `Resolve the commit`: "is not the one the image was built from" | The branch moved between `build` and the approval, so the image and the infrastructure would come from different commits | Press `demo-up` again |
| `Configure AWS credentials`, or `Not authorized to perform sts:AssumeRoleWithWebIdentity` | The trust policy or the variable `AWS_DEPLOY_ROLE_ARN` does not match: base was not applied with the `GitHubDemo` statement, or the environment is not called `demo` | [CI's roles and variables](#cis-roles-and-variables) |
| `Download the image`: "Artifact not found" | The artifact is older than a day (the approval took too long), or `build` was re-run and replaced it | Press `demo-up` again |
| `Push the image`: `AccessDenied`, or "Cannot tell whether szop:… is in the registry" | The deploy role lacks an ECR action (its policy `szop-ci-deploy-image`), or the registry could not be reached | Read the message; add the action in `infra/base/ci_roles.tf` in a PR, apply base, press the button again. A push that stopped halfway leaves no tag, so the next run pushes again |
| `Terraform init` or `Terraform apply`: `Error acquiring the state lock` after 15 minutes | Another run holds the lock, a `demo-down` or an earlier `demo-up` | Wait for it, then *Re-run failed jobs*. A stale lock: `terraform force-unlock <lock-id>` from your machine, as in [The nightly run](#the-nightly-run) |
| `Terraform apply`: `deployed_commit is required to create or change the demo` | The precondition: an apply without the commit. The workflow always passes it, so this appears only for a changed workflow or a local apply without `-var` | Pass `-var "deployed_commit=$(git rev-parse HEAD)"`; see [Spinning up from your machine](#spinning-up-from-your-machine) |
| `Terraform apply`: `AccessDenied` or `UnauthorizedOperation`, `… is not authorized to perform: <service>:<Action>` | The deploy role lacks that action, or the resource does not carry the tags `project` = `szop` and `group` = `demo` its conditions check. The message names the action | Add the action to the matching managed policy (`szop-ci-deploy-demo-network`, `-load-balancer`, `-dns`, `-database` or `-service`) in `infra/base/ci_roles.tf`, in a PR; apply base, then press the button again. Terraform applies what is missing and leaves the rest |
| `Terraform apply`: "Service-linked role … has not been created", or "Unable to assume the service linked role" | The account has no role for ECS or RDS yet | [Service-linked roles](#service-linked-roles), then *Re-run failed jobs* |
| `Terraform apply`: any other AWS error | A resource could not be created: a name already taken, a limit, a dependency, an engine version RDS does not offer | Read the error; fix it; press the button again. If the demo is half built and you give up, press `demo-down` and run [the check that nothing is left](#checking-that-nothing-is-left) |
| `Run db-setup`: "db-setup exited with code …" or "run-task started no task" | The one-off task failed, or ECS refused to start it | [Reading a failed db-setup](#reading-a-failed-db-setup) |
| `Run db-setup`: "did not stop within 10 minutes" | The task never finished: stuck pulling the image or connecting. The step has already asked ECS to stop it (reason `demo-up: db-setup did not stop within 10 minutes`); a warning says if that failed | Read its log stream ([Reading a failed db-setup](#reading-a-failed-db-setup)); then *Re-run failed jobs* |
| `Start the app`: "The deployment failed: the circuit breaker stopped it" | The new tasks failed to start or failed their health checks three times in a row. The old task keeps serving | [A failed deployment](#a-failed-deployment) |
| `Start the app`: "was not stable within 15 minutes", with the service's latest events | The deployment neither completed nor failed in 15 minutes: tasks that start slowly, or ones that do not become healthy yet | [A task that does not stay up](#a-task-that-does-not-stay-up) |
| `Wait for the app`: "still answers with commit …, not …" | The service called the deployment complete, but `/api/health` still answers with the old commit after 10 minutes | Ask the service for its deployments and tasks ([A task that does not stay up](#a-task-that-does-not-stay-up)); then press the button again |
| `Wait for the app`: "did not answer ok within 10 minutes" | The service is stable, but `/api/health` never said `"status":"ok"`: DNS not yet answering, the certificate not yet attached, or the database down | From your machine: `dig +short szop.dzwoniec.com` (the load balancer's addresses) and `curl -sS https://szop.dzwoniec.com/api/health`. `"database":{"status":"down"}` means the app cannot reach RDS: read its log ([Debugging](#debugging)). A resolver that looked the name up before the record existed can keep saying "no such name" for some minutes. Press the button again: the apply changes nothing and the waits start over |

### Spinning up from your machine

When the workflow cannot run (GitHub is down, the role is broken, a permission is missing and you want to see the demo meanwhile), do the workflow's steps from your machine with your own credentials, from the commit you want to deploy:

```bash
export AWS_PROFILE=szop
aws sso login
git status -sb                                    # clean, and pushed: demo-down fetches this commit from GitHub
commit=$(git rev-parse HEAD)

# 1. Build the image and push it, unless the registry has the tag already
docker build --build-arg GIT_COMMIT="$commit" -t "szop:$commit" .
uri=$(aws ecr describe-repositories --repository-names szop --query 'repositories[0].repositoryUri' --output text)
aws ecr get-login-password | docker login --username AWS --password-stdin "${uri%%/*}"
aws ecr describe-images --repository-name szop --image-ids "imageTag=$commit"   # ImageNotFoundException: push it
docker tag "szop:$commit" "$uri:$commit" && docker push "$uri:$commit"

# 2. Apply
cd infra/demo
cp terraform.tfvars.example terraform.tfvars      # the first time only; edit account_id
terraform init
terraform plan  -var "deployed_commit=$commit"    # read it: only the demo's resources
terraform apply -var "deployed_commit=$commit"    # type yes

# 3. Run db-setup, then start the app
cluster=$(terraform output -raw cluster)
task=$(aws ecs run-task --cluster "$cluster" --task-definition "$(terraform output -raw db_setup_task_definition)" \
  --launch-type FARGATE --propagate-tags TASK_DEFINITION \
  --network-configuration "awsvpcConfiguration={subnets=[$(terraform output -raw task_subnets)],securityGroups=[$(terraform output -raw task_security_group)],assignPublicIp=ENABLED}" \
  --query 'tasks[0].taskArn' --output text)
aws ecs wait tasks-stopped --cluster "$cluster" --tasks "$task"
aws ecs describe-tasks --cluster "$cluster" --tasks "$task" --query 'tasks[0].containers[0].exitCode'   # must print 0
aws ecs update-service --cluster "$cluster" --service "$(terraform output -raw service)" --desired-count 1 --force-new-deployment   # at a count of 0, so the circuit breaker watches the first start
```

Then do the check of [Pressing the button](#pressing-the-button), which the workflow's waits would have done for you.

The commit is recorded as the `deployed_commit` output, so `demo-down` then destroys the demo with this commit's code, the same as after a button press. Without `-var`, the precondition stops the apply before it creates anything, so no demo exists that `demo-down` would destroy with the wrong code ([ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 7). Applying from your machine does not re-enable `demo-down`: if the schedule is off, *Actions → demo-down* shows a banner with an *Enable workflow* button.

⚠️ **Don't:**

- apply from a dirty working tree or a commit you have not pushed: the demo would hold code that `demo-down` can neither fetch nor reproduce;
- apply before the image is in the registry: the service has no tasks yet, so nothing fails at once, but the task you start later cannot pull it.

## Debugging

A running demo has two ways in: its **log** in CloudWatch, and a **shell inside the task** through ECS Exec. Both need your sign-in (`aws sso login`) and, for the shell, the Session Manager plugin ([setup guide, section 8](../development/setup.md#8-terraform-tflint-and-the-aws-cli)). The names below are fixed: the cluster and the service are `szop-demo` and `szop-demo-app`, the log group is `/szop/app`, and the container is `app`.

### The app's log

Both the app and `db-setup` write to the log group `/szop/app`, each task into a stream named `<prefix>/<container>/<task id>`: `app/app/…` and `db-setup/db-setup/…`. The app logs one JSON line per event, and every request except `GET /api/health` and `GET /api/live`.

```bash
aws logs tail /szop/app --follow --since 1h                          # everything, live
aws logs tail /szop/app --since 1h --log-stream-name-prefix app/     # the app only
aws logs tail /szop/app --since 5m --filter-pattern '"startup failed"'
```

The log keeps 7 days. Tokens in URLs are redacted and secrets never logged, but read it as if it were public.

### Finding the task

```bash
aws ecs list-tasks --cluster szop-demo --service-name szop-demo-app \
  --query 'taskArns[0]' --output text
#   arn:aws:ecs:eu-central-1:<account>:task/szop-demo/<task id>: the id is the last part
```

`None` means the service has no running task: it has not been started yet, or it is failing ([A task that does not stay up](#a-task-that-does-not-stay-up)).

### A shell in the task

```bash
aws ecs execute-command --cluster szop-demo --task <task id> --container app \
  --interactive --command "/bin/sh"
```

`Starting session with SessionId: ecs-execute-command-…` and a prompt mean it works; `exit` ends the session. The shell runs inside the container, so it has the app's environment variables, `DATABASE_PASSWORD` among them, as the first real demo showed. The image has no `psql` and no `curl`. An ECS Exec session needs a writable root filesystem, which is why the task's is writable ([ADR 0038](../decisions/0038-app-on-ecs-and-rds-details.md)).

`TargetNotConnectedException` means the task's ECS Exec agent is not connected yet (wait a minute after the task starts) or the task role lacks the four `ssmmessages:` actions. A task started before the service allowed ECS Exec cannot be entered: use a task the current service started.

### Querying the database

Inside the shell, Node connects with the app's own settings, TLS included, and prints a query's rows:

```bash
cd /app/apps/api
node --input-type=module -e '
import pg from "pg";
import { readFileSync } from "node:fs";
const e = process.env;
const pool = new pg.Pool({
  host: e.DATABASE_HOST, port: Number(e.DATABASE_PORT), database: e.DATABASE_NAME,
  user: e.DATABASE_USER, password: e.DATABASE_PASSWORD,
  ssl: { ca: readFileSync("certs/rds-global-bundle.pem", "utf8"), rejectUnauthorized: true },
});
console.table((await pool.query(process.argv[1])).rows);
await pool.end();
' "SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()"
```

The query in the last line is the one to change. This one asks PostgreSQL whether *this* connection is encrypted; it must print `ssl` as `true` ([OP-017](https://github.com/luiki-dev/szop/issues/68)). Others worth running: `SELECT current_user, current_database()` (`szop_app`, `szop`), `SELECT rolname, rolsuper, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = 'szop_app'` (all three `false`), `SELECT * FROM drizzle.__drizzle_migrations` (the applied migrations). Nothing in the demo holds data worth keeping, so a write is safe, but it is gone at the next `demo-down`.

Why Node and not `psql`: adding the PostgreSQL client to the image would grow it for a tool used by hand now and then ([ADR 0038](../decisions/0038-app-on-ecs-and-rds-details.md), refining [ADR 0008](../decisions/0008-hosting.md), decision 20). The command runs the same way anywhere the app's settings are set; on the first real demo, run inside the task, it printed `true`.

### Checking the client address

The load balancer is the one hop the app trusts, so the log must show the address a request really came from, whatever `X-Forwarded-For` claims ([ADR 0012](../decisions/0012-security-baseline.md), decision 13; [OP-053](https://github.com/luiki-dev/szop/issues/26)):

```bash
curl -s https://checkip.amazonaws.com                                       # your address
curl -s -o /dev/null https://szop.dzwoniec.com/
curl -s -o /dev/null -H 'X-Forwarded-For: 203.0.113.7' https://szop.dzwoniec.com/
aws logs tail /szop/app --since 5m --filter-pattern '"incoming request"'
#   both lines show "remoteAddress":"<your address>"; 203.0.113.7 appears in neither
```

### Reading a failed db-setup

`Run db-setup` names the task and the stream (`db-setup/db-setup/<task id>`) and the exit code. Read what the task printed:

```bash
aws logs tail /szop/app --since 1h --log-stream-name-prefix db-setup/
```

What the stream and the exit code say:

- **`{"msg":"db-setup done","role":"szop_app","created":true}`** and exit code 0: it worked. `created` is `false` on a redeploy: the role existed, and only its password was set again.
- **`{"msg":"db-setup failed","error":"…"}`** and exit code 1: a statement failed; the error is PostgreSQL's message. `password authentication failed for user "szop_admin"` is the master password (the secret RDS keeps); `permission denied` or `must be able to SET ROLE` means the master user lacks a right the statements need; `ECONNREFUSED`, a timeout or `no pg_hba.conf entry` means the task cannot reach the database (a security group, or the database not yet available). The message never holds a password: `db-setup` sends `szop_app`'s password as a hash made in the task, so even PostgreSQL's own log has none.
- **`{"msg":"db-setup failed","error":"canceling statement due to lock timeout"}`** (or `… statement timeout`): `db-setup` gives its statements 30 seconds and its lock waits 10, so a lock it cannot get, for instance from a migration that hangs, fails it with a clear error instead of hanging. Find what holds the lock ([Querying the database](#querying-the-database)), then press `demo-up` again.
- **`Invalid configuration:` and lines naming variables** and exit code 1: a setting is missing or invalid, never shown with its value. `APP_DATABASE_PASSWORD: must be printable ASCII characters (no SASLprep normalization)` means the password in `/szop/db-app-password` has other characters. Simple Authentication and Security Layer preparation (SASLprep) is the normalization PostgreSQL applies to a password before hashing it; `db-setup` does not, so it refuses such a password. Terraform generates letters and digits only, so this means the parameter was set by hand.
- **No stream, or exit code `none`:** ECS could not start the container, so no log exists. Ask the task itself:

  ```bash
  aws ecs describe-tasks --cluster szop-demo --tasks <task id> \
    --query 'tasks[0].[stopCode,stoppedReason,containers[0].reason]' --output text
  ```

  `CannotPullContainerError` means the image tag is not in the registry. `ResourceInitializationError: unable to pull secrets` names a secret the execution role cannot read: the parameter or the master secret does not exist (check `aws ssm describe-parameters`; the master secret is created with the instance) or the role's policy no longer allows it. A task ECS stopped shows for about an hour.

Run `db-setup` again by pressing `demo-up` again: it is safe to repeat.

### A task that does not stay up

When `Start the app` fails or times out, ask the service why, then read the task's log:

```bash
aws ecs describe-services --cluster szop-demo --services szop-demo-app \
  --query 'services[0].events[:8].message' --output text
aws ecs list-tasks --cluster szop-demo --service-name szop-demo-app --desired-status STOPPED
aws ecs describe-tasks --cluster szop-demo --tasks <task id> \
  --query 'tasks[0].[stopCode,stoppedReason,containers[0].exitCode]' --output text
aws logs tail /szop/app --since 30m --log-stream-name-prefix app/
```

The events say `(service szop-demo-app) has started 1 tasks`, `… has reached a steady state`, or `… (instance …) is unhealthy in (target-group …) due to (reason Health checks failed)`. A task that always fails is retried until the circuit breaker marks the deployment `FAILED` ([A failed deployment](#a-failed-deployment)). Common causes:

- **The app stops at startup**, with `startup failed` in its log and exit code 1: the migration check below, an unreachable database (the log names the error), or an invalid setting (named, never its value).
- **The task runs but the health checks fail:** the target group asks `/api/live` every 10 seconds, which answers `200` whenever the process runs and touches no database, so a database outage does not replace tasks. A task that listens but never answers is unhealthy after 3 failed checks. The service ignores failed checks for the first 60 seconds of a task, for the image pull and the migrations. `/api/health`, which answers 503 while the database is unreachable, is what `Wait for the app` and the watch script ask, so a database outage shows there, not here. A task that fails `/api/live` listens but does not answer, or is still starting after the grace period: read the app's log and the service events (the commands above).
- **The task never starts**, with `CannotPullContainerError` or `ResourceInitializationError`: as for `db-setup` above.

### The migration check

A new task runs the migrations when it starts, after checking that the database holds no migration this branch's code lacks. If the demo was last deployed from another branch, the check fails, the task exits with code 1, the circuit breaker fails the deployment and `Start the app` fails. The task's log says:

```text
The database's migrations do not match this code's:
  unknown: applied at 1891307052475, not in this code
Reset the database: `pnpm db:reset` locally; on the demo, `demo-down` then `demo-up`.
```

The remedy for a demo is to start from an empty database: press `demo-down` (from `main`; it destroys with the code of the commit the demo was last deployed from, which after a failed redeploy is already the new branch's, since the apply recorded it), wait for it, then press `demo-up` on the branch you want. The old task keeps serving while the new one fails, so the demo stays up meanwhile. The cases are described in the [Drizzle page](../development/tools/drizzle.md#the-migration-check) ([OP-043](https://github.com/luiki-dev/szop/issues/84)).

### A failed destroy

A `demo-down` that fails halfway leaves some resources and drops the `deployed_commit` output from the state, so a re-run (or the nightly run) destroys with `main`'s code. `main`'s code still removes everything the state lists, since a destroy is driven by the state, but a resource a branch added is destroyed by the code that created it, so use the commit. Before re-running, note the commit from the failed run's summary (*Code used*), then destroy by hand with it ([From your machine](#from-your-machine)): `git switch --detach <commit>` ([OP-099](https://github.com/luiki-dev/szop/issues/228)). Then [check that nothing is left](#checking-that-nothing-is-left). Failures to expect now that the demo has a task and a database:

- **A security group or subnet "has a dependent object" or "is in use":** a task's network interface is still being released after the service stopped. Wait a few minutes and re-run.
- **The database takes long to delete:** RDS needed under 2 minutes on the first demo (1 min 52 s; creating it took 5 minutes), and the job's limit is 60. Re-run once if it timed out.

## Checking that no password is in a state

Terraform's state must hold neither `szop_app`'s password nor the master password ([OP-016](https://github.com/luiki-dev/szop/issues/75); [ADR 0008](../decisions/0008-hosting.md), decision 22). Once after the first demo, and after every rotation, run this from the repository's root: it reads both passwords with your own credentials and searches both states for them. The demo must be up for the master password to exist:

```bash
export AWS_PROFILE=szop
app_pw=$(aws ssm get-parameter --name /szop/db-app-password --with-decryption \
  --query Parameter.Value --output text)
master_pw=$(aws secretsmanager get-secret-value \
  --secret-id "$(aws rds describe-db-instances --db-instance-identifier szop-demo \
    --query 'DBInstances[0].MasterUserSecret.SecretArn' --output text)" \
  --query SecretString --output text | jq -r .password)
for module in base demo; do
  for pw in "$app_pw" "$master_pw"; do
    terraform -chdir=infra/$module state pull | grep -c -F -- "$pw"
  done
done
unset app_pw master_pw
```

It must print `0` four times. Both modules must be initialised (`terraform init`) on your machine. A `1` or more means a password reached the state: stop, find the resource that holds it, and rotate the password.

## What a demo costs

The figures are estimates from AWS's list prices for Frankfurt; the first real run's Cost Explorer figures replace them (to be measured). The bill is per hour from the moment a resource exists to the moment it is deleted.

| Resource | Per hour | Per day |
|---|---|---|
| Application load balancer (the hourly charge and a little capacity) | about $0.03 | $0.72 |
| Public IPv4 addresses: two for the load balancer, one for the task | about $0.015 | $0.36 |
| Database `db.t4g.micro` with 20 GB of `gp3` | about $0.022 | $0.53 |
| The Fargate task (0.25 vCPU, 0.5 GB) | about $0.012 | $0.29 |
| **Total** | **about $0.08** | **about $1.90** |

The load balancer's and the database's charges dominate. A three-hour session costs about $0.25. A demo someone forgets is destroyed at 01:17 UTC, so it costs at most a day, about $1.90. If the nightly run fails and nobody notices, about $13 a week or $57 a month: the budget alerts of [Applying bootstrap](#applying-bootstrap) fire well before, and the nightly run's failure email comes first. Log lines, the DNS queries and the data transfer of a demo add cents. A second task and Redis will add about $0.9 a day ([ADR 0036](../decisions/0036-scalability-and-isolation.md), costs).

What stays between sessions costs little: the hosted zone ($0.50 a month), the domain ($15 a year), the registry's images (cents), the log group and the parameters (free at this size). The budget alerts count spending, not credits, so a day of demos can raise one even when credits cover the bill.

## Tearing down

`infra/demo` is destroyed by the **`demo-down`** workflow, by hand and every night ([ADR 0010](../decisions/0010-ci-cd.md), decision 13). It is the safety net against a demo left running: a forgotten demo costs about $1.90 a day with the task and the database ([What a demo costs](#what-a-demo-costs)), about $2.80 once PH-37 and PH-39 add a second task and Redis ([ADR 0036](../decisions/0036-scalability-and-isolation.md), costs). A real destroy removes everything [Spinning up](#spinning-up) created, in dependency order: the DNS records, the service and its tasks, the listeners and the load balancer, the database, the certificate, the security groups, then the gateway, the subnets and the VPC. It reads the state, so it removes exactly what the last apply recorded. On a quiet night there is nothing to destroy, which still proves that the workflow, the role, the state bucket and the lock all work.

### With the button

1. On GitHub: *Actions → demo-down → Run workflow*, branch **`main`**, *Run workflow*. (The environment `demo-teardown` allows only `main`; on another branch the job is refused.)
2. Open the run and wait for the job `destroy` to turn green: a few seconds when there is nothing to destroy, about 5 minutes with the app and the database (9½ minutes on PH-12c's first demo: 7 for the service, and under 2 for the database; PH-12c explained the 7 minutes with the load balancer's default draining of 300 seconds, but AWS deregisters a target with no in-flight requests at once, so the cause is not known. PH-12d set the delay to 30 seconds, and its destroy took 4¾ minutes: 2¾ for the service and under 2 for the database). The first real destroy, of the placeholder demo before PH-12c, took about a minute and a half, most of it the two DNS records (half a minute each) and the load balancer (20 seconds).
3. Read the run's **summary** (the run's page, *Summary*):
   - **Trigger:** `workflow_dispatch` (by hand) or `schedule` (the nightly run).
   - **Code used:** which Terraform code destroyed the demo and why. If a demo recorded its commit (the `deployed_commit` output of `infra/demo`, written by every `demo-up` run), it is that commit, so a resource added by a branch is destroyed by the code that created it; with no commit recorded, it is `main`'s code ([ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 7; [ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decision 6).
   - **Result:** Terraform's own `Destroy complete! Resources: N destroyed.` (`0 destroyed` on a quiet night).

**Check:** the run is green, and *Result* says `Destroy complete!` with every resource `demo-up` created counted (33). Then [check that nothing is left](#checking-that-nothing-is-left).

If two runs overlap, the second waits: `demo-down` runs one at a time and never cancels a running destroy, and every Terraform command waits up to 15 minutes for the state lock.

### Checking that nothing is left

A destroy that reports success is the proof, and this is the second look, which also finds what a half-failed apply left behind. Two checks, because AWS has two kinds of resource here:

1. **Everything that carries tags.** *Resource Groups & Tag Editor → Tag Editor*: **Regions: eu-central-1** (the Tag Editor searches only the regions you select, and every taggable resource of the demo lives in Frankfurt), *Resource types: All supported resource types*, tag key `group`, value `demo`, *Search resources*. It must list nothing but inactive task definition revisions. The same from a terminal:

   ```bash
   aws resourcegroupstaggingapi get-resources --region eu-central-1 --tag-filters Key=group,Values=demo \
     --query 'ResourceTagMappingList[].ResourceARN'
   #   []   (or only the inactive task definition revisions, below)
   ```

   Right after a destroy, the list can still name resources that are already gone: the index behind the Tag Editor lags behind deletions, by minutes or longer. On the first real destroy it still listed the two security group rules (`security-group-rule/sgr-…`) after EC2 reported them deleted; after PH-12c's first destroy it still listed the subnets, the rules, the service and its stopped tasks, and the cluster, which ECS keeps as `INACTIVE` for a while (`aws ecs describe-clusters --clusters szop-demo --query 'clusters[].status'`). Check such a leftover in its own service before acting on it, for example `aws ec2 describe-security-group-rules --region eu-central-1 --security-group-rule-ids <id>`, which answers `InvalidSecurityGroupRuleId.NotFound` for a rule that is gone.

   **Inactive task definition revisions may remain, and are expected.** Terraform deregisters each revision of `szop-demo-app` and `szop-demo-db-setup` when it destroys them, which leaves it `INACTIVE`: it costs nothing, cannot start a task and keeps its tags, so the Tag Editor still lists it as `task-definition/szop-demo-app:<n>`. Check one: `aws ecs describe-task-definition --task-definition szop-demo-app:1 --query taskDefinition.status --output text` prints `INACTIVE`. Anything else in the list is a leftover. The database's master secret is not in the list: RDS deletes it with the instance, and `aws secretsmanager list-secrets --query "SecretList[?starts_with(Name, 'rds!db-')].Name"` prints `[]`.

   Global services (Route 53, IAM, Budgets) show up in the Tag Editor only under *Regions: us-east-1*, and **IAM roles never show up there at all**: the API behind it does not return them. The demo creates no role, and the roles the app uses are base's.

2. **The zone's records.** DNS records carry no tags, so the Tag Editor never lists them. The zone must hold no `szop` record and no certificate-validation record `_<token>.szop`:

   ```bash
   zone=$(aws route53 list-hosted-zones-by-name --dns-name dzwoniec.com --query 'HostedZones[0].Id' --output text)
   aws route53 list-resource-record-sets --hosted-zone-id "$zone" \
     --query "ResourceRecordSets[?starts_with(Name, 'szop.') || contains(Name, '.szop.')].[Name,Type]" --output text
   #   prints nothing
   ```

   The apex records (CAA, MX, SPF), DKIM and DMARC stay: they belong to base.

If something is left, find which resource it is and delete it in the console, newest dependency first (the load balancer before the subnets, the subnets before the VPC), then run the check again. The tagging search can lag a few minutes behind a deletion, so look at the service's own console before assuming a resource is still there. A leftover validation record is harmless: the next `demo-up` takes it over ([ADR 0034](../decisions/0034-network-and-demo-up-details.md)).

### The nightly run

`demo-down` also runs **every night at 01:17 UTC** (about 02:17 to 03:17 in Poland). GitHub emails a failed scheduled run to the person who last changed the `schedule` line of the workflow: you. A failure means **the safety net did not run to the end**: a demo may still be up, so do not ignore the email. Open the run from the email and read the failed step:

- **Configure AWS credentials fails**, or `Not authorized to perform sts:AssumeRoleWithWebIdentity`: the trust policy or the repository variable `AWS_DEPLOY_ROLE_ARN` no longer matches ([CI's roles and variables](#cis-roles-and-variables)).
- **`terraform init` or `destroy` says `Error acquiring the state lock`** after 15 minutes: another run holds it, usually a `demo-up` still working. Wait for it, then re-run (*Re-run failed jobs*). If no run is going and the lock is stale, `terraform force-unlock <lock-id>` from your machine (the ID is in the error) removes it.
- **`Cannot fetch the recorded commit`:** the demo was deployed from a commit GitHub no longer serves, and the job refuses to destroy with other code. Destroy by hand, from your machine ([From your machine](#from-your-machine)). If the commit is missing on your machine too (`git cat-file -e <commit>` fails after `git fetch origin`), destroy with `main`'s code, then [check that nothing is left](#checking-that-nothing-is-left) (the Tag Editor with *Regions* set to eu-central-1 and tag `group` = `demo`); a resource that `main`'s code does not know has to be deleted by hand.
- **A destroy error from AWS** (a resource that is in use, a dependency): the log names the resource. Re-run once; if it fails again, destroy by hand and read the error there. A destroy that fails halfway removes the `deployed_commit` output from the state, so a re-run (or the next nightly run) destroys with `main`'s code and its summary says that no commit is recorded. Before re-running, note the commit from the failed run's summary (*Code used*), and destroy by hand with that commit ([From your machine](#from-your-machine)): `git switch --detach <commit>`.
- **A network error or a GitHub outage:** *Re-run failed jobs*.

After any failure, [check that nothing of the demo is left](#checking-that-nothing-is-left): the Tag Editor with *Regions* set to eu-central-1 and tag `group` = `demo`, and the zone's records. The budget alerts ([Applying bootstrap](#applying-bootstrap)) are the second net.

GitHub disables scheduled workflows of a public repository after 60 days without activity in it. `demo-up` re-enables `demo-down` every time it runs, in its own job `enable-teardown` ([ADR 0010](../decisions/0010-ci-cd.md), decision 13), so a demo cannot outlive a disabled schedule. A demo applied from your machine does not do that: glance at the *Actions → demo-down* page, which shows a banner if the schedule was disabled.

### From your machine

When the workflow cannot run (GitHub is down, the role is broken), destroy from your machine with the code that created the demo:

```bash
export AWS_PROFILE=szop
aws sso login
git status -sb                                    # clean, on a branch you can leave
cd infra/demo
cp terraform.tfvars.example terraform.tfvars      # the first time only; edit account_id
terraform init
terraform output deployed_commit                  # the commit the demo was deployed from
```

With no such output (no demo has recorded one, or an earlier destroy failed halfway and dropped it from the state: then take the commit from that run's summary, *Code used*, and use it below), destroy with `main`'s code: `git switch main` and `git pull`, so that you are on an up-to-date `main`, then `terraform init` again. Otherwise check out that commit, whose Terraform code and `.terraform-version` created the demo, and initialise again:

```bash
git switch --detach <commit>
tenv tf install                                   # the version that commit's .terraform-version asks for
terraform init
terraform plan -destroy                           # read it: only the demo's resources
terraform destroy                                 # type yes
git switch -                                      # back to your branch
```

⚠️ **Don't:** run `terraform destroy` in `infra/base` or `infra/bootstrap` to "clean up": they hold what outlives every demo, and the zone is protected for a reason. Shutting Szop down for good is a different job: [Destroying base](#destroying-base).

## Destroying base

Only when Szop is shut down for good ([OP-093](https://github.com/luiki-dev/szop/issues/208)). `infra/base` holds what outlives every demo, so its destroy is guarded twice (`prevent_destroy` on the zone, `force_delete = false` on the registry), and deleting the zone takes the domain's DNS offline at once.

**Order.** `infra/demo` first ([Tearing down](#tearing-down), with its check that nothing is left): it writes the `szop` and certificate-validation records into base's zone, and a zone that still holds records Terraform does not know cannot be deleted. Base second. [Destroying bootstrap](#destroying-bootstrap) last, because the state bucket holds base's state.

**What goes.** The hosted zone and the records Terraform made in it (CAA, MX, SPF, DMARC and the three DKIM records); the SES identity for `dzwoniec.com`; the image registry `szop` with its lifecycle policy; the Better Auth secret and `szop_app`'s password; the log group `/szop/app` with its logs; the app's roles `szop-app-task-execution` and `szop-app-task`; the GitHub OIDC provider and the roles `szop-ci-plan` and `szop-ci-deploy` with their policies. Not touched: the domain's registration (Terraform never held it), the state bucket and the budget (bootstrap), and the cost allocation tags you activated in the billing console.

**Decide about the domain first.** The registration of `dzwoniec.com` names the four name servers of today's zone. Once the zone is deleted, `dzwoniec.com` and every name under it stop resolving. Two ways on:

- **Let the domain lapse.** Turn auto-renew off (*Route 53 → Domains → Registered domains → `dzwoniec.com`*), and the domain expires at the end of the year you paid for; there is no refund.
- **Keep it.** A new zone, made by hand or by a new base, gets four **different** name servers, so the registration must be changed to them (*Registered domains → `dzwoniec.com` → Name servers → Edit*) or the domain stays broken until it is, and resolvers' caches can take up to two days to catch up.

**Steps**, from `infra/base` with a current sign-in:

1. Check `infra/demo` is gone: [Checking that nothing is left](#checking-that-nothing-is-left). Then disable the nightly teardown (*Actions → demo-down → ⋯ → Disable workflow*, or `gh workflow disable demo-down.yml --repo luiki-dev/szop`): once the roles and variables are gone it fails every night and emails you.
2. **Lift the zone's guard**, as a local edit you never commit: delete the `lifecycle { prevent_destroy = true }` block of `aws_route53_zone.main` in `dns.tf`.
3. **Empty the registry.** Terraform refuses to delete a repository that holds images (`force_delete = false`). Either delete the images:

   ```bash
   ids=$(aws ecr list-images --repository-name szop --max-items 100 --query 'imageIds[*]' --output json)
   aws ecr batch-delete-image --repository-name szop --image-ids "$ids"
   #   at most 100 images per call: run both lines again until list-images prints []
   ```

   or set `force_delete = true` in `registry.tf` (again local) and run `terraform apply` once, which changes that one attribute in the state: a destroy reads the state's value, not the file's, so editing the file alone is not enough.
4. `terraform plan -destroy`, read it: only base's resources, and no change to anything you do not expect gone.
5. `terraform destroy`, type `yes`.

**Check:** the destroy ends with `Destroy complete!`; `dig +short NS dzwoniec.com` stops answering with the old servers once caches expire; `aws ecr describe-repositories --repository-names szop` (`RepositoryNotFoundException`) and `aws sesv2 get-email-identity --email-identity dzwoniec.com` report that the repository and the identity do not exist.

Afterwards: delete the two repository variables (`gh variable delete AWS_PLAN_ROLE_ARN --repo luiki-dev/szop`, and the same for `AWS_DEPLOY_ROLE_ARN`), since the roles they name are gone and every workflow that assumes one fails at its credentials step; and `git restore infra/base` to drop the local edits. Then [Destroying bootstrap](#destroying-bootstrap).

⚠️ **Don't:**

- commit the lifted `prevent_destroy` or `force_delete = true`: the guards exist for the next person who runs `terraform destroy` by mistake;
- delete the zone while the domain is still registered and in use, unless you mean to take it offline;
- skip `terraform plan -destroy`: it is the last place to see that it names base's resources and nothing else.
