# Status Pages

Status pages let you share a public-facing uptime page with your users or team. You pick which health checks to show, style it to match your brand, and optionally put it on a custom domain.

## Creating a status page

Go to **Admin > Status Pages** and hit **New Status Page**. Give it a name and a slug (e.g. `my-service` makes it available at `/status/my-service`). You can set it to public or private — private pages require a login to view.

## Editing a status page

Click a status page from the list to open the edit view. From here you can:

**Checks** — search and add health checks to the page. Drag them to reorder. The order you set here is the order they appear on the public page.

**Logo** — upload a logo (PNG, JPG, GIF, WebP, or SVG) to show at the top of the status page. Square images work best.

**Custom domain** — point your own domain at the status page. Enter the domain, and Perch will show you the DNS record to add. Once you've added it, hit **Verify** to confirm it's resolving. When you set a custom domain, the page serves at the root (`/`) of that domain.

**Theme** — customize the look with color pickers for accent, background, and text colors, a font selector (pulls from Google Fonts), and a custom CSS field if you want to go further.

**Preview** — a live iframe preview updates as you change settings, so you can see how it looks before saving.

## Public view

The public status page at `/status/your-slug` (or your custom domain) shows:

- Your logo if you uploaded one
- Each assigned health check with its current status and heartbeat bars
- No Perch branding in the way of your content

The page doesn't auto-refresh, so users need to reload to see updates. If you want live updates, that's something on the roadmap.

## Custom domains

To serve a status page on your own domain (e.g. `status.yourcompany.com`):

1. Add the domain in the **Custom Domain** field on the edit page
2. Add a CNAME record pointing to your Perch hub's domain, or an A record pointing to its IP
3. Hit **Verify DNS** — Perch checks that the domain resolves and points to the hub
4. Make sure your reverse proxy routes traffic for that domain to the hub

Once verified and saved, anyone hitting `status.yourcompany.com` gets your status page.

> If you have a custom domain set, the slug field on the slug field locks on the edit page. The slug still works at `/status/your-slug`, but the custom domain takes priority for public sharing.
