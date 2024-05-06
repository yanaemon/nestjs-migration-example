import * as fs from 'fs'
import { program } from 'commander'
import {
  ArrowFunction,
  CallExpression,
  FunctionDeclaration,
  ImportDeclaration,
  ImportDeclarationStructure,
  ImportSpecifierStructure,
  Node,
  Project,
  Scope,
  SourceFile,
  SyntaxKind,
} from 'ts-morph'
import { httpStatusMap } from './constants'

/**
 * Generate E2E test code from existing codes
 *
 * @example
 * $ yarn ts-node src/scripts/migrateRoute/main.ts --key users --mode move
 */
program
  .version('1.0.0')
  .option('--key <key>', 'key of module (ex. exampleResources)')
  .option('--moduleKey <moduleKey>', 'key of module (ex. exampleResources)')
  .option(
    '--routePath <routePath>',
    'route file path (ex. exampleResources.ts)',
  )
  .option('--functions <functions>', 'functions to migrate (ex. func1,func2)')
  .option('--admin')
  .option('--debug')
  .option('--mode <mode>', 'mode to run (ex. move, resJson')
  .parse(process.argv)

const opts = program.opts()
const ROUTE_BASE_DIR = 'src/routes'

function toUpperCamelCase(str: string) {
  if (!str) {
    return str
  }
  return str?.charAt(0).toUpperCase() + str.slice(1)
}

type ModuleConfig = {
  /** @example ~/github.com/org/repo/root/tsconfig.json */
  tsConfigPath: string
  /** @example ~/github.com/org/repo/root/src/modules/resources */
  moduleDir: string
  /** @example resources */
  key: string
  /** @example ~/github.com/org/repo/root/src/routes/resources.ts */
  routePath: string
  /** @example [ 'index', 'create' ] */
  functions: string[]
  /** @example false */
  admin: boolean

  controller: ComponentConfig
  service: ComponentConfig
  dto: ComponentConfig
}

type ComponentConfig = {
  /** @example resources.controller.ts */
  fileName: string
  /** @example ${moduleDir}/resources.controller.ts */
  filePath: string
  /** @example ResourcesController */
  className: string
  /** @example resourcesController */
  varName: string
}

export function getModuleConfig(params: {
  key: string
  moduleKey?: string
  routePath: string
  functions: string[]
  admin: boolean
}) {
  if (!params.key) {
    throw new Error('key is required')
  }

  const resource = params.key
  const moduleKey = params.moduleKey || resource
  const routePath = params.routePath || `${resource}.ts`
  const functions = params.functions || []
  const admin = params.admin

  const baseDir = process.cwd()
  const moduleDir = `${baseDir}/src/modules/${moduleKey}`
  const classKey = toUpperCamelCase(params.key)
  const suffixFile = params.admin ? '.admin' : ''
  const suffixName = params.admin ? 'Admin' : ''
  return {
    tsConfigPath: `${baseDir}/tsconfig.json`,
    moduleDir,
    key: resource,
    routePath: `${baseDir}/${ROUTE_BASE_DIR}/${routePath}`,
    functions,
    admin,

    controller: {
      fileName: `${resource}${suffixFile}.controller.ts`,
      filePath: `${moduleDir}/${resource}${suffixFile}.controller.ts`,
      className: `${classKey}${suffixName}Controller`,
      varName: `${resource}${suffixName}Controller`,
    },
    service: {
      fileName: `${resource}${suffixFile}.service.ts`,
      filePath: `${moduleDir}/${resource}${suffixFile}.service.ts`,
      className: `${classKey}${suffixName}Service`,
      varName: `${resource}${suffixName}Service`,
    },
    dto: {
      fileName: `${resource}.dto.ts`,
      filePath: `${moduleDir}/dtos/${resource}.dto.ts`,
      className: `${classKey}Dto`,
      varName: `${resource}Dto`,
    },
  }
}

function debugLog(...msg: any[]) {
  if (opts.debug) {
    console.log(...msg)
  }
}

