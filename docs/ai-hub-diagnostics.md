# Exporting an AI Hub Builder diagnostic

After a generation succeeds, fails or is cancelled, click **Download full diagnostic** in the AI Hub Builder. Send the downloaded `ai-hub-diagnostic-<timestamp>.json` file with your feedback. There is no need to copy individual output panels or enable Phi. Export does not run another model call.

The original request and settings are captured when generation starts. Applying the proposal, clearing the prompt, unloading the model or closing/reopening the builder does not erase the record. The latest run is retained in memory for the current tab; download before reloading the page or starting another generation. Runs made before this feature was installed cannot be reconstructed.

The versioned file includes:

- Run ID, timestamp, original instruction, create/edit mode, model and interpretation/review/Phi/thinking settings.
- Interpreter, generator, repair and reviewer requests and responses, schemas, usage, durations, errors and partial text from interrupted streams. Actual worker decoding settings are included when supplied by the worker.
- The structured design plan and thinking status/timing. Internal planning drafts are omitted, including their insertion into subsequent prompts.
- The starting editor layout, creation scaffold, compiled candidates, local recovery trials, published proposal and current editor layout. Account/user records are excluded.
- Validation results, preservation/request checks, local corrections, review feedback and stop reason.
- Browser-resolved colours, gradients, fonts, spacing, grid tracks, bounding boxes, inline styles and scoped stylesheets at render-review stages. Node sampling is capped at 1,000 and any omission is counted.
- Embedded 1280×720 PNG images of the baseline and published proposal (or last compiled candidate on failure). If applied, an additional current-editor capture is included. Captures are re-rendered at export time and labelled separately from measurements recorded during generation.
- Browser, viewport and WebGPU-availability information. This is not a GPU utilization/performance measurement.

Image capture has a twelve-second limit per layout. If an image fails, the JSON still downloads with the capture error and other evidence. When generation never compiled a candidate, its result image is explicitly unavailable. The entire export is local; no upload occurs automatically.

## Reading the evidence

Start with `run.instruction`, `run.settings`, `run.outcome` and `run.metrics`. Compare `run.calls[].response.raw` with the `compiled`, recovery and `published` entries in `run.stages`. The `computedStyles` evidence distinguishes intended CSS from browser-resolved styles. `captures.*.image` contains PNG data URLs, which can be extracted to image files for visual inspection. `editorAtExport` may contain later manual edits; `run.proposed` remains the exact published proposal.

## Regression checks

Node tests cover immutable snapshots, account exclusion, draft redaction, exact response retention, runtime failure, cancellation and independent runs. The Chrome harness supports `AI_QA_DIAGNOSTICS=1` alongside `AI_QA_CSS=1 AI_QA_NO_REVIEW=1 AI_QA_SINGLE=1 AI_QA_REPLAY=tests/fixtures/ai-item-grid-response.json`; it checks downloads after Apply and after closing/reopening. Add `AI_QA_DIAGNOSTIC_FAILURE=1` to inject malformed recorded output and verify failure diagnostics without applying changes. These are controlled-response integration checks, not live model benchmarks.
