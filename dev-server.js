const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const handler=require('./api/extract');
const root=path.join(__dirname,'public');
const server=http.createServer(async(req,res)=>{
  if(req.url.startsWith('/api/extract')){
    const u=new URL(req.url,'http://localhost');
    req.query=Object.fromEntries(u.searchParams);
    if(req.method==='POST'){
      let body='';
      for await(const chunk of req){
        body+=chunk;
        if(body.length>4096)break;
      }
      try{req.body=JSON.parse(body);}catch{req.body={};}
    }
    res.status=code=>{res.statusCode=code;return res;};
    res.json=data=>res.end(JSON.stringify(data));
    return handler(req,res);
  }
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=pathname==='/'?'index.html':pathname.substring(1);
  if(!['index.html','favicon.svg'].includes(file)){res.statusCode=404;return res.end('Not found');}
  res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8');
  fs.createReadStream(path.join(root,file)).pipe(res);
});
server.listen(process.env.PORT||3000,()=>console.log('Storykeep running on http://localhost:'+(process.env.PORT||3000)));

