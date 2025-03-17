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

// File type patterns
const FILE_TYPES = {
  images: /\.(jpg|jpeg|png|gif|webp|svg)$/i,
  documents: /\.(pdf|doc|docx|txt|md|csv)$/i,
  code: /\.(js|ts|jsx|tsx|html|css|json|yaml|yml)$/i,
  media: /\.(mp4|mp3|wav|avi|mov)$/i,
  archives: /\.(zip|rar|7z|tar|gz)$/i,
};

type Context = {
  params: Promise<{ name: string }>;
};

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    const { name: bucketName } = await context.params;
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('prefix') || '';
    const fileType = searchParams.get('fileType');
    const minSize = searchParams.get('minSize');
    const maxSize = searchParams.get('maxSize');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const continuationToken = searchParams.get('continuationToken');

    // Create a command to list objects
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 50,
      ContinuationToken: continuationToken || undefined,
      // Always use the search query as prefix to optimize S3 listing
      Prefix: searchQuery,
    });

    const response = await s3.send(command);
    let objects = response.Contents || [];

    // Apply additional filtering
    objects = objects.filter(obj => {
      const key = obj.Key || '';
      
      // Check if the key contains the search query anywhere (filename search)
      if (searchQuery && !key.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Apply file type filter
      if (fileType) {
        const ext = key.toLowerCase().split('.').pop();
        const typeMatches = {
          images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
          documents: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'],
          code: ['js', 'ts', 'py', 'java', 'cpp', 'html', 'css', 'json'],
          media: ['mp3', 'mp4', 'avi', 'mov', 'wav'],
          archives: ['zip', 'rar', '7z', 'tar', 'gz']
        };
        if (!typeMatches[fileType as keyof typeof typeMatches]?.includes(ext || '')) {
          return false;
        }
      }

      // Apply size filters
      if (minSize && (obj.Size ?? 0) < parseInt(minSize)) {
        return false;
      }
      if (maxSize && (obj.Size ?? 0) > parseInt(maxSize)) {
        return false;
      }

      // Apply date filters
      if (dateFrom && new Date(obj.LastModified!) < new Date(dateFrom)) {
        return false;
      }
      if (dateTo && new Date(obj.LastModified!) > new Date(dateTo)) {
        return false;
      }

      return true;
    });

    // Sort objects by last modified date (newest first)
    objects.sort((a, b) => {
      return new Date(b.LastModified || 0).getTime() - new Date(a.LastModified || 0).getTime();
    });

    return NextResponse.json({
      objects: objects.map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag
      })),
      nextContinuationToken: response.NextContinuationToken,
      totalObjects: response.KeyCount || 0
    });

  } catch (error) {
    console.error('Error listing objects:', error);
    return NextResponse.json(
      { error: 'Failed to list objects' },
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