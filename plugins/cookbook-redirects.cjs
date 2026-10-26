// Small static aliases; GitHub notebook URLs are outside this site's control.
const {mkdirSync, writeFileSync} = require('node:fs');
const {join} = require('node:path');
module.exports = function cookbookRedirects(context) {
  const prefix = context.i18n.currentLocale === 'zh-Hans' ? '/zh-Hans' : '';
  return {name: 'cookbook-filename-redirects',
    configureWebpack() {
      return {module:{rules:[{resourceQuery:/cookbook-source/,type:'asset/source'}]}};
    },
    async postBuild({outDir}) {
    for (const [oldName, nextName] of [['api_quickstart','api-quickstart'], ['local_inference','local-inference']]) {
      for (const suffix of ['', '_zh']) {
        const target = `${suffix ? '/zh-Hans' : prefix}/cookbook/${nextName}/`;
        const dir = join(outDir, 'cookbook', oldName + suffix);
        mkdirSync(dir, {recursive:true});
        writeFileSync(join(dir,'index.html'), `<!doctype html><html lang="${suffix || prefix ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><title>Cookbook moved</title><meta http-equiv="refresh" content="0;url=${target}"><link rel="canonical" href="https://valen-team.github.io${target}"></head><body><a href="${target}">Open the maintained Cookbook tutorial</a></body></html>`);
      }
    }
  }};
};
