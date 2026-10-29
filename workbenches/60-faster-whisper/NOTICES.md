# Upstream, model and sample notices

- **faster-whisper 1.2.1**: MIT, copyright 2023 SYSTRAN. The companion service imports its published package; see [the exact release license](https://github.com/SYSTRAN/faster-whisper/blob/v1.2.1/LICENSE) and [README API](https://github.com/SYSTRAN/faster-whisper/tree/v1.2.1). A copy is stored in `notices/faster-whisper-LICENSE`.
- **Inference checkpoints used for verification**: [Systran/faster-whisper-small](https://huggingface.co/Systran/faster-whisper-small), revision `536b0662742c02347bc0e980a01041f333bce120` (0.9.0 sample and browser run), and [Systran/faster-whisper-tiny.en](https://huggingface.co/Systran/faster-whisper-tiny.en), revision `0d3d19a32d3338f10357c0889762bd8d64bbdeba` (0.4.0 run). Both model cards are marked MIT; they are conversions of OpenAI Whisper checkpoints (MIT). No weights are included in this repository or the workbench package.
- Other model selections have their own terms and are not certified by these runs.
- Native service dependencies, including CTranslate2, ONNX Runtime, PyAV and its FFmpeg libraries, retain their own licenses. They are installed separately through a pinned requirements file, not bundled into the Node application. The pinned PyAV version is a compatibility decision, not a claim that a complete third-party binary license or security audit has been performed.
- Application React/Lucide/template notices follow the repository's existing [licensing record](../../docs/licensing.md). No blanket license for all newly authored repository code is selected here.

## Bundled sample

`app/src/server/sample-audio.ts` (Ogg Opus, 24 kbps mono, 82.2 s, SHA-256 `65336748f9829e2a32c6f0188cce67390ea2f968d2f0b61f9899760c95f4c65c`) and `app/src/contracts/sample.ts` were made for this workbench:

- The interview script (a fictional community library and fictional people) was written for this repository.
- Speech was synthesised locally with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0, revision `f3ff3571791e39611d31c381e3a41a3af07b49870`, `kokoro` 0.9.4 / `misaki` 0.9.4), voices `zf_xiaoxiao` and `zm_yunjian`, with low-level room noise added, then encoded with FFmpeg's libopus. No recording of a real person is included.
- The transcript is the unedited output of faster-whisper small (CPU, int8, `language=zh`, `beam_size=5`, `word_timestamps=True`, `vad_filter=True`) on that audio, with the first four cues corrected by hand and speaker labels added by hand. Word timings of corrected cues were re-aligned by the workbench's own algorithm.

Runtime recordings, databases and model files stay outside tracked source.
