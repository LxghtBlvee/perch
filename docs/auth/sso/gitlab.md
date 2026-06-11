# GitLab

Let users sign in with their GitLab account. Works with both GitLab.com and self-hosted GitLab instances.

## Setup

1. Go to your GitLab profile: click your avatar in the top-right, then **Edit profile**
2. In the left sidebar, go to **Access > Applications**
3. Click **Add new application**
4. Set the **Redirect URI** to `https://your-hub-url/api/auth/callback/gitlab`
5. Enable the `openid` and `email` scopes
6. Click **Save application**, then copy the **Application ID** and **Secret**
7. Paste both into the GitLab card in Perch (**Admin > Auth**) and enable it

## Self-hosted GitLab

If you're running your own GitLab instance, fill in the **Base URL** field with your instance URL (e.g. `https://gitlab.yourcompany.com`). Leave it blank to use `https://gitlab.com`.

For a self-hosted instance, create the OAuth application in the admin area under **Admin > Applications** so it's available to all users, rather than under a personal profile.

## Domain restriction

Fill in **Allowed Domain** to limit sign-ins to a specific email domain.
