# Authelia

Use Authelia as the identity provider for Perch sign-ins. Authelia doesn't have a web UI for managing OIDC clients — you register clients directly in the config file.

## Register the client in Authelia

Add a new entry under `identity_providers.oidc.clients` in your Authelia configuration file:

```yaml
identity_providers:
  oidc:
    clients:
      - client_id: perch
        client_name: Perch
        client_secret: '$argon2id$...'
        public: false
        authorization_policy: two_factor
        redirect_uris:
          - https://your-hub-url/api/auth/callback/custom
        scopes:
          - openid
          - email
          - profile
        grant_types:
          - authorization_code
        response_types:
          - code
```

Since Authelia 4.38.0, the `client_secret` field must hold an Argon2 digest, not the plaintext secret. Generate one with:

```bash
docker run --rm authelia/authelia:latest \
  authelia crypto hash generate argon2 \
  --random --random.length 72 --random.charset rfc3986
```

The command prints both the raw secret and the digest. Put the digest in the config file and save the raw secret for the next step.

Restart Authelia to load the new client.

## Setup in Perch

Open the Custom OIDC card in Perch (**Admin > Auth**) and fill in:

- **Client ID**: `perch`
- **Client Secret**: the raw secret from the command above

For the URLs, use the discovery document:

```
https://auth.example.com/.well-known/openid-configuration
```

Open that URL in your browser, then copy the values into Perch:

| Perch field | Discovery doc key |
|---|---|
| Authorization URL | `authorization_endpoint` |
| Token URL | `token_endpoint` |
| Userinfo URL | `userinfo_endpoint` |

Set **Scopes** to `openid email`, then enable the provider.
