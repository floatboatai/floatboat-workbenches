# Third-party materials

| Component | Version | License | Use |
| --- | --- | --- | --- |
| promptfoo | 0.125.1 | MIT (`promptfoo-LICENSE.txt`) | Result format, config format and deterministic assertion semantics ported to `src/server/assertions.ts`; the optional cross-check runner in the repository's `service/` executes the real package |
| ajv / ajv-formats | 8.20.0 / 3.0.1 | MIT | JSON Schema checks for `is-json`, `contains-json` and tool-call arguments (same validator as promptfoo) |
| js-rouge | 3.2.3 | MIT | Tokenizer, n-grams and F-measure for `rouge-n` (same library as promptfoo) |
| fastest-levenshtein | 1.0.16 | MIT | Edit distance for `levenshtein` (same library as promptfoo) |
| yaml | 2.8.2 | ISC | Reading and writing `promptfooconfig.yaml` |

The bundled example (`samples/`) is an original evaluation set written for this workbench: a fictional shop, 36 support tickets and hand-written "recorded" outputs. They are not real model answers.
