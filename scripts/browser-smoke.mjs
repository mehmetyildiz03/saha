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
async function assertNoOverflow(page,label){
  const diagnostic=await page.evaluate(()=>({
    viewport:innerWidth,root:document.documentElement.scrollWidth,
    offenders:[...document.querySelectorAll('body *')].filter(e=>{
      const r=e.getBoundingClientRect();
      return r.width&&r.height&&(r.right>innerWidth+1||r.left<-1)&&!e.closest('.intro-art,.detail-jumps,.filter-row');
    }).slice(0,20).map(e=>({tag:e.tagName,id:e.id,cls:String(e.className?.baseVal??e.className),left:Math.round(e.getBoundingClientRect().left),right:Math.round(e.getBoundingClientRect().right)}))
  }));
  assert(diagnostic.root<=diagnostic.viewport+1,label+' horizontal overflow: '+JSON.stringify(diagnostic));
}
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
    assert(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--forest').trim().length>0));
    await page.screenshot({path:path.join(output,viewport.name+'-home.png'),fullPage:false});
    await assertNoOverflow(page,'Home '+viewport.name);
    await page.locator('#categoryTiles button').first().click();
    assert.equal(await page.locator('.app-shell').getAttribute('data-page'),'cases');
    assert(await page.locator('#caseList [data-open]').count()<37);
    await page.locator('[data-nav="home"]').click();
    await page.locator('.hero-cta').click();
    assert.equal(await page.locator('.app-shell').getAttribute('data-page'),'cases');
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
    await assertNoOverflow(page,'Detail '+viewport.name);
    await page.screenshot({path:path.join(output,viewport.name+'-detail.png'),fullPage:false});
    await page.locator('[data-action="favorite"]').click();
    assert.equal(await page.locator('[data-action="favorite"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-density-toggle]').click();
    assert.equal(await page.locator('html').getAttribute('data-density'),'compact');
    await page.locator('[data-density-toggle]').click();
    await page.locator('.workspace-theme').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('.workspace-theme').click();
    await page.locator('.back-btn').click();
    await page.locator('#mainView:not(.hidden)').waitFor();
    await page.locator('[data-nav="favorites"]').click();
    assert.equal(await page.locator('#caseList [data-open="'+id+'"]').count(),1);
    await page.locator('[data-nav="home"]').click();
    await page.locator('#themeToggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.screenshot({path:path.join(output,viewport.name+'-dark.png'),fullPage:false});
    // Whole-catalog clinical view acceptance, not just the first card.
    const catalog=await page.locator('#caseList [data-open]').evaluateAll(nodes=>nodes.map(n=>n.dataset.open));
    const protocolIds=await page.locator('#protocolGrid [data-protocol-open]').evaluateAll(nodes=>nodes.map(n=>n.dataset.protocolOpen));
    assert.equal(catalog.length,37);assert.equal(protocolIds.length,2);
    for(const theme of ['dark','light']){
      if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#themeToggle').click();
      await page.locator('[data-nav="cases"]').click();
      for(const caseId of catalog){
        await page.locator('#caseList [data-open="'+caseId+'"]').click();
        await page.locator('#detailView:not(.hidden) .workspace-brand').waitFor();
        assert.equal(await page.locator('#detailView').getAttribute('data-design'),'workspace-v3');
        assert(await page.locator('.workspace-overview').isVisible());
        assert(await page.locator('#critical-actions').isVisible());
        assert(await page.locator('#algorithm').isVisible());
        assert(await page.locator('#source').isVisible());
        const style=await page.locator('.detail-section').first().evaluate(n=>getComputedStyle(n).borderRadius);
        assert.equal(style,'24px',caseId+' workspace style');
        await assertNoOverflow(page,theme+' '+caseId+' standard '+viewport.name);
        if(await page.locator('#medications').count())assert(await page.locator('.dose-panel').first().isVisible());
        await page.locator('[data-density-toggle]').click();
        assert.equal(await page.locator('html').getAttribute('data-density'),'compact');
        await assertNoOverflow(page,theme+' '+caseId+' field '+viewport.name);
        await page.locator('[data-density-toggle]').click();
        await page.locator('.back-btn').click();
        await page.locator('#mainView:not(.hidden)').waitFor();
      }
      for(const protocolId of protocolIds){
        await page.locator('#protocolGrid [data-protocol-open="'+protocolId+'"]').click();
        assert(await page.locator('.workspace-brand').isVisible());
        assert(await page.locator('#protocol-flow').isVisible());
        await assertNoOverflow(page,theme+' '+protocolId+' '+viewport.name);
        await page.locator('.back-btn').click();
        await page.locator('#mainView:not(.hidden)').waitFor();
      }
      await page.locator('[data-nav="home"]').click();
      console.log('PASS '+viewport.name+' '+theme+': all 37 cases + 2 protocols');
    }
    if(await page.locator('html').getAttribute('data-theme')!=='dark')await page.locator('#themeToggle').click();
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