function todo(msg: string) {
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

export function copyAndPasteToService(params: ModuleConfig) {
  // Initialize a project object
  const project = new Project()

  // Add the source file to the project
  project.addSourceFilesFromTsConfig(params.tsConfigPath)
  const sourceFile = project.addSourceFileAtPath(params.routePath)

  // Create or overwrite the Controller file
  const outputFileExists = fs.existsSync(params.service.filePath)
  debugLog('outputFileExists', outputFileExists)
  // Create or load the source file
  const outputFile = outputFileExists
    ? project.addSourceFileAtPath(params.service.filePath)
    : project.createSourceFile(params.service.filePath, '', {
        overwrite: true,
      })

  // Add necessary imports
  const importToAdds = [
    {
      moduleSpecifier: '@nestjs/common',
      namedImports: ['Injectable'],
    },
  ] as ImportDeclarationStructure[]
  // Copy original imports from source file to output file
  sourceFile.getImportDeclarations().forEach((importDeclaration) => {
    const importClause = importDeclaration.getStructure()
    importToAdds.push(importClause)
  })
  updateImportDeclarations(outputFile, importToAdds)

  // Get the class from the source file
  let classDeclaration = outputFile.getClass(params.service.className)
  debugLog('classDeclaration', classDeclaration)
  // If the class exists, proceed to inherit existing functionality
  if (!classDeclaration) {
    // Iterate over existing methods in the class
    classDeclaration = outputFile.addClass({
      name: params.service.className,
      isExported: true,
      decorators: [
        {
          name: 'Injectable',
          arguments: [],
        },
      ],
    })
  }

  // Iterate over each function in the source file
  sourceFile.forEachChild((node) => {
    let functionName: string | undefined
    let functionDeclaration: FunctionDeclaration | ArrowFunction | undefined

    if (node.getKind() === SyntaxKind.FunctionDeclaration) {
      functionDeclaration = node.asKind(SyntaxKind.FunctionDeclaration)
      functionName = functionDeclaration?.getName()
    } else if (node.getKind() === SyntaxKind.VariableStatement) {
      const constFunctionDeclaration = node.asKind(SyntaxKind.VariableStatement)
      if (constFunctionDeclaration) {
        console.log('constFunctionDeclaration', constFunctionDeclaration)
        constFunctionDeclaration.getDeclarations().forEach((declaration) => {
          const initializer = declaration.getInitializer()
          if (
            initializer &&
            initializer.getKind() === SyntaxKind.ArrowFunction
          ) {
            functionName = declaration.getName()
            functionDeclaration = initializer.asKind(SyntaxKind.ArrowFunction)
          }
        })
      }
    }

    if (functionName && functionDeclaration) {
      if (
        params.functions?.length &&
        !params.functions.includes(functionName)
      ) {
        return
      }

      // Extract JSDoc comments
      const jsDocs = functionDeclaration
        .getJsDocs()
        .map((doc) => doc.getStructure())
      // Extract parameters, preserving their original types or using 'any' as fallback
      const parameters = functionDeclaration
        .getParameters()
        .map((parameter) => {
          const parameterType = parameter.getTypeNode()?.getText() || 'any' // Preserve original type text
          return {
            name: parameter.getName(),
            // Directly set the type without import when possible
            type: parameterType.includes('import') ? 'any' : parameterType,
          }
        })
      // Extract function body
      const bodyText = functionDeclaration.getBodyText() || ''

      // Check if the return type is explicitly `Promise<void>`
      const returnTypeNode = functionDeclaration.getReturnTypeNode()
      const returnType = returnTypeNode?.getText() || ''

      // Construct the method for the class structure
      classDeclaration?.addMethod({
        name: functionName,
        parameters: parameters.map((param) => ({
          name: param.name,
          // Directly use the type text, avoiding modifications
          type: param.type,
        })),
        docs: [todo('Replace Parameters'), ...jsDocs],
        statements: bodyText,
        isAsync: true,
        returnType: returnType !== 'Promise<void>' ? returnType : '',
      })
    }
  })

  // Save the transformed file
  outputFile.saveSync()

  console.log('Transformation completed.')
}

export function generateController(params: ModuleConfig) {
  // Setup a new project
  const project = new Project()

  // Load the source file
  project.addSourceFilesFromTsConfig(params.tsConfigPath)
  const sourceFile = project.addSourceFileAtPath(params.routePath)

  // Create or overwrite the Controller file
  const outputFileExists = fs.existsSync(params.controller.filePath)
  debugLog('outputFileExists', outputFileExists)
  // Create or load the source file
  const outputFile = outputFileExists
    ? project.addSourceFileAtPath(params.controller.filePath)
    : project.createSourceFile(params.controller.filePath, '', {
        overwrite: true,
      })

  const entryPoints = parseExpressServer()
  const getEntryPoint = (func: string) => {
    return entryPoints.find((ep) => ep.func === `${params.key}.${func}`)
  }
  const rootPath = params.admin ? `admin/${params.key}` : params.key

  // Get the class from the source file
  let classDeclaration = outputFile.getClass(params.controller.className)
  debugLog('classDeclaration', classDeclaration)
  if (!classDeclaration) {
    classDeclaration = outputFile.addClass({
      name: params.controller.className,
      isExported: true,
      docs: [todo('Check Controller Entry Point')],
      decorators: [
        {
          name: 'ApiTags',
          arguments: [`'${params.key}'`],
        },
        {
          name: 'Controller',
          arguments: [`'${rootPath}'`],
        },
      ],
      ctors: [
        {
          parameters: [
            {
              name: params.service.varName,
              type: params.service.className,
              decorators: [
                { name: 'Inject', arguments: [params.service.className] },
              ],
              scope: Scope.Private,
            },
          ],
        },
      ],
    })
  }

  // generate function and check HTTP Method
  const httpMethods = new Set<HttpMethod>()

  sourceFile.forEachChild((node) => {
    let functionName: string | undefined
    let functionDeclaration: FunctionDeclaration | ArrowFunction | undefined

    if (node.getKind() === SyntaxKind.FunctionDeclaration) {
      functionDeclaration = node.asKind(SyntaxKind.FunctionDeclaration)
      functionName = functionDeclaration?.getName()
    } else if (node.getKind() === SyntaxKind.VariableStatement) {
      const constFunctionDeclaration = node.asKind(SyntaxKind.VariableStatement)
      if (constFunctionDeclaration) {
        console.log('constFunctionDeclaration', constFunctionDeclaration)
        constFunctionDeclaration.getDeclarations().forEach((declaration) => {
          const initializer = declaration.getInitializer()
          if (
            initializer &&
            initializer.getKind() === SyntaxKind.ArrowFunction
          ) {
            functionName = declaration.getName()
            functionDeclaration = initializer.asKind(SyntaxKind.ArrowFunction)
          }
        })
      }
    }

    if (functionName && functionDeclaration) {
      if (
        params.functions?.length &&
        !params.functions.includes(functionName)
      ) {
        return
      }
      const funcConfig =
        getEntryPoint(functionName) || getFunctionConfig(functionName)
      const routePath =
        funcConfig.path?.replace(new RegExp(`/api/${rootPath}(/|$)`), '') || ''
      const httpMethod = toUpperCamelCase(funcConfig.method) as HttpMethod
      httpMethods.add(httpMethod)

      classDeclaration?.addMethod({
        name: functionName,
        decorators: [
          {
            name: httpMethod,
            arguments: [routePath ? `'${routePath}'` : ''],
          },
        ],
        parameters: [
          {
            name: 'req',
            type: 'any',
            decorators: [{ name: 'Req', arguments: [] }],
          },
          {
            name: 'res',
            type: 'any',
            decorators: [{ name: 'Res', arguments: [] }],
          },
        ],
        docs: [todo('Check Entry Point'), todo('Replace Req/Res')],
        statements: `return await this.${params.service.varName}.${functionName}(req, res);`,
        isAsync: true,
      })
    }
  })

  // Add necessary imports
  const importToAdds = [
    {
      moduleSpecifier: '@nestjs/common',
      namedImports: [
        'Controller',
        'Req',
        'Res',
        'Inject',
        ...httpMethods,
      ].sort(),
    },
    { moduleSpecifier: '@nestjs/swagger', namedImports: ['ApiTags'] },
    {
      moduleSpecifier: `./${params.service.fileName.replace('.ts', '')}`,
      namedImports: [params.service.className],
    },
  ] as ImportDeclarationStructure[]
  updateImportDeclarations(outputFile, importToAdds)

  // Save the generated controller file
  outputFile.saveSync()

  console.log('Controller generated successfully.')
}

type HttpMethod = 'Get' | 'Post' | 'Put' | 'Delete'

/**
 * Helper function to infer HTTP method based on function name or custom logic
 * @param functionName - The name of the function
 * @returns The inferred HTTP method and route parameter
 */
function getFunctionConfig(functionName: string): {
  method: HttpMethod
  path: 'id' | null
} {
  // Example simplistic inference logic; adjust according to your conventions
  if (functionName.startsWith('get')) {
    return { method: 'Get', path: 'id' }
  } else if (functionName.startsWith('index')) {
    return { method: 'Get', path: null }
  } else if (functionName.startsWith('create')) {
    return { method: 'Post', path: null }
  } else if (functionName.startsWith('update')) {
    return { method: 'Put', path: 'id' }
  } else if (functionName.startsWith('delete')) {
    return { method: 'Delete', path: 'id' }
  } else if (functionName.startsWith('remove')) {
    return { method: 'Delete', path: 'id' }
  }
  return { method: 'Get', path: null } // Default fallback
}

export function addTodoComment(params: ModuleConfig) {
  // Initialize a new ts-morph Project
  const project = new Project()

  // Add the source file to the project
  project.addSourceFilesFromTsConfig(params.tsConfigPath)
  const sourceFile = project.addSourceFileAtPath(params.service.filePath)

  const changes: { pos: number; text: string }[] = []

  sourceFile.getClasses().forEach((classDeclaration) => {
    classDeclaration.getMethods().forEach((method) => {
      method.forEachDescendant((node) => {
        if (
          node.getKind() === SyntaxKind.Identifier &&
          ['req', 'res'].includes(node.getText())
        ) {
          // Ensure the node is part of an expression (usage) and not a declaration
          if (
            node.getParent() &&
            node.getParent()?.getKind() !== SyntaxKind.Parameter
          ) {
            const start = node.getStartLinePos()
            if (!changes.some((change) => change.pos === start)) {
              changes.push({
                pos: start,
                text: `// ${todo('Check req/res')}\n`,
              })
            }
          }
        }
      })
    })
  })

  // Sort changes by position in ascending order to insert from top to bottom
  changes.sort((a, b) => a.pos - b.pos)

  // Apply changes, adjusting for comment length as we go
  let cumulativeOffset = 0
  changes.forEach(({ pos, text }) => {
    const adjustedPos = pos + cumulativeOffset
    sourceFile.insertText(adjustedPos, text)
    cumulativeOffset += text.length
  })

  // Optionally, save the changes to the source file
  sourceFile.save().catch((err) => console.error(err))
}

type Route = {
  type: 'group'
  middlewares: string[]
  path: string
  routes: EntryPoint[]
}
type EntryPoint = {
  type: 'handler'
  method: string // 'get' | 'post' | 'put' | 'delete'
  path: string
  func: string
}

function parseExpressRoute(node: Node) {
  const routes: EntryPoint[] = []
  let route = {} as EntryPoint
  node.forEachDescendant((descendant) => {
    debugLog(descendant.getKindName(), descendant.getText())
    if (descendant.getKind() === SyntaxKind.Identifier) {
      if (['get', 'post', 'put', 'delete'].includes(descendant.getText())) {
        debugLog('↑↑↑↑↑ method ↑↑↑↑↑')
        route = {
          type: 'handler' as const,
          method: descendant.getText(),
          path: '',
          func: '',
        }
        routes.push(route)
      }
    } else if (descendant.getKind() === SyntaxKind.StringLiteral) {
      if (route.path) return
      debugLog('↑↑↑↑↑ path ↑↑↑↑↑')
      route.path = descendant.getText().replace(/'/g, '')
    } else if (descendant.getKind() === SyntaxKind.CallExpression) {
      if (route.func) return
      debugLog('↑↑↑↑↑ func ↑↑↑↑↑')
      route.func = descendant.getText().replace(/wrap\((.*)\)/g, '$1')
    }
  })
  return routes
}

function parseAppUse(node: Node) {
  const callExpr = node.asKind(SyntaxKind.CallExpression)
  const expression = callExpr?.getExpression()
  debugLog('---------- use -----------')
  debugLog(expression?.getText())
  const args = callExpr?.getArguments() || []

  debugLog(
    args[args.length - 1]?.getKindName(),
    args[args.length - 1]?.getText(),
  )
  return {
    type: 'group' as const,
    path: args[0].getText().replace(/['"`]+/g, ''),
    middlewares: args.slice(1, args.length - 1).map((arg) => arg.getText()),
    routes: parseExpressRoute(args[args.length - 1]),
  }
}
function parseExpressServer() {
  const project = new Project()
  const sourceFile = project.addSourceFileAtPath('src/server.ts')

  const results: (EntryPoint | Route)[] = []

  sourceFile?.forEachDescendant((descendant) => {
    if (descendant.getKind() === SyntaxKind.CallExpression) {
      const callExpr = descendant.asKind(SyntaxKind.CallExpression)
      const expression = callExpr?.getExpression()
      if (expression?.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propertyAccessExpr = expression.asKind(
          SyntaxKind.PropertyAccessExpression,
        )
        if (propertyAccessExpr?.getExpression().getText() === 'app') {
          if (propertyAccessExpr.getName() === 'use') {
            // app.use
            const result = parseAppUse(descendant)
            if (result.path) {
              results.push(result)
            }
          } else {
            // app.get / app.post / app.put / app.delete
            debugLog('flat route')
            const result = parseExpressRoute(descendant)
            debugLog('flat route result', result)
            if (result?.length) {
              results.push(result[0])
            }
          }
        }
      }
    }
  })

  console.log('===========================')
  const flattenRoutes = results.reduce(
    (acc, cur) => {
      if (cur.type === 'group') {
        for (const route of cur.routes) {
          acc.push({
            method: route.method,
            path: cur.path + route.path,
            func: route.func?.split('\n')[0],
            middlewares: cur.middlewares,
          })
        }
      } else {
        acc.push({
          method: cur.method,
          path: cur.path,
          func: cur.func?.split('\n')[0],
        })
      }
      return acc
    },
    [] as {
      method: string
      path: string
      func: string
      middlewares?: string[]
    }[],
  )
  for (const route of flattenRoutes) {
    console.log(
      route.method,
      route.path,
      route.func,
      route.middlewares?.join(','),
    )
  }
  return flattenRoutes
}

function getResStructure(callExpression: any) {
  let current = callExpression
  const res = {
    status: undefined,
    json: undefined,
  }
  while (current) {
    const expression = current.getExpression()
    if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
      const name = expression
        .asKind(SyntaxKind.PropertyAccessExpression)
        ?.getName()
      if (name === 'status') {
        res.status = current.getArguments()[0].getText()
      } else if (name === 'json') {
        res.json = current.getArguments()[0]?.getText() || null
      }
      current = expression.getExpression().asKind(SyntaxKind.CallExpression)
    } else {
      break // チェーンの終端または想定外のパターン
    }
  }
  return res
}

export function replaceResError(params: ModuleConfig) {
  // Setup a new project
  const project = new Project()

  // Load the source file
  project.addSourceFilesFromTsConfig(params.tsConfigPath)
  const sourceFile = project.addSourceFileAtPath(params.service.filePath)

  const namedImports = new Set<string>()
  // Find all call expressions in the file
  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      console.log(node.getText())
      const callExpression = (node as any).getExpression()
      if (!Node.isPropertyAccessExpression(callExpression)) {
        return
      }
      const resError = getResStructure(node)
      console.log('### resError', resError)
      if (resError.status && resError.status !== '200' && resError.json) {
        // Replace with `throw new BadRequestException(...)`
        // const targetNode = node.getParent().getText().startsWith('return')
        //   ? node.getParent()
        //   : node
        node
          ?.getParent()
          ?.replaceWithText(
            httpStatusMap[resError.status]
              ? `throw new ${httpStatusMap[resError.status]}(${resError.json})`
              : `throw new HttpException(${resError.json}, ${resError.status})`,
          )
        namedImports.add(httpStatusMap[resError.status] || 'HttpException')
      }
    }
  })

  if (namedImports.size > 0) {
    updateImportDeclarations(sourceFile, [
      {
        moduleSpecifier: '@nestjs/common',
        namedImports: [...namedImports],
      },
    ] as ImportDeclarationStructure[])
  }
  // Save the transformed file
  sourceFile.saveSync()
}

