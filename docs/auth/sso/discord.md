# Discord

Let users sign in with their Discord account.

## Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application
2. Go to **OAuth2** in the left sidebar
3. Add `https://your-hub-url/api/auth/callback/discord` as a redirect URI
4. Copy the **Client ID** and **Client Secret** from the same page
5. Paste both into the Discord card in Perch (**Admin > Auth**) and enable it

## Note on email addresses

Perch uses the user's Discord email to create and match their account. The user needs a verified email on their Discord account to sign in. If they don't have one, the login will fail.

Discord doesn't support OIDC, so Perch calls the Discord API directly after the OAuth flow to fetch the user's email.
