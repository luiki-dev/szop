# AWS CLI

The AWS Command Line Interface (CLI) runs AWS commands from a terminal: `aws s3 ls`, `aws sts get-caller-identity` and so on. In Szop it also signs the owner in to AWS: Terraform uses the credentials it obtains. The **Session Manager plugin** is a small companion program the CLI calls to open a shell inside a running container (ECS Exec), for debugging the demo from PH-12c.

## Why Szop uses it

- **AWS CLI v2 and the Session Manager plugin:** [ADR 0008](../../decisions/0008-hosting.md), decision 30.
- **Short-lived credentials from IAM Identity Center, never access keys:** ADR 0008, decision 25, and [ADR 0029](../../decisions/0029-aws-account-and-terraform-bootstrap-details.md), decision 3. An access key works until someone deletes it; a leaked one is the most common way AWS accounts are compromised. `aws sso login` instead opens the browser, signs in with multi-factor authentication (MFA) and stores credentials that expire after a few hours.
- **Installed with AWS's own installer:** AWS publishes the CLI as a zip for Linux and the plugin as a `.deb`, both "latest" only. Neither runs in CI's checks, so they are not pinned.

## Configuration

**`~/.aws/config`** holds named **profiles**. Szop uses one, `szop`, written by `aws configure sso` during the [one-time account setup](../../operations/demo-environment.md#one-time-account-setup):

```ini
[profile szop]
sso_session = szop
sso_account_id = <the account ID>
sso_role_name = AdministratorAccess
region = eu-central-1
output = json

[sso-session szop]
sso_start_url = <the AWS access portal URL>
sso_region = eu-central-1
sso_registration_scopes = sso:account:access
```

- `sso_session` points at the sign-in settings below it; `sso_account_id` and `sso_role_name` pick the account and the permission set.
- No `aws_access_key_id` appears anywhere, and **`~/.aws/credentials` holds no keys.** After the account setup, a command run without a profile fails with "Unable to locate credentials" instead of quietly using an old key.

On the owner's machine, `~/.aws` is a link to the Windows user's `.aws` folder, so the Windows AWS CLI and the one in WSL share the profiles and the cached sign-in.

## Everyday use

In each new terminal that works with AWS:

```bash
export AWS_PROFILE=szop              # every aws and terraform command uses the profile
aws sso login                        # opens the browser; once a session expires
aws sts get-caller-identity          # who am I: an assumed role named AWSReservedSSO_AdministratorAccess_…
```

- **`Error when retrieving token from sso: Token has expired`** or **`The SSO session associated with this profile has expired`**: run `aws sso login` again.
- **`Unable to locate credentials`**: `AWS_PROFILE` is not set in this terminal.
- Terraform reads the same profile through `AWS_PROFILE`; the profile is not written into the Terraform code, because CI authenticates without profiles ([Terraform](terraform.md#everyday-use)).

## Updating

The installer updates in place:

```bash
S=/tmp/szop-tools; mkdir -p "$S"; cd "$S"
curl -fsSL -o awscliv2.zip https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip
unzip -qo awscliv2.zip && sudo ./aws/install --update && aws --version
```

The Session Manager plugin updates by installing the latest `.deb` again, as in the [setup guide](../setup.md#8-terraform-tflint-and-the-aws-cli).
