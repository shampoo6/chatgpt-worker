export enum WorkerMessageType {
  /**
   * 退出
   */
  Exit,
  /**
   * 准备就绪
   */
  Ready,
  /**
   * 报告消息
   */
  Report,
  /**
   * 异常
   */
  Error,
  /**
   * 聊天
   */
  Chat,
  /**
   * 回复
   */
  Reply,
  /**
   * 刷新页面
   */
  Refresh
}