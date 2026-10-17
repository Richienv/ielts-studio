import type { IncomingMessage, ServerResponse } from 'node:http';
import { createAssessmentHandler } from '../assessment-handler.js';
const handler=createAssessmentHandler(process.env as Record<string,string>);
export default async function endpoint(req:IncomingMessage,res:ServerResponse){
 await handler(req,res,()=>{res.statusCode=404;res.end(JSON.stringify({error:'Unknown endpoint.'}));});
}
