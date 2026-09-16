/**
 * VEIL™ — Jest ?raw transform
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Vite resolves `import x from './file.html?raw'` to the file's text; Jest has
 * no such loader. moduleNameMapper strips the `?raw` query and this transform
 * hands back the file text as the default export, preserving Vite semantics.
 */
module.exports = {
  process(sourceText) {
    return {
      code: `module.exports = ${JSON.stringify(sourceText)};`,
    };
  },
};
