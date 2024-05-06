import * as mongoose from 'mongoose'

/**
 * Delete all documents from all collections
 */
export async function deleteAll() {
  const collections = mongoose.connection.collections
  const deletePromises = []
  for (const key in collections) {
    const collection = collections[key]
    deletePromises.push(collection.deleteMany({}))
  }
  await Promise.all(deletePromises)
}
