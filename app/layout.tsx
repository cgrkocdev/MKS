import type { Metadata } from 'next'
import './globals.css'
import './brand.css'
import './responsive.css'

export const metadata: Metadata = { title: 'MKS | Ön Muhasebe', description: 'MKS ön muhasebe yönetim sistemi' }
export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const buildVersion = process.env.VERCEL_GIT_COMMIT_SHA ?? 'local'
  return <html lang="tr" data-build-version={buildVersion}><body>{children}</body></html>
}
