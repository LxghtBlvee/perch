# SSO / OAuth

Perch supports signing in with external providers so your team doesn't need separate Perch passwords. You can enable providers in any combination and mix them with local accounts.

OAuth settings live at **Admin > Auth** (linked from the Instance page too).

## How it works

When a user signs in with an OAuth provider, Perch creates or finds a local account matched to their email. If an account with that email already exists (e.g. from an email/password login), it gets linked automatically. New accounts start with the `member` role — promote them to `admin` from the Users page if needed.

## Providers

### GitHub

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) and create a new OAuth App
2. Set the callback URL to `https://your-hub-url/api/auth/callback/github`
3. Copy the **Client ID** and generate a **Client Secret**
4. Paste both into the GitHub card in Perch and hit **Enable**

**Org restriction** — if you want to limit sign-ins to members of a specific GitHub org, fill in the **Allowed Org** field with your org's name (e.g. `my-company`). Anyone not in that org gets turned away.

### Google

1. Go to the [Google Cloud Console](https://console.cloud.google.com) and create an OAuth 2.0 client (Web application type)
2. Add `https://your-hub-url/api/auth/callback/google` as an authorized redirect URI
3. Copy the **Client ID** and **Client Secret** into Perch

**Domain restriction** — fill in **Allowed Domain** to limit sign-ins to a specific Google Workspace domain (e.g. `yourcompany.com`).

### Microsoft

1. Register an app in [Microsoft Entra](https://entra.microsoft.com) (formerly Azure AD)
2. Add `https://your-hub-url/api/auth/callback/microsoft` as a redirect URI
3. Copy the **Application (client) ID** and create a client secret

**Tenant ID** — defaults to `common` (any Microsoft account). Set it to your specific tenant ID to restrict access to your organization.

**Domain restriction** — optionally limit sign-ins to a specific domain (e.g. `yourcompany.com`).

### GitLab

1. Go to your GitLab profile settings and create a new OAuth application
2. Set the redirect URI to `https://your-hub-url/api/auth/callback/gitlab`
3. Enable the `read_user` scope
4. Copy the **Application ID** and **Secret** into Perch

**Self-hosted GitLab** — fill in **Base URL** with your GitLab instance URL (e.g. `https://gitlab.yourcompany.com`). Defaults to `https://gitlab.com`.

**Domain restriction** — limit sign-ins to email addresses on a specific domain.

### Discord

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application
2. Under **OAuth2**, add `https://your-hub-url/api/auth/callback/discord` as a redirect URI
3. Copy the **Client ID** and **Client Secret** into Perch

Discord doesn't support OIDC, so Perch calls Discord's API directly to fetch the user's email after the OAuth flow. Make sure the user has a verified email on their Discord account.

### Okta

1. In your Okta admin panel, create a new OIDC Web Application
2. Set the sign-in redirect URI to `https://your-hub-url/api/auth/callback/okta`
3. Copy the **Client ID** and **Client Secret** into Perch
4. Fill in **Base URL** with your Okta org URL (e.g. `https://yourcompany.okta.com`)

### Custom OIDC

If your provider isn't in the list, use the Custom OIDC option. You'll need to fill in the authorization URL, token URL, and userinfo URL from your provider's documentation. Add any scopes your provider requires (you'll need at least `openid` and `email`).

## Disabling a provider

Flip the toggle in the provider's modal to disable it. Existing accounts linked to that provider keep working, but new sign-ins through it will fail until you re-enable it.

## Maintenance mode

When maintenance mode is on (toggled from the Instance page), Perch blocks OAuth sign-ins along with password logins. The seeded admin account is the one exception.
