import { readFile } from 'node:fs/promises';
import ts from 'typescript';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (!url.endsWith('.ts')) {
    return nextLoad(url, context);
  }

  const { outputText } = ts.transpileModule(await readFile(new URL(url), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
    },
  });
  return { format: 'module', source: outputText, shortCircuit: true };
}
