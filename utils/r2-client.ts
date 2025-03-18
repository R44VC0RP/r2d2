import { S3Client } from '@aws-sdk/client-s3';
import { getCloudflareConfig } from '@/lib/config';

export async function getR2Client() {
  const config = await getCloudflareConfig();
  
  return new S3Client({
    region: 'auto',
    endpoint: config.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
      accessKeyId: config.CLOUDFLARE_ACCESS_KEY_ID,
      secretAccessKey: config.CLOUDFLARE_SECRET_ACCESS_KEY,
    },
  });
} 