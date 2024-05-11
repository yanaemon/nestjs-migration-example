import * as express from 'express'
import { User } from '@/models'
import * as validator from 'validator'

export async function list(req: express.Request, res: express.Response) {
  const condition: { email?: string; isAdmin?: boolean } = {}
  if (req.query.email) {
    condition.email = req.query.email as string
  }
  if (req.query.isAdmin) {
    condition.isAdmin = req.query.isAdmin.toString() === 'true'
  }

  const users = await User.find(condition)
  return res.json(users)
}

export async function show(req: express.Request, res: express.Response) {
  const user = await User.findById(req.params.id)
  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }
  return res.json(user)
}

export async function create(
  req: express.Request<unknown, unknown, { email: string; age: number }>,
  res: express.Response,
) {
  if (!validator.isEmail(req.body.email)) {
    return res.status(400).json({ message: 'invalid email' })
  }
  if (!Number.isInteger(req.body.age)) {
    return res.status(400).json({ message: 'invalid age' })
  }

  const user = await User.create(req.body)
  return res.json(user)
}
