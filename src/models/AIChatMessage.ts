export enum AIChatStatus {
  /**
   * 开始回复
   */
  Start,
  /**
   * 回复中
   */
  Replying,
  /**
   * 回复完毕
   */
  End
}

export class AIChatMessage {
  status: AIChatStatus;
  /**
   * 本次回复的追加片段
   */
  apd: string;
  /**
   * 完整的内容
   */
  content: string;
  /**
   * 返回内容的html代码，只有在 status 为 End 的时候 该属性才有值
   */
  html: string;

  constructor(status: AIChatStatus, apd: string, content: string, html: string) {
    this.status = status
    this.apd = apd
    this.content = content
    this.html = html
  }

  public static start(content: string) {
    return new AIChatMessage(AIChatStatus.Start, content, content, '')
  }

  public static replying(apd: string, content: string) {
    return new AIChatMessage(AIChatStatus.Replying, apd, content, '')
  }

  public static end(content: string, html: string) {
    return new AIChatMessage(AIChatStatus.End, '', content, html)
  }
}