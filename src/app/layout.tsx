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
            <Link href="/" className="flex items-center gap-2.5">
              <img
                src="/Logo2.png"
                alt="Монтажка PRO"
                className="h-9 w-auto object-contain rounded-md shrink-0"
              />
              <span className="hidden sm:inline-block text-sm md:text-base font-bold tracking-tight text-foreground/90">
                Монтажка <span className="text-red-500">PRO</span>
              </span>
            </Link>
            <Link
              href="/"
              className="relative md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2"
            >
              <Image
                src="/logo.png"
                alt="Монтажка PRO"
                width={280}
                height={100}
                className="object-contain h-8 w-auto md:h-auto"
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