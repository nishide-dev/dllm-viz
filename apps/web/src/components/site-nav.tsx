import { cn } from "@workspace/ui/lib/utils"
import { NavLink, Outlet } from "react-router-dom"

const links = [
  { to: "/", label: "Overview", end: true },
  { to: "/components/denoising-token-canvas", label: "TokenCanvas" },
  { to: "/components/commit-heatmap", label: "CommitHeatmap" },
  { to: "/components/candidate-distribution", label: "Candidates" },
  { to: "/components/block-diffusion-canvas", label: "BlockCanvas" },
  { to: "/components/diffusion-chat", label: "Chat" },
  { to: "/compare", label: "Compare" },
]

export function SiteLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <nav
          aria-label="Site"
          className="flex flex-wrap items-center gap-1 px-4 py-2"
        >
          <span className="mr-3 font-medium text-sm">dllm-viz</span>
          {links.map((link) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "rounded px-2 py-1 text-muted-foreground text-sm hover:bg-muted hover:text-foreground",
                  isActive && "bg-muted font-medium text-foreground"
                )
              }
              end={link.end}
              key={link.to}
              to={link.to}
            >
              {link.label}
            </NavLink>
          ))}
          <a
            className="ml-auto rounded px-2 py-1 text-muted-foreground text-sm hover:bg-muted hover:text-foreground"
            href="https://github.com/nishide-dev/dllm-viz"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
