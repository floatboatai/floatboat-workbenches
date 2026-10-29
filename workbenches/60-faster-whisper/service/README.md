# faster-whisper companion service

This optional process is independent from the Node workbench package. It runs the actual Python `faster_whisper.WhisperModel` with CPU INT8 and a single inference worker. Install the pinned `requirements.txt` in a private Python 3.12 virtual environment; see the project README for commands. No Docker or globally installed Python packages are needed.

## Contract

- `GET /health` returns `{engine:"faster-whisper",model}`. This confirms the job service is reachable; the first model load can still fail and is reported on the job.
- `GET /health` also returns `protocol: 2`, `multilingual` and the engine version. The workbench treats a service without `protocol: 2` as outdated.
- `PUT /v1/jobs/<uuid>?language=auto|zh|yue|en|...&options=<json>` submits raw audio bytes, maximum 200 MB, with `X-Audio-Sha256`. `options` may contain only `task` (`transcribe`/`translate`), `word_timestamps`, `vad_filter`, `min_silence_duration_ms` (100–5000), `beam_size` (1–10), `initial_prompt` (≤800 chars), `hotwords` (≤400 chars) and `condition_on_previous_text`; anything else is rejected. They are passed to `WhisperModel.transcribe()` unchanged (VAD silence via `vad_parameters`). A fixed ID plus identical audio, language and normalised options returns the same job. Different input for an existing ID returns 409.
- `GET /v1/jobs/<uuid>` reads its durable status, the normalised `options`, and for completed jobs `segments` with `start`, `end`, `text` and, when requested, `words` (`start`, `end`, `word`, `probability`), plus `info` (`language`, `language_probability`, `duration`, `duration_after_vad`).
- `POST /v1/jobs/<uuid>/cancel` cancels queued work or requests cooperative cancellation for running work. A terminal result is not changed.
- Job responses include `id`, `audioSha256`, `language` and `options`; the Node connector verifies all four against its captured input before accepting a result.

`queued → running → completed|failed|cancelled`; a service restart converts `running` to `interrupted`. Each job captures its model, compute mode and engine version; queued work is rejected if the configuration changes before execution. Existing results retain their original model identity. The queue has no public endpoint for arbitrary URLs or local file paths. It persists input audio under generated IDs; imports are decoded by PyAV, not shell commands. The model is selected by the administrator at service startup, not by arbitrary browser requests.

The Node connector keeps its own operation record before its first HTTP request. A lost response becomes `unknown`; reconciliation reads the original remote job. Explicit retry resends the same immutable input and ID. HTTP 4xx rejections are terminal failures. New model results are accepted into a new workbench project.

## Local access and deployment

Default bind: `127.0.0.1:8768`. Browser `Origin` requests are rejected; without a configured token, Host must be a loopback hostname. Non-loopback binding requires `FASTER_WHISPER_TOKEN`, supplied to the workbench server as well. Configure transport security and access boundaries if deploying remotely; this is a single-user companion service, not a tenant-isolated platform.

The service reads `--data`, `--cache`, `--model`, `--compute`, `--port`, `--host`. `--model` accepts a supported upstream model name or a prepared local model directory. Use a fixed model revision/cache for reproducible deployment; model weights and their license are not bundled here. CPU is the implemented device path; GPU enablement is outside this adapter.

Cancellation does not force-stop a CTranslate2 call or model download. It prevents subsequently produced segments/results from being adopted. The worker resumes queued work after a restart, but interrupted in-flight work remains explicitly interrupted.

## Verification

```sh
.local/whisper-service/bin/python -m unittest discover -s service -p 'test_*.py'
```

These 7 tests cover durable submission, duplicates, conflicts (including different options), option validation, English-only model limits, cancellation and restart. They do not invoke models. The separate real model (small, 0.9.0; tiny.en, 0.4.0) browser acceptance is recorded in the workbench ACCEPTANCE.md.
