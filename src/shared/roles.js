export const roleProfiles = {
  cloud_engineer: {
    label: "Cloud Engineer",
    description: "Build and manage scalable cloud infrastructure and serverless services.",
    requiredSkills: ["aws", "lambda", "s3", "dynamodb", "api gateway", "serverless"]
  },
  frontend_developer: {
    label: "Frontend Developer",
    description: "Create modern responsive interfaces and client-side applications.",
    requiredSkills: ["html", "css", "javascript", "react", "git"]
  },
  backend_developer: {
    label: "Backend Developer",
    description: "Design APIs, data access layers, and scalable backend services.",
    requiredSkills: ["node.js", "javascript", "rest api", "sql", "mongodb", "git"]
  },
  fullstack_developer: {
    label: "Full-Stack Developer",
    description: "Work across frontend, backend, APIs, and cloud deployment workflows.",
    requiredSkills: ["html", "css", "javascript", "react", "node.js", "rest api", "aws"]
  },
  data_analyst: {
    label: "Data Analyst",
    description: "Analyze datasets, build reports, and communicate business insights.",
    requiredSkills: ["python", "sql", "excel", "power bi", "tableau"]
  }
};

export function getRoleProfile(roleKey) {
  if (!roleKey || !roleProfiles[roleKey]) {
    return roleProfiles.cloud_engineer;
  }

  return roleProfiles[roleKey];
}
