import {ChatWorker} from "../core";
import {WorkerMessage} from "../models/WorkerMessage";
import {WorkerMessageType} from "../types/WorkerMessageType";

export class ChatGPTWorker extends ChatWorker {
  name: string = 'ChatGPTWorker';
  url: string = 'https://chat.openai.com/';
  private loginBtnSelector = '.btn.relative.btn-primary'
  private emailInputSelector = '#username'
  private continueBtnSelector = 'button[type="submit"]'
  private pwdInputSelector = '#password'
  private coverSelector = '#headlessui-portal-root'
  private textareaSelector = 'textarea'
  private sendBtnSelector = '.absolute.p-1.rounded-md.text-gray-500'
  private sendBtnSvgSelector = '.absolute.p-1.rounded-md.text-gray-500>svg'
  private messageSelector = '.group.w-full'
  // 回复中的元素
  private resultStreamDivSelector = '.result-streaming'
  // 异常提示div元素
  private errorDivSelector = '.bg-red-500\\/10'
  // 机器人检测元素
  private humanCheckSelector = '#content'

  // 点击聊天按钮时，消息个数

  protected beforeReload(): Promise<void> {
    return Promise.resolve(undefined);
  }

  protected beforeRetry(): Promise<void> {
    return Promise.resolve(undefined);
  }

  protected async chatLogic(text: string): Promise<void> {
    console.log('chat logic')
    console.log(text)
    await this.page.$eval(this.textareaSelector, (el: HTMLTextAreaElement, text: string) => {
      el.value = text
    }, text)
    await this.page.type(this.textareaSelector, ' ')
    await this.page.click(this.sendBtnSelector)
  }

  protected async getReplyHtml(): Promise<string> {
    try {
      return await this.page.$eval(this.resultStreamDivSelector, el => {
        return el.innerHTML
      })
    } catch (e) {
    }

    return await this.page.$$eval(this.messageSelector, (els) => {
      if (els.length === 0) return ''
      let tmp = els[els.length - 1].querySelector('.markdown')
      return tmp ? tmp.innerHTML : ''
    })
  }

  protected async getReplyText(): Promise<string> {
    // 判断是否出现ChatGPT红色异常
    if (await this.page.$(this.errorDivSelector)) {
      // await this.reportError('ChatGPT error', new Error('ChatGPT error'))
      await this.reload()
      return ''
    }

    try {
      return await this.page.$eval(this.resultStreamDivSelector, el => {
        return el.textContent
      })
    } catch (e) {
    }

    return await this.page.$$eval(this.messageSelector, (els) => {
      if (els.length === 0) return ''
      let tmp = els[els.length - 1].querySelector('.markdown')
      return tmp ? tmp.textContent : ''
    })
  }

  protected async isReplyOver(): Promise<boolean> {
    let result = Boolean(await this.page.$(this.sendBtnSvgSelector))
    if (result)
      console.log('is reply over: ', result)
    return result
  }

  protected async isStartReply(): Promise<boolean> {
    return Boolean(await this.page.$(this.resultStreamDivSelector))
  }

  protected async receiveMessage(m: WorkerMessage): Promise<void> {
    console.log('worker receive message')
    console.log(m)
    switch (m.type) {
      case WorkerMessageType.Chat:
        await this.chat(m.data)
        break;
    }
  }

  protected async signIn(): Promise<void> {
    await this.report('login start')
    if (await this.readCookies()) {
      try {
        await Promise.all([
          this.wait(3000),
          this.page.waitForNavigation({timeout: 10000})
        ])

        // 有可能需要验证是否是机器人
        if (await this.page.$(this.humanCheckSelector)) {
          // 等待 confirm
          // 因为需要手动验证，超时时间写长点
          await this.page.waitForNavigation({timeout: 30000})
        }

        await this.page.waitForSelector(this.textareaSelector, {timeout: 1000})
        await this.page.waitForSelector(this.sendBtnSelector, {timeout: 1000})
        await this.report('login end')
        return
      } catch (e) {
      }
    }

    // 点击第一个登录按钮
    await this.page.waitForSelector(this.loginBtnSelector)
    await this.wait(3000)
    await Promise.all([
      this.page.waitForNavigation(),
      this.page.click(this.loginBtnSelector)
    ])
    // 等待邮箱输入框
    await this.page.waitForSelector(this.emailInputSelector)
    await this.wait(2000)
    await this.page.type(this.emailInputSelector, this.config.email)
    await this.page.waitForSelector(this.continueBtnSelector)
    await Promise.all([
      this.page.waitForNavigation(),
      this.page.click(this.continueBtnSelector)
    ])
    // 等待密码输入框
    await this.page.waitForSelector(this.pwdInputSelector)
    await this.wait(2000)
    await this.page.type(this.pwdInputSelector, this.config.password)
    await this.page.waitForSelector(this.continueBtnSelector)
    await Promise.all([
      this.page.waitForNavigation(),
      this.page.click(this.continueBtnSelector)
    ])
    await this.report('login end')
  }

  protected async ready(): Promise<void> {
    await this.report('ready start')
    await this.wait(5000)
    await this.page.waitForSelector(this.textareaSelector)
    await this.page.waitForSelector(this.sendBtnSelector)
    // 登录成功 保存 cookies
    await this.saveCookies()
    try {
      await this.page.waitForSelector(this.coverSelector)
      await this.page.$eval(this.coverSelector, el => {
        el.remove()
      })
    } catch (e) {
    }
    await super.ready()
  }

}