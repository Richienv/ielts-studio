import type { Plugin } from 'vite';
import { createAssessmentHandler } from './assessment-handler.js';
import { createChatGPTHandler } from './chatgpt-handler.js';
export function assessmentPlugin(env:Record<string,string>):Plugin {
 const handler=createAssessmentHandler(env);
 const chatgpt=createChatGPTHandler({hosted:!!env.VERCEL});
 return {name:'ielts-assessment',configureServer(server){server.middlewares.use(chatgpt.handler);server.middlewares.use(handler);server.httpServer?.once('close',chatgpt.close);},configurePreviewServer(server){server.middlewares.use(chatgpt.handler);server.middlewares.use(handler);server.httpServer?.once('close',chatgpt.close);}};
}
