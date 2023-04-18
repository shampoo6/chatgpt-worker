import path from "path";
import process from "process";
import fsp from "fs/promises";
import {AIType, PuppeteerConfig} from "../types/PuppeteerConfig";
import {ChatWorker} from "../core";
import {ChatCuttermanWorker} from "../helpers/ChatCuttermanWorker";
import {FastChatWorker} from "../helpers/FastChatWorker";
import {ChatGPTWorker} from "../helpers/ChatGPTWorker";

const configFilePath = path.resolve(process.cwd(), 'puppeteer.config.js');

let chatWorker: ChatWorker

(async () => {
  try {
    await fsp.access(configFilePath)
    // 读取文件配置
    const config: PuppeteerConfig = (await import(configFilePath)).default
    // 创建chatWorker对象
    switch (config.aiType) {
      case AIType.ChatGPT:
        chatWorker = new ChatGPTWorker()
        break;
      case AIType.FastChat:
        chatWorker = new FastChatWorker()
        break;
      case AIType.ChatCutterman:
        chatWorker = new ChatCuttermanWorker()
        break;
      default:
        break;
    }
    await chatWorker.run()
  } catch (e) {
    console.error('worker thread error')
    console.error(e)
  }
})()