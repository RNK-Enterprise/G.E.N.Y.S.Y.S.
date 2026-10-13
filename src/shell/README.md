# GENYSYS shell modules

Chrome bindings, section navigation, sidebar rendering, spotlight, and DOM helpers extracted from the original main.js. Bound by ID via `bindClickHandlers` (silent-skip on missing elements — markup must exist before these run).

`settings-panel-render.js` must stay first in `main.js`'s import order: it injects `settings-panel.html` into the shell, and later modules (`density-surfaces.js`) fill slots inside it at module-eval time.
