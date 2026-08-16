# DeepSeek Harness Desktop（桌面版）

一个**自包含的 macOS 桌面应用**，把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的完整网页界面封装进原生窗口。**不用再开浏览器**：双击即可启动整套 harness（后端 + 网页 UI），并在窗口里打开。

> 这是一个独立的社区封装项目，**不是** DeepSeek 官方产品。内置的 `@deepseek-ai/dsh` 是 DeepSeek 的开源（MIT）项目，图标中的鲸鱼标志来自该项目自带的 MIT 许可 `favicon.svg`。

## 特性

- **无需浏览器** —— Electron 窗口加载与 `dsh web` 完全相同的网页界面。
- **完全自包含** —— 内置 `@deepseek-ai/dsh` 的生产依赖（后端 + 前端 dist + 原生模块）。
- **复用 `~/.dsh`** —— 你的模型、API Key、会话记录、技能、设置都会自动沿用。
- **空闲端口** —— 绑定 `127.0.0.1` 并由系统分配空闲端口（不占用 3080）。
- **干净的生命周期** —— 关闭窗口即停止后端；再次打开会重启；`⌘Q` 全部退出。

## 工作原理

`main.cjs`（Electron 主进程）做三件事：

1. 以 `ELECTRON_RUN_AS_NODE=1 --expose-internals` 在空闲端口拉起内置后端。
2. 等待就绪行 `dsh web: http://127.0.0.1:<port>`。
3. 在该地址打开 `BrowserWindow`。

## 环境要求

- macOS（Apple Silicon，arm64）
- Node.js `^22.19.0 || >=24.0.0`
- npm

## 快速开始（开发模式）

```bash
npm install                               # 安装 electron + electron-builder
node node_modules/electron/install.js     # 下载 Electron 二进制（electron 43 没有 postinstall）
npm run setup:backend                     # 把 @deepseek-ai/dsh 装到 backend/vendor/node_modules
npm start                                 # 开发模式启动应用
```

## 打包 .app / .zip / .dmg

```bash
npm run setup:backend
npm run dist                              # 产物在 release/
```

`electron-builder` 首次构建会下载 Electron 发行版；国内可以指向镜像加速：

```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm run dist
```

## 项目结构

```
main.cjs                     Electron 主进程（后端生命周期 + 窗口）
package.json                 应用元信息 + electron-builder 配置
scripts/setup-backend.sh     构建自包含后端
scripts/render-icon.mjs      重新生成 build/icon.png（需要 sharp）
backend/package.json         声明内置的 @deepseek-ai/dsh 依赖
backend/vendor/              生成的后端安装（已 gitignore）
build/                       应用图标（icon.png / icon.svg）
```

## 图标

图标是蓝色底 + 白色鲸鱼标志。重新生成：

```bash
npm i -D sharp
npm run icon
```

## 许可证

[MIT](./LICENSE) © 2026 chenyanning。

DeepSeek 名称及鲸鱼 Logo 为 DeepSeek 商标，此处仅用于标识所封装的开源 harness。
