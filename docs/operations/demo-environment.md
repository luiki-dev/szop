# Demo environment runbook

How to set up, run and take down Szop's environment on AWS, step by step. Szop runs on AWS as an on-demand demo: created for a session and destroyed after it ([ADR 0008](../decisions/0008-hosting.md)). Its infrastructure is Terraform code in three root modules, applied in this order and destroyed in the reverse one:

| Module | Holds | Applied | Chapter |
|---|---|---|---|
| `infra/bootstrap` | The state bucket every module keeps its state in, and the budget alerts | Once, from the owner's machine | [Applying bootstrap](#applying-bootstrap) |
| `infra/base` | Permanent resources: DNS zone, certificate, image registry, secrets, log group | From the owner's machine, when it changes | Coming in PH-10 |
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
- [Coming later](#coming-later)

## One-time account setup

Szop uses an AWS account that was used only for learning and runs nothing else ([ADR 0029](../decisions/0029-aws-account-and-terraform-bootstrap-details.md), decisions 1 to 3). These six steps leave it with: no IAM users and no access keys anywhere; a root user with multi-factor authentication (MFA), not used day to day; and one person signing in through IAM Identity Center, with credentials that expire after hours. Do them in order: step 6 removes the old way in only after step 5 proves the new one works.

### 1. Take stock and clean up

Sign in to the console the way you do today.

1. **IAM → Users.** Write down every user, and on each user's *Security credentials* tab, its access keys. **Do not delete them yet:** one of them is probably how your CLI signs in today. Step 6 removes them.
2. **IAM → Roles.** Delete the roles you created while learning. Leave the **service-linked roles** alone: their path starts with `/aws-service-role/` and AWS manages them.
3. **Leftover resources, in every region.** *Resource Groups & Tag Editor → Tag Editor*, Regions: *All regions*, Resource types: *All supported resource types*, *Search resources*. Delete anything you no longer need: instances, volumes, buckets, load balancers, databases. Then *Billing and Cost Management → Bills*: the charges by service for the last few months should be $0 or covered by credits; a service with charges is still running somewhere.
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

1. In the console's region menu (top right), choose **Europe (Frankfurt) eu-central-1**. Everything Szop creates lives there ([ADR 0008](../decisions/0008-hosting.md), decision 8).
2. *Billing and Cost Management → Billing preferences → Alert preferences → Edit*: turn on **Receive AWS Free Tier alerts** and **Receive CloudWatch billing alerts**.
3. On *Billing and Cost Management → Home*, note your plan and the remaining credits. On the Free plan, the page shows when it ends.

### 4. IAM Identity Center

IAM Identity Center is AWS's single sign-on (SSO): you sign in once, with MFA, and get short-lived credentials for the account.

**Before you click:** enabling it creates an **AWS Organization** with this account as its management account, and **creating an organization upgrades the account from the Free plan to the Paid plan.** The Paid plan has no fixed fee: you pay only for usage your credits do not cover, and the credits keep applying for up to 12 months from sign-up. The budget alerts of [Applying bootstrap](#applying-bootstrap) then watch the spending.

1. Check the console's region is **Frankfurt**. Open **IAM Identity Center → Enable**, and choose the option **with AWS Organizations** (the organization instance). Confirm.

   ⚠️ **Don't:** enable it in any other region. Identity Center lives in one region, and moving it means deleting it and starting over.

2. **MFA for every sign-in.** *Settings → Authentication → Multi-factor authentication → Configure*: prompt users for MFA **every time they sign in**; allow **security keys and built-in authenticators** and **authenticator apps**; if a user has no MFA device, **require them to register one at sign-in**. Save.
3. **Your user.** *Users → Add user*: a username (for example your first name), your email address, first and last name. *Next* through the group page (no groups), *Add user*. AWS sends an invitation email: open it, set a password, and register an MFA device when asked.
4. **The permission set.** *Permission sets → Create permission set → Predefined permission set → AdministratorAccess → Next*. Set **Session duration** to **8 hours**. *Next → Create*.
5. **The assignment.** *AWS accounts* → tick your account → *Assign users or groups* → *Users* → your user → *Next* → **AdministratorAccess** → *Next → Submit*.
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
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`: your 12-digit account ID (in quotes; `aws sts get-caller-identity --query Account --output text` prints it) and the address the budget alerts go to. git ignores this file.

Check that the bucket's name is free; S3 names are shared by every AWS account in the world:

```bash
aws s3api head-bucket --bucket szop-tfstate-ntrtcr
```

- `An error occurred (404) … Not Found`: the name is free. Go on.
- `An error occurred (403) … Forbidden`: another account owns it. Stop; the name in the code must change.
- No output: it exists in your account already, so bootstrap was applied before. Stop and check the state.

Then:

```bash
terraform init      # downloads the AWS provider; "Terraform has been successfully initialized!"
terraform plan      # read it: "Plan: 8 to add, 0 to change, 0 to destroy."
terraform apply     # shows the same plan; type yes
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
- add a `backend` block yourself: the phase adds `backend.tf` once the bucket exists;
- delete `terraform.tfstate` before Part 2;
- run `terraform destroy`.

### Part 2: moving the state into the bucket

Once `infra/bootstrap/backend.tf` exists, it tells Terraform to keep bootstrap's state in the bucket, under `bootstrap/terraform.tfstate`, with S3's native lock. Move the state there:

```bash
cd ~/workspace/szop/infra/bootstrap
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

## Coming later

- **Applying `infra/base`**: the domain, certificate, registry and secrets ([PH-10](../roadmap.md#ph-10-domain-and-base-infrastructure)).
- **Spinning the demo up and down** with the `demo-up` and `demo-down` buttons, and the nightly teardown ([PH-11](../roadmap.md#ph-11-ci-access-to-aws-and-the-teardown-safety-net), [PH-12](../roadmap.md#ph-12-first-deploy)).
- **Debugging** a running demo with ECS Exec and its logs, and **what it costs** ([PH-12](../roadmap.md#ph-12-first-deploy)).
