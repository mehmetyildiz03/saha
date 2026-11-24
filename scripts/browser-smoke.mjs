import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root=process.cwd();
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(!url.pathname.startsWith('/saha/')){res.writeHead(404).end();return}
    const relative=decodeURIComponent(url.pathname.slice(6))||'index.html';
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
    const bytes=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
    res.end(bytes);
  }catch{res.writeHead(404).end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/saha/';
const browser=await chromium.launch({headless:true});
const output=process.env.SAHA_SCREENSHOTS||'test-output';
await fs.mkdir(output,{recursive:true});
try{
  for(const viewport of [{name:'mobile',width:390,height:844},{name:'desktop',width:1280,height:900}]){
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},colorScheme:'light',reducedMotion:'reduce'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url,{waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('#statCases').textContent==='37');
    assert.equal(await page.locator('#caseList [data-open]').count(),37);
    assert.equal(await page.locator('#protocolGrid [data-protocol-open]').count(),2);
    assert.equal(await page.locator('#populationTabs button:disabled').count(),2);
    assert(await page.locator('.hero-cta').isVisible());
    assert(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--saha-primary').trim().length>0));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Home horizontal overflow: '+viewport.name);
    await page.screenshot({path:path.join(output,viewport.name+'-home.png'),fullPage:false});
    await page.locator('.hero-cta').click();
    const first=page.locator('#caseList [data-open]').first();
    const id=await first.getAttribute('data-open');
    const title=await first.locator('h4').innerText();
    await page.locator('#searchInput').fill(title);
    await page.waitForFunction(id=>Array.from(document.querySelectorAll('#caseList [data-open]')).some(x=>x.dataset.open===id),id);
    await page.locator('#searchInput').fill('');
    await page.waitForFunction(()=>document.querySelectorAll('#caseList [data-open]').length===37);
    await page.locator('#caseList [data-open="'+id+'"]').click();
    await page.locator('#detailView:not(.hidden) #algorithm').waitFor();
    assert(await page.locator('#critical-actions').isVisible());
    assert(await page.locator('#source').isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Detail horizontal overflow: '+viewport.name);
    await page.screenshot({path:path.join(output,viewport.name+'-detail.png'),fullPage:false});
    await page.locator('[data-action="favorite"]').click();
    assert.equal(await page.locator('[data-action="favorite"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-density-toggle]').click();
    assert.equal(await page.locator('html').getAttribute('data-density'),'compact');
    await page.locator('[data-density-toggle]').click();
    await page.locator('.back-btn').click();
    await page.locator('#mainView:not(.hidden)').waitFor();
    await page.locator('[data-nav="favorites"]').click();
    assert.equal(await page.locator('#caseList [data-open="'+id+'"]').count(),1);
    await page.locator('[data-nav="home"]').click();
    await page.locator('#themeToggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.screenshot({path:path.join(output,viewport.name+'-dark.png'),fullPage:false});
    await page.locator('#sourceBtn').click();
    await page.locator('#sourceSheet:not(.hidden)').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#sourceSheet').waitFor({state:'hidden'});
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),{},{timeout:20000});
    await context.setOffline(true);
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('#statCases').textContent==='37');
    assert.equal(await page.locator('#caseList [data-open]').count(),37);
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('[data-nav="favorites"]').click();
    assert.equal(await page.locator('#caseList [data-open="'+id+'"]').count(),1);
    assert.deepEqual(errors,[],'Runtime errors');
    await context.close();
    console.log('PASS '+viewport.name+': render, search, detail, favorite, quick mode, theme, source, offline, persistence, no runtime errors.');
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
