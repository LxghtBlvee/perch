# nginx

A minimal nginx config to proxy Perch with HTTPS. The key thing is passing WebSocket upgrades through for the `/ws/live` path — without it, the live dashboard won't update.

## Config

```nginx
server {
    listen 80;
    server_name metrics.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name metrics.example.com;

    ssl_certificate     /etc/letsencrypt/live/metrics.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/metrics.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8484;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Keep WebSocket connections alive
        proxy_read_timeout 3600s;
    }
}
```

## Getting a certificate with Certbot

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d metrics.example.com
```

Certbot will update your nginx config automatically and set up auto-renewal.

## Set PERCH_BASE_URL

Once Perch is behind a proxy, set `PERCH_BASE_URL` in your `.env` so OAuth callbacks work:

```env
PERCH_BASE_URL=https://metrics.example.com
```

Then restart the hub:

```bash
docker compose restart hub
```
