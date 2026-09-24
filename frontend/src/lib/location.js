// Resolves { lat, lng, accuracy (metres), capturedAt (epoch seconds) }.
// Rejects with { code: 'denied' | 'unavailable' | 'timeout' | 'unsupported' }.
export function getLocation() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject({ code: 'unsupported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          capturedAt: Math.floor(position.timestamp / 1000),
        }),
      (error) =>
        reject({ code: error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable' }),
      // A fresh, high-accuracy fix: a cached position would defeat the point of the check.
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}
