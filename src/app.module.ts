import { Module } from '@nestjs/common'
import { CategoriesModule } from './modules/categories/categories.module'

@Module({
  imports: [CategoriesModule],
})
export class AppModule {}
