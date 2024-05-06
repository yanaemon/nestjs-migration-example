import { app, shutdown, start } from './server'

// graceful shutdown
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

start()

export default app
