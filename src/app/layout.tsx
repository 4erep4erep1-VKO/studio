import Image from "next/image"
import Link from "next/link"
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
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo"
                alt="Монтажка PRO"
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
              />
              <span className="font-bold text-secondary">Монтажка PRO</span>
            </Link>
            <ThemeToggle />
          </header>
          <main>{children}</main>
          <CalculatorWidget />
        </ThemeProvider>
      </body>
    </html>
  )
}