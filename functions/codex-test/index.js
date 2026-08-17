import "../modules/firebase.init.js";
import { resolveExternalEffectsPolicy } from "../modules/utils/externalEffectsPolicy.js";

process.env.AIR_GUARD_EXTERNAL_EFFECTS = "deny";
resolveExternalEffectsPolicy();

export * from "../apis/index.js";
