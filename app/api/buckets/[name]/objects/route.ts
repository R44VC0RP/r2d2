import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client } from '@/lib/r2';
import { withAuth } from '@/lib/api-middleware';

type Context = {
  params: Promise<{ name: string }>;
};

// GET handler implementation
async function getObjects(request: NextRequest, context: Context) {
  try {
    const { name: bucketName } = await context.params;
    const { searchParams } = new URL(request.url);
    
    const prefix = searchParams.get('prefix') || '';
    const continuationToken = searchParams.get('continuationToken') || undefined;
    const filename = searchParams.get('filename') || '';
    const fileType = searchParams.get('fileType') || '';
    const minSize = searchParams.get('minSize') ? parseInt(searchParams.get('minSize') || '0', 10) : undefined;
    const maxSize = searchParams.get('maxSize') ? parseInt(searchParams.get('maxSize') || '0', 10) : undefined;
    const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom') || '') : undefined;
    const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo') || '') : undefined;

    if (!bucketName) {
      return NextResponse.json(
        { error: 'Bucket name is required' },
        { status: 400 }
      );
    }

    const s3 = await getR2Client();
    
    // List objects with prefix
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000, // Limit to 1000 objects per request
    });

    const response = await s3.send(command);
    
    // Filter objects based on search parameters
    let objects = response.Contents || [];
    
    // Apply filename filter
    if (filename) {
      const lowerFilename = filename.toLowerCase();
      objects = objects.filter(obj => 
        obj.Key?.toLowerCase().includes(lowerFilename)
      );
    }
    
    // Apply file type filter
    if (fileType) {
      const fileTypeMap: Record<string, string[]> = {
        'image': ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
        'document': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
        'video': ['mp4', 'webm', 'avi', 'mov', 'flv'],
        'audio': ['mp3', 'wav', 'ogg', 'flac'],
        'archive': ['zip', 'rar', 'tar', 'gz', '7z'],
      };
      
      const extensions = fileTypeMap[fileType] || [fileType];
      
      objects = objects.filter(obj => {
        const key = obj.Key || '';
        const extension = key.split('.').pop()?.toLowerCase() || '';
        return extensions.includes(extension);
      });
    }
    
    // Apply size filters
    if (minSize !== undefined) {
      objects = objects.filter(obj => (obj.Size || 0) >= minSize);
    }
    if (maxSize !== undefined) {
      objects = objects.filter(obj => (obj.Size || 0) <= maxSize);
    }
    
    // Apply date filters
    if (dateFrom !== undefined && !isNaN(dateFrom.getTime())) {
      objects = objects.filter(obj => 
        obj.LastModified !== undefined && new Date(obj.LastModified) >= dateFrom
      );
    }
    if (dateTo !== undefined && !isNaN(dateTo.getTime())) {
      objects = objects.filter(obj => 
        obj.LastModified !== undefined && new Date(obj.LastModified) <= dateTo
      );
    }
    
    // Transform objects to a more friendly format
    const transformedObjects = objects.map(obj => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified?.toISOString() || '',
      etag: obj.ETag?.replace(/"/g, '') || '',
    }));

    // Provide pagination info and objects count
    return NextResponse.json({
      objects: transformedObjects,
      nextContinuationToken: response.NextContinuationToken,
      totalObjects: response.KeyCount || 0,
    });
  } catch (error) {
    console.error('Error listing objects:', error);
    return NextResponse.json(
      { error: 'Failed to list objects' },
      { status: 500 }
    );
  }
}

// POST handler for file uploads
async function uploadObject(request: NextRequest, context: Context) {
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

// DELETE handler implementation
async function deleteObject(request: NextRequest, context: Context) {
  try {
    console.log('🚀 Starting DELETE request for object in objects route');
    
    // Ensure params are properly awaited
    const params = await context.params;
    const bucketName = params.name;
    
    console.log('📦 Bucket:', bucketName);
    console.log('🔍 Full request URL:', request.url);
    console.log('🛣️ Request method:', request.method);
    
    // Extract key from URL
    const urlParts = request.url.split('/objects/');
    if (urlParts.length < 2) {
      console.error('❌ Invalid URL format, cannot extract key:', request.url);
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }
    
    const key = decodeURIComponent(urlParts[1]);
    console.log('🔑 Extracted Key:', key);
    
    if (!bucketName || !key) {
      console.error('❌ Missing bucket name or key, bucketName:', bucketName, 'key:', key);
      return NextResponse.json(
        { error: 'Bucket name and object key are required' },
        { status: 400 }
      );
    }

    console.log('📡 Sending delete request to R2 for key:', key);
    const s3 = await getR2Client();
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3.send(command);
    console.log('✅ Object deleted successfully:', key);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('💥 Error deleting object:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return NextResponse.json(
      { error: 'Failed to delete object', details: error.message },
      { status: 500 }
    );
  }
}

// Apply authentication middleware to handlers
export const GET = withAuth(getObjects);
export const POST = withAuth(uploadObject);
export const DELETE = withAuth(deleteObject); 