import type { Metadata } from 'next'
import './globals.css'
import './brand.css'
import './responsive.css'

export const metadata: Metadata = { title: 'MKS | Ön Muhasebe', description: 'MKS ön muhasebe yönetim sistemi' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>
}
