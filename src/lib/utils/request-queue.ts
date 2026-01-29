// Request Queue for Cart Operations
// Ensures cart operations are serialized to prevent concurrent modification conflicts

type QueuedRequest<T> = {
  execute: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: any) => void
}

class RequestQueue {
  private queue: QueuedRequest<any>[] = []
  private processing = false

  /**
   * Add a request to the queue
   * Returns a promise that resolves when the request completes
   */
  async enqueue<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ execute, resolve, reject })
      this.processQueue()
    })
  }

  /**
   * Process queued requests sequentially
   */
  private async processQueue() {
    // If already processing or queue is empty, return
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      const request = this.queue.shift()!

      try {
        const result = await request.execute()
        request.resolve(result)
      } catch (error) {
        request.reject(error)
      }
    }

    this.processing = false
  }

  /**
   * Get current queue size
   */
  get size(): number {
    return this.queue.length
  }

  /**
   * Check if queue is processing
   */
  get isProcessing(): boolean {
    return this.processing
  }
}

export const cartRequestQueue = new RequestQueue()
