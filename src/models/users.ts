import { InferSchemaType, Schema, model } from 'mongoose'

const user = new Schema(
  {
    email: { type: String, required: true, unique: true },
    lastName: { type: String, required: true },
    firstName: { type: String },
    age: { type: String },
    isAdmin: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

export const User = model('User', user)

export type UserType = InferSchemaType<typeof user>
