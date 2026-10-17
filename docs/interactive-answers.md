# Interactive learning answers

Curve can generate working diagrams, charts, comparisons, and calculators alongside source-grounded explanations. After completing the diagnostic, ask Curve to explain a topic with an interactive diagram or calculator. The explanation tab shows the visual, text, and source citations. The associated chat reply has a button to reopen its visual. Reset restores the initial controls; Expand gives the visual more space.

This adapts the sandboxed generative UI pattern from [OpenIntelligentUI](https://github.com/CopilotKit/OpenIntelligentUI) to the existing React / Supabase agent. It uses the configured model via `callMetaJSON`; it does not install CopilotKit or require a separate Python service or new provider keys.

`explain` can return an optional `{html, css, js}` payload. The server validates field types and size limits after verifying source citations. Existing saved explanations remain compatible. The payload persists in the existing explanation artifact JSON, so no schema migration is needed. Deploy the updated `workspace-agent` function with the frontend to enable generation.

The browser strips active markup and URL attributes before rendering inside an opaque-origin iframe with only `allow-scripts`. CSP blocks fetches and external resource loads, external scripts, nested frames, forms, and objects. The sandbox prevents access to the app origin and top-level navigation; it does not prevent a generated script from navigating its own iframe, so treat visuals as untrusted generated content. There is no host action bridge. Runtime failures show a fallback while preserving the explanation. Visual content is model generated and still needs the same educational accuracy review as generated prose; verified citation quotes do not prove every generated formula is correct.

Run `npm run test:interactive-ui`, `npm run test:learning`, and `npm run build`. The local browser fixture at `/tests/interactive-answer.html` exercises a working slider, reset, expansion, and runtime failure. Independent checks continue to block the explanation tool.
