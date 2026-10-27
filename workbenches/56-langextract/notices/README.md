# Upstream notices

- Google LangExtract, pinned Python package `langextract==1.7.1`, [source](https://github.com/google/langextract), [Apache-2.0 license](https://github.com/google/langextract/blob/main/LICENSE).
- Upstream contracts read: [core data types](https://github.com/google/langextract/blob/main/langextract/core/data.py), [data serialization](https://github.com/google/langextract/blob/main/langextract/data_lib.py), [JSONL I/O](https://github.com/google/langextract/blob/main/langextract/io.py), [extract API](https://github.com/google/langextract/blob/main/langextract/extraction.py).
- The service calls installed upstream APIs. The application implements its own React evidence view; it does not embed upstream generated HTML scripts.
- Model providers/weights have separate terms. Health-related applications are additionally subject to the [upstream disclaimer](https://github.com/google/langextract/blob/main/README.md#disclaimer) and [Health AI Developer Foundations terms](https://developers.google.com/health-ai-developer-foundations/terms).
- React, React DOM, Lucide and the Floatboat template retain their own licenses. This notice does not select a new repository-wide license.
- All visible business sample content was authored for this workbench. `verify_upstream.py` uses an explicit deterministic model stub solely for contract verification, not a claimed real provider run.
