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

  constructor(status: AIChatStatus, slice: string, content: string) {
    this.status = status
    this.apd = slice
    this.content = content
  }

  public static start(content: string) {
    return new AIChatMessage(AIChatStatus.Start, content, content)
  }

  public static replying(apd: string, content: string) {
    return new AIChatMessage(AIChatStatus.Replying, apd, content)
  }

  public static end(content: string) {
    return new AIChatMessage(AIChatStatus.End, '', content)
  }
}