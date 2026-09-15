import Link from 'next/link'

export function Logo({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand-logo ${light ? 'brand-logo-light' : ''}`} aria-label="Bilal Broast home"><span className="brand-mark">BB</span><span><strong>Bilal</strong><em>Broast</em></span></Link>
}
