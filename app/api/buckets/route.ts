import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListBucketsCommand, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getR2Client, getR2Credentials } from '@/lib/r2';

// Function to get bucket domains (public access and Workers)
async function getBucketDomains(bucketName: string) {
  const credentials = await getR2Credentials();
  const accountId = credentials.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = credentials.CLOUDFLARE_API_TOKEN;

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
      const workerServices = workersData.result || [];
      
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
          const hasR2Binding = serviceData.result?.bindings?.some(
            (binding: any) => binding.type === 'r2_bucket' && binding.bucket_name === bucketName
          );

          if (hasR2Binding && serviceData.result?.domains) {
            domains.push(...serviceData.result.domains.map((d: any) => d.hostname));
          }
        }
      }
    }

    return [...new Set(domains)];
  } catch (error) {
    console.error(`Error fetching domains for bucket ${bucketName}:`, error);
    return [];
  }
}

// Function to get bucket size and operation counts using S3 API
async function getBucketDetails(bucketName: string, s3: S3Client) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
    });

    const response = await s3.send(command);
    
    let totalSize = 0;
    response.Contents?.forEach(object => {
      totalSize += object.Size || 0;
    });

    const classBOperations = response.Contents?.length || 0;
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

    const s3 = await getR2Client();
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
            getBucketDetails(name, s3),
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

    const headers = new Headers({
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    });

    return NextResponse.json(buckets, { headers });
  } catch (error) {
    console.error('Error fetching buckets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch buckets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, publicAccess = false } = await request.json();
    
    if (!name) {
      return NextResponse.json(
        { error: 'Bucket name is required' },
        { status: 400 }
      );
    }

    // Validate bucket name
    const bucketNameRegex = /^[a-z0-9.-]{3,63}$/;
    if (!bucketNameRegex.test(name)) {
      return NextResponse.json(
        { error: 'Bucket name must be 3-63 characters long and can only contain lowercase letters, numbers, hyphens, and periods' },
        { status: 400 }
      );
    }

    const credentials = await getR2Credentials();
    const accountId = credentials.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = credentials.CLOUDFLARE_API_TOKEN;

    // Create bucket using Cloudflare API
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error creating bucket:', errorText);
      return NextResponse.json(
        { error: 'Failed to create bucket' },
        { status: response.status }
      );
    }

    // If public access is enabled, set the bucket to be publicly accessible
    if (publicAccess) {
      const publicAccessResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${name}/public_access`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            enabled: true,
          }),
        }
      );

      if (!publicAccessResponse.ok) {
        console.warn(`Failed to set public access for bucket ${name}`);
      }
    }

    const s3 = await getR2Client();
    const details = await getBucketDetails(name, s3);
    const domains = await getBucketDomains(name);

    return NextResponse.json({
      name,
      publicUrlAccess: publicAccess,
      domains,
      bucketSize: details.size ? `${(details.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : '0 B',
      classAOperations: details.operations.class_a,
      classBOperations: details.operations.class_b,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error creating bucket:', error);
    return NextResponse.json(
      { error: 'Failed to create bucket' },
      { status: 500 }
    );
  }
} 