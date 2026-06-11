# Dex

Use Dex as the identity provider for Perch sign-ins. Like Authelia, Dex has no web UI — all client registration happens in the config file.

## Register the client in Dex

Add a static client to your Dex config file under `staticClients`:

```yaml
staticClients:
  - id: perch
    secret: your-client-secret
    name: Perch
    redirectURIs:
      - https://your-hub-url/api/auth/callback/custom
```

Pick a strong random string for `secret`. Restart Dex after saving the config.

## Setup in Perch

Open the Custom OIDC card in Perch (**Admin > Auth**) and fill in:

- **Client ID**: `perch`
- **Client Secret**: the value from `secret` above

For the URLs, use the discovery document:

```
https://dex.example.com/.well-known/openid-configuration
```

Open that URL in your browser, then copy the values into Perch:

| Perch field | Discovery doc key |
|---|---|
| Authorization URL | `authorization_endpoint` |
| Token URL | `token_endpoint` |
| Userinfo URL | `userinfo_endpoint` |

Set **Scopes** to `openid email`, then enable the provider.

## Connectors

Dex acts as an OIDC bridge — it sits in front of other identity backends (LDAP, GitHub, another OIDC provider, etc.) and exposes them all as a single OIDC endpoint. Set up the backend connector in your Dex config to match your environment. The Perch side of the config stays the same regardless of which connector Dex uses.
