

## Getting Started

Don't wanna deal with all this? We got you covered.

Fully hosted version with authentication and a database (thanks Neon!) (Note on vercel you cannot upload files larger than 10mb)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FR44VC0RP%2Fr2d2&env=AUTH_SECRET&envDescription=You%20are%20going%20to%20need%20to%20set%20a%20random%20AUTH_SECRET%20and%20use%20Neon%20DB%20for%20the%20database%20integration.&project-name=cloudflare-r2-d2&repository-name=cloudflare-r2-d2&integration-ids=oac_3sK3gnG06emjIEVL09jjntDD)



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

## Key Features

### 1. Infinite Smooth Scrolling
- Virtualized list for large bucket contents with minimal memory usage
- Early fetch triggers (starts loading 1000px before reaching the bottom)
- Smooth animations for loading states
- Scroll position maintenance when navigating
- Automatic pagination handling with continuation tokens

### 2. Advanced Search & Filtering
- Smart search syntax with prefix and filename components
- Powerful query syntax with operators:
  - `type:image` - Filter by file type (image, document, code, media, archive)
  - `size>1mb` - Files larger than 1MB
  - `size<1gb` - Files smaller than 1GB
  - `after:2024-01-01` - Files modified after date
  - `before:2024-12-31` - Files modified before date
- Combined server-side and client-side filtering for optimal performance
- Real-time result updating as you type

### 3. Interactive File Preview System
- Hover preview for images directly in the file list
- Automatic file type detection with appropriate previews
- Thumbnail generation for quick visual browsing
- Optimized loading with lazy-loading and caching
- Contextual controls based on file type

### 4. Advanced Drag & Drop File Upload
- Intuitive drag & drop interface with visual feedback
- Multi-file upload support
- Real-time progress tracking with elegant progress bars
- Configurable parallel uploads (1-10 concurrent uploads)
- Automatic folder path handling
- Upload cancellation support
- Error handling with retry functionality

### 5. React Query Data Management
- Efficient data caching reduces API calls
- Real-time data with optimistic updates
- Prefetching of likely-to-be-needed data
- Background data refreshing
- Queryable and filterable data store

### 6. Smooth Animations & Transitions
- Framer Motion powered animations
- Micro-interactions for better user feedback
- Loading states with smooth transitions
- Interactive element animations
- Optimized for performance

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
