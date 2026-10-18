# UME Lite — 媒体标签定位（Firefox）

[![build](https://github.com/1TRYOUT/firefox-ume-lite/actions/workflows/build.yml/badge.svg)](https://github.com/1TRYOUT/firefox-ume-lite/actions/workflows/build.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Firefox 140+](https://img.shields.io/badge/Firefox-140%2B-orange.svg)

在**任意标签页**里找出正在播放音视频的页面，弹窗里一键跳过去；同时保留倍速、音量增强和快捷键。

> English: [README.en.md](README.en.md)

## 它解决什么问题

标签开得太多，跳到别的页面后原页面还在放视频/音乐，却怎么也找不到是哪一个。Firefox 只在标签上显示一个小喇叭，标签一多就看不见了。

UME Lite 在弹窗里给出**所有正在播放媒体的标签列表**（含跨窗口），点一下即可跳转并聚焦对应窗口。它**不会**为了"净化"而暂停你正在播放的后台标签——那些标签正是你要找的目标。

## 与上游的差异

本项目是 [`amitbrown21/OneTab-Media`](https://github.com/amitbrown21/OneTab-Media)（Firefox MV2 版，上游名 "UME - Ultimate Media Extension" v5.1）的二次开发，完整改动见 [CHANGELOG.md](CHANGELOG.md)。

| 改动 | 上游行为 | 本版本 |
|---|---|---|
| **多标签同时播放** | 有第二个标签开始播放时，**无条件暂停**上一个正在播放的标签（`background.js` 写死，无开关） | 默认**不打断**任何标签——后台继续播放，因此才能被列出来找到它；想恢复上游行为可在选项页关闭 *Allow Multiple Tabs to Play* |
| **页面悬浮控制器** | 默认开启，每个有视频的页面都注入浮层 | 默认**关闭**（`showController: false`，选项页可开） |
| **设置同步** | 只广播给"已被追踪的媒体标签"，且后台自身的内存设置不更新 → 上游 issue #1「设置只对当前标签生效」 | 后台与内容脚本**各自监听 `storage.onChanged`**，任何上下文保存设置都立即对所有标签生效 |
| **权限** | `storage, tabs, alarms, <all_urls>, activeTab` | 去掉从未使用的 `alarms` 与 `activeTab` |
| **仓库内容** | 名称拼写 `Extention`；含开发者打赏链接；86 KB 未使用图标；16 个历史 zip 与测试页混在扩展目录 | 名称修正为 UME Lite；移除打赏入口；删除未使用图标；测试页移入 `dev/`，打包产物不进仓库 |
| **名称本地化** | 名称写死英文 | `_locales/`（en / zh_CN）：扩展名称、简介与工具栏提示随浏览器语言显示，中文界面即「UME Lite（媒体标签定位）」 |

检测机制**未改动**：它 hook `<video>/<audio>` 的 `play`/`pause` 事件（不依赖 `tab.audible`），所以**页面自身静音的后台播放也能被列出来**——这是相对只认"正在出声"的同类插件的关键优势。上游的 `LightweightMediaDetector` 会先做一次廉价探测，页面没有媒体时不初始化完整逻辑，注入开销可控。

## 下载与安装

从 [Releases](https://github.com/1TRYOUT/firefox-ume-lite/releases) 下载 `ume-lite-<version>.xpi`。

需要 **Firefox 140+**（清单声明了 `data_collection_permissions`；Android 版要求 142+，已在 `gecko_android` 中单独声明）。

扩展未签名，Firefox 正式版不能直接永久安装。三种方式：

**A. 临时加载（最快，重启后失效）**

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点「临时载入附加组件…」
3. 选择解包目录里的 `manifest.json`（或直接选 `.xpi`）

**B. 开发者版 / Nightly / ESR 永久安装**

1. `about:config` 将 `xpinstall.signatures.required` 设为 `false`
2. `about:addons` → 齿轮 → 「从文件安装附加组件」→ 选择 `.xpi`

**C. 自签名（正式版永久安装）**

```powershell
npx web-ext sign --source-dir . --channel unlisted --api-key <AMO_KEY> --api-secret <AMO_SECRET>
```

需要一个 AMO 账号；扩展 ID 已在 `manifest.json` 中固定为 `ume-lite@1tryout.github.io`，自签名或上架时请沿用（换 ID 会被视为另一个扩展）。

## 使用

点工具栏图标打开弹窗：

- **Active Media Tabs**：按 `playing > has_media > paused > potential` 排序的媒体标签列表，**点任意一项即跳转到该标签**（标签在其他窗口时会把窗口切到前台）。
- 每项可单独暂停；底部 **Pause All** 一次停掉全部；**Refresh** 重新拉取列表。
- **Current Speed / Volume Booster**：当前标签的倍速与音量（最高 500%，带听力保护提示）。
- 顶部开关可临时停用扩展，右侧开关切换深色主题。

页面内快捷键（选项页可改键）：`S` 减速、`D` 加速、`R` 重置、`G` 首选速度、`Z/X` 后退/前进 10 秒、`M/J` 标记与跳回、`V` 显示/隐藏控制器（需先开启控制器）、`↑/↓` 音量。上游 issue #2 反馈 `M/J/V` 在 Firefox for Android 上无效；桌面版未复现，若你也遇到，先在选项页重新绑定这三个键。

选项页（弹窗里的 Options，或 `about:addons` → 首选项）另有：域名黑名单、起始隐藏、控制器记忆倍速、控制器透明度、键位自定义、配置导入导出。

## 开发

```
manifest.json        扩展清单（MV2）
background.js        TabManager（标签追踪 + 徽章）与 MessageHandler（消息协议）
content.js           轻量检测器 + MediaManager（媒体事件、倍速、音量）+ 控制器
controller.css       控制器样式（仅在开启控制器时使用）
shadow.css           控制器 Shadow DOM 样式
options.html/js/css  选项页（含 Allow Multiple Tabs to Play）
popup/               弹窗：媒体标签列表、跳转、Pause All、倍速/音量
dev/                 上游的测试页面、诊断脚本与接线断言（不随扩展打包）
build-xpi.py         打包脚本（用 Python zipfile，保证归档内是正斜杠）
.github/workflows/   CI：语法检查 + 接线断言 + web-ext lint + 打包
```

```bash
npm run verify   # 静态接线断言：三处改造是否仍接线正确
npm run lint     # web-ext lint（忽略 dev/ 等非运行时文件）
npm run build    # 生成 ume-lite-<version>.xpi
npm run start    # web-ext run：自动启动 Firefox 加载扩展（便于调试）
```

`Compress-Archive` 在 Windows 上可能写出反斜杠路径，XPI 是 ZIP、必须用正斜杠，所以打包走 `build-xpi.py`。

### 验证状态

| 检查 | 结果 |
|---|---|
| `node --check` 全部运行时脚本 | 通过 |
| `web-ext lint` 对**打包后的 xpi 解包结果** | 0 error / 0 warning / 0 notice |
| `dev/verify-wiring.py` 静态接线断言 | 26/26 通过 |
| 权限裁剪、打赏链接与拼写清理 | 已确认移除 |

**尚未完成真机验证**（开发机未安装 Firefox）。请按以下 5 步人工确认：

1. 临时加载扩展，打开两个视频标签页分别播放；
2. 确认**两个都在继续播放**（上游行为是第二个开始播时第一个被自动暂停）；
3. 点工具栏图标，确认两个标签都出现在 **Active Media Tabs** 列表里，点击条目能跳转（跨窗口时窗口会被切到前台）；
4. 选项页改一个键位 → 保存 → **不刷新**直接到另一个标签按新键，确认立即生效；
5. 确认页面上不再出现悬浮倍速控制器。

## 隐私

- **无任何网络请求**：全部 JS 中没有 `fetch` / `XMLHttpRequest` / `WebSocket` / `sendBeacon`，也没有远程脚本或 `eval`；扩展不向任何服务器发送数据（上游打赏链接已移除）。
- **无遥测、无数据收集**：清单声明 `"data_collection_permissions": { "required": ["none"] }`。
- **权限**：`storage`（保存设置）、`tabs`（读取标签标题/URL 以列出媒体标签）、`<all_urls>`（内容脚本需要在任意站点检测媒体元素）。`<all_urls>` 是这类功能的必要条件，但请注意它意味着扩展能读取并修改你打开的任意页面。

## 已知限制

- **MV2 + `persistent: true` 后台页**：Firefox 仍支持，但属遗留形态。迁移到 MV3 事件页需要把 `TabManager` 的内存表落盘，本版本未做。
- 只处理 HTML5 `<video>/<audio>`：Web Audio 直出、特殊 DRM 管线或跨域 iframe 内的媒体可能探测不到。
- 弹窗列表同时包含"有媒体但已暂停"的标签（`has_media`/`paused`），噪音比纯 `audible` 方案略多——这是为了能找回"刚播完"的页面。
- 上游自 2025-09 起无提交，本 fork 不跟踪上游；上游其余历史问题（例如 `updateSpeedSettings` 的过滤条件会丢弃带 `speed` 的整包更新）不在本次改造范围，仍存在。

## 许可证

MIT。原始作品版权归 [amitbrown21](https://github.com/amitbrown21) 所有（[OneTab-Media](https://github.com/amitbrown21/OneTab-Media)），本 fork 的修改部分版权归 1TRYOUT 所有，详见 [LICENSE](LICENSE)。
