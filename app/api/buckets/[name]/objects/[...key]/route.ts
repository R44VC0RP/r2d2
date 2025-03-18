import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { getR2Client } from '@/lib/r2';

type Context = {
  params: Promise<{ name: string; key: string[] }>;
};

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    console.log('🚀 Starting GET request for object');
    
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

    console.log('📡 Sending request to R2');
    const s3 = await getR2Client();
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3.send(command);
    console.log('✅ R2 response received');

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