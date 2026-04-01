import { useState, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Theme = "light" | "dark" | "system";

function getStoredTheme(): Theme {
  return (localStorage.getItem("theme") as Theme) ?? "system";
}

function applyTheme(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", isDark);
  if (theme === "system") {
    localStorage.removeItem("theme");
  } else {
    localStorage.setItem("theme", theme);
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  // Listen for system preference changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function select(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent hover:text-accent-foreground transition-colors">
        <Icon size={16} />
        <span className="sr-only">Chọn theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => select("light")}>
          <Sun size={14} className="mr-2" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => select("dark")}>
          <Moon size={14} className="mr-2" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => select("system")}>
          <Monitor size={14} className="mr-2" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
