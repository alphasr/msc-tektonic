// Simple in-memory queue for development
// In production, use Redis, RabbitMQ, or similar

interface QueueJob {
  type: string
  data: any
  id: string
  createdAt: Date
  retries: number
}

class SimpleQueue {
  private jobs: QueueJob[] = []
  private processing = false
  private handlers: Map<string, (data: any) => Promise<void>> = new Map()

  // Register handler for job type
  on(type: string, handler: (data: any) => Promise<void>) {
    this.handlers.set(type, handler)
  }

  // Publish job to queue
  async publish(type: string, data: any): Promise<string> {
    const job: QueueJob = {
      type,
      data,
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      createdAt: new Date(),
      retries: 0,
    }
    
    this.jobs.push(job)
    this.process()
    
    return job.id
  }

  // Process jobs
  private async process() {
    if (this.processing || this.jobs.length === 0) return
    
    this.processing = true
    
    while (this.jobs.length > 0) {
      const job = this.jobs.shift()
      if (!job) break
      
      const handler = this.handlers.get(job.type)
      if (!handler) {
        console.warn(`No handler for job type: ${job.type}`)
        continue
      }
      
      try {
        await handler(job.data)
      } catch (error) {
        console.error(`Job ${job.id} failed:`, error)
        
        // Retry with exponential backoff (max 3 retries)
        if (job.retries < 3) {
          job.retries++
          const delay = Math.pow(2, job.retries) * 1000 // 2s, 4s, 8s
          setTimeout(() => {
            this.jobs.push(job)
            this.process()
          }, delay)
        } else {
          console.error(`Job ${job.id} failed after ${job.retries} retries`)
        }
      }
    }
    
    this.processing = false
  }

  // Get queue stats
  getStats() {
    return {
      pending: this.jobs.length,
      processing: this.processing,
    }
  }
}

export const analyzeQueue = new SimpleQueue()

