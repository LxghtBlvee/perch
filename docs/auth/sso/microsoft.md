# Microsoft

Let users sign in with their Microsoft or Azure AD / Entra ID account.

## Setup

1. Go to the [Microsoft Entra admin center](https://entra.microsoft.com) and open **Entra ID > App registrations**
2. Click **New registration**
3. Give it a name and click **Register**
4. Copy the **Application (client) ID** from the Overview page
5. In the left sidebar, go to **Authentication**, click **Add a platform**, and choose **Web**
6. Add `https://your-hub-url/api/auth/callback/microsoft` as the redirect URI and click **Configure**
7. Go to **Certificates & secrets**, click **New client secret**, fill in a description and expiry, then copy the **Value** (not the Secret ID)
8. Paste the Client ID and Secret into the Microsoft card in Perch (**Admin > Auth**) and enable it

## Tenant ID

By default, Perch uses `common` as the tenant, which allows any Microsoft account (personal and work). To restrict sign-ins to your organization, set the **Tenant ID** to your Azure AD tenant ID. You'll find it on the app's Overview page.

## Domain restriction

Fill in **Allowed Domain** to limit sign-ins to a specific email domain (e.g. `yourcompany.com`), even when using `common` as the tenant.
