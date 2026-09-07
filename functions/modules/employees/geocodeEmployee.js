import { defineString } from "firebase-functions/params";
import { assertExternalEffectAllowed } from "../utils/externalEffectsPolicy.js";

// Employee addresses and coordinates must never enter logs, including provider errors.
export async function geocodeEmployee(address, { request = fetch, timeoutMs = 8000 } = {}) {
  assertExternalEffectAllowed("geocoding.fetch");
  const key = defineString("GEOCODING_API_KEY").value();
  if (!key) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await request(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(key)}`, { signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== "OK") return null;
    const result = data.results?.[0];
    return { lat: result?.geometry?.location?.lat, lng: result?.geometry?.location?.lng, formattedAddress: result?.formatted_address };
  } finally { clearTimeout(timeout); }
}
