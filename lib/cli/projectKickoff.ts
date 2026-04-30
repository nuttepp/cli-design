import fs from "node:fs";
import path from "node:path";

export const PROJECT_KICKOFF_MD = fs.readFileSync(
  path.join(process.cwd(), "lib/cli/projectKickoff.md"),
  "utf8",
);

export const FIRST_TURN_DIRECTIVE = `\n\n${PROJECT_KICKOFF_MD}`;
