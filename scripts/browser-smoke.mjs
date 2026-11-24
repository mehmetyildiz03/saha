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

async function verifyInteractiveFlow(page,label){
  const report=await page.evaluate(()=>{
    const errors=[];let branches=0,choices=0;
    const check=(ok,msg)=>{if(!ok)errors.push(msg)};
    const visible=n=>!!n&&n.getClientRects().length>0;
    const click=n=>{if(!n){errors.push('missing control');return}n.click()};
    for(const explorer of document.querySelectorAll('#detailView [data-flow-explorer]')){
      const nodes=[...explorer.querySelectorAll('.algo-branch[data-flow-path]')];
      const byPath=new Map(nodes.map(n=>[n.dataset.flowPath,n]));
      const body=n=>n.querySelector(':scope > .branch-content');
      const button=n=>n.querySelector(':scope > .flow-option');
      const control=key=>explorer.querySelector('[data-flow-action="'+key+'"]');
      check(nodes.every(n=>!visible(body(n))),'initial outcomes not concealed');
      for(const node of nodes){
        click(control('reset'));
        const path=node.dataset.flowPath.split('.');
        for(let i=0;i<path.length;i++){
          const target=byPath.get(path.slice(0,i+1).join('.'));
          check(visible(button(target)),'choice not reachable '+target.dataset.flowPath);click(button(target));
        }
        branches++;
        check(visible(body(node)),'selected body hidden '+node.dataset.flowPath);
        const selected=node.dataset.flowPath;
        for(const other of nodes){
          const key=other.dataset.flowPath;
          const shouldShow=selected===key||selected.startsWith(key+'.');
          check(visible(body(other))===shouldShow,'unexpected outcome '+key+' selected '+selected);
        }
        click(control('back'));
        check(visible(button(node))&&!visible(body(node)),'back did not restore choice '+selected);
      }
      click(control('reset'));click(control('full'));
      check(nodes.every(n=>visible(body(n))),'full view missing source branch');
      click(control('full'));
      check(nodes.every(n=>!visible(body(n))),'guided restore failed');
    }
    for(const group of document.querySelectorAll('#detailView [data-flow-choice]')){
      const outcomes=[...group.querySelectorAll('[data-choice-result]')];
      const select=key=>group.querySelector('[data-choice-select="'+key+'"]');
      const control=key=>group.querySelector('[data-choice-action="'+key+'"]');
      check(outcomes.every(n=>!visible(n)),'initial choice not concealed');
      for(const answer of ['yes','no']){
        click(select(answer));choices++;
        check(outcomes.every(n=>visible(n)===(n.dataset.choiceResult===answer)),'choice isolation '+answer);
        click(control('back'));
        check(outcomes.every(n=>!visible(n)),'choice back failed');
      }
      click(control('full'));check(outcomes.every(visible),'full binary choices missing');click(control('full'));
      check(outcomes.every(n=>!visible(n)),'binary guided restore failed');
    }
    return {errors,branches,choices};
  });
  assert.deepEqual(report.errors,[],label+' interactive flow');
  return report;
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
      let branchCount=0,choiceCount=0;
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
        const fidelity=await page.evaluate(id=>{
          const c=CASES.find(x=>x.id===id), text=(el)=>el.textContent.trim(), all=s=>[...document.querySelectorAll('#detailView '+s)];
          const normalize=s=>String(s??'').replace(/\s+/g,' ').trim();
          const arrEq=(a,b)=>JSON.stringify(a.map(normalize))===JSON.stringify(b.map(normalize));
          const branches=b=>b.reduce((n,x)=>n+1+branches(x.branches||[]),0);
          return {critical:arrEq(all('#critical-actions li').map(text),c.criticalActions),warnings:arrEq(all('.red-flag').map(text),c.warningFindings),medNames:arrEq(all('.med-main strong').map(text),(c.meds||[]).map(m=>m.name)),medDoses:arrEq(all('.dose-panel .dose').map(text),(c.meds||[]).map(m=>m.dose)),branches:all('.algo-branch').length===branches(c.algorithmBranches||[]),steps:all('.quick-steps>.quick-step').length===(Array.isArray(c.algorithmSteps)?c.algorithmSteps:(c.quick||[])).length};
        },caseId);
        assert(Object.values(fidelity).every(Boolean),caseId+' fidelity '+JSON.stringify(fidelity));
        const interactive=await verifyInteractiveFlow(page,caseId+' '+theme+' '+viewport.name);branchCount+=interactive.branches;choiceCount+=interactive.choices;
        const style=await page.locator('.detail-section').first().evaluate(n=>getComputedStyle(n).borderRadius);
        assert.equal(style,'24px',caseId+' workspace style');
        await assertNoOverflow(page,theme+' '+caseId+' standard '+viewport.name);
        if(await page.locator('#medications').count())assert(await page.locator('.dose-panel').first().isVisible());
        await page.locator('[data-density-toggle]').click();
        assert.equal(await page.locator('html').getAttribute('data-density'),'compact');
        assert.equal(await page.locator('#critical-actions').evaluate(n=>getComputedStyle(n).order),'10');
        assert.equal(await page.locator('#algorithm').evaluate(n=>getComputedStyle(n).order),'20');
        const ordering=await page.locator('.detail-body').evaluate(n=>[...n.children].map(x=>x.id||x.className));
        assert.equal(ordering[0],'critical-actions');
        assert.equal(ordering[1],'algorithm');
        const visual=await page.evaluate(()=>document.querySelector('#critical-actions').getBoundingClientRect().top<document.querySelector('#algorithm').getBoundingClientRect().top);
        assert(visual,'Critical steps must visually precede algorithm');
        await assertNoOverflow(page,theme+' '+caseId+' field '+viewport.name);
        await page.locator('[data-density-toggle]').click();
        await page.locator('.back-btn').click();
        await page.locator('#mainView:not(.hidden)').waitFor();
      }
      for(const protocolId of protocolIds){
        await page.locator('#protocolGrid [data-protocol-open="'+protocolId+'"]').click();
        assert(await page.locator('.workspace-brand').isVisible());
        assert(await page.locator('#protocol-flow').isVisible());
        assert(await page.locator('#source').isVisible());
        const protocolFidelity=await page.evaluate(id=>{const p=PROTOCOLS.find(x=>x.id===id);return document.querySelectorAll('#protocol-flow .protocol-flow-step').length===p.flow.filter(x=>x.type==='step').length&&document.querySelectorAll('#protocol-flow .protocol-decision').length===p.flow.filter(x=>x.type==='decision').length&&document.querySelectorAll('#protocol-flow .protocol-transition').length===p.flow.filter(x=>x.type==='transition').length},protocolId);
        assert(protocolFidelity,protocolId+' flow fidelity');
        const interactive=await verifyInteractiveFlow(page,protocolId+' '+theme+' '+viewport.name);branchCount+=interactive.branches;choiceCount+=interactive.choices;
        await assertNoOverflow(page,theme+' '+protocolId+' '+viewport.name);
        await page.locator('.back-btn').click();
        await page.locator('#mainView:not(.hidden)').waitFor();
      }
      await page.locator('[data-nav="home"]').click();
      assert(branchCount>30&&choiceCount>30,'Interactive catalog coverage insufficient');
      console.log('PASS '+viewport.name+' '+theme+': all 37 cases + 2 protocols; '+branchCount+' branch selections; '+choiceCount+' binary outcomes; back/full view');
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
