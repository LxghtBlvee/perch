# InfluxDB

Connect an InfluxDB instance to Perch to query time-series data alongside your other metrics.

## Adding a connection

Go to **Data Sources** in the sidebar and click **Add Data Source**. Select **InfluxDB** and fill in:

- **Name** — a label for this connection (e.g. "Production InfluxDB")
- **URL** — the base URL of your InfluxDB instance (e.g. `http://influxdb:8086`)
- **Token** — an API token with read access to the bucket you want to query
- **Organization** — your InfluxDB organization name or ID
- **Bucket** — the default bucket to query

## InfluxDB versions

Perch connects to **InfluxDB 2.x** using the v2 API and token-based auth. InfluxDB 1.x uses a different auth model (username/password + database) and is not supported.

If you're still on InfluxDB 1.x, consider upgrading or using the [1.x compatibility API](https://docs.influxdata.com/influxdb/v2/reference/api/influxdb-1x/) with a v2 instance.

## Getting an API token

In the InfluxDB UI, go to **Load Data > API Tokens** and create a token with read access to your bucket. Copy it into the Token field in Perch.

## URL format

Use the base URL without a trailing slash:

```
http://influxdb:8086
https://influxdb.example.com
```

If InfluxDB is on the same Docker host, use the container name rather than `localhost`.
