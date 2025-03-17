This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment Setup

1. Copy the example environment file to create your local environment file:

```bash
cp .env.example .env.local
```

2. Fill in the environment variables in `.env.local`:

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID (found in the Cloudflare dashboard URL)
- `CLOUDFLARE_ACCESS_KEY_ID`: R2 access key ID (generate in Cloudflare R2 dashboard → "Manage R2 API Tokens")
- `CLOUDFLARE_SECRET_ACCESS_KEY`: R2 secret access key (shown when generating the token above)
- `CLOUDFLARE_API_TOKEN`: API token with R2 permissions (create in Cloudflare dashboard → "My Profile" → "API Tokens")
- `CLOUDFLARE_R2_ENDPOINT`: Your R2 endpoint URL (format: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)

### Running the Development Server

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
