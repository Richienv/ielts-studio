import type { Plugin } from 'vite';
import { createAssessmentHandler } from './assessment-handler';
export function assessmentPlugin(env:Record<string,string>):Plugin {
 const handler=createAssessmentHandler(env);
 return {name:'ielts-assessment',configureServer(server){server.middlewares.use(handler);},configurePreviewServer(server){server.middlewares.use(handler);}};
}
