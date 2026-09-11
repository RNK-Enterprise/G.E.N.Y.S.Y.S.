/**
 * Axis™ — spotlight suggestion builders
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

window.axisSpotlightPush = function axisSpotlightPush(suggestions, cond, item) {
  if (cond) suggestions.push(item);
};

window.axisSpotlightCaps = function axisSpotlightCaps(id) {
  return window.isAxisCapabilityAvailable?.(id);
};
