import * as express from 'express'
import * as http from 'http'
import mongoose from 'mongoose'
import { NestFactory } from '@nestjs/core'
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { users } from './routes'

const app: express.Express = express()
const server = http.createServer(app)
const port = 3000
const mongodbUri = 'mongodb://localhost:27017/test?directConnection=true'

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
async function start() {
  console.log('Server is initializing...')
  await mongoose.connect(mongodbUri).then(() => {
    console.log(`Connected to MongoDB ${mongodbUri}`)
  })

  nestApp = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(app),
    { abortOnError: false },
  )
  nestApp.setGlobalPrefix('api')
  await nestApp.init()

  server.listen(port, () => {
    console.log(`Server is starting on http://localhost:${port}`)
  })
}

const shutdown = (signal?: NodeJS.Signals) => {
  console.log(`Received ${signal}, stopping server...`)
  server.close(async (err) => {
    if (err) {
      console.error('Failed to close server', err)
      process.exit(1)
    }
    try {
      await nestApp.close()
      await mongoose.disconnect()
      console.log('Server stopped')
      process.exit(0)
    } catch (err) {
      console.error('Failed to disconnect from MongoDB', err)
      process.exit(1)
    }
  })
}

// graceful shutdown
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

start()

export { start, shutdown, app }
export default app
