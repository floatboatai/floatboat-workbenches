# Connect a real Presenton service (optional)

The connector targets the self-hosted REST API inspected at upstream commit `93b9dcf947f70ae107b779b51dd3c491e736748a`. It is bundled in this workbench's Node server; no separate adapter process or npm installation is needed. A Presenton server with configured model/image providers must run independently. The Electron desktop application's private HTTP servers are not an external REST API.

## Start Presenton

Use an existing supported instance, or build the inspected source in an external deployment directory. This can consume substantial disk space; no image was pulled or built during local acceptance.

```sh
git clone https://github.com/presenton/presenton.git
cd presenton
git checkout 93b9dcf947f70ae107b779b51dd3c491e736748a
docker build -t presenton:93b9dcf947f7 .
mkdir -p app_data
docker run --name presenton -p 127.0.0.1:5001:80 \
  -v "$PWD/app_data:/app_data" presenton:93b9dcf947f7
```

Open the instance, finish administrator setup, configure its text/image providers and create an API key under **Admin → API keys**. Do not place provider or Presenton keys in a project, browser form, published repository or workbench resource.

## Start this workbench with server-only config

In a shell in the workbench directory, use the environment of the server process. The example prompts without echoing the API key (zsh):

```sh
export PRESENTON_URL=http://127.0.0.1:5001
read -rs 'PRESENTON_API_KEY?Presenton API key: '
export PRESENTON_API_KEY
pnpm dev
```

`PRESENTON_URL` must be an origin with no path/query/userinfo; HTTPS is required except for explicit localhost/loopback. It must address both REST routes and `/app_data/exports/`. `PRESENTON_API_KEY` is sent as Bearer server-side. No environment values are returned to the page. Restart preview after changing environment configuration. For a packaged Host installation, these variables must be available to its Node server process; inherited environment configuration and client import were not verified in this session. Keys are never exported with the package.

On the **大纲** step, open the **Presenton** status chip next to **生成幻灯片** and use **重新检查** (validates the required OpenAPI route, not model quality). When reachable, the drawer shows settings and **交给 Presenton 生成**; the request carries the brief and the outline (one Markdown block per outline item, with speaker notes). Local generation and PPTX/PDF export never need this service. The ledger stores the input and local operation before the external request. Follow the task, download the actual original, or read its slides into a new review document. Generation is not confirmed until a real upstream task completes.

If submission becomes unknown, inspect the original service and associate its existing `task-…` ID. The workbench does not automatically repeat the POST. A new manual generation warns about unresolved operations. “停止跟踪” only stops local polling; it does not cancel Presenton or model billing. A source-origin change blocks access to earlier jobs until the original service configuration is restored.

## Supported upstream contracts

| Action | Endpoint |
| --- | --- |
| Generate | `POST /api/v1/ppt/presentation/generate/async` |
| Query original task | `GET /api/v1/ppt/presentation/status/{task-id}` |
| Read slides | `GET /api/v1/ppt/presentation/{presentation-id}` |
| Export existing | `POST /api/v1/ppt/presentation/{presentation-id}/export` with `export_as` |

States are `pending`, `completed`, `error`. Final task `data` contains `presentation_id`, `path`, `edit_path`; `PresentationWithSlides` contains slide `index`, `content`, `speaker_note` and optional HTML. The connector does not execute HTML. Original JSON import and outline export work with no service.

Only same-origin `/app_data/exports/… .pptx/.pdf` outputs are accepted. Deployments using a different physical/public path need their server configured to expose that documented asset path; the workbench will not proxy arbitrary returned URLs. Files remain available from the local cached resource after a successful download. Portable project export carries plans and response metadata, not generated binary files; download originals separately. Source-only `.fbworkbench` packages exclude preview data.

## Sources and notices

- [Official README, setup and authentication](https://github.com/presenton/presenton/blob/93b9dcf947f70ae107b779b51dd3c491e736748a/README.md)
- [Generate request model](https://github.com/presenton/presenton/blob/93b9dcf947f70ae107b779b51dd3c491e736748a/servers/fastapi/models/generate_presentation_request.py)
- [Presentation endpoints](https://github.com/presenton/presenton/blob/93b9dcf947f70ae107b779b51dd3c491e736748a/servers/fastapi/api/v1/ppt/endpoints/presentation.py)
- [Async task model](https://github.com/presenton/presenton/blob/93b9dcf947f70ae107b779b51dd3c491e736748a/servers/fastapi/models/sql/async_task.py)
- [Presentation with slides](https://github.com/presenton/presenton/blob/93b9dcf947f70ae107b779b51dd3c491e736748a/servers/fastapi/models/presentation_with_slides.py)
- [Apache-2.0 license](https://github.com/presenton/presenton/blob/93b9dcf947f70ae107b779b51dd3c491e736748a/LICENSE) and [upstream NOTICE](https://github.com/presenton/presenton/blob/93b9dcf947f70ae107b779b51dd3c491e736748a/NOTICE)

Presenton source, model weights, templates, brand assets and generated media are not redistributed here. This independent workbench implements its documented HTTP/JSON contract. The city shade plan is original illustrative example data, not model-generated evidence. Existing pinned React/React DOM and Lucide dependencies retain their licenses. No upstream copyrighted sample media is included.
