/**
 * VEIL™ — spotlight suggestion builders
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

window.veilSpotlightPush = function veilSpotlightPush(suggestions, cond, item) {
  if (cond) suggestions.push(item);
};

window.veilSpotlightCaps = function veilSpotlightCaps(id) {
  return window.isVEILCapabilityAvailable?.(id);
};
