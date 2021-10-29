/* CONFIGURATION STARTS HERE */
  /* Step 1: enter your domain name like fruitionsite.com */
  const MY_DOMAIN = 'dev.omsk.community';
  
  /* Step 3: enter your page title and description for SEO purposes */
  const SITE_NAME = 'DevFest Omsk 2021';
  const PAGE_TITLE = 'Конференция для разработчиков';
  const PAGE_DESCRIPTION = '23-24 октября. 6 треков. 30+ сессий.';
  
  /* Step 4: enter a Google Font name, you can choose from https://fonts.google.com */
  const GOOGLE_FONT = '';

  const PROPERTIES_TO_DELETE = {
    '1f2825691efd4ccd865ef537eefd7e8c': ['create time', 'telegram'],
    'bcc4da7d24fa4f3f856188e5fc361604': ['create time', 'когда в омске'], // parent_id DevFest-еры
    '1515ddb6b7014d5684dc05806bdb5a38': ['leadership', 'social', 'website'] // parent_id Companies
  }
  
  /* Step 5: enter any custom scripts you'd like */
  const CUSTOM_SCRIPT = `
  <!-- Global site tag (gtag.js) - Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-W2CZ8V6DDX"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-W2CZ8V6DDX');
  </script>`;
  
  addEventListener('fetch', event => {
    event.respondWith(fetchAndApply(event.request));
  });

  function generateSitemap() {
    let sitemap = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    slugs.forEach(
      (slug) =>
        (sitemap +=
          '<url><loc>https://' + MY_DOMAIN + '/' + slug + '</loc></url>')
    );
    sitemap += '</urlset>';
    return sitemap;
  }
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  function handleOptions(request) {
    if (request.headers.get('Origin') !== null &&
      request.headers.get('Access-Control-Request-Method') !== null &&
      request.headers.get('Access-Control-Request-Headers') !== null) {
      // Handle CORS pre-flight request.
      return new Response(null, {
        headers: corsHeaders
      });
    } else {
      // Handle standard OPTIONS request.
      return new Response(null, {
        headers: {
          'Allow': 'GET, HEAD, POST, PUT, OPTIONS',
        }
      });
    }
  }
  
  async function fetchAndApply(request) {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    let url = new URL(request.url);
    url.hostname = 'www.notion.so';
    if (url.pathname === '/robots.txt') {
      return new Response('Sitemap: https://' + MY_DOMAIN + '/sitemap.xml');
    }
    if (url.pathname === '/sitemap.xml') {
      let response = new Response(generateSitemap());
      response.headers.set('content-type', 'application/xml');
      return response;
    }
    let response;
    if (url.pathname.startsWith('/app') && url.pathname.endsWith('js')) {
      response = await fetch(url.toString());
      let body = await response.text();
      response = new Response(body.replace(/www.notion.so/g, MY_DOMAIN).replace(/notion.so/g, MY_DOMAIN), response);
      response.headers.set('Content-Type', 'application/x-javascript');
      return response;
    } else if ((url.pathname.startsWith('/api'))) {
      // Forward API
      response = await fetch(url.toString(), {
        body: url.pathname.startsWith('/api/v3/getPublicPageData') ? null : request.body,
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36'
        },
        method: 'POST',
      });

      const deleteProperties = (response, parentId, deleteSchema = false) => {
        const deletedKeys = [];
  
        let collectionId;
  
        Object.entries(response?.recordMap?.collection || {}).forEach(([key, value]) => {
            if (value.value.parent_id.replaceAll('-', '') === parentId) {
              collectionId = key;
            }
        })
  
        if (collectionId && response?.recordMap?.collection?.[collectionId]?.value?.schema) {
          if (deleteSchema) {
            delete response.recordMap.collection[collectionId].value
              .deleted_schema;
          }
          Object.entries(
            response.recordMap.collection?.[collectionId].value.schema
          ).forEach(([key, value]) => {
            if (PROPERTIES_TO_DELETE[parentId].map((fieldName) => fieldName.toLowerCase()).includes(value.name.toLowerCase())) {
              deletedKeys.push(key);
              delete response.recordMap.collection?.[collectionId]?.value?.schema[
                key
              ];
            }
          });
        }
  
        return {deletedKeys, collectionId};
      };
  
      const deletePropertiesRows = (response, collectionId, deletedKeys) => {
        for (const block in response.recordMap.block) {
          if (
            response.recordMap.block[block]?.value?.parent_id === collectionId &&
            response.recordMap.block[block]?.value?.properties
          ) {
            deletedKeys.forEach((key) => {
              delete response.recordMap.block[block]?.value?.properties[key];
            });
          }
        }
      };
  
      let responseWorker = new Response(response.body, response);
      responseWorker.headers.set('Access-Control-Allow-Origin', '*');
  
      if (url.pathname.startsWith('/api/v3/queryCollection') || 
      url.pathname.startsWith('/api/v3/syncRecordValues') || 
      url.pathname.startsWith('/api/v3/loadPageChunk')) {
        let responseBody = await response.json();
        Object.keys(PROPERTIES_TO_DELETE).forEach((id) => {
          const {deletedKeys, collectionId} = deleteProperties(responseBody, id, true);
          deletePropertiesRows(responseBody, collectionId, deletedKeys);
        });
        const body = JSON.stringify({ ...responseBody });
        responseWorker = new Response(body, responseWorker);
      }
  
      if (url.pathname.startsWith('/api/v3/loadCachedPageChunk')) {
        let responseBody = await response.json();
        Object.keys(PROPERTIES_TO_DELETE).forEach((id) => {
          deleteProperties(responseBody, id);
        });
        const body = JSON.stringify({ ...responseBody });
        responseWorker = new Response(body, responseWorker);
      }

      return responseWorker;
    }

    const SLUG_TO_PAGE = await WORKER_KV.get('SLUG_TO_PAGE', {type: 'json'});
    const PAGE_TO_SLUG = {};
    const slugs = [];
    const pages = [];
    Object.keys(SLUG_TO_PAGE).forEach(slug => {
        const page = SLUG_TO_PAGE[slug];
        slugs.push(slug);
        pages.push(page);
        PAGE_TO_SLUG[page] = slug;
    });
    
    if (slugs.indexOf(url.pathname.slice(1)) > -1) {
      const pageId = SLUG_TO_PAGE[url.pathname.slice(1)];
      return Response.redirect('https://' + MY_DOMAIN + '/' + pageId, 301);
    }

    response = await fetch(url.toString(), {
        body: request.body,
        headers: request.headers,
        method: request.method,
    });
    response = new Response(response.body, response);
    response.headers.delete('Content-Security-Policy');
    response.headers.delete('X-Content-Security-Policy');
  
    return appendJavascript(response, SLUG_TO_PAGE);
  }
  
  class MetaRewriter {
    element(element) {
      if (SITE_NAME !== '') {
        if (element.getAttribute('property') === 'og:site_name') {
            element.setAttribute('content', SITE_NAME);
        }
      }
      if (PAGE_TITLE !== '') {
        if (element.getAttribute('property') === 'og:title'
          || element.getAttribute('name') === 'twitter:title') {
          element.setAttribute('content', PAGE_TITLE);
        }
        if (element.tagName === 'title') {
          element.setInnerContent(PAGE_TITLE);
        }
      }
      if (PAGE_DESCRIPTION !== '') {
        if (element.getAttribute('name') === 'description'
          || element.getAttribute('property') === 'og:description'
          || element.getAttribute('name') === 'twitter:description') {
          element.setAttribute('content', PAGE_DESCRIPTION);
        }
      }
      if (element.getAttribute('property') === 'og:url'
        || element.getAttribute('name') === 'twitter:url') {
        element.setAttribute('content', MY_DOMAIN);
      }
      if (element.getAttribute('property') === 'og:type') {
        element.setAttribute('content', 'website');
      }
      if (element.getAttribute('name') === 'apple-itunes-app') {
        element.remove();
      }
      if (element.getAttribute('name') === 'article:author') {
        element.remove();
      }
    }
  }
  
  class HeadRewriter {
    element(element) {
      if (GOOGLE_FONT !== '') {
        element.append(`<link href="https://fonts.googleapis.com/css?family=${GOOGLE_FONT.replace(' ', '+')}:Regular,Bold,Italic&display=swap" rel="stylesheet">
        <style>* { font-family: "${GOOGLE_FONT}" !important; }</style>`, {
          html: true
        });
      }
      element.append(`<style>
      div.notion-topbar > div > div:nth-child(5) { display: none !important; }
      div.notion-topbar > div > div:nth-child(6) { display: none !important; }
      div.notion-topbar > div > div:nth-child(8) { display: none !important; }
      div.notion-topbar-mobile > div:nth-child(2) { margin-left: 5px !important; margin-right: auto !important; }
      div.notion-topbar-mobile > div:nth-child(3) { display: none !important; }
      div.notion-topbar-mobile > div:nth-child(4) { display: none !important; }
      div.notion-topbar-mobile > div:nth-child(5) { display: none !important; }
      
      div.notion-topbar > div > div:nth-child(1n).toggle-mode { display: block !important; }

      div.notion-topbar-mobile > div:nth-child(1n).toggle-mode { position: absolute; right: 0; top: 12px; }
      </style>`, {
        html: true
      })
    }
  }
  
  class BodyRewriter {
    constructor(SLUG_TO_PAGE) {
      this.SLUG_TO_PAGE = SLUG_TO_PAGE;
    }
    element(element) {
      element.append(`<div style="display:none">Powered by <a href="http://fruitionsite.com">Fruition</a></div>
      <script>
      window.CONFIG.domainBaseUrl = location.origin;
      const SLUG_TO_PAGE = ${JSON.stringify(this.SLUG_TO_PAGE)};
      const PAGE_TO_SLUG = {};
      const slugs = [];
      const pages = [];
      const el = document.createElement('div');
      let redirected = false;
      Object.keys(SLUG_TO_PAGE).forEach(slug => {
        const page = SLUG_TO_PAGE[slug];
        slugs.push(slug);
        pages.push(page);
        PAGE_TO_SLUG[page] = slug;
      });
      function getPage() {
        return location.pathname.slice(-32);
      }
      function getSlug() {
        return location.pathname.slice(1);
      }
      function updateSlug() {
        const slug = PAGE_TO_SLUG[getPage()];
        if (slug != null) {
          history.replaceState(history.state, '', '/' + slug);
        }
      }
      function onDark() {
        el.innerHTML = '<div title="Change to Light Mode" style="margin-left: auto; margin-right: 14px; min-width: 0px;"><div role="button" tabindex="0" style="user-select: none; transition: background 120ms ease-in 0s; cursor: pointer; border-radius: 44px;"><div style="display: flex; flex-shrink: 0; height: 14px; width: 26px; border-radius: 44px; padding: 2px; box-sizing: content-box; background: rgb(46, 170, 220); transition: background 200ms ease 0s, box-shadow 200ms ease 0s;"><div style="width: 14px; height: 14px; border-radius: 44px; background: white; transition: transform 200ms ease-out 0s, background 200ms ease-out 0s; transform: translateX(12px) translateY(0px);"></div></div></div></div>';
        document.body.classList.add('dark');
        __console.environment.ThemeStore.setState({ mode: 'dark' });
      };
      function onLight() {
        el.innerHTML = '<div title="Change to Dark Mode" style="margin-left: auto; margin-right: 14px; min-width: 0px;"><div role="button" tabindex="0" style="user-select: none; transition: background 120ms ease-in 0s; cursor: pointer; border-radius: 44px;"><div style="display: flex; flex-shrink: 0; height: 14px; width: 26px; border-radius: 44px; padding: 2px; box-sizing: content-box; background: rgba(135, 131, 120, 0.3); transition: background 200ms ease 0s, box-shadow 200ms ease 0s;"><div style="width: 14px; height: 14px; border-radius: 44px; background: white; transition: transform 200ms ease-out 0s, background 200ms ease-out 0s; transform: translateX(0px) translateY(0px);"></div></div></div></div>';
        document.body.classList.remove('dark');
        __console.environment.ThemeStore.setState({ mode: 'light' });
      }
      function toggle() {
        if (document.body.classList.contains('dark')) {
          onLight();
        } else {
          onDark();
        }
      }
      function addDarkModeButton(device) {
        const nav = device === 'web' ? document.querySelector('.notion-topbar').firstChild : document.querySelector('.notion-topbar-mobile');
        el.className = 'toggle-mode';
        el.addEventListener('click', toggle);
        nav.appendChild(el);
        onLight();
      }
      const observer = new MutationObserver(function() {
        if (redirected) return;
        const nav = document.querySelector('.notion-topbar');
        const mobileNav = document.querySelector('.notion-topbar-mobile');
        if (nav && nav.firstChild && nav.firstChild.firstChild
          || mobileNav && mobileNav.firstChild) {
          redirected = true;
          updateSlug();
          addDarkModeButton(nav ? 'web' : 'mobile');
          const onpopstate = window.onpopstate;
          window.onpopstate = function() {
            if (slugs.includes(getSlug())) {
              const page = SLUG_TO_PAGE[getSlug()];
              if (page) {
                history.replaceState(history.state, 'bypass', '/' + page);
              }
            }
            onpopstate.apply(this, [].slice.call(arguments));
            updateSlug();
          };
        }
      });
      observer.observe(document.querySelector('#notion-app'), {
        childList: true,
        subtree: true,
      });
      const replaceState = window.history.replaceState;
      window.history.replaceState = function(state) {
        if (arguments[1] !== 'bypass' && slugs.includes(getSlug())) return;
        return replaceState.apply(window.history, arguments);
      };
      const pushState = window.history.pushState;
      window.history.pushState = function(state) {
        const dest = new URL(location.protocol + location.host + arguments[2]);
        const id = dest.pathname.slice(-32);
        if (pages.includes(id)) {
          arguments[2] = '/' + PAGE_TO_SLUG[id];
        }
        return pushState.apply(window.history, arguments);
      };
      const open = window.XMLHttpRequest.prototype.open;
      window.XMLHttpRequest.prototype.open = function() {
        if (arguments[1].includes('https://msgstore.www.notion.so/primus/')) {
            return;
        }
        arguments[1] = arguments[1].replace('${MY_DOMAIN}', 'www.notion.so');   
        return open.apply(this, [].slice.call(arguments));
      };
    </script>${CUSTOM_SCRIPT}`, {
        html: true
      });
    }
  }
  
  async function appendJavascript(res, SLUG_TO_PAGE) {
    return new HTMLRewriter()
      .on('title', new MetaRewriter())
      .on('meta', new MetaRewriter())
      .on('head', new HeadRewriter())
      .on('body', new BodyRewriter(SLUG_TO_PAGE))
      .transform(res);
  }