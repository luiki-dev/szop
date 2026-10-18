# Demo environment runbook

How to set up, run and take down Szop's environment on AWS, step by step. Szop runs on AWS as an on-demand demo: created for a session and destroyed after it ([ADR 0008](../decisions/0008-hosting.md)). Its infrastructure is Terraform code in three root modules, applied in this order and destroyed in the reverse one:

| Module | Holds | Applied | Chapter |
|---|---|---|---|
| `infra/bootstrap` | The state bucket every module keeps its state in, and the budget alerts | Once, from the owner's machine | [Applying bootstrap](#applying-bootstrap) |
| `infra/base` | Permanent resources: the DNS zone, the email identity, the image registry, the Better Auth secret, the log group, and CI's access to AWS: the GitHub OpenID Connect (OIDC) provider and the roles `szop-ci-plan` and `szop-ci-deploy` | From the owner's machine, when it changes | [Buying the domain](#buying-the-domain), [Applying base](#applying-base) |
| `infra/demo` | One demo session: network, load balancer, certificate and the `szop` DNS record; containers and database follow in [PH-12c](../roadmap.md#ph-12c-app-on-ecs-and-rds) | By CI's `demo-up` button, and destroyed by `demo-down`, by hand and every night | [Spinning up](#spinning-up), [Tearing down](#tearing-down) |

Shutting Szop down for good is the reverse of this table: [Tearing down](#tearing-down) for `infra/demo`, then [Destroying base](#destroying-base), then [Destroying bootstrap](#destroying-bootstrap).

Why each piece exists is in the [stack overview](../architecture/stack-overview.md#12-where-szop-runs); how Terraform works here is on the [Terraform page](../development/tools/terraform.md). The tools come from [setup guide, section 8](../development/setup.md#8-terraform-tflint-and-the-aws-cli).

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
  - [CI's roles and variables](#cis-roles-and-variables)
  - [Cost allocation tags](#cost-allocation-tags)
- [Spinning up](#spinning-up)
  - [Pressing the button](#pressing-the-button)
  - [When a run fails](#when-a-run-fails)
  - [Spinning up from your machine](#spinning-up-from-your-machine)
- [Tearing down](#tearing-down)
  - [With the button](#with-the-button)
  - [Checking that nothing is left](#checking-that-nothing-is-left)
  - [The nightly run](#the-nightly-run)
  - [From your machine](#from-your-machine)
- [Destroying base](#destroying-base)
- [Coming later](#coming-later)

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

`infra/base` holds what outlives every demo: the domain's zone with its Certification Authority Authorization (CAA), Mail Exchanger (MX) and mail records, SES's identity for `dzwoniec.com`, the image registry `szop`, the Better Auth secret and the log group `/szop/app` ([ADR 0030](../decisions/0030-domain-and-base-infrastructure-details.md)), and CI's access to AWS: the GitHub OIDC provider and the two roles `szop-ci-plan` and `szop-ci-deploy` ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md)). It is applied from your machine after [Buying the domain](#buying-the-domain), and again whenever its code changes: first from the PR's branch, then from `main` after the merge.

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
#   the repository, the log group, the parameter and the SES identity

aws resourcegroupstaggingapi get-resources --region us-east-1 --tag-filters Key=group,Values=base \
  --query 'ResourceTagMappingList[].ResourceARN'
#   the zone: Route 53 is global, and its tags are listed in us-east-1
```

**The secret is not in the state.** Once, after the first apply, and after every rotation:

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
aws iam list-role-policies --role-name szop-ci-deploy
#   one inline policy, "state"
```

The `GitHubDemo` statement has no `ref` condition because `demo-up` runs from any branch; what stands between a branch's code and the deploy role is the owner's approval of the `demo` environment, so that environment must exist with its reviewer **before** this statement does ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decisions 10 and 14). If it is missing, a job that names `demo` creates it with no protection and gets credentials unapproved. The three managed policies hold what `infra/demo` needs (the network, the load balancer with its certificate, and the `szop` record and certificate-validation record in the zone), each limited to resources tagged `project` = `szop` and `group` = `demo`, or to those two record names in the zone ([PH-12b spec](../superpowers/specs/2026-10-18-PH-12b-network-and-the-demo-up-button-design.md#the-deploy-role)); the plan comment of the PR that changes them shows IAM Access Analyzer's findings.

Both trust policies also hold `"token.actions.githubusercontent.com:aud": "sts.amazonaws.com"`. These two conditions are what keeps every other repository, branch and workflow from getting the roles' credentials. The `@` numbers are the owner's and the repository's GitHub IDs, which the immutable subject adds ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decision 13); they are public, unlike the account ID.

**Store the two role ARNs** (Amazon Resource Names, the roles' unique IDs) as repository variables, which the workflows read as `vars.AWS_PLAN_ROLE_ARN` and `vars.AWS_DEPLOY_ROLE_ARN`. They are base's outputs. In the browser: *Settings → Secrets and variables → Actions → Variables → New repository variable*. Or with the GitHub CLI, from `infra/base`:

```bash
gh variable set AWS_PLAN_ROLE_ARN --repo luiki-dev/szop --body "$(terraform output -raw ci_plan_role_arn)"
gh variable set AWS_DEPLOY_ROLE_ARN --repo luiki-dev/szop --body "$(terraform output -raw ci_deploy_role_arn)"
```

No access key and no account ID is stored in GitHub: the workflows read the account ID from the credentials they receive. The ARNs contain the account ID. It is not a secret, and the credentials step of both workflows prints the ARN in its public log; still, keep the ARNs and the account ID out of commits, issues and PRs, where nothing needs them.

**Create the `demo-teardown` environment first**, before `demo-down.yml` reaches `main` ([GitHub settings](../development/github-settings.md#environments)): no reviewer, deployment branches limited to `main`. A job that names an environment that does not exist creates it with no protection at all. The plan comment of the PR that adds the roles needs the variables, so these steps come before it.

**Create the `demo` environment before applying base with the `GitHubDemo` statement** (the apply of [PH-12b](../roadmap.md#ph-12b-network-and-the-demo-up-button)): you as the only required reviewer, *Prevent self-review* off (you are the only person who can press the button, so with it on you could never approve your own run), and deployment branches set to *No restriction*. The same environment must exist before `demo-up.yml` runs on any branch. The apply adds the three managed policies and their attachments and updates the deploy role's trust; read the plan, which must change nothing else.

After the merge, apply base again from `main`, as for every base PR ([ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 9); the plan must show no changes.

⚠️ **Don't:**

- add `repo:luiki-dev@290870182/szop@1380292421:environment:demo` to the deploy role's trust by hand, or apply it before the `demo` environment exists with its required reviewer: GitHub creates a missing environment unprotected ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decision 10);
- widen a CI role in the console: the plan comment and IAM Access Analyzer check the roles' policies only when they change in code.

### Cost allocation tags

Once the access portal works (step 5) and a resource that carries the tags exists, which `infra/bootstrap` and `infra/base` provide, make the cost reports group by them. Signed in through the access portal, *Billing and Cost Management → Cost allocation tags*: under *User-defined cost allocation tags*, select `group` and `project`, then *Activate*. These are the two tags every Szop resource carries, so Cost Explorer can group the spending by module ([ADR 0008](../decisions/0008-hosting.md), decision 26). A tag shows in the list only after a resource carrying it exists, which can take up to 24 hours, and its cost data starts from the moment of activation, never earlier: do it before the first demo, not after. This needs step 3's *Activate IAM Access* first ([OP-094](https://github.com/luiki-dev/szop/issues/209)).

**Check:** *Cost allocation tags* opens for your Identity Center user and lists `group` and `project` as *Active*.

## Spinning up

`infra/demo` is created by the **`demo-up`** workflow, by hand ([ADR 0010](../decisions/0010-ci-cd.md), decision 11; [ADR 0034](../decisions/0034-network-and-demo-up-details.md)). Until [PH-12c](../roadmap.md#ph-12c-app-on-ecs-and-rds) puts the app behind it, a demo is 19 resources: the network (a VPC, two public and two private subnets, an internet gateway and the public route table with its two associations), the load balancer with its security group and its two listeners, the HTTPS certificate with its DNS validation record, and the `szop` DNS record. `https://szop.dzwoniec.com` then answers with a fixed placeholder page that says the demo is up and names the commit it was deployed from.

Before the first press, base must be applied with PH-12b's trust and policies, and the `demo` environment must exist with you as its reviewer ([CI's roles and variables](#cis-roles-and-variables)).

### Pressing the button

1. On GitHub: *Actions → demo-up → Run workflow*. Choose the branch in *Use workflow from*: the one you want checked, usually the PR's branch. Leave `ref` empty to deploy that branch's latest commit, or type a branch, a tag or a **full 40-digit commit hash** to deploy that instead. A short hash is refused: checkout would look it up as a branch name. Then *Run workflow*.
2. Open the run. The job `enable-teardown` starts at once and turns green in seconds: it switches the nightly `demo-down` back on if GitHub had disabled it. The job `deploy` waits for you: *Review deployments* → tick `demo` → *Approve and deploy*. Approve only code you have read; the job gets the deploy role's credentials ([threat model](../architecture/threat-model.md#who-can-act-and-through-which-path)). *Reject* ends the run without touching AWS.
3. Wait for `deploy` to turn green. It checks the commit out, applies `infra/demo` with that commit passed as `deployed_commit`, then asks `https://szop.dzwoniec.com` every 10 seconds, for up to 10 minutes, until the page shows the commit. The certificate is issued first, which takes a few minutes ([ADR 0030](../decisions/0030-domain-and-base-infrastructure-details.md), decision 5), and the page can need a few more after that: a new DNS name and a fresh load balancer do not answer at once. The first run, on 2026-10-18, took about 4 minutes from the approval: about 3 minutes for the apply, of which the load balancer took 2¼, the certificate's validation half a minute and each DNS record another half minute; the page answered at the first try.
4. Read the run's **summary**: the URL, the commit, the result of the apply, whether the page showed the commit, and that `demo-down` destroys the demo at the next 01:17 UTC unless pressed sooner.

**Check:** open both addresses in a browser.

- `https://szop.dzwoniec.com` shows "The Szop demo is up" and the commit hash of the summary, with a valid certificate (the padlock; issued by Amazon).
- `http://szop.dzwoniec.com` redirects to the HTTPS address (a 301). From a terminal: `curl -sI http://szop.dzwoniec.com`, whose first line is `HTTP/1.1 301` and whose `location` header names the HTTPS address.

The demo now exists until `demo-down` removes it ([Tearing down](#tearing-down)). Pressing `demo-up` again while it is up applies the new commit on top and records it; two presses never run at the same time (the second waits for the first).

⚠️ **Don't:** leave a demo up by accident. An approved run stays up until `demo-down` runs, at the latest at 01:17 UTC; press `demo-down` when you are done.

### When a run fails

Open the run and read the failed step. `enable-teardown` and `deploy` do not depend on each other: a failure in one leaves the other running.

| Failed step | What it means | What to do |
|---|---|---|
| `enable-teardown` (`gh workflow enable`) | GitHub refused or was unreachable. The deploy runs regardless, so the safety net may be off | *Re-run failed jobs*. If it keeps failing, enable `demo-down` by hand: *Actions → demo-down → ⋯ → Enable workflow* |
| `deploy` stays on "Waiting" | It needs your approval | *Review deployments* ([Pressing the button](#pressing-the-button)). A run nobody approves expires after 30 days |
| Checkout fails, often with `couldn't find remote ref` | `ref` is a short hash or a name that does not exist | Run again with a branch, a tag or the full 40-digit hash |
| Configure AWS credentials, or `Not authorized to perform sts:AssumeRoleWithWebIdentity` | The trust policy or the variable `AWS_DEPLOY_ROLE_ARN` does not match: base was not applied with the `GitHubDemo` statement, or the environment is not called `demo` | [CI's roles and variables](#cis-roles-and-variables) |
| `terraform init` or `apply`: `Error acquiring the state lock` after 15 minutes | Another run holds the lock, a `demo-down` or an earlier `demo-up` | Wait for it, then *Re-run failed jobs*. A stale lock: `terraform force-unlock <lock-id>` from your machine, as in [The nightly run](#the-nightly-run) |
| `apply`: `deployed_commit is required to create or change the demo` | The precondition: an apply without the commit. The workflow always passes it, so this appears only for a changed workflow or a local apply without `-var` | Pass `-var "deployed_commit=$(git rev-parse HEAD)"`; see [Spinning up from your machine](#spinning-up-from-your-machine) |
| `apply`: `AccessDenied` or `UnauthorizedOperation`, `… is not authorized to perform: <service>:<Action>` | The deploy role lacks that action, or the resource does not carry the tags `project` = `szop` and `group` = `demo` its conditions check. The message names the action | Add the action to the matching managed policy (`szop-ci-deploy-demo-network`, `-load-balancer` or `-dns`) in `infra/base/ci_roles.tf`, in a PR; apply base, then press the button again. Terraform applies what is missing and leaves the rest |
| `apply`: any other AWS error | A resource could not be created: a name already taken, a limit, a dependency | Read the error; fix it; press the button again. If the demo is half built and you give up, press `demo-down` and run [the check that nothing is left](#checking-that-nothing-is-left) |
| `Wait for the page`: "did not show commit … within 10 minutes" | The apply succeeded, but the page never showed the commit: DNS not yet answering, the certificate not yet attached, or a different commit answering | From your machine: `dig +short szop.dzwoniec.com` (the load balancer's addresses) and `curl -sS https://szop.dzwoniec.com`. A resolver that looked the name up before the record existed can keep saying "no such name" for some minutes. Press the button again: the apply changes nothing and the wait starts over |

### Spinning up from your machine

When the workflow cannot run (GitHub is down, the role is broken, a permission is missing and you want to see the demo meanwhile), apply from your machine with your own credentials, from the commit you want to deploy:

```bash
export AWS_PROFILE=szop
aws sso login
git status -sb                                    # clean, and pushed: demo-down fetches this commit from GitHub
cd infra/demo
cp terraform.tfvars.example terraform.tfvars      # the first time only; edit account_id
terraform init
terraform plan  -var "deployed_commit=$(git rev-parse HEAD)"    # read it: only the demo's resources
terraform apply -var "deployed_commit=$(git rev-parse HEAD)"    # type yes
```

Then do the check of [Pressing the button](#pressing-the-button), which the workflow's wait would have done for you.

The commit is recorded as the `deployed_commit` output, so `demo-down` then destroys the demo with this commit's code, the same as after a button press. Without `-var`, the precondition stops the apply before it creates anything, so no demo exists that `demo-down` would destroy with the wrong code ([ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 7). Applying from your machine does not re-enable `demo-down`: if the schedule is off, *Actions → demo-down* shows a banner with an *Enable workflow* button.

⚠️ **Don't:** apply from a dirty working tree or a commit you have not pushed: the demo would hold code that `demo-down` can neither fetch nor reproduce.

## Tearing down

`infra/demo` is destroyed by the **`demo-down`** workflow, by hand and every night ([ADR 0010](../decisions/0010-ci-cd.md), decision 13). It is the safety net against a demo left running: a forgotten demo costs about $1.70 a day. A real destroy removes everything [Spinning up](#spinning-up) created, in dependency order: the DNS records, the listeners and the load balancer, the certificate, the security group, then the gateway, the subnets and the VPC. It reads the state, so it removes exactly what the last apply recorded. On a quiet night there is nothing to destroy, which still proves that the workflow, the role, the state bucket and the lock all work.

### With the button

1. On GitHub: *Actions → demo-down → Run workflow*, branch **`main`**, *Run workflow*. (The environment `demo-teardown` allows only `main`; on another branch the job is refused.)
2. Open the run and wait for the job `destroy` to turn green: a few seconds when there is nothing to destroy, about ten minutes with an RDS database to delete. The first real destroy, of the placeholder demo, took about a minute and a half, most of it the two DNS records (half a minute each) and the load balancer (20 seconds).
3. Read the run's **summary** (the run's page, *Summary*):
   - **Trigger:** `workflow_dispatch` (by hand) or `schedule` (the nightly run).
   - **Code used:** which Terraform code destroyed the demo and why. If a demo recorded its commit (the `deployed_commit` output of `infra/demo`, written by every `demo-up` run), it is that commit, so a resource added by a branch is destroyed by the code that created it; with no commit recorded, it is `main`'s code ([ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 7; [ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decision 6).
   - **Result:** Terraform's own `Destroy complete! Resources: N destroyed.` (`0 destroyed` on a quiet night).

**Check:** the run is green, and *Result* says `Destroy complete!` with every resource `demo-up` created counted (19 until PH-12c). Then [check that nothing is left](#checking-that-nothing-is-left).

If two runs overlap, the second waits: `demo-down` runs one at a time and never cancels a running destroy, and every Terraform command waits up to 15 minutes for the state lock.

### Checking that nothing is left

A destroy that reports success is the proof, and this is the second look, which also finds what a half-failed apply left behind. Two checks, because AWS has two kinds of resource here:

1. **Everything that carries tags.** *Resource Groups & Tag Editor → Tag Editor*: **Regions: eu-central-1** (the Tag Editor searches only the regions you select, and every taggable resource of the demo lives in Frankfurt), *Resource types: All supported resource types*, tag key `group`, value `demo`, *Search resources*. It must list nothing. The same from a terminal:

   ```bash
   aws resourcegroupstaggingapi get-resources --region eu-central-1 --tag-filters Key=group,Values=demo \
     --query 'ResourceTagMappingList[].ResourceARN'
   #   []
   ```

   Right after a destroy, the list can still name resources that are already gone: the index behind the Tag Editor lags behind deletions, by minutes or longer. On the first real destroy it still listed the two security group rules (`security-group-rule/sgr-…`) after EC2 reported them deleted. Check such a leftover in its own service before acting on it, for example `aws ec2 describe-security-group-rules --region eu-central-1 --security-group-rule-ids <id>`, which answers `InvalidSecurityGroupRuleId.NotFound` for a rule that is gone.

   Global services (Route 53, IAM, Budgets) show up in the Tag Editor only under *Regions: us-east-1*, and **IAM roles never show up there at all**: the API behind it does not return them. The demo creates no role until PH-12c, and the roles the app uses are base's.

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
- **A destroy error from AWS** (a resource that is in use, a dependency): the log names the resource. Re-run once; if it fails again, destroy by hand and read the error there.
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

With no such output (no demo has recorded one), destroy with `main`'s code: `git switch main` and `git pull`, so that you are on an up-to-date `main`, then `terraform init` again. Otherwise check out that commit, whose Terraform code and `.terraform-version` created the demo, and initialise again:

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

**What goes.** The hosted zone and the records Terraform made in it (CAA, MX, SPF, DMARC and the three DKIM records); the SES identity for `dzwoniec.com`; the image registry `szop` with its lifecycle policy; the Better Auth secret; the log group `/szop/app` with its logs; the GitHub OIDC provider and the roles `szop-ci-plan` and `szop-ci-deploy` with their policies. Not touched: the domain's registration (Terraform never held it), the state bucket and the budget (bootstrap), and the cost allocation tags you activated in the billing console.

**Decide about the domain first.** The registration of `dzwoniec.com` names the four name servers of today's zone. Once the zone is deleted, `dzwoniec.com` and every name under it stop resolving. Two ways on:

- **Let the domain lapse.** Turn auto-renew off (*Route 53 → Domains → Registered domains → `dzwoniec.com`*), and the domain expires at the end of the year you paid for; there is no refund.
- **Keep it.** A new zone, made by hand or by a new base, gets four **different** name servers, so the registration must be changed to them (*Registered domains → `dzwoniec.com` → Name servers → Edit*) or the domain stays broken until it is, and resolvers' caches can take up to two days to catch up.

**Steps**, from `infra/base` with a current sign-in:

1. Check `infra/demo` is gone: [Checking that nothing is left](#checking-that-nothing-is-left).
2. **Lift the zone's guard**, as a local edit you never commit: delete the `lifecycle { prevent_destroy = true }` block of `aws_route53_zone.main` in `dns.tf`.
3. **Empty the registry.** Terraform refuses to delete a repository that holds images (`force_delete = false`). Either delete the images:

   ```bash
   ids=$(aws ecr list-images --repository-name szop --query 'imageIds[*]' --output json)
   aws ecr batch-delete-image --repository-name szop --image-ids "$ids"
   #   at most 100 images per call: run both lines again until list-images prints []
   ```

   or set `force_delete = true` in `registry.tf` (again local) and run `terraform apply` once, which changes that one attribute in the state: a destroy reads the state's value, not the file's, so editing the file alone is not enough.
4. `terraform plan -destroy`, read it: only base's resources, and no change to anything you do not expect gone.
5. `terraform destroy`, type `yes`.

**Check:** the destroy ends with `Destroy complete!`; `dig +short NS dzwoniec.com` stops answering with the old servers once caches expire; `aws ecr describe-repositories` and `aws sesv2 get-email-identity --email-identity dzwoniec.com` report that the repository and the identity do not exist.

Afterwards: delete the two repository variables (`gh variable delete AWS_PLAN_ROLE_ARN --repo luiki-dev/szop`, and the same for `AWS_DEPLOY_ROLE_ARN`), since the roles they name are gone and every workflow that assumes one fails at its credentials step; and `git restore infra/base` to drop the local edits. Then [Destroying bootstrap](#destroying-bootstrap).

⚠️ **Don't:**

- commit the lifted `prevent_destroy` or `force_delete = true`: the guards exist for the next person who runs `terraform destroy` by mistake;
- delete the zone while the domain is still registered and in use, unless you mean to take it offline;
- skip `terraform plan -destroy`: it is the last place to see that it names base's resources and nothing else.

## Coming later

- **Debugging** a running demo with ECS Exec and its logs, and **what it costs** ([PH-12c](../roadmap.md#ph-12c-app-on-ecs-and-rds)).