export function replaceRes(params: ModuleConfig) {
  // Setup a new project
  const project = new Project()

  // Load the source file
  project.addSourceFilesFromTsConfig(params.tsConfigPath)
  const sourceFile = project.addSourceFileAtPath(params.service.filePath)

  // Find all call expressions in the file
  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      console.log(node.getText())
      const callExpression = (node as any).getExpression()
      if (!Node.isPropertyAccessExpression(callExpression)) {
        return
      }
      const res = getResStructure(node)
      console.log('### res', res)
      if ((!res.status || res.status === '200') && res.json !== undefined) {
        node
          ?.getParent()
          ?.replaceWithText(`return ${res.json === null ? '' : res.json}`)
      }
    }
  })

  // Save the transformed file
  sourceFile.saveSync()
}

export function replaceReq(params: ModuleConfig) {
  // Initialize a new ts-morph Project
  const project = new Project()

  // Add the source file to the project
  project.addSourceFilesFromTsConfig(params.tsConfigPath)
  const sourceFile = project.addSourceFileAtPath(params.service.filePath)
  const controllerSourceFile = project.addSourceFileAtPath(
    params.controller.filePath,
  )

  const importsToAdd: ImportDeclarationStructure[] = []
  const controllerImportsToAdd: ImportDeclarationStructure[] = []

  sourceFile.getClasses().forEach((classDeclaration) => {
    const controllerClass = controllerSourceFile.getClasses()
    // GET ([query, [options]])
    // POST, PUT (...params, [body], [{ ...options, ...query }])

    classDeclaration.getMethods().forEach((method) => {
      const paramNames = method.getParameters().map((p) => p.getName())

      console.log('========== method ==========')
      console.log(method.getName(), paramNames)

      if (paramNames[0] !== 'req' || paramNames[1] !== 'res') {
        console.log('already migrated', method.getName())
        return
      }

      const reqVars = {
        query: new Set<string | null>(),
        body: new Set<string | null>(),
        params: new Set<string | null>(),
      }

      method.forEachDescendant((node) => {
        if (node.getText().startsWith('req.')) {
          console.log('---------- req ---------')
          const vars = node.getText().split('.')
          console.log(node.getText(), node.getParent()?.getText(), vars)

          if (reqVars[vars[1] as keyof typeof reqVars]) {
            reqVars[vars[1] as keyof typeof reqVars].add(
              vars[2]?.replace(/[\?\${`]/g, '').replace(/[ }\[\(\n].*/g, '') ||
                null,
            )
          } else {
            console.error('unexpected var', vars)
          }
          const getVarStr = (vars: string[]) => vars.filter((v) => v).join('.')
          const v = getVarStr(vars.slice(1))
          const restV = getVarStr(vars.slice(2))
          switch (vars[1]) {
            case 'query': {
              node.replaceWithText(v)
              break
            }
            case 'body': {
              node.replaceWithText(v)
              break
            }
            case 'params': {
              if (restV) {
                node.replaceWithText(restV)
              } else {
                node.replaceWithText(v)
              }
              break
            }
            case 'user': {
              node.replaceWithText(getVarStr(['requestUser', restV]))
              break
            }
            case 'userData': {
              node.replaceWithText(getVarStr(['requestUserData', restV]))
              break
            }
          }
        }
      })
      console.log(reqVars)

      const controllerMethod = controllerClass.map((classDeclaration) =>
        classDeclaration
          .getMethods()
          .find((m) => m.getName() === method.getName()),
      )[0]
      let methodCallExpression: CallExpression | undefined
      const methodCallStr = `this.${
        params.service.varName
      }.${method.getName()}(req, res)`
      controllerMethod?.forEachDescendant((node) => {
        if (node.getKind() === SyntaxKind.CallExpression) {
          if (node.getText() === methodCallStr) {
            methodCallExpression = node.asKind(SyntaxKind.CallExpression)
          }
          console.log(node.getText(), methodCallStr)
        }
      })

      console.log(
        controllerClass[0].getName(),
        controllerMethod?.getName(),
        methodCallExpression?.getText(),
      )

      // argument
      controllerMethod?.getParameters().forEach((p) => p.remove())
      methodCallExpression
        ?.getArguments()
        .forEach((a) => methodCallExpression?.removeArgument(a))
      method.getParameters().forEach((p) => p.remove())

      // params
      if (reqVars.params.size) {
        Array.from(reqVars.params).forEach((name) => {
          if (name) {
            controllerMethod?.addParameter({
              name,
              type: 'string',
              decorators: [{ name: 'Param', arguments: [`'${name}'`] }],
            })
            methodCallExpression?.addArgument(name)
            method.addParameter({
              name,
              type: 'string',
            })
            controllerImportsToAdd.push({
              moduleSpecifier: '@nestjs/common',
              namedImports: ['Param'],
            } as ImportDeclarationStructure)
          } else {
            controllerMethod?.addParameter({
              name: 'params',
              type: 'any',
              decorators: [{ name: 'Params', arguments: [] }],
            })
            methodCallExpression?.addArgument('params')
            method.addParameter({
              name: 'params',
              type: 'any',
            })
            controllerImportsToAdd.push({
              moduleSpecifier: '@nestjs/common',
              namedImports: ['Params'],
            } as ImportDeclarationStructure)
          }
        })
      }
      // body
      if (reqVars.body.size) {
        const bodyTypes = []
        for (const key of reqVars.body) {
          if (key) {
            bodyTypes.push(key)
          }
        }
        const bodyType = bodyTypes.length
          ? `{ ${bodyTypes.map((key) => `${key}?: any`).join('; ')} }`
          : '{ [key: string]: any }'
        controllerMethod?.addParameter({
          name: 'body',
          type: bodyType,
          decorators: [{ name: 'Body', arguments: [] }],
        })
        method.addParameter({
          name: 'body',
          type: bodyType,
        })
        methodCallExpression?.addArgument('body')
        controllerImportsToAdd.push({
          moduleSpecifier: '@nestjs/common',
          namedImports: ['Body'],
        } as ImportDeclarationStructure)
      }
      // query
      const queryOptions = []
      if (reqVars.query.size) {
        const typeFields = []
        for (const key of reqVars.query) {
          if (key) {
            typeFields.push(`${key}?: any`)
          }
        }
        const queryType = typeFields.length
          ? `${typeFields.join('; ')}`
          : '[key: string]: any'
        const queryOption = {
          name: 'query',
          type: queryType,
          varName: 'query',
          isSpread: true,
        }
        queryOptions.push(queryOption)
        if (queryOptions.length) {
          controllerMethod?.addParameter({
            name: 'query',
            type: `{ ${queryType} }`,
            decorators: [{ name: 'Query', arguments: [] }],
          })
          controllerImportsToAdd.push({
            moduleSpecifier: '@nestjs/common',
            namedImports: ['Query'],
          } as ImportDeclarationStructure)
        }
      }
      const options = queryOptions.sort((a, b) =>
        b.isSpread ? -1 : a.isSpread ? 1 : 0,
      )
      console.log(options)
      const makeArg = (v: string[], delim = ', ') => `{ ${v.join(delim)} }`
      if (options.length) {
        methodCallExpression?.addArgument(
          makeArg(
            options.map((o) =>
              o.isSpread ? `...${o.varName}` : `${o.name}: ${o.varName}`,
            ),
          ),
        )
        method.addParameter({
          name: makeArg(
            options.map((o) => (o.isSpread ? `...${o.name}` : o.name)),
          ),
          type: makeArg(
            options.map((o) => (o.isSpread ? o.type : `${o.name}?: ${o.type}`)),
            '; ',
          ),
        })
      }
    })
  })

  updateImportDeclarations(sourceFile, importsToAdd)
  updateImportDeclarations(controllerSourceFile, controllerImportsToAdd)

  // Optionally, save the changes to the source file
  sourceFile.save().catch((err) => console.error(err))
  controllerSourceFile.save().catch((err) => console.error(err))
}

const modes = {
  MOVE: 'move',
  TODO: 'todo',
  REQ: 'req',
  RES: 'res',
  PARSE: 'parse-express',
}

if (Object.values(modes).includes(opts.mode)) {
  switch (opts.mode) {
    case modes.MOVE: {
      const params = getModuleConfig({
        key: opts.key,
        moduleKey: opts.moduleKey,
        routePath: opts.routePath,
        functions: opts.functions?.split(',') || [],
        admin: opts.admin,
      })

      copyAndPasteToService(params)
      generateController(params)
      break
    }
    case modes.TODO: {
      const params = getModuleConfig({
        key: opts.key,
        moduleKey: opts.moduleKey,
        routePath: opts.routePath,
        functions: opts.functions?.split(',') || [],
        admin: opts.admin,
      })

      addTodoComment(params)
      break
    }
    case modes.PARSE: {
      parseExpressServer()
      break
    }
    case modes.REQ: {
      const params = getModuleConfig({
        key: opts.key,
        moduleKey: opts.moduleKey,
        routePath: opts.routePath,
        functions: opts.functions?.split(',') || [],
        admin: opts.admin,
      })

      replaceReq(params)
      break
    }
    case modes.RES: {
      const params = getModuleConfig({
        key: opts.key,
        moduleKey: opts.moduleKey,
        routePath: opts.routePath,
        functions: opts.functions?.split(',') || [],
        admin: opts.admin,
      })

      replaceResError(params)
      replaceRes(params)
      break
    }
  }
} else {
  console.error('Invalid mode')
}
