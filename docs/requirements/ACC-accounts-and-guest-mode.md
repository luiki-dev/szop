# Accounts and guest mode (ACC)

Guest mode, registration, logging in and out, passwords, profile settings, and the deletion of accounts and guest workspaces. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## ACC-1

🎯 [MVP] A guest can use the app without registering. Until their first change, they see the default (seed) catalog, categories and units, read-only. Their first change (for example creating a list) creates an anonymous workspace from the seed data, tied to their browser.

## ACC-2

🎯 [MVP] Register with email and password, with email verification. On registration, the guest's anonymous workspace in that browser becomes the account's workspace. Passwords are 15 to 128 characters, with no rules about which characters they must contain, and are refused if they appear in known data breaches. The app never reveals whether an email address already has an account: registration always asks the user to check their inbox, and an address that already has an account receives an email saying so, with links to log in or reset the password.

## ACC-3

🎯 [MVP] Log in and log out. Reset a forgotten password via email. Change the password while logged in. A failed login, a reset request and a request to resend the verification email answer the same way whether or not the address has an account. Changing or resetting the password logs out every other session.

## ACC-4

🎯 [MVP] When logging into an *existing* account from a browser whose guest workspace holds data, the app offers to import the guest's lists and templates or to discard them. Imported items are matched to the account's categories by name. Unmatched items become uncategorized.

## ACC-5

🎯 [MVP] Profile settings: display name and currency.

## ACC-6

🎯 [MVP] Delete the account with all its data, after confirming with the current password. Lists it shared disappear for collaborators.

## ACC-7

🎯 [MVP] Anonymous (guest) workspaces are deleted automatically:

- after **3 days**, if they had no activity later than 1 hour after being created (used only briefly);
- otherwise after **30 days** of inactivity.

## ACC-8

🎯 [MVP] Registered accounts whose email is not verified within **7 days** are deleted automatically.
