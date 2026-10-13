/**
 * GENYSYS™ — spotlight suggestion builders
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

window.genysysSpotlightPush = function genysysSpotlightPush(suggestions, cond, item) {
  if (cond) suggestions.push(item);
};

window.genysysSpotlightCaps = function genysysSpotlightCaps(id) {
  return window.isGENYSYSCapabilityAvailable?.(id);
};
