import { ComprehendClient } from "@aws-sdk/client-comprehend";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { TextractClient } from "@aws-sdk/client-textract";
import { config } from "./config.js";

export const s3Client = new S3Client({ region: config.region });
export const dynamoClient = new DynamoDBClient({ region: config.region });
export const textractClient = new TextractClient({ region: config.region });
export const lambdaClient = new LambdaClient({ region: config.region });
export const comprehendClient = new ComprehendClient({ region: config.region });
