# Demo environment runbook

How to set up, run and take down Szop's environment on AWS, step by step. Szop runs on AWS as an on-demand demo: created for a session and destroyed after it ([ADR 0008](../decisions/0008-hosting.md)). Its infrastructure is Terraform code in three root modules, applied in this order and destroyed in the reverse one:

| Module | Holds | Applied | Chapter |
|---|---|---|---|
| `infra/bootstrap` | The state bucket every module keeps its state in, and the budget alerts | Once, from the owner's machine | [Applying bootstrap](#applying-bootstrap) |
| `infra/base` | Permanent resources: the DNS zone, the email identity, the image registry, the Better Auth secret, the log group | From the owner's machine, when it changes | [Buying the domain](#buying-the-domain), [Applying base](#applying-base) |
| `infra/demo` | One demo session: network, load balancer, containers, database | By CI's buttons, and destroyed every night | Coming in PH-11 and PH-12 |

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
- [Coming later](#coming-later)

## One-time account setup

Szop uses an AWS account that was used only for learning and runs nothing else ([ADR 0029](../decisions/0029-aws-account-and-terraform-bootstrap-details.md), decisions 1 to 3). These six steps leave it with: no IAM users and no access keys anywhere; a root user with multi-factor authentication (MFA), not used day to day; and one person signing in through IAM Identity Center, with credentials that expire after hours. Do them in order: step 6 removes the old way in only after step 5 proves the new one works.

### 1. Take stock and clean up

Sign in to the console the way you do today.

1. **IAM → Users.** Write down every user, and on each user's *Security credentials* tab, its access keys. **Do not delete them yet:** one of them is probably how your CLI signs in today. Step 6 removes them.
2. **IAM → Roles.** Delete the roles you created while learning. Leave the **service-linked roles** alone: their path starts with `/aws-service-role/` and AWS manages them.
3. **Leftover resources, in every region.** *Resource Groups & Tag Editor → Tag Editor*, Regions: *All regions*, Resource types: *All supported resource types*, *Search resources*. Delete anything you no longer need: instances, volumes, buckets, load balancers, databases. Then *Billing and Cost Management → Bills*: the charges by service for the last few months should be $0 or covered by credits; a service with charges is still running somewhere. The bill is the more complete list, since Tag Editor misses some resource types: a line for WAF (about $5 a month per web ACL), for example, means a web ACL is left, often next to the CloudFront distribution or load balancer it protects. Szop uses neither WAF nor CloudFront ([ADR 0008](../decisions/0008-hosting.md), decisions 11 and 18): detach the web ACL from its resources (its *Associated AWS resources* tab), delete it, then delete the resource if it is a leftover too.
4. **The root user's access keys.** Signed in as root: *account menu (top right) → Security credentials → Access keys*. There must be none; delete any that exist.

**Check:** Tag Editor shows nothing you did not mean to keep; the root user has no access keys.

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

Only when Szop is shut down for good, and only **after `infra/demo` and `infra/base` are destroyed**: their states live in this bucket.

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

`infra/base` holds what outlives every demo: the domain's zone with its CAA, MX and mail records, SES's identity for `dzwoniec.com`, the image registry `szop`, the Better Auth secret and the log group `/szop/app` ([ADR 0030](../decisions/0030-domain-and-base-infrastructure-details.md)). It is applied from your machine after [Buying the domain](#buying-the-domain), and again whenever its code changes: first from the PR's branch, then from `main` after the merge.

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
#   the zone, the repository, the log group, the parameter and the SES identity
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
- remove `prevent_destroy` from the zone, or run `terraform destroy` here, unless Szop is shut down for good, after `infra/demo` is destroyed.

## Coming later

- **Spinning the demo up and down** with the `demo-up` and `demo-down` buttons, and the nightly teardown ([PH-11](../roadmap.md#ph-11-ci-access-to-aws-and-the-teardown-safety-net), [PH-12](../roadmap.md#ph-12-first-deploy)).
- **Debugging** a running demo with ECS Exec and its logs, and **what it costs** ([PH-12](../roadmap.md#ph-12-first-deploy)).
