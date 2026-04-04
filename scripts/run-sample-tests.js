import { computeScore, extractExperience, extractName, extractSkillsFromText } from "../src/shared/resumeParser.js";
import { getRoleProfile } from "../src/shared/roles.js";

const sampleText = `
Rahul Sharma
Senior Software Engineer
Experience: 5 years
Skills: AWS, Lambda, Node.js, JavaScript, DynamoDB, REST API
`;

const requiredSkills = ["aws", "lambda", "node.js", "react"];

const assertions = [
  {
    name: "extractName returns the candidate name",
    pass: extractName(sampleText) === "Rahul Sharma"
  },
  {
    name: "extractExperience detects years",
    pass: extractExperience(sampleText) === "5 years"
  },
  {
    name: "extractSkillsFromText finds AWS",
    pass: extractSkillsFromText(sampleText, requiredSkills).includes("aws")
  },
  {
    name: "computeScore calculates percentage correctly",
    pass: computeScore(["aws", "lambda", "node.js"], requiredSkills) === 75
  },
  {
    name: "getRoleProfile returns a predefined role",
    pass: getRoleProfile("cloud_engineer").requiredSkills.includes("aws")
  }
];

const failed = assertions.filter((assertion) => !assertion.pass);

if (failed.length) {
  console.error("Sample tests failed:");
  failed.forEach((assertion) => console.error(`- ${assertion.name}`));
  process.exit(1);
}

console.log("All sample tests passed.");
