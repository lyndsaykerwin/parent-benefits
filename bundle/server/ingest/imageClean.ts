// Strips hidden details (EXIF: GPS location, time, phone model; comments) out of a JPEG, in code, on the server.
// The phone already redraws every photo onto a blank canvas, which drops them; this is the second lock, so nothing
// with location data is ever stored even if a client skips that step. Only the picture data itself is kept.

/** JPEG bytes without APPn (except the JFIF APP0) and comment segments. Throws when the file is not a JPEG or is damaged, so nothing unchecked is ever kept. */
export function stripJpegMetadata(input: Buffer): Buffer {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) throw new Error('not a JPEG');
  const out: Buffer[] = [input.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= input.length) {
    if (input[i] !== 0xff) throw new Error('damaged JPEG');
    const marker = input[i + 1];
    if (marker === 0xff) { i++; continue; } // fill byte
    if (marker === 0xda) { out.push(input.subarray(i)); return Buffer.concat(out); } // start of scan: the rest is picture data
    if (marker === 0xd9) { out.push(input.subarray(i)); return Buffer.concat(out); }
    if (marker >= 0xd0 && marker <= 0xd7 || marker === 0x01) { out.push(input.subarray(i, i + 2)); i += 2; continue; }
    const len = input.readUInt16BE(i + 2);
    const end = i + 2 + len;
    if (len < 2 || end > input.length) throw new Error('damaged JPEG');
    const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!drop) out.push(input.subarray(i, end));
    i = end;
  }
  out.push(input.subarray(i));
  return Buffer.concat(out);
}

/** True when the JPEG still carries an EXIF block (used by tests and as a last check before saving). */
export function hasExif(input: Buffer): boolean {
  let i = 2;
  while (i + 4 <= input.length && input[i] === 0xff) {
    const marker = input[i + 1];
    if (marker === 0xda || marker === 0xd9) return false;
    const len = input.readUInt16BE(i + 2);
    if (marker === 0xe1 && input.subarray(i + 4, i + 8).toString('latin1') === 'Exif') return true;
    i += 2 + len;
  }
  return false;
}
