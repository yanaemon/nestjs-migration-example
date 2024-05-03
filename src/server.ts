import express from 'express'

const app: express.Express = express()
const port = 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

async function proxyToNest(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  next()
}

app.use(
  '/api/users',
  express
    .Router()
    .get('/', (req, res) => { res.json({ id: 1, name: 'Hiroki'}) })
)

app.listen(port, () => {
  console.log(`Server is starting on http://localhost:${port}`)
})

export default app

