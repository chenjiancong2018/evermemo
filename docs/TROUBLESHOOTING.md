# 已知问题与解决（Troubleshooting）

## pnpm 11 构建脚本批准门

`pnpm install` 后出现 `ERR_PNPM_IGNORED_BUILDS`，better-sqlite3 / sharp / esbuild 的安装脚本被跳过。

- sharp 0.34.5 通过 optionalDependencies 预装 libvips，**无需**构建脚本，可正常使用。
- esbuild 的脚本被忽略不影响 Next 15（使用 swc）。
- better-sqlite3 需要原生绑定 `better_sqlite3.node`。

### 方案 A（推荐）：pnpm approve-builds

```bash
pnpm approve-builds
```

交互界面中勾选 `better-sqlite3`（sharp、esbuild 可选），pnpm 会重跑它们的构建/下载脚本。

### 方案 B：手动放置预编译二进制

当本机无法直连 GitHub 且无 MSVC 工具链时（node-gyp 编译不可行），可从镜像下载官方 release 的预编译包：

```
https://ghproxy.net/https://github.com/WiseLibs/better-sqlite3/releases/download/v12.11.1/better-sqlite3-v12.11.1-node-v137-win32-x64.tar.gz
```

- `node-v137` 对应 Node 24（ABI 137）；其他 Node 版本需换对应 ABI 数字。
- 解压后把 `build/Release/better_sqlite3.node` 复制到：
  `node_modules\.pnpm\better-sqlite3@12.11.1\node_modules\better-sqlite3\build\Release\better_sqlite3.node`
- 验证：`node -e "require('better-sqlite3')(':memory:').prepare('select 42 as x').get()"` 输出 `{ x: 42 }`。
- **注意**：重新 `pnpm install` 可能清掉该文件，需重新放置。

## pnpm 11 的 `pnpm run build` 因 ignored builds 退出

pnpm 在跑脚本前会校验依赖并因 `ERR_PNPM_IGNORED_BUILDS` 退出（exit 1）。绕过方式：直接用 next CLI：

```bash
node node_modules/next/dist/bin/next build
```

`dev` / `start` 同理可用 `node node_modules/next/dist/bin/next dev|start`。

## Tailwind @apply 报「class does not exist」（自定义色 + 透明度修饰符）

自定义颜色若定义为 `var(--accent)`（hex），`bg-accent/90`、`focus:ring-accent/15` 这类透明度修饰符无法生成。本项目已改为 RGB 通道形式：

- `globals.css`：`:root` 中同时定义 `--accent: #777d66`（供普通 CSS 用）与 `--accent-rgb: 119 125 102`（供 Tailwind 用）。
- `tailwind.config.ts`：颜色映射为 `rgb(var(--accent-rgb) / <alpha-value>)`。

新增颜色时两条都要加。

## 构建缓存报旧的 CSS 错误

Webpack 的 `PackFileCacheStrategy` 会缓存 PostCSS 错误。修完 CSS 后若仍报同样的旧错，删除 `.next` 目录再构建：

```powershell
Remove-Item -Recurse -Force .next
```

## 图片上传失败排查

- 单张限制 20MB（`MAX_IMAGE_BYTES`，见 `src/lib/config.ts`），每次批量 ≤30 张。
- 仅支持 JPG/PNG/WEBP；文件头会经 sharp 校验真实格式（伪装扩展名会被拒绝）。
- 缩略图生成失败不会导致上传失败（降级为无缩略图，画廊用原图）。
