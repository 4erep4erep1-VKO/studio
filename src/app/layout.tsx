import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/ThemeToggle"
import CalculatorWidget from "@/components/CalculatorWidget"
import "./globals.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <header className="p-4 flex justify-between items-center border-b bg-card">
            <h1 className="font-bold text-secondary">Монтажка PRO</h1>
            <ThemeToggle />
          </header>
          <main>{children}</main>
          <CalculatorWidget />
        </ThemeProvider>
      </body>
    </html>
  )
}