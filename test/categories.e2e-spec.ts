import * as request from 'supertest'
import { app, shutdown, start } from '@/server'
import { deleteAll } from './mongoHelper'

describe('Categories E2E', () => {
  const categoryData = {
    key: 'test',
    name: 'Test Category',
  }

  beforeAll(async () => {
    await start()
  })

  afterEach(async () => {
    await deleteAll()
  })

  afterAll(async () => {
    await shutdown()
  })

  describe('GET /api/categories', () => {
    it('returns an empty array', async () => {
      const res = await request(app).get('/api/categories').expect(200)
      expect(res.body).toEqual([])
    })

    it('returns an array with one category', async () => {
      await request(app).post('/api/categories').send(categoryData).expect(201)

      const res = await request(app).get('/api/categories').expect(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0]).toEqual(expect.objectContaining(categoryData))
    })
  })

  describe('GET /api/categories/:id', () => {
    it('returns the category', async () => {
      const resCreate = await request(app)
        .post('/api/categories')
        .send(categoryData)
        .expect(201)

      const categoryId = resCreate.body._id
      const res = await request(app)
        .get(`/api/categories/${categoryId}`)
        .expect(200)
      expect(res.body).toEqual(expect.objectContaining(categoryData))
    })
  })

  describe('POST /api/categories', () => {
    it('returns the created category', async () => {
      const res = await request(app)
        .post('/api/categories')
        .send(categoryData)
        .expect(201)
      expect(res.body).toEqual(expect.objectContaining(categoryData))
    })
  })
})
