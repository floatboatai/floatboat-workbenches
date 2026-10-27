# Presenton 工作台

For people preparing presentations from source material and a per-slide narrative. The workbench provides an offline production plan and a server-side connector to a separately operated Presenton instance.

- Edit source text/Markdown, audience, objective, per-slide title and Markdown, speaker notes and review state. Add, reorder and remove slides with confirmation. Persist the entire working copy, including incomplete slides and unparsed import text.
- Review a focused outline stage and numbered slide sequence. The stage is a text planning preview; it does not claim to render the generated PPTX/PDF layout.
- Configure language, Presenton template, tone, density, instructions, title/contents slides, web search and PPTX/PDF output. Generation uses the real Presenton async endpoint and sends the full saved input snapshot.
- Save an operation before submission. Keep task IDs, input, source origin, state and output durably in SQLite. Never resubmit an unknown operation automatically. Reconcile via the original task ID; stop tracking does not stop upstream model execution.
- Import portable projects, autosave recovery exports, Presenton generation responses/async tasks and PresentationWithSlides JSON as new documents. Preserve the original response; render imported content as inert text. Read an existing presentation from the configured service into a new document.
- Cache actual generated PPTX/PDF bytes in a declared data resource and download through constrained same-origin routes. Export portable JSON and Markdown outlines locally. Export an existing upstream presentation without regenerating its content.
- Keep ongoing results separate from manual edits. No imported HTML, external editor iframe, homemade PPTX generator, Host LLM fallback or simulated successful generation.

Acceptance: contracts and durable SQLite behavior, save/reload, delayed/lost save responses, incomplete draft recovery, import as new document, conflict protection, request/response bounds, safe download origin, desktop/mobile, keyboard, reduced motion and truthful disconnected status. Real model generation and Host installation are separate acceptance gates and are unverified without those environments.
