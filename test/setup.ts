// import { MongoDBContainer } from '@testcontainers/mongodb'

export default async function setup() {
  console.log('global setup')
  // const mongoDbContainer = await new MongoDBContainer('mongo:6.0.1')
  //   .withExposedPorts({
  //     container: 27017,
  //     host: 37017,
  //   })
  //   .start()
  // global.__MONGOD__ = mongoDbContainer
  // process.env.MONGO_DB_URI = mongoDbContainer.getConnectionString()
  process.env.MONGO_DB_NAME = 'nestjs-migration-example-e2e'

  console.log('setup done', process.env.MONGO_DB_URI)
}
