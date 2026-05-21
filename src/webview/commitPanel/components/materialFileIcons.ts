// Material Icon Theme SVG imports — bundled as inline text by esbuild
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — esbuild resolves .svg as raw text strings
import svgFile         from 'material-icon-theme/icons/file.svg';
// @ts-ignore
import svgReactTs      from 'material-icon-theme/icons/react_ts.svg';
// @ts-ignore
import svgReact        from 'material-icon-theme/icons/react.svg';
// @ts-ignore
import svgTypescript   from 'material-icon-theme/icons/typescript.svg';
// @ts-ignore
import svgJavascript   from 'material-icon-theme/icons/javascript.svg';
// @ts-ignore
import svgHtml         from 'material-icon-theme/icons/html.svg';
// @ts-ignore
import svgCss          from 'material-icon-theme/icons/css.svg';
// @ts-ignore
import svgSass         from 'material-icon-theme/icons/sass.svg';
// @ts-ignore
import svgLess         from 'material-icon-theme/icons/less.svg';
// @ts-ignore
import svgPhp          from 'material-icon-theme/icons/php.svg';
// @ts-ignore
import svgPython       from 'material-icon-theme/icons/python.svg';
// @ts-ignore
import svgRuby         from 'material-icon-theme/icons/ruby.svg';
// @ts-ignore
import svgGo           from 'material-icon-theme/icons/go.svg';
// @ts-ignore
import svgRust         from 'material-icon-theme/icons/rust.svg';
// @ts-ignore
import svgJson         from 'material-icon-theme/icons/json.svg';
// @ts-ignore
import svgMarkdown     from 'material-icon-theme/icons/markdown.svg';
// @ts-ignore
import svgDatabase     from 'material-icon-theme/icons/database.svg';
// @ts-ignore
import svgImage        from 'material-icon-theme/icons/image.svg';
// @ts-ignore
import svgConsole      from 'material-icon-theme/icons/console.svg';
// @ts-ignore
import svgToml         from 'material-icon-theme/icons/toml.svg';
// @ts-ignore
import svgXml          from 'material-icon-theme/icons/xml.svg';
// @ts-ignore
import svgTune         from 'material-icon-theme/icons/tune.svg';
// @ts-ignore
import svgYaml         from 'material-icon-theme/icons/yaml.svg';
// @ts-ignore
import svgFolder       from 'material-icon-theme/icons/folder.svg';
// @ts-ignore
import svgFolderOpen   from 'material-icon-theme/icons/folder-open.svg';

// Map file extension → SVG string
export const EXT_ICON: Record<string, string> = {
  ts:   svgTypescript,
  tsx:  svgReactTs,
  js:   svgJavascript,
  jsx:  svgReact,
  mjs:  svgJavascript,
  cjs:  svgJavascript,
  html: svgHtml,
  htm:  svgHtml,
  css:  svgCss,
  scss: svgSass,
  sass: svgSass,
  less: svgLess,
  php:  svgPhp,
  py:   svgPython,
  rb:   svgRuby,
  go:   svgGo,
  rs:   svgRust,
  json: svgJson,
  jsonc: svgJson,
  md:   svgMarkdown,
  markdown: svgMarkdown,
  yaml: svgYaml,
  yml:  svgYaml,
  sql:  svgDatabase,
  png:  svgImage,
  jpg:  svgImage,
  jpeg: svgImage,
  gif:  svgImage,
  svg:  svgImage,
  webp: svgImage,
  sh:   svgConsole,
  bash: svgConsole,
  zsh:  svgConsole,
  toml: svgToml,
  xml:  svgXml,
  env:  svgTune,
};

export const FALLBACK_ICON: string = svgFile;
export const FOLDER_ICON: string = svgFolder;
export const FOLDER_OPEN_ICON: string = svgFolderOpen;

export function getFileIconSvg(filename: string): string {
  const lower = filename.toLowerCase();
  const ext = lower.includes('.') ? lower.split('.').pop()! : '';
  return EXT_ICON[ext] ?? FALLBACK_ICON;
}
