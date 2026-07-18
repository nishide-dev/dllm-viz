# dllm-viz

This repository will provide open-code, shadcn-installable visualization primitives for diffusion language models (dLLMs).

> Generated with [react-monorepo-template](https://github.com/nishide-dev/react-monorepo-template)

## Getting Started

```bash
pnpm dev
```

## Structure

```
apps/
  web/          # Vite + React アプリ (static docs/demo site)
packages/
  core/         # @dllm-viz/core — trace schema, playback engine (no React)
  react/        # @dllm-viz/react — headless provider/hooks
  ui/           # 共有 UI コンポーネント (@workspace/ui, internal demo foundation)
registry/       # shadcn registry source (registry.json + registry/default/*)
```

## Commands

```bash
pnpm dev             # 開発サーバー起動
pnpm build           # ビルド
pnpm test            # テスト実行
pnpm lint            # Biome check(lint + format 検査)
pnpm format          # Biome check --write(format + lint 自動修正)
pnpm typecheck       # TypeScript 型チェック
pnpm registry:build  # packages/core, packages/react から registry/default/lib
                     # と registry.json を再生成
```

## Adding shadcn/ui Components

`web` アプリを対象に shadcn CLI を実行すると、コンポーネントは `packages/ui/src/components` に配置される:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

利用側では `@workspace/ui/components/...` のサブパスとして import する:

```tsx
import { Button } from "@workspace/ui/components/button"
```

## Installing dLLM Viz Components

`registry.json` は shadcn CLI 経由でインストール可能な dLLM 可視化コンポーネント
(`DenoisingTokenCanvas`, `DiffusionStepControls`, `TraceInspector`) を提供する:

```bash
pnpm dlx shadcn@latest add nishide-dev/dllm-viz/denoising-token-canvas
```
