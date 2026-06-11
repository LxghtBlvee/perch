# SSO / OAuth

Perch supports signing in with external providers so your team doesn't need separate Perch passwords. You can enable providers in any combination and mix them with local accounts.

OAuth settings live at **Admin > Auth**.

## How it works

When a user signs in with an OAuth provider, Perch creates or finds a local account matched to their email. If an account with that email already exists, it gets linked automatically. New accounts start with the `member` role — promote them from the [Users](../users.md) page if needed.

## Providers

- [GitHub](./github.md)
- [Google](./google.md)
- [Microsoft](./microsoft.md)
- [GitLab](./gitlab.md)
- [Discord](./discord.md)
- [Okta](./okta.md)
- Custom OIDC — self-hosted identity providers
  - [Overview](./custom/README.md)
  - [Authentik](./custom/authentik.md)
  - [Keycloak](./custom/keycloak.md)
  - [Authelia](./custom/authelia.md)
  - [Dex](./custom/dex.md)

## Disabling a provider

Flip the toggle in the provider's modal to disable it. Existing accounts linked to that provider keep working, but new sign-ins through it will fail until you re-enable it.

## Maintenance mode

When maintenance mode is on (toggled from the Instance page), Perch blocks OAuth sign-ins along with password logins. The seeded admin account is the one exception.
