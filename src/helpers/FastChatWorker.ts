import {ChatWorker} from "../core";
import {WorkerMessage} from "../models/WorkerMessage";
import {WorkerMessageType} from "../types/WorkerMessageType";

export class FastChatWorker extends ChatWorker {
  name: string = 'FastChatWorker';
  url: string = 'https://chat.lmsys.org/';
  private inputSelector: string = 'textarea[placeholder="Enter text and press ENTER"]'
  private isStartReplySelector = '.svelte-zyxd38.margin'
  private replySelector = 'div[data-testid="bot"].latest'
  private clearHistoryBtnSelector = '#component-17[disabled]'

  protected beforeReload(): Promise<void> {
    return Promise.resolve(undefined);
  }

  protected beforeRetry(): Promise<void> {
    return Promise.resolve(undefined);
  }

  protected async chatLogic(text: string): Promise<void> {
    await this.page.waitForSelector(this.inputSelector)
    await this.page.$eval(this.inputSelector, (el: HTMLTextAreaElement, text: string) => {
      el.value = text
      el.dispatchEvent(new Event('input'))
    }, text)
    await this.wait(1000)
    await this.page.type(this.inputSelector, '\n')
  }

  protected async receiveMessage(m: WorkerMessage): Promise<void> {
    console.log(m)
    switch (m.type) {
      case WorkerMessageType.Chat:
        await this.chat(m.data)
        break;
      default:
        break;
    }
  }

  protected async signIn(): Promise<void> {
    await this.report('no need sign in')
  }

  protected async getReplyHtml(): Promise<string> {
    await this.page.waitForSelector(this.replySelector)
    return await this.page.$eval(this.replySelector, el => {
      return el.innerHTML
    })
  }

  protected async getReplyText(): Promise<string> {
    await this.page.waitForSelector(this.replySelector)
    return await this.page.$eval(this.replySelector, el => {
      return el.textContent
    })
  }

  protected async isReplyOver(): Promise<boolean> {
    return !Boolean(await this.page.$(this.clearHistoryBtnSelector))
  }

  protected async isStartReply(): Promise<boolean> {
    return !Boolean(await this.page.$(this.isStartReplySelector))
  }

}