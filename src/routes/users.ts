import express from 'express'
import { User } from "../models/users"

export async function list(req: express.Request, res: express.Response) {
    const users = await User.find()
    return res.json(users)
}

export async function show(req: express.Request, res: express.Response) {
    const user = await User.findById(req.params.id)
    return res.json(user)
}

export async function create(req: express.Request, res: express.Response) {
    const user = await User.create(req.body)
    return res.json(user)
}
