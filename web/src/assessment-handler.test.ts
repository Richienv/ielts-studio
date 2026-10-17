import {afterEach,expect,it} from 'vitest';
import {createServer,type Server,type IncomingMessage} from 'node:http';
import {createAssessmentHandler} from '../assessment-handler';
const servers:Server[]=[];
afterEach(async()=>{await Promise.all(servers.splice(0).map(server=>new Promise<void>(resolve=>server.close(()=>resolve()))));});
async function serve(env:Record<string,string>,parsed=false){
 const handler=createAssessmentHandler(env);const server=createServer(async(req,res)=>{
  if(parsed&&req.method==='POST'){const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));(req as IncomingMessage&{body?:unknown}).body=JSON.parse(Buffer.concat(chunks).toString());}
  await handler(req,res,()=>{res.statusCode=404;res.end();});
 });servers.push(server);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(typeof address!=='object'||!address)throw new Error('No test port');return `http://127.0.0.1:${address.port}`;
}
it('reports the hosted evaluator as unavailable without exposing local setup paths',async()=>{const url=await serve({VERCEL:'1'});const status=await fetch(url+'/api/status');expect((await status.json()).configured).toBe(false);const response=await fetch(url+'/api/assess',{method:'POST',body:JSON.stringify({skill:'writing'})});expect(response.status).toBe(503);const body=await response.json();expect(body.error).toContain('not configured on this site');expect(body.error).not.toContain('.env');});
it('accepts the production origin and Vercel-parsed JSON while rejecting invalid essays before provider access',async()=>{const url=await serve({GEMINI_API_KEY:'synthetic-test-key'},true);const response=await fetch(url+'/api/assess',{method:'POST',headers:{Origin:url.replace('http:','https:'),'Content-Type':'application/json'},body:JSON.stringify({skill:'writing',tasks:[]})});expect(response.status).toBe(400);expect((await response.json()).error).toContain('Two valid writing responses');});
it('rejects unrelated browser origins',async()=>{const url=await serve({});const response=await fetch(url+'/api/assess',{method:'POST',headers:{Origin:'https://unrelated.example'},body:'{}'});expect(response.status).toBe(403);});
