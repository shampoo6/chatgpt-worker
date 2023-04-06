import {ChatWorker} from "../core";
import fsp from 'fs/promises'
import {WorkerMessage} from "../models/WorkerMessage";
import {WorkerMessageType} from "../types/WorkerMessageType";
import {parentPort} from "node:worker_threads";
import {AIChatMessage} from "../models/AIChatMessage";

export class ChatCuttermanWorker extends ChatWorker {
  name: string = 'ChatCuttermanWorker';
  url: string = 'https://chat.cutterman.cn';

  inputSelector: string = '#input';
  sendBtnSelector: string = 'button[title="发送"]';
  replySelector: string = '#message-container>div:last-child>.message'
  divSelector: string = '#message-container>div'

  timerId: NodeJS.Timer
  lastText: string = ''
  lastDivLength: number = 0

  protected async receiveMessage(m: WorkerMessage): Promise<void> {
    console.log('worker receive message')
    console.log(m)
    switch (m.type) {
      case WorkerMessageType.Question:
        await this.question(m.data)
        break;
    }
  }

  protected async beforeRetry(): Promise<void> {
    // 清空cookie
    try {
      await fsp.access(this.cookiesPath)
      await fsp.unlink(this.cookiesPath)
    } catch (e) {
      await this.report('skip clear cookies')
    }
  }

  protected async beforeReload(): Promise<void> {
    await this.reset()
  }

  protected async ready(): Promise<void> {
    await this.report('cutterman ready')
  }

  protected async signIn(): Promise<void> {
    if (await this.readCookies()) {
      await this.report('read cookies, no need sign in')
    }
    await this.saveCookies()
    // 等待输入框，若超时则重试
    await this.page.waitForSelector(this.inputSelector, {timeout: 10000})
  }

  public async question(text: string): Promise<void> {
    await this.page.waitForSelector(this.inputSelector)
    await this.page.type(this.inputSelector, text)
    // await this.page.$eval(this.inputSelector, (el, text) => {
    //   (el as any).value = text
    // }, text)
    await this.wait(1000);
    await this.page.waitForSelector(this.sendBtnSelector)
    await this.page.click(this.sendBtnSelector)
    await this.wait(200);
    // 记录当前对话框个数，用于判断ai是否开始回复内容
    this.lastDivLength = (await this.page.$$(this.divSelector)).length
    await this.startListenResult()
  }

  public answer(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  private async startListenResult() {
    this.timerId = setInterval(async () => {
      // 判断ai是否开始作答
      const divLength = (await this.page.$$(this.divSelector)).length
      if (divLength <= this.lastDivLength) {
        return
      }

      // 获取内容
      let text = await this.page.$eval(this.replySelector, el => {
        return el.textContent
      })
      const isFirstReply = this.lastText === ''
      // 比较内容
      const apd = text.slice(this.lastText.length)
      this.lastText = text
      // 判断是否结束
      if (await this.page.$(this.sendBtnSelector)) {
        console.log('reply over')
        await this.reset()
        parentPort.postMessage(WorkerMessage.build(WorkerMessageType.Answer, 'answer', AIChatMessage.end(text)))
        return
      }
      // 发送内容
      parentPort.postMessage(WorkerMessage.build(WorkerMessageType.Answer, 'answer', isFirstReply ? AIChatMessage.start(text) : AIChatMessage.replying(apd, text)))
    }, 40)
  }

  private async reset() {
    clearInterval(this.timerId)
    this.lastText = ''
    this.timerId = undefined
    this.lastDivLength = 0
    await this.wait(100)
  }
}