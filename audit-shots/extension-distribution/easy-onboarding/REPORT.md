# Easy onboarding audit

- Public artifact: `/downloads/lens-everywhere-chrome-v1.0.0.zip`
- Three-screen, skippable first run: passed at 360px
- Local no-account path and one-confirm clean import: passed
- Signed-in login invokes automatic library refresh: covered by worker contract
- Persistent selection and explicit GO boundary: passed
- Preview-before-mutation and verified insertion: passed
- Reduced-motion and keyboard-visible styles: present
- Automated checks: 12 passed, 0 failed

The funnel follows the dominant patterns used by Grammarly, Notion Web Clipper,
Loom, 1Password, and Readwise: one install action, a short first run, equal
sign-in/local choices, useful defaults, and progressive disclosure. The
unavoidable exception is installation: Chrome cannot install an unpacked ZIP
from a website. One-click **Add Pearl to Chrome** activates only after a real
Chrome Web Store URL is configured; until then the honest three-step manual
setup remains.
