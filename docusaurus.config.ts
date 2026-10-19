import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import {themes} from 'prism-react-renderer';

const config: Config = {
  title: 'Valen Team',
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
    blog: {
      routeBasePath: 'news',
      blogTitle: 'News & releases',
      blogDescription: 'Models, benchmarks, tools, and research from Valen Team.',
      blogSidebarCount: 0,
      postsPerPage: 10,
      showReadingTime: true,
      feedOptions: {type: ['rss', 'atom'], title: 'Valen Team — News'},
      onUntruncatedBlogPosts: 'throw',
    },
    theme: {customCss: './src/css/custom.css'},
  } satisfies Preset.Options]],
  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {defaultMode: 'light', disableSwitch: true, respectPrefersColorScheme: false},
    navbar: {
      title: 'VALEN',
      logo: {alt: 'Valen Team', src: 'img/valen-mark.png', width: 38, height: 38},
      hideOnScroll: false,
      items: [
        {to: '/docs/', label: 'Docs', position: 'left', activeBaseRegex: '/docs/'},
        {to: '/projects/', label: 'Projects', position: 'left'},
        {to: '/news/', label: 'News', position: 'left'},
        {to: '/about/', label: 'About', position: 'left'},
        {href: 'https://github.com/Valen-Team', label: 'GitHub', position: 'right'},
        {href: 'https://huggingface.co/Valen-Team', label: 'Hugging Face', position: 'right'},
        {type: 'localeDropdown', position: 'right'},
        {type: 'search', position: 'right'},
      ],
    },
    footer: {
      style: 'light',
      links: [
        {title: 'Build', items: [{label: 'Documentation', to: '/docs/'}, {label: 'Projects', to: '/projects/'}, {label: 'Leaderboard', href: 'https://huggingface.co/spaces/Valen-Team/JevalKit-Leaderboard'}]},
        {title: 'Explore', items: [{label: 'News', to: '/news/'}, {label: 'Models & datasets', href: 'https://huggingface.co/Valen-Team'}, {label: 'About Valen Team', to: '/about/'}]},
        {title: 'Connect', items: [{label: 'GitHub', href: 'https://github.com/Valen-Team'}, {label: 'Contribute', href: 'https://github.com/Valen-Team/Valen/issues'}, {label: 'RSS', href: 'pathname:///news/rss.xml'}]},
      ],
      copyright: `© ${new Date().getFullYear()} Valen Team · 万澜. Fast Decisions. Continuous Evolution.`,
    },
    prism: {theme: themes.github, darkTheme: themes.dracula, additionalLanguages: ['bash', 'python', 'json']},
    metadata: [{name: 'theme-color', content: '#195F9D'}],
  } satisfies Preset.ThemeConfig,
};

export default config;
