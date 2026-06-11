# Authentik

Use Authentik as the identity provider for Perch sign-ins.

## Setup in Authentik

1. Log in to your Authentik instance as an admin
2. Go to **Applications > Applications** and click **New Provider**
3. Give the application a name (e.g. "Perch") and click **Next**
4. Select **OAuth2/OIDC** as the provider type and click **Next**
5. Under **Redirect URIs**, add `https://your-hub-url/api/auth/callback/custom`
6. Click **Submit**
7. Open the new application, click into the linked provider, and copy the **Client ID** and **Client Secret**

## Setup in Perch

Open the Custom OIDC card in Perch (**Admin > Auth**) and fill in the Client ID and Client Secret. For the URLs, use the discovery document from your Authentik instance:

```
https://your-authentik-url/application/o/<app-slug>/.well-known/openid-configuration
```

Replace `<app-slug>` with the slug shown on the application's detail page. Open that URL in your browser, then copy the values into Perch:

| Perch field | Discovery doc key |
|---|---|
| Authorization URL | `authorization_endpoint` |
| Token URL | `token_endpoint` |
| Userinfo URL | `userinfo_endpoint` |

Set **Scopes** to `openid email`, then enable the provider.

## Access control

By default, any Authentik user can sign in to Perch through the provider. To restrict access, bind a policy to the Perch application in Authentik under **Applications > Bindings**.
