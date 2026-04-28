import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const dynamic = "force-dynamic";

const CLAUDE_MODELS = ["sonnet", "opus", "haiku"];
const GEMINI_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"];

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

async function getKiloModels(): Promise<string[]> {
  const { code, stdout } = await runCommand("kilo", ["models"]);
  if (code !== 0 || !stdout) return [];
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cli = searchParams.get("cli") ?? "claude";

  let models: string[];
  switch (cli) {
    case "claude":
      models = CLAUDE_MODELS;
      break;
    case "kilo":
      models = await getKiloModels();
      if (models.length === 0) models = ["default"];
      break;
    case "gemini":
      models = GEMINI_MODELS;
      break;
    default:
      models = ["default"];
  }

  return NextResponse.json({ models });
}
