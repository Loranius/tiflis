import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const fileName = path.resolve('src/pages/StaffPage.tsx');
const options = {
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
  allowJs: false,
};
const host = {
  getScriptFileNames: () => [fileName],
  getScriptVersion: () => '1',
  getScriptSnapshot: (name) => fs.existsSync(name) ? ts.ScriptSnapshot.fromString(fs.readFileSync(name, 'utf8')) : undefined,
  getCurrentDirectory: () => process.cwd(),
  getCompilationSettings: () => options,
  getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
};
const service = ts.createLanguageService(host);
const changes = service.organizeImports(
  { type: 'file', fileName, skipDestructiveCodeActions: false },
  {},
  {},
);
let source = fs.readFileSync(fileName, 'utf8');
for (const change of changes.flatMap((entry) => entry.textChanges).sort((a, b) => b.span.start - a.span.start)) {
  source = source.slice(0, change.span.start) + change.newText + source.slice(change.span.start + change.span.length);
}
fs.writeFileSync(fileName, source);
