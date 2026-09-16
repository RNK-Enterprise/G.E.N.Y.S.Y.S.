# Stylesheet modules

Split from the former 4,809-line `src/styles.css` under the 500 LOC cap. The cuts follow the file's own section comments; concatenation in manifest order is byte-identical to the original.

`src/styles.css` is the `@import` manifest — module order equals cascade order. Do not reorder without re-verifying specificity-dependent rules; do not add a rule here that assumes a module loaded later.
