import type { Metadata, Viewport } from "next"
import { Manrope } from "next/font/google"
import { QueryProvider } from "@/components/query-provider"
import { TelegramProvider } from "@/components/telegram-provider"
import { copy } from "@/lib/constants"
import "./globals.css"

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
})

export const metadata: Metadata = {
  title: copy.appTitle,
  description: copy.appDescription,
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  userScalable: false,
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${manrope.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-(--tg-theme-bg-color) font-sans text-(--tg-theme-text-color)">
        <TelegramProvider>
          <QueryProvider>{children}</QueryProvider>
        </TelegramProvider>
      </body>
    </html>
  )
}
