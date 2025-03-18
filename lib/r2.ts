import { S3Client } from '@aws-sdk/client-s3';
import { db } from '@/db';
import { appConfig } from '@/db/schema';
import { eq, or } from 'drizzle-orm';

// Cache the credentials to avoid hitting the database too often
let cachedCredentials: Record<string, string> | null = null;
let lastFetch: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getR2Credentials() {
  // Return cached credentials if they're still valid
  if (cachedCredentials && (Date.now() - lastFetch < CACHE_TTL)) {
    return cachedCredentials;
  }

  // Fetch all R2-related credentials from the database
  const credentials = await db.query.appConfig.findMany({
    where: (fields) => 
      or(
        eq(fields.key, 'CLOUDFLARE_ACCOUNT_ID'),
        eq(fields.key, 'CLOUDFLARE_ACCESS_KEY_ID'),
        eq(fields.key, 'CLOUDFLARE_SECRET_ACCESS_KEY'),
        eq(fields.key, 'CLOUDFLARE_API_TOKEN'),
        eq(fields.key, 'CLOUDFLARE_R2_ENDPOINT')
      ),
  });

  // Convert array of records to key-value object
  const credentialsObject = credentials.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {} as Record<string, string>);

  // Update cache
  cachedCredentials = credentialsObject;
  lastFetch = Date.now();

  return credentialsObject;
}

export async function getR2Client() {
  const credentials = await getR2Credentials();

  return new S3Client({
    region: 'auto',
    endpoint: credentials.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
      accessKeyId: credentials.CLOUDFLARE_ACCESS_KEY_ID,
      secretAccessKey: credentials.CLOUDFLARE_SECRET_ACCESS_KEY,
    },
  });
} 