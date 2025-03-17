import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;

console.log('🔧 R2 Endpoint:', endpoint);
console.log('🔑 Access Key ID:', process.env.CLOUDFLARE_ACCESS_KEY_ID ? '✅ Present' : '❌ Missing');
console.log('🔑 Secret Access Key:', process.env.CLOUDFLARE_SECRET_ACCESS_KEY ? '✅ Present' : '❌ Missing');

// Initialize S3 client outside request handler
const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || '',
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED"
});

type Context = {
  params: Promise<{ name: string }> | { name: string };
};

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    console.log('🚀 Starting GET request');
    
    // Ensure we have the bucket name
    const { name: bucketName } = await context.params;
    console.log('📦 Bucket name:', bucketName);
    
    if (!bucketName) {
      console.log('❌ No bucket name provided');
      return NextResponse.json(
        { error: 'Bucket name is required' },
        { status: 400 }
      );
    }

    // Get search parameters
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || '';
    const continuationToken = searchParams.get('continuationToken');
    console.log('🔍 Search params:', { prefix, continuationToken });

    // Validate credentials
    if (!process.env.CLOUDFLARE_ACCESS_KEY_ID || !process.env.CLOUDFLARE_SECRET_ACCESS_KEY) {
      console.log('🔑 Missing R2 credentials');
      return NextResponse.json(
        { error: 'R2 credentials not configured' },
        { status: 500 }
      );
    }

    console.log('📝 Creating ListObjectsV2Command');
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken || undefined,
      MaxKeys: 50, // Limit results per page
    });

    console.log('📡 Sending request to R2');
    const response = await s3.send(command);
    console.log('✅ R2 response received:', {
      objectCount: response.Contents?.length || 0,
      hasMore: !!response.NextContinuationToken
    });

    return NextResponse.json({
      objects: response.Contents?.map((object) => ({
        key: object.Key,
        size: object.Size,
        lastModified: object.LastModified,
        etag: object.ETag,
      })) || [],
      nextContinuationToken: response.NextContinuationToken,
    });
  } catch (error: any) {
    console.error('💥 Error fetching objects:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return NextResponse.json(
      { error: 'Failed to fetch objects', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: Context
) {
  try {
    const { name: bucketName } = await context.params;
    const key = request.url.split('/objects/')[1];
    
    if (!bucketName || !key) {
      return NextResponse.json(
        { error: 'Bucket name and object key are required' },
        { status: 400 }
      );
    }

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: decodeURIComponent(key),
    });

    await s3.send(command);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting object:', error);
    return NextResponse.json(
      { error: 'Failed to delete object' },
      { status: 500 }
    );
  }
} 