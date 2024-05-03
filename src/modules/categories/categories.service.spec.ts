import { Test, TestingModule } from '@nestjs/testing'
import { CategoriesService } from './categories.service'
import { CategoriesModule } from './categories.module'

describe('CategoriesService', () => {
  let service: CategoriesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CategoriesModule],
    }).compile()

    service = module.get<CategoriesService>(CategoriesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
