// Reads when (and, if the camera saved it, where) a JPEG photo was taken, from its hidden EXIF
// data. This runs on the reporter's phone before toJpeg() strips that data, and the result is
// only sent if the reporter ticks the box. Returns { takenAt, lat?, lng? } or null.
export async function readPhotoDetails(file) {
  try {
    const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (view.getUint16(0) !== 0xffd8) return null; // not a JPEG
    let offset = 2;
    while (offset + 10 < view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) return null;
      // APP1 segment starting with "Exif"
      if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) return readTiff(view, offset + 10);
      offset += 2 + view.getUint16(offset + 2);
    }
  } catch {
    // unreadable or unusual file: treat it as having no details
  }
  return null;
}

function readTiff(view, start) {
  const little = view.getUint16(start) === 0x4949;
  const u16 = (at) => view.getUint16(start + at, little);
  const u32 = (at) => view.getUint32(start + at, little);
  const ifd = (at) => {
    const tags = {};
    const count = u16(at);
    for (let i = 0; i < count; i++) {
      const entry = at + 2 + i * 12;
      tags[u16(entry)] = { count: u32(entry + 4), value: entry + 8 };
    }
    return tags;
  };
  const text = (tag) => {
    const at = tag.count > 4 ? u32(tag.value) : tag.value;
    let out = '';
    for (let i = 0; i < tag.count - 1; i++) out += String.fromCharCode(view.getUint8(start + at + i));
    return out;
  };
  const rationals = (tag) => {
    const at = u32(tag.value);
    return Array.from({ length: tag.count }, (_, i) => u32(at + i * 8) / u32(at + i * 8 + 4));
  };

  const main = ifd(u32(4));
  const details = {};

  if (main[0x8769]) {
    const exif = ifd(u32(main[0x8769].value));
    const taken = exif[0x9003] || exif[0x9004]; // DateTimeOriginal, DateTimeDigitized
    const m = taken && text(taken).match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
    if (m) {
      // The camera writes its own local time with no time zone; read it as the phone's local time
      const seconds = Math.floor(new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() / 1000);
      if (Number.isFinite(seconds) && seconds > 0 && seconds < Date.now() / 1000 + 86400) details.takenAt = seconds;
    }
  }

  if (main[0x8825]) {
    const gps = ifd(u32(main[0x8825].value));
    if (gps[1] && gps[2] && gps[3] && gps[4]) {
      const degrees = ([d, m, s]) => d + m / 60 + s / 3600;
      const ref = (tag) => String.fromCharCode(view.getUint8(start + tag.value));
      let lat = degrees(rationals(gps[2]));
      let lng = degrees(rationals(gps[4]));
      if (ref(gps[1]) === 'S') lat = -lat;
      if (ref(gps[3]) === 'W') lng = -lng;
      const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
      if (valid && !(lat === 0 && lng === 0)) Object.assign(details, { lat, lng });
    }
  }

  return Object.keys(details).length ? details : null;
}

// A link to the place on OpenStreetMap, for staff and for the reporter's own check
export const mapLink = ({ lat, lng }) =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

export const coords = ({ lat, lng }) => `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
