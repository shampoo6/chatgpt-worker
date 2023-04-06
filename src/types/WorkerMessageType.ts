export enum WorkerMessageType {
  /**
   * 退出
   */
  Exit,
  /**
   * 报告消息
   */
  Report,
  /**
   * 异常
   */
  Error,
  /**
   * 提问
   */
  Question,
  /**
   * 回答
   */
  Answer,
  /**
   * 刷新页面
   */
  Refresh
}