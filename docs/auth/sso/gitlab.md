# GitLab

Let users sign in with their GitLab account. Works with both GitLab.com and self-hosted GitLab instances.

## Setup

1. Go to your GitLab profile settings and open **Applications**
2. Click **Add new application**
3. Set the redirect URI to `https://your-hub-url/api/auth/callback/gitlab`
4. Enable the `read_user` scope
5. Click **Save application**, then copy the **Application ID** and **Secret**
6. Paste both into the GitLab card in Perch (**Admin > Auth**) and enable it

## Self-hosted GitLab

If you're running your own GitLab instance, fill in the **Base URL** field with your instance URL (e.g. `https://gitlab.yourcompany.com`). Leave it blank to use `https://gitlab.com`.

Create the OAuth application in your GitLab instance's admin area under **Admin > Applications** rather than in a user profile, so it's available to all users.

## Domain restriction

Fill in **Allowed Domain** to limit sign-ins to a specific email domain.
