import {PuppeteerConfig} from "./types/PuppeteerConfig";
import moment from "moment/moment";
import process from "process";
import {parentPort} from "node:worker_threads";
import {WorkerMessage} from "./models/WorkerMessage";
import {WorkerMessageType} from "./types/WorkerMessageType";
import fsp from "fs/promises";
import path from "path";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import {Browser, Page} from "puppeteer";

/**
 * worker 线程中运行的对象的抽象类
 */
export abstract class ChatWorker {
  public abstract name: string
  public abstract url: string
  protected config: PuppeteerConfig
  protected browser: Browser
  protected page: Page
  private currentRetryCount: number = 0
  protected cookiesPath: string = path.resolve(process.cwd(), 'cookies')

  constructor() {
    parentPort.on('message', async (e: WorkerMessage) => {
      switch (e.type) {
        case WorkerMessageType.Refresh:
          await this.beforeReload()
          await this.page.reload()
          break;
        case WorkerMessageType.Exit:
          await this.page.close()
          process.exit(0)
          break;
        default:
          await this.receiveMessage(e)
          break;
      }
    })
  }

  protected abstract receiveMessage(m: WorkerMessage): Promise<void>;

  public async run(): Promise<void> {
    await this.readConfig()
    try {
      await this.main()
    } catch (e) {
      await this.reportError('something wrong, retry now', e)
      await this.retry()
    }
  }

  private async readConfig(): Promise<void> {
    const configFilePath = path.resolve(process.cwd(), 'puppeteer.config.js')
    await this.report('start read config')
    try {
      await fsp.access(configFilePath)
    } catch (e) {
      await reportError('read config error', e)
      // 配置文件没找到异常退出 应该在主线程监听 exit 事件并作出处理
      process.exit(1)
    }
    this.config = (await import(configFilePath)).default
    await this.report('read config complete')
  }

  private async main(): Promise<void> {
    await this.init()
    await this.signIn()
    await this.ready()
  }

  protected async retry() {
    if (this.currentRetryCount >= this.config.retryCount) {
      // 异常中断 应该在主线程监听 exit 事件并作出处理
      await this.reportError('retry over count', new Error('retry over count: ' + this.config.retryCount))
      process.exit(1)
    }

    await this.report('retry')
    this.currentRetryCount++
    await this.beforeRetry()
    // 关闭浏览器
    this.browser && await this.browser.close()
    await this.report('close browser, ready to call main again')
    await this.main()
  }

  protected abstract beforeRetry(): Promise<void>;

  protected abstract beforeReload(): Promise<void>;

  protected async init(): Promise<void> {
    await this.report('start init puppeteer')
    puppeteer.use(StealthPlugin());
    this.browser = await puppeteer.launch({
      executablePath: this.config.chromePath,
      headless: this.config.headless
    });
    await this.report('launch browser')
    const pages = await this.browser.pages();
    this.page = pages[0];
    this.page.setDefaultNavigationTimeout(0);
    this.page.setDefaultTimeout(0);
    // let url = this.config.aiType === AIType.ChatGPT ? 'https://chat.openai.com/chat' : 'https://chat.cutterman.cn'
    await this.report('init puppeteer complete, start goto: ' + this.url)
    await this.page.goto(this.url);
  }

  protected abstract signIn(): Promise<void>;

  protected async ready(): Promise<void> {
    parentPort.postMessage(WorkerMessage.build(WorkerMessageType.Ready))
  }

  protected async report(message: string): Promise<void> {
    await report(message, this.name)
  }

  protected async reportError(message: string, e: Error): Promise<void> {
    await reportError(message, e, this.name)
  }

  protected async readCookies(): Promise<boolean> {
    try {
      await fsp.access(this.cookiesPath)
      const cookies = JSON.parse((await fsp.readFile(this.cookiesPath)).toString())
      await this.page.setCookie(...cookies)
      return true
    } catch (e) {
      await this.report('skip read cookies')
      return false
    }
  }

  protected async saveCookies() {
    const cookies = await this.page.cookies()
    await fsp.writeFile(this.cookiesPath, JSON.stringify(cookies))
  }

  public abstract question(text: string): Promise<void>;

  public abstract answer(): Promise<void>;

  protected wait(time: number): Promise<void> {
    return new Promise(r => {
      setTimeout(r, time)
    })
  }
}

export async function logStr(str: string, who?: string): Promise<string> {
  return `[date:${moment().format('YYYY/MM/DD HH:mm:ss')}][pid:${process.pid}] - ${who ? who : 'main'} - : ${str}`
}

export async function log(str: string, who?: string): Promise<void> {
  console.log(await logStr(str, who))
}

export async function error(str: string, who?: string): Promise<void> {
  console.log(await logStr(str, who))
}

export async function report(message: string, who?: string): Promise<void> {
  message = await logStr(message, who)
  parentPort.postMessage(JSON.stringify(WorkerMessage.build(WorkerMessageType.Report, message)))
}

export async function reportError(message: string, e: Error, who?: string): Promise<void> {
  message = await logStr(message, who)
  parentPort.postMessage(JSON.stringify(WorkerMessage.build(WorkerMessageType.Error, message, e)))
}