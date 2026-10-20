const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseTumblrUrl,parseJsonp,getBody,extract}=require('../api/extract')._test;

test('supports both commonly shared Tumblr link formats',()=>{
  assert.deepEqual(parseTumblrUrl('https://www.tumblr.com/some-blog/742511779164340224/story-title'),{blog:'some-blog',id:'742511779164340224',canonical:'https://www.tumblr.com/some-blog/742511779164340224'});
  assert.equal(parseTumblrUrl('https://some-blog.tumblr.com/post/742511779164340224/story-title').id,'742511779164340224');
});
test('rejects malicious or unsupported external hosts and URLs',()=>{
  for(const url of ['https://evil.com/post/742511779164340224','https://some-blog.tumblr.com.evil.com/post/742511779164340224','http://127.0.0.1/post/742511779164340224','file:///etc/passwd','https://www.tumblr.com/tagged/fanfiction','https://some-blog.tumblr.com:444/post/742511779164340224'])assert.throws(()=>parseTumblrUrl(url));
});
test('parses JSONP and retains text behind more breaks',()=>{
  const fixture='var tumblr_api_read = '+JSON.stringify({posts:[{id:'742511779164340224','regular-body':'<p>Intro</p><!-- more --><p>Everything after the break.</p>'}]})+';';
  const p=parseJsonp(fixture);assert.match(getBody(p.posts[0]),/Everything after the break/);
});
test('reads legacy public post correctly with mocked Tumblr API',async()=>{
  const original=global.fetch;
  global.fetch=async url=>{
    assert.equal(url,'https://example.tumblr.com/api/read/json?id=742511779164340224');
    return new Response('var tumblr_api_read = '+JSON.stringify({tumblelog:{name:'example'},posts:[{id:'742511779164340224','regular-title':'My fic','regular-body':'<p>Hello <em>world</em></p>'}]})+';', {status:200});
  };
  try{const story=await extract('https://www.tumblr.com/example/742511779164340224');assert.equal(story.title,'My fic');assert.match(story.html,/em/);assert.equal(story.author,'example');}finally{global.fetch=original;}
});
test('keeps precision when Tumblr sends a 64-bit post id as a JSON number',async()=>{
  const original=global.fetch;
  global.fetch=async()=>new Response('var tumblr_api_read = {"tumblelog":{"name":"example"},"posts":[{"id":769680688183164928,"regular-body":"<p>Full story</p>"}]}',{status:200});
  try{const result=await extract('https://www.tumblr.com/example/769680688183164928');assert.equal(result.html,'<p>Full story</p>');}finally{global.fetch=original;}
});

