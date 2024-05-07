import { program } from 'commander'
import { addTodoComment } from './addTodoComment'
import { moveComponents } from './moveComponents'
import { parseExpressServer } from './parseExpressServer'
import { replaceReq } from './replaceReq'
import { replaceRes } from './replaceRes'
import { toUpperCamelCase } from './utils'

/**
 * Migrate express app to Nest.js
 *
 * @example
 * $ yarn ts-node src/scripts/migrateRoute/main.ts --key users --mode move
 */
program
  .version('1.0.0')
  .description(
    `Migrate express app to Nest.js

Steps
1. move logic to module (mode: move)
2. add TODO comment to check at refactoring (mode: todo)
3. migrate Response object (mode: res)
4. migrate Request object (mode: req)
`,
  )
  .option('--key <key>', 'key of module (ex. exampleResources)')
  .option('--moduleKey <moduleKey>', 'key of module (ex. exampleResources)')
  .option(
    '--routePath <routePath>',
    'route file path (ex. exampleResources.ts)',
  )
  .option('--functions <functions>', 'functions to migrate (ex. func1,func2)')
  .option('--admin', 'admin route')
  .option('--debug', 'debug mode')
  .option('--mode <mode>', 'mode to run (ex. move, resJson')
  .parse(process.argv)

const opts = program.opts()
const ROUTE_BASE_DIR = 'src/routes'

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

global.debug = opts.debug

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

      moveComponents(params)
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

      replaceRes(params)
      break
    }
  }
} else {
  console.error('Invalid mode')
}
