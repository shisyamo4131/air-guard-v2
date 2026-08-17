import "../modules/firebase.init.js";
import { resolveExternalEffectsPolicy } from "../modules/utils/externalEffectsPolicy.js";

resolveExternalEffectsPolicy();

export * from "../apis/index.js";
