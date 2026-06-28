import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: 'Termaid',
    description: 'AI-Powered Terminal — Generate shell commands from natural language',
    base: '/termaid/',
    vite: {
      server: {
        port: 5174,
      },
    },
    head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/termaid/logo.svg' }]],
    themeConfig: {
      logo: '/logo.svg',
      nav: [
        { text: 'Guide', link: '/guide/getting-started' },
        { text: 'Configuration', link: '/guide/configuration' },
        {
          text: 'v1.5.0',
          link: 'https://github.com/openhoat/termaid/releases/tag/v1.5.0',
        },
      ],
      sidebar: [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Termaid?', link: '/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
          ],
        },
        {
          text: 'User Guide',
          items: [
            { text: 'Usage', link: '/guide/usage' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Build Executables', link: '/guide/build' },
          ],
        },
        {
          text: 'Reference',
          items: [{ text: 'Architecture', link: '/guide/architecture' }],
        },
        {
          text: 'Help',
          items: [
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
            { text: 'Contributing', link: '/guide/contributing' },
            {
              text: 'Changelog',
              link: 'https://github.com/openhoat/termaid/blob/main/CHANGELOG.md',
            },
          ],
        },
      ],
      socialLinks: [{ icon: 'github', link: 'https://github.com/openhoat/termaid' }],
      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2026 Olivier Penhoat',
      },
      editLink: {
        pattern: 'https://github.com/openhoat/termaid/edit/main/docs/:path',
        text: 'Edit this page on GitHub',
      },
    },
  })
)
