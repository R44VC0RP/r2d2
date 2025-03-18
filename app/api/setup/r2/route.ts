import { NextResponse } from 'next/server';
import { db } from '@/db';
import { appConfig } from '@/db/schema';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

export async function POST(request: Request) {
  try {
    const config = await request.json();

    // Validate required fields
    const requiredFields = [
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_ACCESS_KEY_ID',
      'CLOUDFLARE_SECRET_ACCESS_KEY',
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_R2_ENDPOINT',
    ];

    for (const field of requiredFields) {
      if (!config[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Test the R2 connection
    const client = new S3Client({
      region: 'auto',
      endpoint: config.CLOUDFLARE_R2_ENDPOINT,
      credentials: {
        accessKeyId: config.CLOUDFLARE_ACCESS_KEY_ID,
        secretAccessKey: config.CLOUDFLARE_SECRET_ACCESS_KEY,
      },
    });

    try {
      await client.send(new ListBucketsCommand({}));
    } catch (error) {
      console.error('R2 connection test failed:', error);
      return NextResponse.json(
        { error: 'Failed to connect to R2. Please check your credentials.' },
        { status: 400 }
      );
    }

    // Store configuration in database
    for (const [key, value] of Object.entries(config)) {
      await db.insert(appConfig).values({
        key,
        value: value as string,
        isSecret: key.includes('KEY') || key.includes('TOKEN'),
      });
    }

    // Mark setup as complete
    await db.insert(appConfig).values({
      key: 'setup_completed',
      value: 'true',
      isSecret: false,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving R2 configuration:', error);
    return NextResponse.json(
      { error: 'Failed to save R2 configuration' },
      { status: 500 }
    );
  }
} 