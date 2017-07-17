
import { Stylesheet, Generator, objectifyCSS, Resolver } from 'stylable'; //peer
import path = require('path');
const deindent = require('deindent');
var murmurhash = require('murmurhash');

var loaderUtils = require('loader-utils');

/* must be flat */
export const defaults = {
  namespacelessPrefix: 's'
};

// const importRegExp = /:import\(["']?(.*?)["']?\)/gm;
const relativeImportRegExp = /:import\(["']?(\.\/)(.*?)["']?\)/gm;

export function resolveImports(source: string, context: string) {
  const importMapping: { [key: string]: string } = {};
  const resolved = source.replace(relativeImportRegExp, (match, rel, thing) => {
    const relativePath = rel + thing;
    const fullPath = path.resolve(context, relativePath);
    importMapping[relativePath] = fullPath;
    importMapping[fullPath] = relativePath;
    return match.replace(relativePath, fullPath);
  });

  return { resolved, importMapping };
}

export function createStylesheetWithNamespace(source: string, path: string, options: typeof defaults) {
  const cssObject = objectifyCSS(source);
  const atNS = cssObject['@namespace'];
  const ns = Array.isArray(atNS) ? atNS[atNS.length - 1] : atNS;
  const namespace = (ns || options.namespacelessPrefix) + murmurhash.v3(path);
  return new Stylesheet(cssObject, namespace, source);
}

export function createImportString(importDef: any, path: string) {
  var imports = importDef.defaultExport ? [`var ${importDef.defaultExport} = require("${(path)}");`] : [];
  for (var k in importDef.named) {
    imports.push(`var ${importDef.defaultExport} = require("${(path)}")[${JSON.stringify(importDef.named[k])}];`);
  }
  return imports.join('\n');
}


export function justImport(importDef: any, path: string) {
  return `require("${path}");`;
}

export function transformStylableCSS(xt: any, source: string, resourcePath: string, context: string, resolver: Resolver, options: typeof defaults) {

  const { resolved, importMapping } = resolveImports(source, context);
  const sheet = createStylesheetWithNamespace(resolved, resourcePath, options);
  const namespace = sheet.namespace;

  const gen = new Generator({ resolver: resolver });

  gen.addEntry(sheet, false);

  const css = gen.buffer;

  const imports = sheet.imports.map((importDef: any) => {
    return justImport(null, importMapping[importDef.from]);
    // return createImportString(importDef, importMapping[importDef.from]);
  });

  const code: string = deindent`    
    ${imports.join('\n')}
    exports = module.exports = require(${JSON.stringify(require.resolve("./smallsheet.js"))}).default(
        ${JSON.stringify(sheet.root)}, 
        ${JSON.stringify(namespace)}, 
        ${JSON.stringify(sheet.classes)},
        ${JSON.stringify(css.join('\n'))}
    );
  `;
  return { sheet, code };

}


function escapepath(path: string) {
  return path.replace(/\\/gm, '\\').replace(/"/gm, '\"')
}