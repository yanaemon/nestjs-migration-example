import * as fs from 'fs'
import {
  ArrowFunction,
  FunctionDeclaration,
  ImportDeclarationStructure,
  Project,
  Scope,
  SyntaxKind,
} from 'ts-morph'
import { HttpMethod, ModuleConfig } from './types'
import {
  debugLog,
  toUpperCamelCase,
  todo,
  updateImportDeclarations,
} from './utils'
import { parseExpressServer } from './parseExpressServer'
import { functionHttpConfigMap } from './constants'

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
  for (const key in functionHttpConfigMap) {
    if (functionName.startsWith(key)) {
      return functionHttpConfigMap[key]
    }
  }
  return { method: 'Get', path: null } // Default fallback
}

function copyAndPasteToService(params: ModuleConfig) {
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

function generateController(params: ModuleConfig) {
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

export function moveComponents(params: ModuleConfig) {
  copyAndPasteToService(params)
  generateController(params)
}
