# Custom OIDC

Connect any OIDC-compatible identity provider that isn't covered by the other options — Authentik, Keycloak, Authelia, Dex, or anything else that speaks standard OIDC.

## Setup

You'll need to create an OAuth client in your provider and grab four URLs from its documentation or discovery endpoint.

1. Create a new OAuth / OIDC client in your provider
2. Set the redirect URI to `https://your-hub-url/api/auth/callback/custom`
3. Copy the **Client ID** and **Client Secret**
4. Fill in the four URL fields in the Custom OIDC card in Perch (**Admin > Auth**):
   - **Authorization URL** — where users get redirected to sign in
   - **Token URL** — where Perch exchanges the auth code for tokens
   - **Userinfo URL** — where Perch fetches the user's profile
   - **Scopes** — space-separated scopes to request (you need at least `openid email`)
5. Enable it

## Finding the URLs

Most providers publish an OIDC discovery document at `/.well-known/openid-configuration`. Opening that URL in a browser gives you all the endpoints:

```
https://auth.example.com/.well-known/openid-configuration
```

The fields you need map to these keys in the discovery doc:

| Perch field | Discovery doc key |
|---|---|
| Authorization URL | `authorization_endpoint` |
| Token URL | `token_endpoint` |
| Userinfo URL | `userinfo_endpoint` |

## Common providers

**Authentik:** Create an OAuth2/OIDC provider in Authentik, then create an application pointing at it. Use the URLs from the provider's detail page or the discovery endpoint.

**Keycloak:** Create a client in your realm with `openid-connect` as the protocol. The discovery URL is at `https://keycloak.example.com/realms/your-realm/.well-known/openid-configuration`.

**Authelia:** Set up an OIDC client in your Authelia config. The discovery URL is at `https://auth.example.com/.well-known/openid-configuration`.
