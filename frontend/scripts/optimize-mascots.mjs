import { readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "../..");
const sourceDir = join(projectRoot, "photos");
const outputDir = join(scriptDir, "../public/photos");
const maxBytes = 150 * 1024;
const pngQualities = [80, 68, 56, 44];

await mkdir(outputDir, { recursive: true });

const sourceNames = (await readdir(sourceDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
  .map((entry) => entry.name)
  .sort();

if (sourceNames.length === 0) {
  throw new Error(`No PNG mascot images found in ${sourceDir}.`);
}

for (const name of sourceNames) {
  const sourcePath = join(sourceDir, name);
  const outputPath = join(outputDir, name);
  const webpPath = join(outputDir, name.replace(/\.png$/, ".webp"));
  const image = sharp(sourcePath).rotate().resize({
    width: 512,
    height: 512,
    fit: "inside",
    withoutEnlargement: true,
  });

  let pngOutput;
  for (const quality of pngQualities) {
    pngOutput = await image.clone().png({
      palette: true,
      quality,
      effort: 10,
      colours: 96,
      dither: 0.5,
    }).toBuffer();
    if (pngOutput.length <= maxBytes) break;
  }
  if (pngOutput.length > maxBytes) {
    throw new Error(`${name} could not be optimized below 150 KB (${Math.ceil(pngOutput.length / 1024)} KB).`);
  }

  const webpOutput = await image.clone().webp({ quality: 78, effort: 6, alphaQuality: 85 }).toBuffer();
  if (webpOutput.length > maxBytes) {
    throw new Error(`${name.replace(/\.png$/, ".webp")} exceeds the 150 KB target.`);
  }

  await Promise.all([
    writeFile(outputPath, pngOutput),
    writeFile(webpPath, webpOutput),
  ]);
  console.log(`${name}: ${Math.ceil(pngOutput.length / 1024)} KB PNG, ${Math.ceil(webpOutput.length / 1024)} KB WebP`);
}
