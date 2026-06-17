# User Management

User management lives at **Admin > Users**. You need the `admin` role to access it.

## Roles

Perch has two roles:

- **Member** — can view the dashboard, health checks, agents, and containers. Can't access admin pages.
- **Admin** — full access, including Users, Auth, Instance settings, and Status Pages admin.

New accounts (whether created manually or via OAuth) start as members. Promote them from the Users page.

## Creating users

Hit **New User** and fill in an email and password. The user can change their password from their Settings page after signing in.

If you have OAuth providers enabled, users can sign up by signing in with their provider — Perch creates an account automatically on first login.

## The user detail panel

Click any row in the user list to open a detail panel on the right. It shows:

- Their email and role
- Last login time
- A button to generate a recovery link

## Account recovery

If a user gets locked out (forgot password, lost access to their OAuth provider), you can generate a recovery link from the detail panel.

The link is single-use and expires after 24 hours. Send it to the user and Perch logs them in, from where they can update their password or re-link their OAuth account.

> Recovery links aren't shown for admin accounts or your own account — the instance admin can always get those back through other means.

## Deleting users

Hover a user row to reveal the delete button. Deleting a user removes their account and all their active sessions. There's no undo, so you'll get a confirmation prompt first.

## The instance admin

The first admin account (seeded from `PERCH_ADMIN_EMAIL` and `PERCH_ADMIN_PASSWORD`) is the instance admin. It's marked with a **seeded** badge in the user list. The UI won't let you delete it, to prevent you from locking yourself out.

If you need to reset the instance admin's password and can't get in, update the `password_hash` column directly in the database:

```bash
docker compose exec db psql -U perch -d perch
```

Then run an `UPDATE users SET password_hash = '...' WHERE email = 'your@email.com'` with a bcrypt hash for your new password. You can generate one with any bcrypt tool at cost 12.
