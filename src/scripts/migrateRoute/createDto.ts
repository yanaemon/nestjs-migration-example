import * as fs from 'fs'
import {
  ImportDeclarationStructure,
  Project,
  PropertyDeclarationStructure,
} from 'ts-morph'
import { debugLog, toUpperCamelCase, updateImportDeclarations } from './utils'

type CreateDtoParams = {
  project: Project
  filePath: string
  func: string
  type: 'body' | 'query' | 'param' | 'response'
  properties: Omit<PropertyDeclarationStructure, 'kind'>[]
}

/**
 * Create dto
 *
 * Naming Rule: `{func}{type}Dto`
 *
 * @param params
 *
 * @example
 * export class CreateBodyDto {
 *   email?: string
 * }
 *
 * @example
 * export class ShowResponseDto {
 *   email?: string
 * }
 */
export function createDto(params: CreateDtoParams) {
  const { func, type, properties, project, filePath } = params
  const className = `${toUpperCamelCase(func)}${toUpperCamelCase(type)}Dto`
  const outputFile = getFile(project, filePath)

  let classDeclaration = outputFile.getClass(className)
  if (!classDeclaration) {
    classDeclaration = outputFile.addClass({
      name: className,
      isExported: true,
    })
  }

  debugLog('createDto.properties', properties)
  const importsToAdd: ImportDeclarationStructure[] = []
  properties.forEach((p) => {
    const currentProperty = classDeclaration.getProperty(p.name)
    if (currentProperty) {
      if (currentProperty.getType().getText() !== p.type) {
        debugLog(
          'createDto.property.type.changed',
          currentProperty.getText(),
          p,
        )
      }
      return
    }
    if (p.name.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) {
      classDeclaration.addProperty({
        ...p,
        decorators: [
          {
            name: 'ApiProperty',
            arguments: [`{ name: '${p.name}', type: '${p.type}' }`],
          },
        ],
      })
      importsToAdd.push({
        moduleSpecifier: '@nestjs/swagger',
        namedImports: ['ApiProperty'],
      } as ImportDeclarationStructure)
    } else {
      classDeclaration.addMember(`${p.name}: ${p.type}`)
    }
  })

  outputFile.saveSync()
  updateImportDeclarations(outputFile, importsToAdd)

  const moduleSpecifier = filePath
    .replace(/^.*\/dtos\//g, './dtos/')
    .replace('.ts', '')
  return {
    filePath,
    className,
    file: outputFile,
    importDeclarationStructure: {
      moduleSpecifier,
      namedImports: [className],
    } as ImportDeclarationStructure,
  }
}

function getFile(project: Project, filePath: string) {
  const outputFileExists = fs.existsSync(filePath)

  // Create or load the source file
  const outputFile = outputFileExists
    ? project.addSourceFileAtPath(filePath)
    : project.createSourceFile(filePath, '', {
        overwrite: true,
      })

  return outputFile
}
