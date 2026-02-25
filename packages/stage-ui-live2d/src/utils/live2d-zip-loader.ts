import type { ModelSettings } from 'pixi-live2d-display/cubism4'

import JSZip from 'jszip'

import { Cubism4ModelSettings, ZipLoader } from 'pixi-live2d-display/cubism4'

ZipLoader.zipReader = (data: Blob, _url: string) => JSZip.loadAsync(data)

const defaultCreateSettings = ZipLoader.createSettings
ZipLoader.createSettings = async (reader: JSZip) => {
  const filePaths = Object.keys(reader.files)

  if (!filePaths.find(file => isSettingsFile(file))) {
    return createFakeSettings(filePaths)
  }

  return defaultCreateSettings(reader)
}

export function isSettingsFile(file: string) {
  return file.endsWith('model3.json')
}

export function isMocFile(file: string) {
  return file.endsWith('.moc3')
}

export function basename(path: string): string {
  // https://stackoverflow.com/a/15270931
  return path.split(/[\\/]/).pop()!
}

// copy and modified from https://github.com/guansss/live2d-viewer-web/blob/f6060b2ce52c2e26b6b61fa903c837fe343f72d1/src/app/upload.ts#L81-L142
function createFakeSettings(files: string[]): ModelSettings {
  const mocFiles = files.filter(file => isMocFile(file))
  const moc2Files = files.filter(file => file.endsWith('.moc') && !file.endsWith('.moc3'))
  const hasModel2 = files.some(f => f.endsWith('model2.json'))

  if (mocFiles.length !== 1) {
    const fileList = mocFiles.length ? `(${mocFiles.map(f => `"${f}"`).join(',')})` : ''
    let hint = ''
    if (moc2Files.length > 0 || hasModel2)
      hint = ' This looks like a Cubism 2 model (.moc / model2.json); only Cubism 3/4 (.moc3 / model3.json) is supported.'
    else if (mocFiles.length === 0)
      hint = ' No .moc3 file found; ensure the zip contains a Cubism 3/4 model.'
    throw new Error(`Expected exactly one .moc3 file, got ${mocFiles.length} ${fileList}.${hint}`)
  }

  const mocFile = mocFiles[0]
  const modelName = basename(mocFile).replace(/\.moc3?/, '')

  const textures = files.filter(f => f.endsWith('.png'))

  if (!textures.length) {
    throw new Error('Textures not found')
  }

  const motions = files.filter(f => f.endsWith('.mtn') || f.endsWith('.motion3.json'))
  const physics = files.find(f => f.includes('physics'))
  const pose = files.find(f => f.includes('pose'))

  const settings = new Cubism4ModelSettings({
    url: `${modelName}.model3.json`,
    Version: 3,
    FileReferences: {
      Moc: mocFile,
      Textures: textures,
      Physics: physics,
      Pose: pose,
      Motions: motions.length
        ? {
            '': motions.map(motion => ({ File: motion })),
          }
        : undefined,
    },
  })

  settings.name = modelName;

  // provide this property for FileLoader
  (settings as any)._objectURL = `example://${settings.url}`

  return settings
}

function normalizeSlash(p: string) {
  return p.replace(/\\/g, '/')
}

/** Get the first path segment from zip keys (e.g. "Nicole" from "Nicole\\Nicole.model3.json") */
function getZipRootFolder(jsZip: JSZip): string | null {
  for (const key of Object.keys(jsZip.files)) {
    const sep = key.includes('/') ? '/' : key.includes('\\') ? '\\' : null
    if (sep) {
      const seg = key.split(sep)[0]
      if (seg) return seg
    }
  }
  return null
}

/**
 * Find a file in the zip by path. Tries multiple strategies so both nested (Nicole/Nicole.8192/...)
 * and flat (Nicole.8192/...) zips work, Windows backslash paths are matched, and URI-encoded
 * filenames (e.g. "black%20face.exp3.json") match zip entries with decoded names ("black face.exp3.json").
 */
