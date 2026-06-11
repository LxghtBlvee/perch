# GitHub

Let users sign in with their GitHub account.

## Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) and click **New OAuth App**
2. Fill in the application name and homepage URL
3. Set the callback URL to `https://your-hub-url/api/auth/callback/github`
4. Click **Register application**
5. Copy the **Client ID** and generate a **Client Secret**
6. Paste both into the GitHub card in Perch (**Admin > Auth**) and enable it

## Organization restriction

If you want to limit sign-ins to members of a specific GitHub org, fill in the **Allowed Org** field with the org's name (e.g. `my-company`). Anyone not in that org gets turned away at login.

Leave it blank to allow any GitHub account.
