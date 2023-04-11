import express from 'express'
import {EventName, WorkerProxy} from "./helpers/WorkerProxy";
import {log} from "./core";
import path from "path";
import process from "process";
import {WorkerMessage} from "./models/WorkerMessage";
import {WorkerMessageType} from "./types/WorkerMessageType";
import {AIChatMessage, AIChatStatus} from "./models/AIChatMessage";

const app = express()

const wp = new WorkerProxy()

app.use('/', express.static(path.resolve(process.cwd(), 'public')))

app.get('/question', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const {question} = req.query

  // 绑定线程事件
  wp.on(EventName.Message, (e: WorkerMessage) => {
    if (e.type === WorkerMessageType.Reply) {
      const data: AIChatMessage = e.data
      if (data.status === AIChatStatus.End) {
        res.end(JSON.stringify(data))
      } else {
        res.write(JSON.stringify(data))
      }
    }
  })

  // 前端请求中断
  res.on('close', async () => {
    await wp.refresh()
  })

  await wp.chat(question as string)
})

app.get('/exit', async (req, res) => {
  await wp.exit();
  res.json({msg: 'ok'})
})

app.listen(1024, () => {
  log('server start on: http://127.0.0.1:1024').then()
})