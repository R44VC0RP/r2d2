This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment Setup

1. Copy the example environment file to create your local environment file:

```bash
cp .env.example .env.local
```
1.5. Getting Cloudflare Variables:

![image](https://github.com/user-attachments/assets/e60fd733-4afa-4ed9-b569-9fafea487896)

Click "Manage API Tokens"

Click "Create API Token"

![image](https://github.com/user-attachments/assets/2e1c73b6-9c0f-4182-818e-bf6e1a8e7985)

Make sure the API token you create has ADMIN READ AND WRITE, otherwise you will not be able to list/create/edit and delete buckets. 

![image](https://github.com/user-attachments/assets/40a8e3e2-5acb-4f71-b9fa-0d33655f1223)

Token Value -> CLOUDFLARE_API_TOKEN
Access Key ID -> CLOUDFLARE_ACCESS_KEY_ID
Secret Access Key -> CLOUDFLARE_SECRET_ACCESS_KEY

Click "Finish"

Click "← R2"

Then click "API" -> "Use R2 with APIs"

Account ID -> CLOUDFLARE_ACCOUNT_ID
S3 Compatable API Endpoint -> CLOUDFLARE_R2_ENDPOINT

2. Fill in the environment variables in `.env.local`:

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID (found in the Cloudflare dashboard URL)
- `CLOUDFLARE_ACCESS_KEY_ID`: R2 access key ID (generate in Cloudflare R2 dashboard → "Manage R2 API Tokens")
- `CLOUDFLARE_SECRET_ACCESS_KEY`: R2 secret access key (shown when generating the token above)
- `CLOUDFLARE_API_TOKEN`: API token with R2 permissions (create in Cloudflare dashboard → "My Profile" → "API Tokens")
- `CLOUDFLARE_R2_ENDPOINT`: Your R2 endpoint URL (format: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)

### Running the Development Server

First, run the development server:

```bash
bun i

bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. It will take a few seconds to load the first time & properly load/cache the data. It will show all of your buckets and the files within them.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Known Issues

1. On file upload there is a react-hook-form error that prevents immediate file list reload, we are working on this.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## SECURITY AND AUTHENTICATION WARNING:

CURRENTLY THERE IS NO AUTHENTICATION ON THIS APP. ANYONE WITH ACCESS TO THE URL OF THIS APP CAN VIEW AND EDIT ALL OF YOUR BUCKETS AND FILES. ONLY USE THIS APP ON A PRIVATE NETWORK IF YOU ARE OK WITH THIS. WE ARE NOT RESPONSIBLE FOR ANY DATA LOSS OR LEAKAGE.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
