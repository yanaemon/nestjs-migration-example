# nestjs-migration-example

Nest.js Migration Example

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
yarn ts-node src/scripts/migrateRoute/main.ts --key users --mode move
```

#### 2. add TODO comment to check at refactoring

```sh
yarn ts-node src/scripts/migrateRoute/main.ts --key users --mode todo
```

Example of Migration

```ts
// TODO(NestJS Migration): Check req/res
const email = req.body.email
```

#### 3. migrate Response object

```sh
yarn ts-node src/scripts/migrateRoute/main.ts --key users --mode res
```

Example of Migration

```diff
- res.json({ data })
+ return { data }

- res.status(400).json({ message: 'invalid data' })
+ throw new NotFoundException({ message: 'invalid data' })
```

#### 4. migrate Request object

```sh
yarn ts-node src/scripts/migrateRoute/main.ts --key users --mode req
```

Example of Migration

```diff
- async create(req: Request, res: Response) {
-   const email = req.body.email
+ async create(body: { email?: string }) {
+   const email = body.email
```
