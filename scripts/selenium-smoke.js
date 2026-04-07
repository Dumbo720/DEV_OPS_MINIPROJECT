import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { Builder, By, until } from "selenium-webdriver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const frontendPort = process.env.FRONTEND_PORT || "4173";
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const screenshotPath = path.resolve(projectRoot, "test-results", "selenium-dashboard.png");

function waitForServer(processRef) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Frontend server did not start in time")), 15000);

    processRef.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.includes("Frontend server running")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    processRef.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.trim()) {
        console.error(text);
      }
    });

    processRef.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Frontend server exited early with code ${code}`));
    });
  });
}

async function createDriver() {
  const browserName = process.env.SELENIUM_BROWSER || "chrome";
  return new Builder().forBrowser(browserName).build();
}

const serverProcess = spawn(process.platform === "win32" ? "node.exe" : "node", ["scripts/serve-frontend.js"], {
  cwd: projectRoot,
  env: { ...process.env, FRONTEND_PORT: frontendPort },
  stdio: ["ignore", "pipe", "pipe"]
});

let driver;

try {
  await mkdir(path.resolve(projectRoot, "test-results"), { recursive: true });
  await waitForServer(serverProcess);

  driver = await createDriver();
  await driver.get(frontendUrl);
  await driver.wait(until.titleContains("ResumeAI"), 10000);

  await driver.findElement(By.id("apiBaseUrl"));
  await driver.findElement(By.id("roleSelect"));
  await driver.findElement(By.id("uploadBtn"));
  await driver.findElement(By.id("refreshBtn"));

  const roleSelect = await driver.findElement(By.id("roleSelect"));
  const options = await roleSelect.findElements(By.css("option"));
  if (options.length < 3) {
    throw new Error("Role dropdown did not render expected options");
  }

  const screenshot = await driver.takeScreenshot();
  await writeFile(screenshotPath, Buffer.from(screenshot, "base64"));
  console.log(`Selenium smoke test passed. Screenshot saved at ${screenshotPath}`);
} catch (error) {
  console.error("Selenium smoke test failed:", error.message);
  process.exitCode = 1;
} finally {
  if (driver) {
    await driver.quit();
  }
  serverProcess.kill();
}
