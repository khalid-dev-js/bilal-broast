import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bilal Broast',
    short_name: 'Bilal Broast',
    description: 'Bilal Broast order dashboard',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f1f3ef',
    theme_color: '#922f27',
    icons: [
      {
        src: '/bilal-broast-icon.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
