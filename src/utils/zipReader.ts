// Pure-browser ZIP reader supporting Store (method 0) and Deflate (method 8 via DecompressionStream)

const IGNORED_SEGMENTS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.DS_Store',
  '__MACOSX',
]);

const BINARY_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'woff',
  'woff2',
  'ttf',
  'eot',
  'mp3',
  'wav',
  'ogg',
  'mp4',
  'webm',
  'zip',
  'tar',
  'gz',
  'exe',
  'dll',
  'so',
  'dylib',
  'pdf',
]);

function shouldIgnorePath(path: string): boolean {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return true;
  if (parts.some((p) => IGNORED_SEGMENTS.has(p))) return true;
  const ext = parts[parts.length - 1].split('.').pop()?.toLowerCase() || '';
  if (parts[parts.length - 1].includes('.') && BINARY_EXTENSIONS.has(ext)) {
    return true;
  }
  return false;
}

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Tarayıcı Deflate sıkıştırmasını çözmeyi desteklemiyor.');
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const writePromise = writer.write(new Uint8Array(compressed)).then(() => writer.close());
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  await writePromise;

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function stripCommonRoot(files: Record<string, string>): Record<string, string> {
  const keys = Object.keys(files);
  if (keys.length === 0) return files;
  const firstSegments = keys.map((k) => k.split('/')[0]);
  const allHaveSlash = keys.every((k) => k.includes('/'));
  const candidate = firstSegments[0];
  if (allHaveSlash && firstSegments.every((s) => s === candidate)) {
    const out: Record<string, string> = {};
    for (const k of keys) {
      out[k.slice(candidate.length + 1)] = files[k];
    }
    return out;
  }
  return files;
}

export async function parseZipArrayBuffer(buffer: ArrayBuffer): Promise<Record<string, string>> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8', { fatal: false });

  // End of Central Directory (EOCD: 0x06054b50) imzasını sondan ara
  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 65558);
  for (let i = bytes.length - 22; i >= minOffset; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Geçerli bir ZIP arşivi bulunamadı (EOCD eksik).');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);

  const rawFiles: Record<string, string> = {};
  let ptr = centralOffset;

  for (let i = 0; i < totalEntries; i += 1) {
    if (ptr + 46 > bytes.length || view.getUint32(ptr, true) !== 0x02014b50) {
      break;
    }
    const method = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const fileName = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen)).replace(/\\/g, '/');
    ptr += 46 + nameLen + extraLen + commentLen;

    if (fileName.endsWith('/') || shouldIgnorePath(fileName)) {
      continue;
    }

    if (localHeaderOffset + 30 > bytes.length || view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      continue;
    }
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedSlice = bytes.subarray(dataStart, dataStart + compressedSize);

    let fileBytes: Uint8Array;
    if (method === 0) {
      fileBytes = compressedSlice;
    } else if (method === 8) {
      fileBytes = await inflateRawBytes(compressedSlice);
    } else {
      continue;
    }

    if (fileBytes.length > 512_000) continue; // Çok büyük dosyaları atla
    rawFiles[fileName] = decoder.decode(fileBytes);
  }

  return stripCommonRoot(rawFiles);
}
