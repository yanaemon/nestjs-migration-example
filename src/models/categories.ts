import { InferSchemaType, Schema, model } from 'mongoose'

const category = new Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
  },
  {
    timestamps: true,
  },
)

export const Category = model('Category', category)

export type CategoryType = InferSchemaType<typeof category>
