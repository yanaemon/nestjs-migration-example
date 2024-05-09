import { ImportDeclarationStructure, Node, Project, SyntaxKind } from 'ts-morph'
import { ModuleConfig } from './types'
import { httpStatusMap } from './constants'
import { updateImportDeclarations } from './utils'

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

/**
 * replace res.status(4xx | 5xx) to throw new HttpException
 * @param params module config
 * @example Service
 *   WHEN: res.status(404).json({ message: 'Not Found' })
 *   THEN： throw new NotFoundException({ message: 'Not Found' })
 * @example Controller
 *   WHEN: http error status (ex. 404) in Service
 *   THEN: add @ApiNotFoundResponse() decorator to the method
 */
function replaceResError(params: ModuleConfig) {
  // Setup a new project
  const project = new Project()

  // Load the source file
  project.addSourceFilesFromTsConfig(params.tsConfigPath)
  const serviceFile = project.addSourceFileAtPath(params.service.filePath)
  const controllerFile = project.addSourceFileAtPath(params.controller.filePath)

  const namedImports = new Set<string>()
  // Find all call expressions in the file
  serviceFile.getClasses().forEach((classDeclaration) => {
    classDeclaration.getMethods().forEach((method) => {
      const httpDecorators = new Set<string>()
      method.forEachDescendant((node) => {
        if (node.getKind() === SyntaxKind.CallExpression) {
          console.log(node.getText())
          const callExpression = (node as any).getExpression()
          if (!Node.isPropertyAccessExpression(callExpression)) {
            return
          }
          const resError = getResStructure(node)
          console.log('### resError', resError)
          if (
            resError.status &&
            !resError.status.startsWith('2') &&
            resError.json
          ) {
            // Replace with `throw new BadRequestException(...)`
            const httpStatus = httpStatusMap[resError.status]
            const httpStatusException = httpStatus.exception
            if (httpStatus) {
              httpDecorators.add(httpStatus.decorator)
            }
            node
              ?.getParent()
              ?.replaceWithText(
                httpStatusException
                  ? `throw new ${httpStatusException}(${resError.json})`
                  : `throw new HttpException(${resError.json}, ${resError.status})`,
              )
            namedImports.add(httpStatusException || 'HttpException')
          }
        }
      })

      if (httpDecorators.size > 0) {
        const controllerMethod = controllerFile
          .getClasses()[0]
          .getMethod(method.getName())
        if (controllerMethod) {
          httpDecorators.forEach((decorator) => {
            controllerMethod.addDecorator({
              name: decorator,
              arguments: [],
            })
          })
          updateImportDeclarations(controllerFile, [
            {
              moduleSpecifier: '@nestjs/swagger',
              namedImports: [...httpDecorators],
            },
          ] as ImportDeclarationStructure[])
        }
      }
    })
  })

  if (namedImports.size > 0) {
    updateImportDeclarations(serviceFile, [
      {
        moduleSpecifier: '@nestjs/common',
        namedImports: [...namedImports],
      },
    ] as ImportDeclarationStructure[])
  }
  // Save the transformed file
  serviceFile.saveSync()
  controllerFile.saveSync()
}

/**
 * replace res.status(200).json to return
 * @param params module config
 * @example
 *   WHEN: res.status(200).json({ message: 'OK' })
 *   THEN: return { message: 'OK' }
 */
function replaceResSuccess(params: ModuleConfig) {
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

export function replaceRes(params: ModuleConfig) {
  replaceResError(params)
  replaceResSuccess(params)
}
