export type HttpMethod = 'Get' | 'Post' | 'Put' | 'Delete'

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

export type ModuleConfig = {
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
