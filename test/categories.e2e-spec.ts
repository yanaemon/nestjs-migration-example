import * as request from 'supertest'
import { start, shutdown, app } from '../src/server'

describe('Categories E2E', () => {
  beforeAll(async () => {
    await start()
  })
  afterAll(async () => {
    await shutdown()
  })

  it('GET /api/categories', async () => {
    await request(app).get('/api/categories').expect(200).expect([])
  })
})
