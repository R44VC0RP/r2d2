export interface Bucket {
  name: string;
  publicUrlAccess: boolean;
  domains: string[];
  bucketSize: string;
  classAOperations: number;
  classBOperations: number;
}

export interface BucketListResponse {
  buckets: Bucket[];
  error?: string;
} 