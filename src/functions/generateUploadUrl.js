import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { s3Client } from "../shared/awsClients.js";
import { jsonResponse } from "../shared/response.js";
import { validateUploadRequest } from "../shared/validators.js";
import { getRoleProfile } from "../shared/roles.js";

export async function handler(event) {
  try {
    const payload = JSON.parse(event.body || "{}");
    const { fileName, contentType, role } = validateUploadRequest(payload);
    const candidateId = uuidv4();
    const safeFileName = fileName.replace(/\s+/g, "-");
    const normalizedRole = getRoleProfile(role) ? role : "cloud_engineer";
    const key = `resumes/${normalizedRole}/${candidateId}/${Date.now()}-${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.RESUME_BUCKET,
      Key: key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    const roleProfile = getRoleProfile(normalizedRole);

    return jsonResponse(200, {
      candidateId,
      role: normalizedRole,
      roleLabel: roleProfile.label,
      requiredSkills: roleProfile.requiredSkills,
      objectKey: key,
      uploadUrl,
      requiredHeaders: {
        "Content-Type": contentType
      }
    });
  } catch (error) {
    console.error("generateUploadUrl error", error);
    return jsonResponse(400, {
      message: error.message || "Failed to generate upload URL"
    });
  }
}
