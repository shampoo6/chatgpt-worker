import {WorkerMessageType} from "../types/WorkerMessageType";

/**
 * worker 线程通信，消息对象
 */
export class WorkerMessage {
  public type: WorkerMessageType
  public message: string
  public data: any

  constructor(type: WorkerMessageType, message: string, data: any) {
    this.type = type
    this.message = message
    this.data = data
  }

  public static build(type: WorkerMessageType): WorkerMessage
  public static build(type: WorkerMessageType, message: string): WorkerMessage
  public static build(type: WorkerMessageType, message: string, data: any): WorkerMessage
  public static build(type: WorkerMessageType, message?: string, data?: any): WorkerMessage {
    if (data) {
      return new WorkerMessage(type, message, data)
    }
    if (message) {
      return new WorkerMessage(type, message, null)
    }
    return new WorkerMessage(type, 'none', null)
  }
}