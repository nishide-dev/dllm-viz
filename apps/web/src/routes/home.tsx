import { Link } from "react-router-dom"

export function Home() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="font-medium text-lg">dllm-viz</h1>
      <p className="max-w-prose text-sm leading-relaxed">
        Open-code, shadcn-installable visualization primitives for diffusion
        language models. Components replay structured inference traces — they
        never fake model behavior with generic text effects.
      </p>
      <nav aria-label="Component gallery">
        <ul className="list-disc pl-5 text-sm">
          <li>
            <Link className="underline" to="/components/denoising-token-canvas">
              DenoisingTokenCanvas
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  )
}
