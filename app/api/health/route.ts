import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import os from "node:os";

export const dynamic = "force-dynamic";

interface CliStatus {
  installed: boolean;
  version: string | null;
  ready: boolean;
  authInfo: string | null;
}

function runCommand(
  command: string,
  args: string[],
): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    let stdout = "";
    proc.stdout?.setEncoding("utf8");
    proc.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    proc.on("error", () => resolve({ code: 1, stdout: "" }));
    proc.on("close", (code) => resolve({ code, stdout: stdout.trim() }));
  });
}

async function checkVersion(
  command: string,
): Promise<{ installed: boolean; version: string | null }> {
  const { code, stdout } = await runCommand(command, ["--version"]);
  if (code === 0 && stdout) {
    return { installed: true, version: stdout.split("\n")[0] };
  }
  return { installed: false, version: null };
}

async function checkClaude(): Promise<CliStatus> {
  const ver = await checkVersion("claude");
  if (!ver.installed) return { ...ver, ready: false, authInfo: null };
  const { stdout } = await runCommand("claude", ["auth", "status"]);
  try {
    const data = JSON.parse(stdout) as { loggedIn?: boolean; authMethod?: string };
    if (data.loggedIn) {
      return { ...ver, ready: true, authInfo: data.authMethod ?? "authenticated" };
    }
  } catch {
    // Non-JSON output or parse error
  }
  return { ...ver, ready: false, authInfo: null };
}

async function checkKilo(): Promise<CliStatus> {
  const ver = await checkVersion("kilo");
  if (!ver.installed) return { ...ver, ready: false, authInfo: null };
  const { code, stdout } = await runCommand("kilo", ["auth", "list"]);
  if (code === 0 && /credentials?/i.test(stdout)) {
    return { ...ver, ready: true, authInfo: "api" };
  }
  return { ...ver, ready: false, authInfo: null };
}

async function checkGemini(): Promise<CliStatus> {
  const ver = await checkVersion("gemini");
  if (!ver.installed) return { ...ver, ready: false, authInfo: null };

  // Check env var first (fastest)
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return { ...ver, ready: true, authInfo: "api_key" };
  }

  // Try a quick prompt with a timeout. If Gemini responds, auth works.
  // If it hangs (trying to open browser for login), auth is not set up.
  const ready = await new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      if (!proc.killed) proc.kill("SIGTERM");
      resolve(false);
    }, 15000);
    const proc = spawn("gemini", ["-p", "hi", "--output-format", "json", "--skip-trust"], {
      cwd: os.homedir(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      env: { ...process.env, NO_BROWSER: "true", GEMINI_CLI_TRUST_WORKSPACE: "true" },
    });
    let gotOutput = false;
    proc.stdout?.on("data", () => { gotOutput = true; });
    proc.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code === 0 && gotOutput);
    });
    proc.on("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });

  return { ...ver, ready, authInfo: ready ? "oauth" : null };
}

export async function GET() {
  const [claude, kilo, gemini] = await Promise.all([
    checkClaude(),
    checkKilo(),
    checkGemini(),
  ]);
  return NextResponse.json({ claude, kilo, gemini });
}
