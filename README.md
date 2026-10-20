# Storykeep

A clean Tumblr-inspired reader for **public Tumblr story posts**. Works on mobile and desktop. Offers one-click rich-text copying, `.txt` and offline `.html` downloads, and adjustable reading text size.

## Run locally

Requires Node.js 20+. No package installation needed.

```sh
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

Import this folder to Vercel. The `public/` folder contains the site; `api/extract.js` is an automatically discovered Node.js serverless function. No secrets or environment variables required. Deploy from the root with the framework setting **Other**. To change the API behavior, edit `api/extract.js`.

## Notes and limits

* Supports `www.tumblr.com/username/postid` and `username.tumblr.com/post/postid` style URLs.
* Uses Tumblr's public legacy API endpoint for full public post HTML, including the content beyond Read More breaks when exposed publicly. Tumblr may change or restrict this endpoint at any time.
* Does not bypass private posts, login requirements, paywalls, or deleted posts. Some modern Tumblr post types may not be rendered fully by Tumblr's legacy endpoint.
* Plain text, headings, quotes, links, and inline emphasis are preserved; remote images, embeds, scripts, and interactive media are intentionally omitted.
* Story text is fetched on demand and not stored by this site.
* Please respect authors' rights; personal reading and saving doesn't grant permission to republish their writing.
