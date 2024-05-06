import * as request from 'supertest'
import { app, shutdown, start } from '../src/server'

describe('Categories E2E', () => {
  beforeAll(async () => {
    await start()
  })
  afterAll(async () => {
    await shutdown()
  })

  it('GET /api/categories', async () => {
    console.log('test start')
    await request(app).get('/api/categories').expect(200).expect([])
  })
})
