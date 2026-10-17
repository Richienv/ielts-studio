import type { IncomingMessage, ServerResponse } from 'node:http';
export default function status(_req:IncomingMessage,res:ServerResponse){
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 res.end(JSON.stringify({configured:!!process.env.GEMINI_API_KEY,provider:'Google Gemini',model:process.env.GEMINI_MODEL||'gemini-3.8-flash'}));
}
