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
import {AIChatMessage} from "./models/AIChatMessage";

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
  private timerId: NodeJS.Timer
  private lastText: string = ''
  // 用于指示是否回复结束的flag
  // 不能再 reset 方法中重置，只能在每次开始回复时重置
  private over: boolean = false

  constructor() {
    parentPort.on('message', async (e: WorkerMessage) => {
      switch (e.type) {
        case WorkerMessageType.Refresh:
          await this.reload()
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

  /**
   * 刷新页面
   * @protected
   */
  protected async reload() {
    await this.superBeforeReload()
    await this.page.reload()
    // 重新执行ready方法保证能在刷新后接收消息
    await this.ready()
  }

  /**
   * 接收主线程的消息
   * @param m 线程消息
   * @protected
   */
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

  /**
   * 读取配置
   * @private
   */
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

  /**
   * 主逻辑
   * @private
   */
  private async main(): Promise<void> {
    await this.init()
    await this.signIn()
    await this.ready()
  }

  /**
   * 重试流程
   * @protected
   */
  protected async retry() {
    if (this.currentRetryCount >= this.config.retryCount) {
      // 异常中断 应该在主线程监听 exit 事件并作出处理
      await this.reportError('retry over count', new Error('retry over count: ' + this.config.retryCount))
      process.exit(1)
    }

    await this.report('retry')
    this.currentRetryCount++
    await this.superBeforeRetry()
    // 关闭浏览器
    this.browser && await this.browser.close()
    await this.report('close browser, ready to call main again')
    await this.main()
  }

  protected reset() {
    clearInterval(this.timerId)
    this.timerId = null
    this.lastText = ''
  }

  private async superBeforeRetry() {
    this.reset()
    await this.beforeRetry()
  }


  /**
   * 重试前操作
   * @protected
   */
  protected abstract beforeRetry(): Promise<void>;

  private async superBeforeReload() {
    this.reset()
    await this.beforeReload()
  }

  /**
   * 刷新页面前
   * @protected
   */
  protected abstract beforeReload(): Promise<void>;

  /**
   * 初始化浏览器
   * @protected
   */
  protected async init(): Promise<void> {
    await this.report('start init puppeteer')
    puppeteer.use(StealthPlugin());
    const option: Record<string, any> = {
      // executablePath: this.config.chromePath,
      headless: this.config.headless
    }
    if (typeof this.config.chromePath === 'string')
      option['executablePath'] = this.config.chromePath
    this.browser = await puppeteer.launch(option);
    await this.report('launch browser')
    const pages = await this.browser.pages();
    this.page = pages[0];
    this.page.setDefaultNavigationTimeout(0);
    this.page.setDefaultTimeout(0);
    // let url = this.config.aiType === AIType.ChatGPT ? 'https://chat.openai.com/chat' : 'https://chat.cutterman.cn'
    await this.report('init puppeteer complete, start goto: ' + this.url)
    await this.page.goto(this.url);
  }

  /**
   * 登录
   * @protected
   */
  protected abstract signIn(): Promise<void>;

  /**
   * 准备就绪
   * 在接收消息前的一些操作写在这里
   * @protected
   */
  protected async ready(): Promise<void> {
    await this.report('ready')
    parentPort.postMessage(WorkerMessage.build(WorkerMessageType.Ready))
  }

  /**
   * 发送报告给主线程
   * @param message
   * @protected
   */
  protected async report(message: string): Promise<void> {
    await report(message, this.name)
  }

  /**
   * 发送异常报告给主线程
   * @param message
   * @param e
   * @protected
   */
  protected async reportError(message: string, e: Error): Promise<void> {
    await reportError(message, e, this.name)
  }

  /**
   * 读取cookies缓存
   * @protected
   */
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

  /**
   * 保存cookies
   * @protected
   */
  protected async saveCookies() {
    const cookies = await this.page.cookies()
    await fsp.writeFile(this.cookiesPath, JSON.stringify(cookies))
  }

  /**
   * 聊天
   * @param text 聊天的文本
   */
  public async chat(text: string): Promise<void> {
    await this.chatLogic(text)
    await this.wait(100)
    await this.startListenResult()
  }

  protected abstract chatLogic(text: string): Promise<void>;

  /**
   * 开始监听AI的返回结果
   * @protected
   */
  protected async startListenResult() {
    this.timerId = setInterval(async () => {
      // 判断ai是否开始作答
      if (await this.isStartReply()) {
        clearInterval(this.timerId)
        listener()
      }
    }, 40)

    const listener = () => {
      this.over = false
      this.timerId = setInterval(async () => {
        // 获取内容
        let text = await this.getReplyText()
        // 输出内容到终端
        process.stdout.write('\x1B[2J\x1B[0f');
        console.log(text)
        const isFirstReply = this.lastText === ''
        // 比较内容
        const apd = text.slice(this.lastText.length)
        this.lastText = text

        // 判断是否结束
        if (await this.isReplyOver() && !this.over) {
          this.over = true
          this.reset()
          const html = await this.getReplyHtml()
          parentPort.postMessage(WorkerMessage.build(WorkerMessageType.Reply, 'answer', AIChatMessage.end(text, html)))
          return
        }

        // 发送内容
        parentPort.postMessage(WorkerMessage.build(WorkerMessageType.Reply, 'answer', isFirstReply ? AIChatMessage.start(text) : AIChatMessage.replying(apd, text)))
      }, 40)
    }
  }

  /**
   * 是否AI回复结束
   * @protected
   */
  protected abstract isReplyOver(): Promise<boolean>

  /**
   * 获取AI回复的文本
   * @protected
   */
  protected abstract getReplyText(): Promise<string>

  /**
   * 获取AI回复内容的html代码
   * @protected
   */
  protected abstract getReplyHtml(): Promise<string>

  /**
   * AI是否开始回复
   * @protected
   */
  protected abstract isStartReply(): Promise<boolean>

  /**
   * 等待
   * @param time
   * @protected
   */
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
  parentPort.postMessage(WorkerMessage.build(WorkerMessageType.Report, message))
}

export async function reportError(message: string, e: Error, who?: string): Promise<void> {
  message = await logStr(message, who)
  parentPort.postMessage(WorkerMessage.build(WorkerMessageType.Error, message, e))
}