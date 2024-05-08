import { Command, program } from 'commander'
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
const main = program
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

const initParams = () => {
  const opts = main.opts()
  global.debug = opts.debug

  const params = getModuleConfig({
    key: opts.key,
    moduleKey: opts.moduleKey,
    routePath: opts.routePath,
    functions: opts.functions?.split(',') || [],
    admin: opts.admin,
  })
  return params
}

const commands = [
  {
    name: 'move',
    description: 'move components',
    action: () => {
      const params = initParams()
      moveComponents(params)
    },
  },
  {
    name: 'todo',
    description: 'add TODO comment',
    action: () => {
      const params = initParams()
      addTodoComment(params)
    },
  },
  {
    name: 'parse-express',
    description: 'parse express server',
    action: () => {
      parseExpressServer()
    },
  },
  {
    name: 'req',
    description: 'replace req',
    action: () => {
      const params = initParams()
      replaceReq(params)
    },
  },
  {
    name: 'res',
    description: 'replace res',
    action: () => {
      const params = initParams()
      replaceRes(params)
    },
  },
]

commands.forEach((cmd) => {
  const command = new Command(cmd.name)
    .description(cmd.description)
    .action(cmd.action)
  program.addCommand(command)
})

main.parse(process.argv)
