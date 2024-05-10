# Nest.js Migration Example

TSKaigi 2024 向けの Example Code

[TSKaigi 2024 - Talks yanaemon169](https://tskaigi.org/talks/yanaemon169)

## Directory Structure

```sh
├── src
│   ├── app.module.ts
│   ├── server.ts
│   ├── models                  // DB Model Schema
│   │   └── users.ts
│   ├── routes                  // OLD Express Route Code
│   │   └── users.ts
│   ├── modules                 // New Nest.js Code
│   │   └── categories
│   │       ├── categories.controller.ts
│   │       ├── categories.service.ts
│   │       └── categories.module.ts
│   └── scripts                 // Scripts for refactoring
│       ├── generateE2ETest
│       └── migrateRoute
├── test                        // E2E Test
│   ├── categories.e2e-spec.ts
│   └── jest-e2e.json
```

## Scripts for Refactoring

### Generate E2E Test

```sh
$ yarn ts-node src/scripts/generateE2ETest/main.ts --apiBasePath /api/users --input src/routes/users.ts --output test/users.e2e-spec.ts
```

### Migrate Route

#### 1. move current logic without changing logic

create `Controller` and `Service` with current logic

```sh
yarn ts-node src/scripts/migrateRoute/main.ts move --key users
```

Example of Migration

From

```ts
// routes/users.ts
async create(req: Request, res: Response) {
  const email = req.body.email
  const user = await User.create({ email })
  return res.json(user)
}
```

To

```ts
/// modules/users/users.controller.ts
@Controller('users')
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
  ) {}

  @Post()
  async create(req: Request, res: Response) {
    return this.usersService.create(req, res)
  }
}

/// modules/users/users.service.ts
@Injectable()
export class UsersService {
  async create(req: Request, res: Response) {
    const email = req.body.email
    const user = await User.create({ email })
    return res.json(user)
  }
}
```

#### 2. add TODO comment to check at refactoring

```sh
yarn ts-node src/scripts/migrateRoute/main.ts todo --key users
```

Example of Migration

```diff
+ // TODO(NestJS Migration): Check req/res
  const email = req.body.email
```

#### 3. migrate Response object

```sh
yarn ts-node src/scripts/migrateRoute/main.ts res --key users
```

Example of Migration

```diff
  // users.service.ts
-     res.json({ data })
+     return { data }

-     res.status(400).json({ message: 'invalid data' })
+     throw new BadRequestException({ message: 'invalid data' })

  // users.controller.ts
  @Get(':id')
+ @ApiBadRequestResponse()
  async create(@Req() req: Request, @Res() res: Response) {
    return await this.usersService.create(req, res)
  }
```

#### 4. migrate Request object

```sh
yarn ts-node src/scripts/migrateRoute/main.ts req --key users
```

Example of Migration

```diff
  // users.service.ts
-   async create(req: Request, res: Response) {
-     const email = req.body.email
+   async create(body: CreateBodyDto) {
+     const email = body.email

  // users.controller.ts
    @Post()
-   async create(@Req() req: Request, @Res() res: Response) {
-     return await this.usersService.create(req, res)
+   async create(@Body() body: CreateBodyDto) {
+     return await this.usersService.create(body)
    }

  // users.dto.ts
  export class CreateBodyDto {
    email?: string
  }
```
