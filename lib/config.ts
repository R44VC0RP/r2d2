import { cache } from 'react';
import { db } from '@/db';
import { appConfig } from '@/db/schema';
import { eq, or } from 'drizzle-orm';

export const getConfig = cache(async (key: string) => {
  const config = await db.query.appConfig.findFirst({
    where: eq(appConfig.key, key),
  });
  
  return config?.value || null;
});

export const getCloudflareConfig = cache(async () => {
  const configs = await db.select().from(appConfig).where(
    or(
      eq(appConfig.key, 'CLOUDFLARE_ACCOUNT_ID'),
      eq(appConfig.key, 'CLOUDFLARE_ACCESS_KEY_ID'),
      eq(appConfig.key, 'CLOUDFLARE_SECRET_ACCESS_KEY'),
      eq(appConfig.key, 'CLOUDFLARE_API_TOKEN'),
      eq(appConfig.key, 'CLOUDFLARE_R2_ENDPOINT')
    )
  );
  
  const configMap: Record<string, string> = {};
  for (const config of configs) {
    configMap[config.key] = config.value;
  }
  
  return configMap;
}); 