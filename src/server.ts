import express from 'express'
import mongoose from 'mongoose'
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
    next: express.NextFunction
  ) => Promise<any>,
) {
  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
      await handler(req, res, next)
    } catch (err) {
      console.error('Internal Server Error', {
        method: req.method,
        url: req.originalUrl,
        error: err
      })
      if (!res.headersSent) {
        res
          .status(500)
          .json({ message: 'Internal Server Error' })
      }
    }
  }
}

app.use(
  '/api/users',
  express
    .Router()
    .get('/', wrap(users.list))
    .get('/:id', wrap(users.show))
    .post('/', wrap(users.create))
)

app.listen(port, () => {
  console.log(`Server is starting on http://localhost:${port}`)
  mongoose.connect(mongodbUri).then(() => {
    console.log(`Connected to MongoDB ${mongodbUri}`)
  })
})

export default app
