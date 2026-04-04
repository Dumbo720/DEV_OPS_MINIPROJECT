import { DetectEntitiesCommand } from "@aws-sdk/client-comprehend";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import {
  DetectDocumentTextCommand,
  GetDocumentTextDetectionCommand,
  StartDocumentTextDetectionCommand
} from "@aws-sdk/client-textract";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { comprehendClient, dynamoClient, s3Client, textractClient } from "../shared/awsClients.js";
import { config } from "../shared/config.js";
import { parseResumeText, computeScore } from "../shared/resumeParser.js";
import { normalizeRequiredSkills } from "../shared/validators.js";
import { getRoleProfile } from "../shared/roles.js";

const documentClient = DynamoDBDocumentClient.from(dynamoClient);

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractPdfText(bucket, key) {
  const startResponse = await textractClient.send(
    new StartDocumentTextDetectionCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: bucket,
          Name: key
        }
      }
    })
  );

  const jobId = startResponse.JobId;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await wait(3000);
    const result = await textractClient.send(
      new GetDocumentTextDetectionCommand({
        JobId: jobId
      })
    );

    if (result.JobStatus === "SUCCEEDED") {
      let blocks = [...(result.Blocks || [])];
      let nextToken = result.NextToken;

      while (nextToken) {
        const pagedResult = await textractClient.send(
          new GetDocumentTextDetectionCommand({
            JobId: jobId,
            NextToken: nextToken
          })
        );
        blocks = [...blocks, ...(pagedResult.Blocks || [])];
        nextToken = pagedResult.NextToken;
      }

      return blocks
        .filter((block) => block.BlockType === "LINE" && block.Text)
        .map((block) => block.Text)
        .join("\n");
    }

    if (result.JobStatus === "FAILED") {
      throw new Error("Textract PDF extraction failed");
    }
  }

  throw new Error("Textract PDF extraction timed out");
}

async function extractPdfTextLocally(buffer) {
  const result = await pdfParse(buffer);
  return (result.text || "").trim();
}

async function extractImageText(buffer) {
  const result = await textractClient.send(
    new DetectDocumentTextCommand({
      Document: {
        Bytes: buffer
      }
    })
  );

  return (result.Blocks || [])
    .filter((block) => block.BlockType === "LINE" && block.Text)
    .map((block) => block.Text)
    .join("\n");
}

async function extractDocxText(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

async function enrichSkillsWithComprehend(text, existingSkills) {
  if (!config.enableComprehend || !text.trim()) {
    return existingSkills;
  }

  try {
    const response = await comprehendClient.send(
      new DetectEntitiesCommand({
        LanguageCode: "en",
        Text: text.slice(0, 5000)
      })
    );

    const entitySkills = (response.Entities || [])
      .map((entity) => entity.Text?.trim())
      .filter(Boolean)
      .map((value) => value.toLowerCase());

    return Array.from(new Set([...existingSkills.map((skill) => skill.toLowerCase()), ...entitySkills])).slice(0, 30);
  } catch (error) {
    console.warn("Comprehend enrichment skipped", error.name || error.message);
    return existingSkills.map((skill) => skill.toLowerCase());
  }
}

export async function handler(event) {
  try {
    const { bucket, key, metadata = {}, contentType = "" } = event;
    const objectResult = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );

    const keyParts = key.split("/");
    const roleKey = keyParts[1] || "cloud_engineer";
    const candidateId = metadata["candidate-id"] || keyParts[2];
    const roleProfile = getRoleProfile(roleKey);
    const requiredSkills = normalizeRequiredSkills(roleProfile.requiredSkills);
    const sourceFileName = decodeURIComponent((metadata["original-name"] || key.split("/").pop() || "").replace(/^\d+-/, ""));
    const lowerName = sourceFileName.toLowerCase();
    const fileBuffer = await streamToBuffer(objectResult.Body);

    let extractedText = "";
    if (lowerName.endsWith(".pdf")) {
      try {
        extractedText = await extractPdfTextLocally(fileBuffer);
      } catch (error) {
        console.warn("Local PDF extraction failed", error.name || error.message);
      }

      // Fallback to Textract when local parsing finds little/no text or the PDF is scanned.
      if (!extractedText || extractedText.replace(/\s+/g, "").length < 80) {
        extractedText = await extractPdfText(bucket, key);
      }
    } else if (lowerName.endsWith(".docx")) {
      extractedText = await extractDocxText(fileBuffer);
    } else if (lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
      extractedText = await extractImageText(fileBuffer);
    } else {
      throw new Error(`Unsupported file type: ${contentType}`);
    }

    const parsed = parseResumeText(extractedText, requiredSkills);
    const enrichedSkills = await enrichSkillsWithComprehend(extractedText, parsed.skills);
    const score = computeScore(enrichedSkills, requiredSkills);

    const item = {
      id: candidateId,
      role: roleKey,
      roleLabel: roleProfile.label,
      name: parsed.name,
      skills: enrichedSkills,
      experience: parsed.experience,
      score,
      resumeUrl: `s3://${bucket}/${key}`,
      uploadTime: new Date().toISOString(),
      textPreview: extractedText.slice(0, 1000),
      requiredSkills,
      sourceFileName
    };

    await documentClient.send(
      new PutCommand({
        TableName: config.tableName,
        Item: item
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify(item)
    };
  } catch (error) {
    console.error("extractAndAnalyzeText error", error);
    throw error;
  }
}
