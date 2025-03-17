import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListBucketsCommand, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
  },
});

// Function to get bucket domains (public access and Workers)
async function getBucketDomains(bucketName: string) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  try {
    // Check for public bucket domains
    const publicResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!publicResponse.ok) {
      console.error(`Error fetching bucket info for ${bucketName}:`, await publicResponse.text());
      return [];
    }

    const publicData = await publicResponse.json();
    const domains: string[] = [];

    // Add public bucket domain if public access is enabled
    if (publicData.result?.public_access?.enabled) {
      // Public bucket URL format: https://<BUCKET_NAME>.<ACCOUNT_ID>.r2.dev
      domains.push(`${bucketName}.${accountId}.r2.dev`);
    }

    // Check for custom domains if available
    if (publicData.result?.custom_domain) {
      domains.push(publicData.result.custom_domain);
    }

    // Check for Worker domains (if any Workers are bound to this bucket)
    const workersResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/services`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (workersResponse.ok) {
      const workersData = await workersResponse.json();
      // Get all Worker services that might be using this bucket
      const workerServices = workersData.result || [];
      
      // For each Worker service, check its bindings
      for (const service of workerServices) {
        const serviceResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/services/${service.id}`,
          {
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (serviceResponse.ok) {
          const serviceData = await serviceResponse.json();
          // Check if this Worker has a binding to our bucket
          const hasR2Binding = serviceData.result?.bindings?.some(
            (binding: any) => binding.type === 'r2_bucket' && binding.bucket_name === bucketName
          );

          if (hasR2Binding && serviceData.result?.domains) {
            // Add all domains associated with this Worker
            domains.push(...serviceData.result.domains.map((d: any) => d.hostname));
          }
        }
      }
    }

    return [...new Set(domains)]; // Remove any duplicates
  } catch (error) {
    console.error(`Error fetching domains for bucket ${bucketName}:`, error);
    return [];
  }
}

// Function to get bucket size and operation counts using S3 API
async function getBucketDetails(bucketName: string) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
    });

    const response = await s3.send(command);
    
    // Calculate total size
    let totalSize = 0;
    response.Contents?.forEach(object => {
      totalSize += object.Size || 0;
    });

    // For operations, we'll use the number of objects as a proxy for Class B operations
    // since each object would have been read at least once
    const classBOperations = response.Contents?.length || 0;
    
    // For Class A operations, we can use KeyCount as a proxy since each object
    // would have been written at least once
    const classAOperations = response.KeyCount || 0;

    return {
      size: totalSize,
      operations: {
        class_a: classAOperations,
        class_b: classBOperations
      }
    };
  } catch (error) {
    console.error(`Error fetching details for bucket ${bucketName}:`, error);
    return {
      size: 0,
      operations: {
        class_a: 0,
        class_b: 0
      }
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query')?.toLowerCase() || '';

    const command = new ListBucketsCommand({});
    const response = await s3.send(command);

    // Transform and filter buckets based on search query
    const buckets = await Promise.all(
      (response.Buckets || [])
        .filter(bucket => bucket.Name?.toLowerCase().includes(query))
        .map(async (bucket) => {
          const name = bucket.Name!;
          
          // Fetch bucket details and domains in parallel
          const [details, domains] = await Promise.all([
            getBucketDetails(name),
            getBucketDomains(name)
          ]);

          // Check if bucket is public
          const headCommand = new HeadBucketCommand({ Bucket: name });
          let isPublic = false;
          try {
            const headResponse = await s3.send(headCommand);
            isPublic = headResponse.$metadata.httpStatusCode === 200;
          } catch (error) {
            console.error(`Error checking bucket access for ${name}:`, error);
          }

          return {
            name,
            publicUrlAccess: isPublic,
            domains,
            bucketSize: details.size ? `${(details.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : '0 B',
            classAOperations: details.operations.class_a,
            classBOperations: details.operations.class_b,
            createdAt: bucket.CreationDate,
          };
        })
    );

    return NextResponse.json(buckets);
  } catch (error) {
    console.error('Error fetching buckets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch buckets' },
      { status: 500 }
    );
  }
} 