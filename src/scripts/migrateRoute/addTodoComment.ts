import { Project, SyntaxKind } from 'ts-morph'
import { ModuleConfig } from './types'
import { todo } from './utils'

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
