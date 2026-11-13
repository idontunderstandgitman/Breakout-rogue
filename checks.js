// node checks.js
const fs = require("fs");
const files = fs.readdirSync("./src/i18n/");
for (let filename of files) {
  if (!filename.endsWith(".json")) continue;
  const content = JSON.parse(fs.readFileSync(`./src/i18n/${filename}`));
  for (let key in content) {
    if (
      content[key].match(/<|>|http|\bpuck\b|\bpalet\b|퍽|шайба|冰球|rondelle/gi)
    ) {
      content[key] = "";
      console.info(`Removed ${key} of ${filename}`);
    }
    content[key] = content[key].trim();
  }
  fs.writeFileSync(
    `./src/i18n/${filename}`,
    JSON.stringify(content, null, 4) + "\n",
  );
}
