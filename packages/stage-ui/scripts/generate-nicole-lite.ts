/**
 * Generates Nicole (Lite) - a 4096 texture variant for lower GPU usage.
 * Run: pnpm exec tsx packages/stage-ui/scripts/generate-nicole-lite.ts
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const modelsRoot = join(__dirname, '..', 'src', 'assets', 'live2d', 'models', 'nicole')
const nicoleSrc = join(modelsRoot, 'Nicole')
const nicoleLiteDir = join(modelsRoot, 'Nicole-4096')
const nicoleLiteTexturesDir = join(nicoleLiteDir, 'Nicole.4096')

async function main() {
  await mkdir(nicoleLiteTexturesDir, { recursive: true })

  // Copy all non-texture files (moc3, physics3, cdi3, exp3.json)
  const files = await readdir(nicoleSrc)
  for (const file of files) {
    if (file === 'Nicole.8192' || file.endsWith('.png'))
      continue
    const srcPath = join(nicoleSrc, file)
    const destPath = join(nicoleLiteDir, file)
    const content = await readFile(srcPath)
    await writeFile(destPath, content)
  }

  // Create model3.json with 4096 texture paths
  const model3 = JSON.parse(await readFile(join(nicoleSrc, 'Nicole.model3.json'), 'utf-8'))
  model3.FileReferences.Textures = [
    'Nicole.4096/texture_00.png',
    'Nicole.4096/texture_01.png',
  ]
  await writeFile(
    join(nicoleLiteDir, 'Nicole.model3.json'),
    JSON.stringify(model3, null, 2),
  )

  // Downscale 8192 textures to 4096
  const textureSrc = join(nicoleSrc, 'Nicole.8192')
  for (const name of ['texture_00.png', 'texture_01.png']) {
    const srcPath = join(textureSrc, name)
    const destPath = join(nicoleLiteTexturesDir, name)
    const meta = await sharp(srcPath).metadata()
    const w = meta.width ?? 8192
    const h = meta.height ?? 8192
    await sharp(srcPath)
      .resize(Math.round(w / 2), Math.round(h / 2))
      .png()
      .toFile(destPath)
    console.log('Generated:', destPath)
  }

  console.log('Nicole (Lite) generated at', nicoleLiteDir)
}

main().catch(console.error)
