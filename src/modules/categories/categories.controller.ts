import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { CategoryType } from '@/models'

@Controller('categories')
export class CategoriesController {
  constructor(
    @Inject(CategoriesService)
    private readonly categoriesService: CategoriesService,
  ) {}

  @Get()
  async list(@Query() query: any): Promise<CategoryType[]> {
    return this.categoriesService.find(query)
  }

  @Get(':id')
  async show(@Param('id') id: string): Promise<CategoryType | null> {
    return this.categoriesService.findById(id)
  }

  @Post()
  async create(@Body() body: any): Promise<CategoryType> {
    return this.categoriesService.create(body)
  }
}
