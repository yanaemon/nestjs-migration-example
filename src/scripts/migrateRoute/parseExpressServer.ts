import { Node, Project, SyntaxKind } from 'ts-morph'
import { debugLog } from './utils'

type EntryPoint = {
  type: 'handler'
  method: string // 'get' | 'post' | 'put' | 'delete'
  path: string
  func: string
}

type Route = {
  type: 'group'
  middlewares: string[]
  path: string
  routes: EntryPoint[]
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

export function parseExpressServer() {
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
