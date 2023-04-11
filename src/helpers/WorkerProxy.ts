import {Worker} from "node:worker_threads";
import path from "path";
import {WorkerMessageType} from "../types/WorkerMessageType";
import {WorkerMessage} from "../models/WorkerMessage";

export type EventHandler = (e?: any) => void

export enum EventName {
  Message = 'message',
  Error = 'error',
  Exit = 'exit',
  Online = 'online',
  Ready = 'ready'
}

export class WorkerProxy {
  private worker: Worker
  private readonly eventHandlers: { [key: string]: EventHandler[] }

  constructor() {
    this.eventHandlers = {}
    this.eventHandlers[EventName.Message] = new Array<EventHandler>()
    this.eventHandlers[EventName.Error] = new Array<EventHandler>()
    this.eventHandlers[EventName.Exit] = new Array<EventHandler>()
    this.eventHandlers[EventName.Online] = new Array<EventHandler>()
    this.eventHandlers[EventName.Ready] = new Array<EventHandler>()

    this.worker = new Worker(path.resolve(__dirname, '../threads/workerThreads.js'))
    this.initWorkerEvent()
  }

  private initWorkerEvent() {
    this.worker.on(EventName.Message, (e: WorkerMessage) => {
      const eventHandlers = this.eventHandlers[e.type === WorkerMessageType.Ready ? EventName.Ready : EventName.Message]
      eventHandlers.forEach(fn => {
        fn(e)
      })
    })
    this.worker.on(EventName.Error, e => {
      this.eventHandlers[EventName.Error].forEach(fn => {
        fn(e)
      })
    })
    this.worker.on(EventName.Exit, e => {
      this.eventHandlers[EventName.Exit].forEach(fn => {
        fn(e)
      })
    })
    this.worker.on(EventName.Online, () => {
      this.eventHandlers[EventName.Online].forEach(fn => {
        fn()
      })
    })
    this.on(EventName.Message, e => {
      if (e.type === WorkerMessageType.Report) {
        console.log(e.message)
      }
    })
    this.on(EventName.Error, e => {
      console.error('worker error: ')
      console.error(e)
    })
    this.on(EventName.Exit, e => {
      console.log(`worker exit code: ${e}`)
    })
  }

  public on(eventName: EventName, eventHandler: EventHandler): void {
    this.eventHandlers[eventName].push(eventHandler)
  }

  public off(eventName: EventName): void
  public off(eventName: EventName, eventHandler: EventHandler): void
  public off(eventName: EventName, eventHandler?: EventHandler): void {
    if (eventHandler) {
      const i = this.eventHandlers[eventName].findIndex(item => item === eventHandler)
      this.eventHandlers[eventName].splice(i, 1)
      return
    }
    this.eventHandlers[eventName].splice(0, this.eventHandlers[eventName].length)
  }

  public async chat(text: string) {
    this.worker.postMessage(WorkerMessage.build(WorkerMessageType.Chat, 'chat', text))
  }

  // 刷新页面
  public async refresh() {
    this.worker.postMessage(WorkerMessage.build(WorkerMessageType.Refresh))
  }

  public async exit() {
    this.worker.postMessage(WorkerMessage.build(WorkerMessageType.Exit))
  }
}