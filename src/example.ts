import express from 'express'
import {EventName, WorkerProxy} from "./helpers/WorkerProxy";
import {log} from "./core";
import path from "path";
import process from "process";
import {WorkerMessage} from "./models/WorkerMessage";
import {WorkerMessageType} from "./types/WorkerMessageType";
import {AIChatMessage, AIChatStatus} from "./models/AIChatMessage";

const template = '我会提供你一个ejs模板，请帮我填充ejs模板中<%=ai%>部分的内容，具体要求如下:\n' +
  '1. 请你使用ejs模板引擎渲染我提供的模板;                                   \n' +
  '2. 其中参数 <%=ai%> 需要你来帮我填充;                                     \n' +
  '3. 最终返回给我渲染成功的 html;                                           \n' +
  '4. ejs模板描述的内容是一份记录技术知识点的笔记;                           \n' +
  '5. 标题请更具体一点;\n' +
  '6. 填充完后的ejs模板的字数在400字以内;\n' +
  '7. 笔记内容请从以下技术中选择一项进行记述: 科大讯飞语音合成，科大讯飞语音转写;\n' +
  '模板如下:\n' +
  '\n' +
  '<!DOCTYPE html>\n' +
  '<html>\n' +
  '<head></head>\n' +
  '<body>\n' +
  '<h1>标题: <%=ai%></h1>\n' +
  '<ul>\n' +
  '<li><%=ai%></li>\n' +
  '<li><%=ai%></li>\n' +
  '<li><%=ai%></li>\n' +
  '<li><%=ai%></li>\n' +
  '</ul>\n' +
  '</body>\n' +
  '</html>\n'

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
    if (e.type === WorkerMessageType.Answer) {
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

  // await wp.question(question as string)
  await wp.question(template as string)
})

app.get('/exit', async (req, res) => {
  await wp.exit();
  res.json({msg: 'ok'})
})

app.listen(1024, () => {
  log('server start on: http://127.0.0.1:1024').then()
})