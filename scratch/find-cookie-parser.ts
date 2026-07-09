import fs from "fs";
import path from "path";

function searchDir(dir: string, pattern: RegExp) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath, pattern);
    } else if (file.endsWith(".js") || file.endsWith(".ts")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      if (pattern.test(content)) {
        console.log(`Found in: ${fullPath}`);
        const matches = content.match(pattern);
        if (matches) console.log(matches.slice(0, 5));
      }
    }
  }
}

searchDir("node_modules/@supabase/ssr", /auth-token|sb-|cookie/i);
