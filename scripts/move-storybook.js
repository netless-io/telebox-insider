/**
 * Move storybook to sub-folder
 */

const shell = require("shelljs");
const path = require("path");
const fs = require("fs");

const storybookPath = path.join(__dirname, "..", "storybook-static");
shell.cd(storybookPath);

const artifacts = fs.readdirSync(storybookPath);

shell.mkdir("storybook");

for (const name of artifacts) {
    shell.mv(name, "storybook");
}

fs.writeFileSync(
    path.join(storybookPath, "index.html"),
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title> TeleBox Storybook </title>
  <meta http-equiv="refresh" content="0; url=/telebox/storybook/">
  <link rel="canonical" href="/telebox/storybook/" />
</head>
<body>
</body>
</html>
`,
);
