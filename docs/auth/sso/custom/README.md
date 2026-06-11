# Custom OIDC

Connect any OIDC-compatible identity provider that isn't covered by the other provider guides. Authentik, Keycloak, Authelia, Dex, and anything else that speaks standard OIDC all work here.

## Provider guides

- [Authentik](./authentik.md)
- [Keycloak](./keycloak.md)
- [Authelia](./authelia.md)
- [Dex](./dex.md)

## Generic setup

If your provider isn't listed above, here's how to configure it manually.

1. Create a new OAuth / OIDC client in your provider
2. Set the redirect URI to `https://your-hub-url/api/auth/callback/custom`
3. Copy the **Client ID** and **Client Secret**
4. Open the Custom OIDC card in Perch (**Admin > Auth**) and fill in:
   - **Authorization URL** — where users get redirected to sign in
   - **Token URL** — where Perch exchanges the auth code for tokens
   - **Userinfo URL** — where Perch fetches the user's profile
   - **Scopes** — space-separated scopes (you need at least `openid email`)
5. Enable it

## Finding the URLs

Most providers publish an OIDC discovery document at `/.well-known/openid-configuration`. Opening that URL in your browser shows all the endpoints:

```
https://auth.example.com/.well-known/openid-configuration
```

The fields you need map to these keys in the discovery doc:

| Perch field | Discovery doc key |
|---|---|
| Authorization URL | `authorization_endpoint` |
| Token URL | `token_endpoint` |
| Userinfo URL | `userinfo_endpoint` |
