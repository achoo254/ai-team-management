export function initTheme() {
  const saved = localStorage.getItem('theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = saved === 'dark' || (saved !== 'light' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}

export function getTheme(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}
