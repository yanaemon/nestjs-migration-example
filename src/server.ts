import express from 'express'
import mongoose from 'mongoose'
import { NestFactory } from '@nestjs/core'
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { users } from './routes'

const app: express.Express = express()
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

/**
 * Not migrated to Nest.js yet
 */
app.use(
  '/api/users',
  express
    .Router()
    .get('/', wrap(users.list))
    .get('/:id', wrap(users.show))
    .post('/', wrap(users.create)),
)

const server = app.listen(port, async () => {
  console.log(`Server is starting on http://localhost:${port}`)
  await mongoose.connect(mongodbUri).then(() => {
    console.log(`Connected to MongoDB ${mongodbUri}`)
  })

  const nestApp = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(app),
    { abortOnError: false },
  )

  const shutdown = (signal: NodeJS.Signals) => {
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
})

export default app
