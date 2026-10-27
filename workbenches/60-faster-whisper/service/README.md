# faster-whisper companion service

This optional process is independent from the Node workbench package. It runs the actual Python `faster_whisper.WhisperModel` with CPU INT8 and a single inference worker. Install the pinned `requirements.txt` in a private Python 3.12 virtual environment; see the project README for commands. No Docker or globally installed Python packages are needed.

## Contract

- `GET /health` returns `{engine:"faster-whisper",model}`. This confirms the job service is reachable; the first model load can still fail and is reported on the job.
- `PUT /v1/jobs/<uuid>?language=auto|en|zh|...` submits raw audio bytes, maximum 40 MB, with `X-Audio-Sha256`. A fixed ID plus identical audio and language returns the same job. Different input for an existing ID returns 409.
- `GET /v1/jobs/<uuid>` reads its durable status and completed `segments` with `start`, `end`, `text`.
- `POST /v1/jobs/<uuid>/cancel` cancels queued work or requests cooperative cancellation for running work. A terminal result is not changed.
- Job responses include `id`, `audioSha256` and `language`; the Node connector verifies all three against its captured input before accepting a result.

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

These tests cover durable submission, duplicates, conflicts, cancellation and restart. They do not invoke models. The separate real tiny.en model/browser acceptance is recorded in the workbench ACCEPTANCE.md.
