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
          <header className="relative p-4 flex justify-between items-center border-b bg-card">
            <Link href="/" className="font-bold text-secondary">
              Монтажка PRO
            </Link>
            <Link
              href="/"
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <Image
                src="/logo.png"
                alt="Монтажка PRO"
                width={56}
                height={56}
                className="h-14 w-14 object-contain"
              />
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