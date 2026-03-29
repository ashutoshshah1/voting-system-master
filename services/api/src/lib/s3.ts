import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "./env.js";

export const s3 = new S3Client({
  region: "us-east-1",
  endpoint: `${env.minioUseSsl ? "https" : "http"}://${env.minioEndpoint}:${env.minioPort}`,
  credentials: {
    accessKeyId: env.minioAccessKey,
    secretAccessKey: env.minioSecretKey,
  },
  forcePathStyle: true,
});

export const ensureBucket = async () => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.minioBucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: env.minioBucket }));
  }
};

export const uploadKycDocument = async (key: string, buffer: Buffer, mimeType: string) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.minioBucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
  return `${env.minioUseSsl ? "https" : "http"}://${env.minioEndpoint}:${env.minioPort}/${env.minioBucket}/${key}`;
};

export const uploadCandidateImage = async (
  key: string,
  buffer: Buffer,
  mimeType: string
) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.minioBucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
  return key;
};

export const getObject = async (key: string) => {
  return s3.send(
    new GetObjectCommand({
      Bucket: env.minioBucket,
      Key: key,
    })
  );
};
