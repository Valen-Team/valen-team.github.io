import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import {themes} from 'prism-react-renderer';

const config: Config = {
  title: 'Valen Team',
  customFields: {decisionProxyUrl: process.env.VALEN_DEMO_PROXY_URL || 'https://api.valen-team.workers.dev/v1/decisions'},
  tagline: 'Fast Decisions. Continuous Evolution.',
  favicon: 'img/valen-mark.png',
  url: 'https://valen-team.github.io',
  baseUrl: '/',
  organizationName: 'Valen-Team',
  projectName: 'valen-team.github.io',
  trailingSlash: true,
  onBrokenLinks: 'throw',
  markdown: {format: 'detect', hooks: {onBrokenMarkdownLinks: 'throw'}},
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-Hans'],
    localeConfigs: {en: {label: 'English', htmlLang: 'en'}, 'zh-Hans': {label: '简体中文', htmlLang: 'zh-CN'}},
  },
  presets: [['classic', {
    docs: {sidebarPath: './sidebars.ts', showLastUpdateTime: false},
    blog: false,
    theme: {customCss: './src/css/custom.css'},
  } satisfies Preset.Options]],
  plugins: ['./plugins/cookbook-redirects.cjs', './plugins/llms-txt.cjs', ['@docusaurus/plugin-content-docs', {
    id: 'cookbook', path: 'cookbook', routeBasePath: 'cookbook',
    sidebarPath: './cookbook-sidebars.ts', showLastUpdateTime: false,
  }]],
  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {defaultMode: 'light', disableSwitch: true, respectPrefersColorScheme: false},
    navbar: {
      title: 'VALEN',
      logo: {alt: 'Valen Team', src: 'img/valen-mark.png', width: 38, height: 38},
      hideOnScroll: false,
      items: [
        {to: '/', label: 'Chat', position: 'left'},
        {to: '/docs/', label: 'Documentation', position: 'left'},
        {to: '/cookbook/', label: 'Cookbook', position: 'left'},
        {href: 'https://github.com/Valen-Team', label: 'GitHub', position: 'right'},
        {type: 'localeDropdown', position: 'right'},
        {type: 'search', position: 'right'},
      ],
    },
    footer: {
      style: 'light',
      links: [
        {title: 'Build', items: [{label: 'Documentation', to: '/docs/'}, {label: 'Valen API', to: '/docs/valen/api/'}, {label: 'API data handling', to: '/docs/valen/api/data-handling/'}, {label: 'Local inference', to: '/docs/valen/quickstart/'}, {label: 'ONNX & SDKs', to: '/docs/valen/onnx/'}]},
        {title: 'Explore', items: [{label: 'JevalKit', to: '/docs/jevalkit/'}, {label: 'Models & datasets', href: 'https://huggingface.co/Valen-Team'}, {label: 'Leaderboard', href: 'https://huggingface.co/spaces/Valen-Team/JevalKit-Leaderboard'}]},
      ],
      copyright: `© ${new Date().getFullYear()} Valen Team · 万澜. Fast Decisions. Continuous Evolution.`,
    },
    prism: {theme: themes.github, darkTheme: themes.dracula, additionalLanguages: ['bash', 'python', 'json']},
    metadata: [{name: 'theme-color', content: '#195F9D'}],
  } satisfies Preset.ThemeConfig,
};

export default config;
