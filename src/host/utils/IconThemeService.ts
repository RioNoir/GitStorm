import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface IconThemeData {
  type: 'svg' | 'font' | 'none';
  // SVG mode: maps icon definition name → webview URI string for the SVG file
  svgMap?: Record<string, string>;
  fileExtensions?: Record<string, string>;   // ext (lower) → icon name
  fileNames?: Record<string, string>;         // filename (lower) → icon name
  languageIds?: Record<string, string>;       // language id → icon name
  folderNames?: Record<string, string>;
  folderNamesExpanded?: Record<string, string>;
  file?: string;
  folder?: string;
  folderExpanded?: string;
  // Font mode
  fontFaceUri?: string;
  fontId?: string;
  fontFormat?: string;
  charMap?: Record<string, string>;   // icon name → unicode char (already converted)
  colorMap?: Record<string, string>;  // icon name → color
}

interface IconDefinitionSvg { iconPath: string }
interface IconDefinitionFont { fontCharacter: string; fontColor?: string; fontSize?: string }
type IconDef = IconDefinitionSvg | IconDefinitionFont;

function isSvg(d: IconDef): d is IconDefinitionSvg {
  return 'iconPath' in d;
}

// Convert "\E099" escape notation → actual Unicode character U+E099
function parseCharacter(raw: string): string {
  return raw.replace(/\\([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

export async function loadIconTheme(webview: vscode.Webview): Promise<IconThemeData> {
  try {
    const themeId = vscode.workspace.getConfiguration('workbench').get<string>('iconTheme');
    if (!themeId) return { type: 'none' };

    const themeExt = vscode.extensions.all.find(ext => {
      const themes: Array<{ id: string; path: string }> = ext.packageJSON?.contributes?.iconThemes ?? [];
      return themes.some(t => t.id === themeId);
    });
    if (!themeExt) return { type: 'none' };

    const themes: Array<{ id: string; path: string }> = themeExt.packageJSON?.contributes?.iconThemes ?? [];
    const themeDef = themes.find(t => t.id === themeId);
    if (!themeDef) return { type: 'none' };

    const themeJsonPath = path.join(themeExt.extensionPath, themeDef.path);
    const themeDir = path.dirname(themeJsonPath);
    const raw = fs.readFileSync(themeJsonPath, 'utf8');
    const json = stripJsonComments(raw);

    const iconDefinitions: Record<string, IconDef> = json.iconDefinitions ?? {};
    const firstDef = Object.values(iconDefinitions)[0];
    if (!firstDef) return { type: 'none' };

    const isDark = vscode.window.activeColorTheme.kind !== vscode.ColorThemeKind.Light;
    const variant = isDark ? json : mergeVariant(json, json.light ?? {});

    if (isSvg(firstDef)) {
      // SVG-based theme (Material Icon Theme, etc.)
      const svgMap: Record<string, string> = {};

      // Build map for both base and light-override definitions
      const allDefs = isDark
        ? iconDefinitions
        : { ...iconDefinitions, ...(json.light?.iconDefinitions ?? {}) };

      for (const [name, def] of Object.entries(allDefs)) {
        if (!isSvg(def)) continue;
        const absPath = path.resolve(themeDir, def.iconPath);
        if (fs.existsSync(absPath)) {
          svgMap[name] = webview.asWebviewUri(vscode.Uri.file(absPath)).toString();
        }
      }

      return {
        type: 'svg',
        svgMap,
        fileExtensions: variant.fileExtensions ?? {},
        fileNames: variant.fileNames ?? {},
        languageIds: variant.languageIds ?? {},
        folderNames: variant.folderNames ?? {},
        folderNamesExpanded: variant.folderNamesExpanded ?? {},
        file: variant.file ?? json.file,
        folder: variant.folder ?? json.folder,
        folderExpanded: variant.folderExpanded ?? json.folderExpanded,
      };
    } else {
      // Font-based theme (Seti, etc.)
      const fonts: Array<{ id: string; src: Array<{ path: string; format: string }> }> = json.fonts ?? [];
      const primaryFont = fonts[0];
      if (!primaryFont) return { type: 'none' };

      const fontSrc = primaryFont.src[0];
      const fontAbsPath = path.resolve(themeDir, fontSrc.path);
      if (!fs.existsSync(fontAbsPath)) return { type: 'none' };

      const fontUri = webview.asWebviewUri(vscode.Uri.file(fontAbsPath)).toString();
      const charMap: Record<string, string> = {};
      const colorMap: Record<string, string> = {};

      for (const [name, def] of Object.entries(iconDefinitions)) {
        if (isSvg(def)) continue;
        const fc = def as IconDefinitionFont;
        charMap[name] = parseCharacter(fc.fontCharacter);
        if (fc.fontColor) colorMap[name] = fc.fontColor;
      }

      return {
        type: 'font',
        fontFaceUri: fontUri,
        fontId: primaryFont.id,
        fontFormat: fontSrc.format,
        charMap,
        colorMap,
        fileExtensions: variant.fileExtensions ?? {},
        fileNames: variant.fileNames ?? {},
        languageIds: variant.languageIds ?? {},
        folderNames: variant.folderNames ?? {},
        folderNamesExpanded: variant.folderNamesExpanded ?? {},
        file: variant.file ?? json.file,
        folder: variant.folder ?? json.folder,
        folderExpanded: variant.folderExpanded ?? json.folderExpanded,
      };
    }
  } catch {
    return { type: 'none' };
  }
}

// Parse JSONC (JSON with // and /* */ comments and trailing commas)
function stripJsonComments(text: string): unknown {
  let result = '';
  let i = 0;
  while (i < text.length) {
    // Single-line comment
    if (text[i] === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    // Multi-line comment
    if (text[i] === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // String — copy verbatim, don't interpret anything inside
    if (text[i] === '"') {
      result += text[i++];
      while (i < text.length) {
        if (text[i] === '\\') { result += text[i++]; result += text[i++]; continue; }
        result += text[i];
        if (text[i++] === '"') break;
      }
      continue;
    }
    result += text[i++];
  }
  // Remove trailing commas before } or ]
  result = result.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(result);
}

function mergeVariant(base: Record<string, unknown>, light: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };
  for (const key of ['fileExtensions', 'fileNames', 'languageIds', 'folderNames', 'folderNamesExpanded', 'file', 'folder', 'folderExpanded'] as const) {
    if (light[key]) {
      if (typeof light[key] === 'object' && typeof base[key] === 'object') {
        result[key] = { ...(base[key] as object), ...(light[key] as object) };
      } else {
        result[key] = light[key];
      }
    }
  }
  return result;
}
