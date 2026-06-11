# Google

Let users sign in with their Google account.

## Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com) and open **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Choose **Web application** as the application type
4. Add `https://your-hub-url/api/auth/callback/google` as an authorized redirect URI
5. Click **Create**, then copy the **Client ID** and **Client Secret**
6. Paste both into the Google card in Perch (**Admin > Auth**) and enable it

## Domain restriction

Fill in **Allowed Domain** to limit sign-ins to a specific Google Workspace domain (e.g. `yourcompany.com`). Users with a personal Gmail won't be able to sign in.

Leave it blank to allow any Google account.

## Consent screen

If this is a new Google Cloud project, you may need to configure the OAuth consent screen first. Go to **APIs & Services > OAuth consent screen** and fill in the required fields. For an internal tool, set the user type to **Internal** to skip the verification process.
