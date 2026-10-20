/** Public Tumblr post extractor. No credentials or private access. */
const MAX_UPSTREAM_BYTES=4*1024*1024;

function parseTumblrUrl(value){
  if(typeof value!=='string'||value.length>2048)throw Error('Paste a valid Tumblr post link.');
  let url;
  try{url=new URL(value.trim());}catch{throw Error('That does not look like a Tumblr post link.');}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port)throw Error('Only public Tumblr post links are supported.');
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  let blog,id;
  if(host==='tumblr.com'||host==='www.tumblr.com'){
    const match=url.pathname.match(/^\/(?:blog\/view\/)?([a-z\d-]+)\/(\d{6,25})(?:\/|$)/i);
    if(!match)throw Error('Please paste a link to an individual Tumblr post, not a blog or tag.');
    blog=match[1];id=match[2];
  }else{
    const matchHost=host.match(/^([a-z\d-]+)\.tumblr\.com$/i);
    if(!matchHost)throw Error('For safety, this version supports tumblr.com links only.');
    const matchPath=url.pathname.match(/^\/post\/(\d{6,25})(?:\/|$)/i);
    if(!matchPath)throw Error('Please paste a link to an individual Tumblr post.');
    blog=matchHost[1];id=matchPath[1];
  }
  if(!/^[a-z\d-]{1,64}$/i.test(blog)||blog==='www'||blog==='api')throw Error('This Tumblr username is not supported.');
  return {blog,id,canonical:'https://www.tumblr.com/'+blog+'/'+id};
}

async function readLimited(response){
  const reader=response.body?.getReader();
  if(!reader)return await response.text();
  let total=0;
  const chunks=[];
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    total+=value.byteLength;
    if(total>MAX_UPSTREAM_BYTES){await reader.cancel();throw Error('This post is too large to import.');}
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map(v=>Buffer.from(v))));
}

async function fetchFromTumblr(url){
  const signal=AbortSignal.timeout(15000);
  let current=url;
  for(let redirects=0;redirects<3;redirects++){
    const response=await fetch(current,{
      redirect:'manual',signal,
      headers:{'User-Agent':'Mozilla/5.0 (compatible; Storykeep/1.0; public post reader)','Accept':'application/javascript, application/json, text/plain, */*'}
    });
    if([301,302,303,307,308].includes(response.status)){
      const to=new URL(response.headers.get('location')||'',current);
      if(to.protocol!=='https:'||!/(^|\.)tumblr\.com$/i.test(to.hostname))throw Error('Tumblr redirected this post somewhere unexpected.');
      current=to.toString();
      continue;
    }
    if([401,403,404].includes(response.status))throw Error('This post is unavailable, private, or restricted to logged-in Tumblr users.');
    if(response.status===429)throw Error('Tumblr is limiting requests right now. Please try again later.');
    if(!response.ok)throw Error('Tumblr could not serve that post right now. Please try again.');
    return readLimited(response);
  }
  throw Error('Too many Tumblr redirects.');
}

function parseJsonp(text){
  const clean=text.replace(/^\s*var\s+tumblr_api_read\s*=\s*/,'').replace(/;\s*$/,'').trim();
  try{return JSON.parse(clean);}catch{throw Error('Tumblr returned a response this reader could not understand.');}
}
function escapeHtml(str){return String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function getBody(post){
  const first=(...keys)=>keys.map(k=>post[k]).find(v=>typeof v==='string'&&v.trim());
  let body=first('regular-body','body','photo-caption','video-caption','audio-caption','link-description','answer','quote-text');
  if(!body&&Array.isArray(post.conversation)){
    body=post.conversation.map(v=>'<p><strong>'+escapeHtml(v.label||v.name||'')+'</strong> '+escapeHtml(v.phrase||'')+'</p>').join('');
  }
  if(post.type==='answer'&&typeof post.question==='string'&&body)body='<blockquote>'+post.question+'</blockquote>'+body;
  return body||'';
}
async function extract(input){
  const {blog,id,canonical}=parseTumblrUrl(input);
  // The request target is constructed solely from validated Tumblr identifiers.
  const text=await fetchFromTumblr('https://'+blog+'.tumblr.com/api/read/json?id='+id);
  const result=parseJsonp(text);
  const posts=Array.isArray(result?.posts)?result.posts:[];
  // IDs may exceed JS safe integer precision; a single-result legacy reply is accepted.
  const post=posts.find(p=>String(p['id-string']||p.id)===id)||
    (posts.length===1&&!posts[0]['id-string']?posts[0]:undefined);
  if(!post)throw Error('This post is not publicly available through Tumblr. Check the link and its visibility settings.');
  const html=getBody(post);
  if(!html.trim())throw Error('This post does not have readable story text, or Tumblr has not made it available.');
  let title=typeof post['regular-title']==='string'?post['regular-title'].trim():'';
  if(!title&&typeof post.slug==='string')title=post.slug.replace(/[-_]+/g,' ').trim();
  if(!title)title='Untitled Tumblr post';
  return {title:title.slice(0,220),author:result?.tumblelog?.name||blog,source:canonical,html};
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'&&req.method!=='GET'){
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({error:'Use GET or POST to extract a post.'});
  }
  try{
    const url=req.method==='GET'?req.query?.url:req.body?.url;
    return res.status(200).json(await extract(url));
  }catch(err){
    const message=err?.name==='TimeoutError'||err?.name==='AbortError'
      ?'Tumblr took too long to respond. Please try again.'
      :(err?.message||'Something went wrong. Please try again.');
    const inputError=/^(Paste|That does not|Only public|Please paste|For safety|This Tumblr username)/.test(message);
    return res.status(inputError?400:422).json({error:message});
  }
};
module.exports._test={parseTumblrUrl,parseJsonp,getBody,extract};
