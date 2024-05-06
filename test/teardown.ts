export default async function teardown() {
  console.log('global teardown')
  // if (global.__MONGOD__) {
  //   await global.__MONGOD__.stop()
  // }
}
