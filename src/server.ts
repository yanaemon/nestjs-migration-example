import * as express from 'express'
import * as http from 'http'
import mongoose from 'mongoose'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express'
import { AppModule } from '@/app.module'
import { users } from '@/routes'

export const app: express.Express = express()
export const server = http.createServer(app)
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

function wrap(
  handler: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => Promise<any>,
) {
  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    try {
      await handler(req, res, next)
    } catch (err) {
      console.error('Internal Server Error', {
        method: req.method,
        url: req.originalUrl,
        error: err,
      })
      if (!res.headersSent) {
        res.status(500).json({ message: 'Internal Server Error' })
      }
    }
  }
}

// `categories` is migrated to Nest.js yet
// app.use('/api/categories',
//   express
//     .Router()
//     .get('/', wrap(categories.list))
//     .get('/:id', wrap(categories.show))
//     .post('/', wrap(categories.create))
// )

// `users` is not migrated to Nest.js yet
app.use(
  '/api/users',
  express
    .Router()
    .get('/', wrap(users.list))
    .get('/:id', wrap(users.show))
    .post('/', wrap(users.create)),
)

let nestApp: NestExpressApplication = null
let isInitialized = false
let isReady = false
export async function start() {
  if (isInitialized) {
    return
  }
  isInitialized = true
  console.log('Server is initializing...')

  const mongoDbName = process.env.MONGO_DB_NAME || 'nestjs-migration-example'
  const mongoDbUri =
    process.env.MONGO_DB_URI ||
    `mongodb://localhost:27017?directConnection=true`
  console.log('MongoDB', `${mongoDbUri}. ${mongoDbName}`)
  await mongoose.connect(mongoDbUri, { dbName: mongoDbName }).then(() => {
    console.log(`Connected to MongoDB.`)
  })

  console.log('Nest.js')
  nestApp = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(app),
    { abortOnError: false },
  )
  nestApp.setGlobalPrefix('api')

  // swagger
  const config = new DocumentBuilder()
    .setTitle('Swagger')
    .setDescription('Swagger')
    .setVersion('0.1')
    .build()
  const document = SwaggerModule.createDocument(nestApp, config)
  SwaggerModule.setup('api/swagger', nestApp, document)

  await nestApp.init()

  server.listen(port, () => {
    console.log(`Server is starting on http://localhost:${port}`)
    isReady = true
    app.emit('ready')
  })

  let timeout = 30
  while (!isReady) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    timeout -= 1
    if (timeout === 0) {
      throw new Error('Server is not ready')
    }
  }
}

export async function shutdown(signal?: NodeJS.Signals) {
  console.log(`Received ${signal}, stopping server...`)
  return await new Promise((resolve, reject) => {
    server.close(async (err) => {
      if (err) {
        console.error('Failed to close server', err)
        reject(err)
      }
      try {
        await nestApp.close()
        await mongoose.disconnect()
        console.log('Server stopped')
        resolve(0)
      } catch (err) {
        console.error('Failed to disconnect from MongoDB', err)
        reject(err)
      }
    })
  })
}
