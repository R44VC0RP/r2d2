import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client } from '@/lib/r2';

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
    const filenameQuery = searchParams.get('filename')?.toLowerCase() || '';
    const fileType = searchParams.get('fileType');
    const minSize = searchParams.get('minSize');
    const maxSize = searchParams.get('maxSize');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const continuationToken = searchParams.get('continuationToken');

    const s3 = await getR2Client();
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 200,
      ContinuationToken: continuationToken || undefined,
      Prefix: searchQuery,
    });

    const response = await s3.send(command);
    let objects = response.Contents || [];

    // Apply additional filtering
    objects = objects.filter(obj => {
      const key = obj.Key || '';
      const filename = key.split('/').pop()?.toLowerCase() || '';
      
      if (filenameQuery && !filename.includes(filenameQuery)) {
        return false;
      }

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

      if (minSize && (obj.Size ?? 0) < parseInt(minSize)) {
        return false;
      }
      if (maxSize && (obj.Size ?? 0) > parseInt(maxSize)) {
        return false;
      }

      if (dateFrom && new Date(obj.LastModified!) < new Date(dateFrom)) {
        return false;
      }
      if (dateTo && new Date(obj.LastModified!) > new Date(dateTo)) {
        return false;
      }

      return true;
    });

    objects.sort((a, b) => {
      return new Date(b.LastModified || 0).getTime() - new Date(a.LastModified || 0).getTime();
    });

    const headers = new Headers({
      'Cache-Control': 'no-cache',
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
    }, { headers });

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

    const s3 = await getR2Client();
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

export async function POST(
  request: NextRequest,
  context: Context
) {
  try {
    const { name: bucketName } = await context.params;
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '';
    
    if (!bucketName) {
      return NextResponse.json(
        { error: 'Bucket name is required' },
        { status: 400 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const key = path || file.name;
    const fileType = file.type || 'application/octet-stream';
    
    const s3 = await getR2Client();
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: fileType,
    });

    await s3.send(command);

    return NextResponse.json({
      success: true,
      key,
      size: file.size,
      contentType: fileType,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
} 