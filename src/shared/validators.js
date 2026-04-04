const supportedExtensions = [".pdf", ".docx", ".png", ".jpg", ".jpeg"];

export function normalizeRequiredSkills(input) {
  if (!input) {
    return [];
  }

  const values = Array.isArray(input) ? input : String(input).split(",");
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.toLowerCase());
}

export function validateUploadRequest(payload) {
  const { fileName, contentType, role } = payload || {};

  if (!fileName || !contentType) {
    throw new Error("fileName and contentType are required");
  }

  const normalizedFileName = fileName.toLowerCase();
  const isSupported = supportedExtensions.some((extension) => normalizedFileName.endsWith(extension));

  if (!isSupported) {
    throw new Error("Only PDF, DOCX, PNG, JPG, and JPEG files are supported");
  }

  return {
    fileName,
    contentType,
    role: role || "cloud_engineer"
  };
}
