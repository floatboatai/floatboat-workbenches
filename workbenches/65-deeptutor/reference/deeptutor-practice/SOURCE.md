# DeepTutor practice core (reference)

These three Python modules are copied byte-for-byte from HKUDS/DeepTutor commit `a31d82624c27d75f4e771d4fcb78dce16470b383`, `deeptutor/services/practice/`:

- `importing.py`: bounded question-bank import and normalization.
- `answers.py`: conservative objective answer checking.
- `scheduler.py`: deterministic SM-2-style review scheduling.

Upstream: https://github.com/HKUDS/DeepTutor/tree/a31d82624c27d75f4e771d4fcb78dce16470b383/deeptutor/services/practice

License: Apache-2.0; the full text is in `../../app/notices/deeptutor-LICENSE.txt`. No modifications have been made to these files.

Since 0.9.0 they are **not on the runtime path**. The workbench runs the TypeScript port in `../../app/src/contracts/deeptutor/`, so practice works without a separate process. These originals remain as the behavioural reference: `../make_parity_fixtures.py` (Python 3.12, standard library only) records their outputs to `../../app/tests/fixtures/python-parity.json`, and `app/tests/parity.test.ts` requires the port to match. The former loopback adapter (`service/server.py`, port 8786) and its tests were retired; their checks are mirrored in `app/tests/practice.test.ts`.
