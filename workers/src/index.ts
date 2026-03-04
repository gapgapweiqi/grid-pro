import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.json({ 
    message: 'Hono API Server with Cloudflare D1',
    status: 'running',
    database: 'grid_doc',
    endpoints: {
      health: '/health',
      dbTest: '/db/test'
    }
  })
})

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/db/test', async (c) => {
  try {
    // Test D1 connection with a simple query
    const result = await c.env.DB.prepare('SELECT 1 as test').all()
    
    return c.json({
      success: true,
      message: 'D1 Database connection successful',
      database: 'grid_doc',
      result: result.results
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'D1 Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export default app
