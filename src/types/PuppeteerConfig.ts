export enum AIType {
  ChatGPT = 'ChatGPT',
  ChatCutterman = 'ChatCutterman',
  FastChat = 'FastChat'
}

/**
 * puppeteer 相关配置
 */
export type PuppeteerConfig = {
  /**
   * AI 类型
   */
  aiType: AIType,
  /**
   * 浏览器可执行文件路径
   */
  chromePath: string,
  /**
   * ChatGPT 邮箱
   */
  email: string,
  /**
   * ChatGPT 密码
   */
  password: string,
  /**
   * 异常重试次数
   */
  retryCount: number,
  /**
   * 是否无头启动
   */
  headless: boolean
}