const DEDICATED_ENVIRONMENT = Object.freeze({
  NITRO_HOST: "127.0.0.1",
  NITRO_PORT: "14600",
  AIR_GUARD_EXTERNAL_EFFECTS: "deny",
});

for (const [name, expected] of Object.entries(DEDICATED_ENVIRONMENT)) {
  const current = process.env[name];
  if (current && current !== expected) {
    throw new Error(`${name} conflicts with the dedicated UI server.`);
  }
  process.env[name] = expected;
}

await import("../.output/server/index.mjs");
