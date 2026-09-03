throw new Error(
  "Dedicated UI dev server is disabled: postal isolation requires " +
  "npm run test:local:ui:build followed by npm run test:local:ui:server:generated.",
);
