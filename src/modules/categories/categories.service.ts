import { Injectable } from '@nestjs/common'
import { Category, CategoryType } from '@/models'

@Injectable()
export class CategoriesService {
  async find(query: any): Promise<CategoryType[]> {
    return Category.find(query)
  }

  async findById(id: string): Promise<CategoryType | null> {
    return Category.findById(id)
  }

  async create(data: any): Promise<CategoryType> {
    return Category.create(data)
  }
}
