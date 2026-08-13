# FutureFit

E-commerce storefront for **FutureFit** — apparel brand (*Setting trends with every stitch*).

## Structure

- `client/` — React + Vite storefront
- `server/` — Express API + Prisma

## Setup

1. Copy `server/.env.example` to `server/.env` and set your `DATABASE_URL` / `DIRECT_URL`.
2. Install and generate Prisma client:

```bash
npm install --prefix server
npm run db:generate --prefix server
```

3. Run the API and client as needed.

Brand social: [facebook.com/FutureFit.eg](https://www.facebook.com/FutureFit.eg)
