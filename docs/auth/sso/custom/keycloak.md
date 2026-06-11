# Keycloak

Use Keycloak as the identity provider for Perch sign-ins.

## Setup in Keycloak

1. Open the Keycloak Admin Console and select the realm you want to use
2. In the left sidebar, click **Clients**, then **Create client**
3. Set **Client type** to **OpenID Connect** and give it a **Client ID** (e.g. `perch`), then click **Next**
4. Turn on **Client authentication** (this makes it a confidential client), then click **Next**
5. Under **Valid redirect URIs**, add `https://your-hub-url/api/auth/callback/custom`
6. Click **Save**
7. Go to the **Credentials** tab and copy the **Client secret**

## Setup in Perch

Open the Custom OIDC card in Perch (**Admin > Auth**) and fill in the Client ID and Client Secret. For the URLs, use the discovery document:

```
https://keycloak.example.com/realms/<realm-name>/.well-known/openid-configuration
```

Replace `<realm-name>` with your realm name. Open that URL in your browser, then copy the values into Perch:

| Perch field | Discovery doc key |
|---|---|
| Authorization URL | `authorization_endpoint` |
| Token URL | `token_endpoint` |
| Userinfo URL | `userinfo_endpoint` |

Set **Scopes** to `openid email`, then enable the provider.

## Realm note

Each Keycloak realm has its own set of clients and its own discovery URL. If you run more than one realm, create the Perch client in the realm your users belong to.
