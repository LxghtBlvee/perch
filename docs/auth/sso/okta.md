# Okta

Let users sign in with their Okta account.

## Setup

1. In your Okta admin panel, go to **Applications > Applications**
2. Click **Create App Integration**
3. Choose **OIDC - OpenID Connect** and **Web Application**
4. Add `https://your-hub-url/api/auth/callback/okta` as a sign-in redirect URI
5. Click **Save**, then copy the **Client ID** and **Client Secret**
6. Fill in the **Base URL** field with your Okta org URL (e.g. `https://yourcompany.okta.com`)
7. Paste everything into the Okta card in Perch (**Admin > Auth**) and enable it

## Assigning users

In Okta, make sure the users or groups that should have access have the application assigned to them. Users not assigned to the app won't be able to sign in even with a valid Okta account.
