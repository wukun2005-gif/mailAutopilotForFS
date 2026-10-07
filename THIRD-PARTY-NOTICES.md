# Third-Party Notices

本仓库除 MIT 授权的自有代码外，还包含以下第三方组件：

## Mock Service Worker — `public/mockServiceWorker.js`

- 来源：https://github.com/mswjs/msw
- 授权：MIT License
- Copyright (c) 2024 Anton Medvedev
- 说明：该文件由 `msw`（devDependency）自动生成，头部标注 "Please do NOT modify this file"，
  按 MSW 官方文档要求原样提交，未做任何修改。

## 配音音频（随仓库公开分发）

以下音频文件随仓库公开分发，由本地 TTS 引擎离线生成。引擎与模型本身不随仓库分发，
构建时经 `scripts/setup-local-tts.sh` 下载到 gitignore 的 `tts/.local/`。
音频为上述引擎的生成物；CC0 / MIT / Apache-2.0 均不要求对生成物署名或附加 license。

### `deck-html/assets/voice/*.mp3` — deck 配音（41 条）

- 引擎：Piper — https://github.com/rhasspy/piper — MIT License
- 声音：en_US-joe-medium — https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/joe/medium
- 声音仓库授权：MIT License
- Model card 标注的数据集授权：CC0

### `public/tts/en/*.mp3` — 英文 demo 配音（88 条）

- 模型：Kokoro-82M — https://huggingface.co/hexgrad/Kokoro-82M — Apache-2.0
- 推理库：kokoro-onnx — https://github.com/thewh1teagle/kokoro-onnx — MIT License
- 声音：af_heart

### `public/tts/zh/*.mp3` — 中文 demo 配音（83 条）

- 引擎：Piper — https://github.com/rhasspy/piper — MIT License
- 声音：zh_CN-chaowen-medium — https://huggingface.co/rhasspy/piper-voices/tree/main/zh/zh_CN/chaowen/medium
- 声音仓库授权：MIT License
- Model card 标注的数据集授权：CC0

其余第三方依赖（React、Vite、Tailwind 等）仅记录在 `package.json`，
以 npm 安装方式获取，未随仓库分发源码或构建产物。
