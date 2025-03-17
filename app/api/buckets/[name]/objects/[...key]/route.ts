import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Initialize S3 client outside request handler
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || '',
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED"
});

type Context = {
  params: Promise<{ name: string; key: string[] }>;
};

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    console.log('🚀 Starting GET request for object');
    
    // Ensure we have the bucket name and key
    const { name: bucketName, key: keyParts } = await context.params;
    const key = keyParts.join('/');
    
    console.log('📦 Bucket:', bucketName);
    console.log('🔑 Key:', key);

    if (!bucketName || !key) {
      console.log('❌ Missing bucket name or key');
      return NextResponse.json(
        { error: 'Bucket name and object key are required' },
        { status: 400 }
      );
    }

    // Validate credentials
    if (!process.env.CLOUDFLARE_ACCESS_KEY_ID || !process.env.CLOUDFLARE_SECRET_ACCESS_KEY) {
      console.log('❌ Missing Cloudflare credentials');
      return NextResponse.json(
        { error: 'Cloudflare credentials not configured' },
        { status: 500 }
      );
    }

    console.log('📡 Sending request to R2');
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3.send(command);
    console.log('✅ R2 response received');

    // Convert the readable stream to a Response
    if (response.Body instanceof Readable) {
      return new NextResponse(response.Body as any, {
        headers: {
          'Content-Type': response.ContentType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${encodeURIComponent(key.split('/').pop() || '')}"`,
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }

    return NextResponse.json(
      { error: 'Failed to get object' },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('💥 Error fetching object:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return NextResponse.json(
      { error: 'Failed to fetch object', details: error.message },
      { status: 500 }
    );
  }
} 