function findZipEntry(jsZip: JSZip, path: string) {
  const pathNorm = normalizeSlash(path)
  const pathDecoded = normalizeSlash(safeDecodeURIComponent(path))

  const pathsToTry = pathNorm !== pathDecoded ? [pathNorm, pathDecoded] : [pathNorm]
  for (const p of pathsToTry) {

    // 1) As-is (or decoded)
    let file = jsZip.file(p)
    if (file) return file

    // 2) Other path separator (Windows zip often has backslash)
    const altPath = p.replace(/\//g, '\\')
    file = jsZip.file(altPath)
    if (file) return file

    // 3) With first segment stripped (e.g. "Nicole/Nicole.8192/tex" -> "Nicole.8192/tex") for flat zip
    const firstSlash = p.indexOf('/')
    if (firstSlash > 0) {
      const withoutFirst = p.slice(firstSlash + 1)
      file = jsZip.file(withoutFirst) ?? jsZip.file(withoutFirst.replace(/\//g, '\\'))
      if (file) return file
    }

    // 4) Prepend zip root folder (zip has "Nicole\Nicole.8192\texture_00.png", library may ask "Nicole.8192/texture_00.png")
    const root = getZipRootFolder(jsZip)
    if (root) {
      file = jsZip.file(`${root}/${p}`) ?? jsZip.file(`${root}\\${p}`)
      if (file) return file
    }

    // 5) Fallback: match by normalized path suffix (library may pass "Nicole.8192/texture_00.png", zip has "Nicole/Nicole.8192/texture_00.png")
    for (const key of Object.keys(jsZip.files)) {
      const entry = jsZip.files[key]
      if (entry.dir) continue
      const keyNorm = normalizeSlash(key)
      if (keyNorm === p || keyNorm.endsWith(p) || p.endsWith(keyNorm)) return entry
    }

    // 6) Case-insensitive: some zips use "Nicole" vs "nicole" or "Nicole.8192" vs "nicole.8192"
    const pLower = p.toLowerCase()
    const pBasename = basename(p)
    const pBasenameLower = pBasename.toLowerCase()
    for (const key of Object.keys(jsZip.files)) {
      const entry = jsZip.files[key]
      if (entry.dir) continue
      const keyNorm = normalizeSlash(key)
      const keyLower = keyNorm.toLowerCase()
      const keyBasename = basename(keyNorm)
      if (keyLower === pLower || keyLower.endsWith(pLower) || pLower.endsWith(keyLower)) return entry
      if (keyBasename.toLowerCase() === pBasenameLower) return entry
    }
  }

  return null
}

function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

ZipLoader.readText = (jsZip: JSZip, path: string) => {
  const file = findZipEntry(jsZip, path)

  if (!file) {
    const sampleKeys = Object.keys(jsZip.files).filter(k => !jsZip.files[k].dir).slice(0, 15)
    console.warn('[Live2D zip] Cannot find file:', path, '| Zip entries (sample):', sampleKeys)
    throw new Error(`Cannot find file: ${path}`)
  }

  return file.async('text')
}

ZipLoader.getFilePaths = (jsZip: JSZip) => {
  const paths: string[] = []

  jsZip.forEach(relativePath => paths.push(relativePath))

  return Promise.resolve(paths)
}

ZipLoader.getFiles = (jsZip: JSZip, paths: string[]) =>
  Promise.all(paths.map(
    async (path) => {
      const fileName = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
      const file = findZipEntry(jsZip, path)
      if (!file) {
        const sampleKeys = Object.keys(jsZip.files).filter(k => !jsZip.files[k].dir).slice(0, 15)
        console.warn('[Live2D zip] Cannot find file:', path, '| Zip entries (sample):', sampleKeys)
        throw new Error(`Cannot find file in zip: ${path}`)
      }
      const blob = await file.async('blob')
      return new File([blob], fileName)
    },
  ))
