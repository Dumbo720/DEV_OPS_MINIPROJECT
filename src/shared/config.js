export const config = {
  region: process.env.AWS_REGION || "ap-south-1",
  bucketName: process.env.RESUME_BUCKET,
  tableName: process.env.CANDIDATES_TABLE,
  analysisFunctionName: process.env.ANALYSIS_FUNCTION_NAME,
  allowedOrigin: process.env.ALLOWED_ORIGIN || "*",
  requiredSkillsDefault: process.env.REQUIRED_SKILLS_DEFAULT || "",
  enableComprehend: process.env.ENABLE_COMPREHEND === "true"
};
