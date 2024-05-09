import {
  CallExpression,
  ImportDeclarationStructure,
  Node,
  Project,
  SyntaxKind,
} from 'ts-morph'
import { updateImportDeclarations } from './utils'
import { ModuleConfig } from './types'

/**
 * replace req.query, req.body, req.params to controller
 * @param params module config
 * @example Controller
 *   WHEN：
 *     async create(res, req) {
 *       return this.service.create(req, res)
 *     }
 *   THEN：
 *     async create(@Body() body: { email: string }) {
 *       return this.service.create(body)
 *     }
 *
 *  @example Service
 *   WHEN：
 *     async create(req, res) {
 *       return Model.create(req.body)
 *     }
 *   THEN：
 *     async create(body: { email: string }) {
 *       return Model.create(body)
 *     }
 */
export function replaceReq(params: ModuleConfig) {
  // Initialize a new ts-morph Project
  const project = new Project()

  // Add the source file to the project
  project.addSourceFilesFromTsConfig(params.tsConfigPath)
  const sourceFile = project.addSourceFileAtPath(params.service.filePath)
  const controllerSourceFile = project.addSourceFileAtPath(
    params.controller.filePath,
  )

  const typeChecker = project.getTypeChecker()
  const predictType = (node: Node) => {
    try {
      const typeResult = typeChecker.getTypeAtLocation(node)
      console.log(
        'predictType: typeResult',
        node.getText(),
        typeResult.getText(),
      )
      return typeResult.getText() || 'any'
    } catch (e) {
      console.error('predictType: error', { node: node.getText(), error: e })
      return 'any'
    }
  }

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
        query: {} as Record<string | null, string | null>,
        body: {} as Record<string | null, string | null>,
        params: {} as Record<string | null, string | null>,
      }

      method.forEachDescendant((node) => {
        if (node.getText().startsWith('req.')) {
          console.log('---------- req ---------')
          const vars = node.getText().split('.')
          console.log(node.getText(), node.getParent()?.getText(), vars)

          if (reqVars[vars[1] as keyof typeof reqVars]) {
            const key =
              vars[2]?.replace(/[\?\${`]/g, '').replace(/[ }\[\(\n].*/g, '') ||
              ''
            reqVars[vars[1] as keyof typeof reqVars][key] = predictType(node)
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
      console.log('reqVars', reqVars)

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
      if (Object.keys(reqVars.params).length) {
        Object.keys(reqVars.params).forEach((name) => {
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
      if (Object.keys(reqVars.body).length) {
        const bodyTypes = []
        for (const key of Object.keys(reqVars.body)) {
          if (key) {
            bodyTypes.push(`${key}?: ${reqVars.body[key]}`)
          } else {
            bodyTypes.push(`[key: string]: any`)
          }
        }
        const bodyType = bodyTypes.length
          ? `{ ${bodyTypes.join('; ')} }`
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
      if (Object.keys(reqVars.query).length) {
        const queryTypes = []
        for (const key of Object.keys(reqVars.query)) {
          if (key) {
            queryTypes.push(`${key}?: ${reqVars.query[key]}`)
          } else {
            queryTypes.push(`[key: string]: any`)
          }
        }
        const queryType = queryTypes.length
          ? `{ ${queryTypes.join('; ')} }`
          : '{ [key: string]: any }'
        controllerMethod?.addParameter({
          name: 'query',
          type: queryType,
          decorators: [{ name: 'Query', arguments: [] }],
        })
        method.addParameter({
          name: 'query',
          type: queryType,
        })
        methodCallExpression?.addArgument('query')
        controllerImportsToAdd.push({
          moduleSpecifier: '@nestjs/common',
          namedImports: ['Query'],
        } as ImportDeclarationStructure)
      }
    })
  })

  updateImportDeclarations(sourceFile, importsToAdd)
  updateImportDeclarations(controllerSourceFile, controllerImportsToAdd)

  // Optionally, save the changes to the source file
  sourceFile.save().catch((err) => console.error(err))
  controllerSourceFile.save().catch((err) => console.error(err))
}
