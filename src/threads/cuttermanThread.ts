import {ChatCuttermanWorker} from "../helpers/ChatCuttermanWorker";

const worker = new ChatCuttermanWorker();

(async () => {
  await worker.run()
})()
