import {
  ImportDeclaration,
  ImportDeclarationStructure,
  ImportSpecifierStructure,
  SourceFile,
} from 'ts-morph'

export function toUpperCamelCase(str: string) {
  if (!str) {
    return str
  }
  return str?.charAt(0).toUpperCase() + str.slice(1)
}

export function debugLog(...msg: any[]) {
  if (global.debug) {
    console.log(...msg)
  }
}

export function todo(msg: string) {
  return `TODO(NestJS Migration): ${msg}`
}

const uniqImports = (arr: ImportDeclarationStructure[]) => {
  return arr.reduce((acc, cur) => {
    const found = acc.find((a) => a.moduleSpecifier === cur.moduleSpecifier)
    if (found) {
      if (cur.namedImports) {
        if (
          Array.isArray(found.namedImports) &&
          found.namedImports.length &&
          Array.isArray(cur.namedImports) &&
          cur.namedImports.length
        ) {
          found.namedImports = Array.from(
            new Set([...found.namedImports, ...cur.namedImports]),
          )
          return acc
        }
      } else if (cur.namespaceImport) {
        if (found.namespaceImport === cur.namespaceImport) {
          return acc
        }
      }
    }
    return [...acc, cur]
  }, [] as ImportDeclarationStructure[])
}

export function updateImportDeclarations(
  outputFile: SourceFile,
  importToAdds: ImportDeclarationStructure[],
) {
  const existingImports = outputFile.getImportDeclarations()
  existingImports.forEach((importDecl) => {
    console.log(
      importDecl.getModuleSpecifier().getText(),
      importDecl.getModuleSpecifier().getLiteralText(),
    )
  })
  for (const importToAdd of uniqImports(importToAdds)) {
    const checkImportType = (
      a: ImportDeclaration,
      b: ImportDeclarationStructure,
    ) => {
      return (
        // NOTE. InvalidOperationError: An import declaration cannot have both a namespace import and a named import.
        !(a.getNamespaceImport() && a.getNamedImports()) &&
        ((a.getNamespaceImport() && b.namespaceImport) ||
          (a.getNamedImports()?.length && b.namedImports?.length) ||
          (a.getDefaultImport() && b.defaultImport))
      )
    }
    const existingImport =
      existingImports.find(
        (importDecl) =>
          importDecl.getModuleSpecifier().getLiteralText() ===
            importToAdd.moduleSpecifier &&
          checkImportType(importDecl, importToAdd),
      ) ||
      (importToAdd.moduleSpecifier.includes('src/modules')
        ? existingImports.find(
            (importDecl) =>
              importDecl.getModuleSpecifier().getLiteralText() ===
                importToAdd.moduleSpecifier.replace(
                  /src\/api\/modules\/[^\/]*/,
                  '.',
                ) && checkImportType(importDecl, importToAdd),
          )
        : null)

    // If the import exists, add any missing named imports
    debugLog('existingImport', existingImport?.getText(), importToAdd)
    if (existingImport) {
      if (existingImport.getNamespaceImport()) {
        // Namespace Imports
        // Example
        //   import * as userLib from 'src/lib/users'
        debugLog(
          'Namespace Import',
          existingImport.getNamespaceImport()?.getText(),
          importToAdd,
        )
        if (
          existingImport.getNamespaceImport()?.getText() !==
          importToAdd.namespaceImport
        ) {
          outputFile.addImportDeclaration(importToAdd)
        }
      } else if (existingImport.getDefaultImport()) {
        // Default Imports
        // Example
        //   import logger from 'src/lib/logger'
        debugLog(
          'Default Import',
          existingImport.getDefaultImport()?.getText(),
          importToAdd,
        )
        if (
          existingImport.getDefaultImport()?.getText() !==
          importToAdd.defaultImport
        ) {
          outputFile.addImportDeclaration(importToAdd)
        }
      } else {
        // Named Imports
        // Example
        //   import { Injectable, Logger } from '@nestjs/common';
        if (!importToAdd.namedImports?.length) {
          continue
        }
        const namedImports = existingImport.getNamedImports()
        const namedImportNames = namedImports.map((namedImport) =>
          namedImport.getName(),
        )
        debugLog('existingImport', importToAdd, namedImportNames)
        if (
          namedImportNames?.length &&
          Array.isArray(importToAdd.namedImports)
        ) {
          for (const namedImport of importToAdd.namedImports as ImportSpecifierStructure[]) {
            // debugLog('namedImportNames', namedImport, namedImportNames)
            if (!namedImportNames.includes(namedImport?.name)) {
              existingImport.addNamedImport(namedImport)
            }
          }
        } else {
          outputFile.addImportDeclaration(importToAdd)
        }
      }
    } else {
      // If the import doesn't exist, create a new import declaration
      outputFile.addImportDeclaration(importToAdd)
    }
  }
}
