# Microsoft

Let users sign in with their Microsoft or Azure AD / Entra ID account.

## Setup

1. Go to [Microsoft Entra](https://entra.microsoft.com) (formerly Azure AD) and open **App registrations**
2. Click **New registration**
3. Give it a name and set the redirect URI to `https://your-hub-url/api/auth/callback/microsoft`
4. Click **Register**
5. Copy the **Application (client) ID**
6. Go to **Certificates & secrets**, create a new client secret, and copy the value
7. Paste both into the Microsoft card in Perch (**Admin > Auth**) and enable it

## Tenant ID

By default, Perch uses `common` as the tenant, which allows any Microsoft account (personal and work). To restrict sign-ins to your organization, set the **Tenant ID** to your Azure AD tenant ID. You'll find it in Entra under **Overview**.

## Domain restriction

Fill in **Allowed Domain** to limit sign-ins to a specific email domain (e.g. `yourcompany.com`), even when using `common` as the tenant.
