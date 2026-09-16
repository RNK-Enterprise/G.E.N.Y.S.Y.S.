# Workflows

- `verify.yml` — every push: global audit → jest → playwright → cargo test, then `verify-live` (compositor-level tab proof under Xvfb) and `package` (.deb/.rpm/AppImage + smoke suite) as independent required-check-attachable jobs.
- `release.yml` — tag-triggered bundle release; notes regenerate via API on tag re-push.
