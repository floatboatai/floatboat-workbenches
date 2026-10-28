# Upstream provenance

DeerFlow: https://github.com/bytedance/deer-flow

Read-only source commit: `d4ed40075f9101db6424b2331ea410934af146ac` (harness 2.1.0, app 2.2.0-dev).

Contracts: `backend/app/gateway/routers/threads.py`, `backend/packages/harness/deerflow/client.py`, `backend/packages/harness/deerflow/runtime/serialization.py`.

The verification directory contains the unchanged upstream serializer under MIT. Its SHA-256 is `bdca87f230631d9e7251816929b7171f7f3c9f92acb4610e3b8ddc5338f9bcb4`. The ordinary native sample was serialized using this source and LangChain Core 1.4.9. It is not a model-generated research result. The production workbench preserves native JSON and uses the documented read-only HTTP state endpoint; it does not bundle the full DeerFlow backend. Explicit research submission uses the documented thread creation and background runs endpoints; official RunCreateRequest validation is exercised by verification/verify_run_contract.py. Live backend execution remains unverified.

The adjacent `deerflow-LICENSE.txt` is the complete upstream MIT license.
