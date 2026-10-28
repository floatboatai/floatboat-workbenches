# DeepTutor practice core

These three Python modules are copied byte-for-byte from HKUDS/DeepTutor commit `a31d82624c27d75f4e771d4fcb78dce16470b383`, `deeptutor/services/practice/`:

- `importing.py`: bounded question-bank import and normalization.
- `answers.py`: conservative objective answer checking.
- `scheduler.py`: deterministic SM-2-style review scheduling.

Upstream: https://github.com/HKUDS/DeepTutor/tree/a31d82624c27d75f4e771d4fcb78dce16470b383/deeptutor/services/practice

License: Apache-2.0; full text is retained in `../../app/notices/deeptutor-LICENSE.txt` (relative to service: `../app/notices/`). This adapter does not claim to run the full DeepTutor RAG/agent/web platform. The surrounding service, project persistence and UI are Floatboat integration code. No modifications have been made to these upstream modules.
