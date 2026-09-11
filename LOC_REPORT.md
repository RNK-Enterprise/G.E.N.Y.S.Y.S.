# AXIS Platform — LOC Report
**Generated:** 2026-05-19  
**LOC Cap:** 500 lines per file  
**Scope:** All files, excluding `target/` and `node_modules/`

---

## [ROOT]

| File | LOC | Status |
|---|---|---|
| .gitignore | 21 | OK |
| AGENTS.md | 4 | OK |
| package.json | 37 | OK |
| package-lock.json | 5,747 | AUTO-GENERATED — EXEMPT |
| vite.config.js | 20 | OK |
| README.md | 314 | OK |

---

## docs/

| File | LOC | Status |
|---|---|---|
| ATLAS_AXIS_WIRING_PLAN.md | 177 | OK |
| ATLAS_CAPABILITY_CATALOG.md | 201 | OK |
| ATLAS_MANIFEST_SCHEMA.md | 104 | OK |
| AXIS_IMPLEMENTATION_CHECKLIST.md | 55 | OK |
| AXIS_SURFACE_MAP.md | 122 | OK |
| DOMAIN_AI_AUTOMATION_SYNC.md | 73 | OK |
| DOMAIN_BROWSER_SECURITY.md | 59 | OK |
| DOMAIN_COMMUNICATION_PRODUCTIVITY.md | 64 | OK |
| DOMAIN_DEVELOPER_ACCESSIBILITY_CLOUD.md | 73 | OK |
| DOMAIN_MEDIA_EXTENSIONS.md | 60 | OK |
| DOMAIN_RUNTIME_PERFORMANCE.md | 54 | OK |
| ENGINE_INTEGRATION_MAP.md | 109 | OK |
| MASTER_ATLAS_ROADMAP.md | 92 | OK |
| PHASE_1_CORE_BROWSER.md | 389 | OK |
| PHASE_2_PERFORMANCE_OPTIMIZATION.md | 57 | OK |
| PHASE_3_COMMUNICATION_SUITE.md | 618 | ⚠ OVER CAP |
| PHASE_4_POLISH_INTEGRATION.md | 441 | OK |
| POLISH_COMPLETE.md | 445 | OK |
| QUICK_START.md | 106 | OK |
| TECHNICAL_SPECIFICATION.md | 332 | OK |
| TESTING_CHECKLIST.md | 172 | OK |
| TESTING_GUIDE.md | 136 | OK |

---

## public/

| File | LOC | Status |
|---|---|---|
| atlas-manifest.json | 328 | OK |

---

## src/

| File | LOC | Status |
|---|---|---|
| axis-auth-gate.js | 139 | OK |
| bookmark-manager.js | 96 | OK |
| download-manager.js | 105 | OK |
| history-manager.js | 85 | OK |
| index.html | 633 | ⚠ OVER CAP |
| lisa-bridge.js | 659 | ⚠ OVER CAP |
| main.js | 6,254 | ⚠ OVER CAP — CRITICAL |
| settings-manager.js | 107 | OK |
| styles.css | 3,147 | ⚠ OVER CAP |

---

## src-tauri/

| File | LOC | Status |
|---|---|---|
| build.rs | 3 | OK |
| Cargo.lock | 4,212 | AUTO-GENERATED — EXEMPT |
| Cargo.toml | 27 | OK |
| tauri.conf.json | 67 | OK |

---

## src-tauri/icons/

| File | LOC | Status |
|---|---|---|
| 128x128.png | 1 | OK |
| 128x128@2x.png | 1 | OK |
| 32x32.png | 1 | OK |
| icon.icns | 1 | OK |
| icon.ico | 8 | OK |

---

## src-tauri/src/

| File | LOC | Status |
|---|---|---|
| main.rs | 415 | OK |

---

## Over-Cap Violations (Actionable)

| File | LOC | Overage | Priority |
|---|---|---|---|
| src/main.js | 6,254 | +5,754 | CRITICAL — split into modules |
| src/styles.css | 3,147 | +2,647 | HIGH — split by component/domain |
| src/lisa-bridge.js | 659 | +159 | MEDIUM |
| src/index.html | 633 | +133 | MEDIUM |
| docs/PHASE_3_COMMUNICATION_SUITE.md | 618 | +118 | LOW — documentation file |

> `package-lock.json` (5,747) and `src-tauri/Cargo.lock` (4,212) are auto-generated — exempt from cap.
