/* Browser UI, drawing and input. No packages or build step required. */
(() => {
  'use strict';
  const $=selector=>document.querySelector(selector);
  const canvas=$('#board'),ctx=canvas.getContext('2d');
  if(!ctx){$('#message').textContent='Canvas is unavailable in this browser. Try a current browser to play.';$('#start').disabled=true;return;}
  const storageKey='pocket-snake-v2';
  let saved={};
  try{const value=JSON.parse(localStorage.getItem(storageKey));if(value&&typeof value==='object'&&!Array.isArray(value))saved=value;}catch{}
  const validScore=n=>Number.isSafeInteger(n)&&n>=0?n:0;
  const records={};
  if(saved.records&&typeof saved.records==='object')for(const [key,value] of Object.entries(saved.records))records[key]=validScore(value);
  // Carry the original game's best into the matching classic rules.
  try{records['classic:normal']=Math.max(records['classic:normal']||0,validScore(Number(localStorage.getItem('pocket-snake-best'))));}catch{}
  let mode=['classic','wrap','maze'].includes(saved.mode)?saved.mode:'classic';
  let difficulty=['chill','normal','turbo'].includes(saved.difficulty)?saved.difficulty:'normal';
  let sound=saved.sound===true,night=saved.night===true;
  let game=new SnakeEngine({mode,difficulty}),state='ready',frame=0,lastTime=0,accumulator=0,previous=null;
  let particles=[],audio=null,startBest=0,lastHudSecond=-1;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const grid=document.createElement('canvas');
  const size=600,cell=size/20;
  const labels={classic:'CLASSIC',wrap:'NO WALLS',maze:'THE MAZE'};
  const directions={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
  function save(){try{localStorage.setItem(storageKey,JSON.stringify({mode,difficulty,sound,night,records}));}catch{}}
  function announce(message){$('#announcement').textContent=message;}
  const recordKey=()=>`${mode}:${difficulty}`;
  const formatScore=n=>String(n).padStart(3,'0');
  const formatTime=ms=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;

  function resize(){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const pixels=Math.max(1,Math.round(canvas.getBoundingClientRect().width*dpr));
    canvas.width=pixels;canvas.height=pixels;
    ctx.setTransform(pixels/size,0,0,pixels/size,0,0);
    grid.width=pixels;grid.height=pixels;
    const g=grid.getContext('2d');g.setTransform(pixels/size,0,0,pixels/size,0,0);
    g.fillStyle='#c5d9a7';g.fillRect(0,0,size,size);
    g.strokeStyle='#b9cea0';g.lineWidth=.65;g.beginPath();
    for(let i=0;i<=20;i++){g.moveTo(i*cell,0);g.lineTo(i*cell,size);g.moveTo(0,i*cell);g.lineTo(size,i*cell);}g.stroke();
    draw(1,performance.now());
  }
  function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function draw(alpha=1,now=0){
    ctx.drawImage(grid,0,0,size,size);
    for(const p of game.obstacles){rounded(p.x*cell+2,p.y*cell+2,cell-4,cell-4,4,'#91a77d');ctx.fillStyle='#b9cc9c';ctx.fillRect(p.x*cell+6,p.y*cell+6,cell-12,2);}
    if(game.food){const {x,y}=game.food;ctx.fillStyle='#6a8649';ctx.beginPath();ctx.arc(x*cell+15,y*cell+16,8,0,Math.PI*2);ctx.fill();rounded(x*cell+16,y*cell+4,5,6,2,'#496c3c');ctx.fillStyle='#dce9bf';ctx.fillRect(x*cell+11,y*cell+12,3,3);}
    if(game.bonus){const {x,y,expires}=game.bonus;const pulse=reducedMotion.matches?1:1+Math.sin(now/150)*.1;ctx.save();ctx.translate(x*cell+15,y*cell+15);ctx.rotate(Math.PI/4);rounded(-8*pulse,-8*pulse,16*pulse,16*pulse,3,'#a57923');rounded(-4,-4,8,8,1,'#edcd65');ctx.restore();ctx.strokeStyle='#937325';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x*cell+15,y*cell+15,13,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,(expires-game.elapsed)/6500));ctx.stroke();}
    let headPosition;
    // Interpolate fixed simulation ticks; never tween across a portal.
    for(let i=game.snake.length-1;i>=0;i--){
      const p=game.snake[i],old=previous?.[i]||previous?.at(-1)||p;
      const adjacent=Math.abs(old.x-p.x)+Math.abs(old.y-p.y)<=1;
      const t=adjacent&&!reducedMotion.matches?alpha:1;
      const x=(old.x+(p.x-old.x)*t)*cell,y=(old.y+(p.y-old.y)*t)*cell;
      rounded(x+1.5,y+1.5,cell-3,cell-3,i===0?7:5,i===0?'#293f2b':i%2?'#48623b':'#405b35');
      if(i===0)headPosition={x,y};
    }
    if(headPosition){const v=directions[game.direction],{x,y}=headPosition;const eyes=v.x?[[v.x>0?20:7,8],[v.x>0?20:7,20]]:[[8,v.y>0?20:7],[20,v.y>0?20:7]];for(const [ex,ey] of eyes)rounded(x+ex-2,y+ey-2,5,5,1,'#e0edc5');}
    for(const p of particles){const age=(now-p.born)/420;if(age>=1)continue;ctx.globalAlpha=1-age;rounded(p.x+p.vx*age,p.y+p.vy*age,4,4,1,p.color);}ctx.globalAlpha=1;
  }
  function burst(head,golden){if(reducedMotion.matches)return;const now=performance.now();particles=particles.filter(p=>now-p.born<420);for(let i=0;i<8;i++){const angle=i*Math.PI/4;particles.push({x:head.x*cell+15,y:head.y*cell+15,vx:Math.cos(angle)*35,vy:Math.sin(angle)*35,born:now,color:golden?'#a57923':'#6a8649'});}}
  function unlockAudio(){
    if(!sound)return;
    try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio??=new Audio();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}
  }
  function tone(frequency,duration=.08,delay=0){
    if(!sound||!audio||audio.state!=='running')return;
    try{const osc=audio.createOscillator(),gain=audio.createGain();const time=audio.currentTime+delay;osc.type='sine';osc.frequency.setValueAtTime(frequency,time);gain.gain.setValueAtTime(.045,time);gain.gain.exponentialRampToValueAtTime(.001,time+duration);osc.connect(gain);gain.connect(audio.destination);osc.start(time);osc.stop(time+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};}catch{}
  }
  function updateHud(){
    $('#score').textContent=formatScore(game.score);$('#best').textContent=formatScore(records[recordKey()]||0);$('#level').textContent=String(game.level).padStart(2,'0');
    $('#progress-fill').style.width=`${game.bites%5*20}%`;$('#progress').setAttribute('aria-valuenow',game.bites%5);
    $('#progress').setAttribute('aria-valuetext',`${5-game.bites%5} bites to level ${game.level+1}`);
    if(state==='playing'){
      $('#status').textContent=game.bonus?'GOLDEN BITE — GO GET IT!':`LEVEL ${game.level} · ${labels[mode]}`;
      const seconds=Math.floor(game.elapsed/1000);
      if(seconds!==lastHudSecond){lastHudSecond=seconds;$('#run-info').textContent=`${formatTime(game.elapsed)} played · ${game.snake.length} long · ${game.bites+game.bonusBites} bites`;}
    }
  }
  function setControls(){
    const active=state==='playing'||state==='paused';
    $('#mode-settings').disabled=active;$('#speed-settings').disabled=active;
    $('#settings-note').textContent=active?'Finish this run to change mode or pace.':'Your best is saved for each mode & pace.';
    $('#pause').disabled=!active;$('#pause').textContent=state==='paused'?'RESUME >':'PAUSE II';
    $('#screen').classList.toggle('playing',state==='playing');
  }
  function showOverlay(title,message,label,eyebrow){
    $('#title').textContent=title;$('#message').textContent=message;$('#start-label').textContent=label;$('#overlay-label').textContent=eyebrow;
    $('#hint').textContent=state==='paused'?'SPACE TO RESUME · R TO RESTART':'OR PRESS SPACE TO START';$('#overlay').hidden=false;
  }
  function stopLoop(){cancelAnimationFrame(frame);frame=0;lastTime=0;}
  function finish(event){
    state='over';stopLoop();previous=null;draw(1,performance.now());
    const newBest=game.score>startBest;
    const tips={wall:'The walls won this round. Give yourself a little turning room.',tail:'A little too close to your tail. Try a wider turn.',obstacle:'A twist too far. Leave some room around the blocks.'};
    showOverlay(game.won?'Garden complete!':newBest?'A new personal best!':'Oh, snap.',game.won?'Every square. Every bite. That was a perfect run.':tips[event.reason]||'A good run. There’s always another bite.','Play again',game.won?'YOU DID THE IMPOSSIBLE':newBest?'THAT ONE’S GOING IN THE BOOKS':'ONE MORE TRY?');
    $('#run-food').textContent=game.bites+game.bonusBites;$('#run-time').textContent=formatTime(game.elapsed);$('#run-length').textContent=game.snake.length;$('#run-summary').hidden=false;
    $('#status').textContent=game.won?'BOARD COMPLETE':`${game.score} POINTS · NICE RUN`;setControls();
    announce(`${game.won?'You won!':'Game over.'} Score ${game.score}.${newBest?' New personal best!':''}`);
    tone(game.won?660:180,.2);if(game.won)tone(880,.2,.14);
    $('#start').focus({preventScroll:true});
  }
  function loop(now){
    if(state!=='playing')return;
    const delta=lastTime?now-lastTime:0;lastTime=now;
    // A stalled tab pauses instead of racing through unseen moves.
    if(delta>350){pause();return;}
    accumulator+=delta;
    while(accumulator>=game.interval&&state==='playing'){
      accumulator-=game.interval;previous=game.snake.map(p=>({...p}));
      const event=game.step();
      if(event.type==='eat'||event.type==='bonus'||event.type==='win'){
        if(game.score>(records[recordKey()]||0)){records[recordKey()]=game.score;save();}
        if(event.head)burst(event.head,event.type==='bonus');
        tone(event.type==='bonus'?880:520);if(event.type==='bonus')tone(1100,.1,.08);
        if(game.bites>0&&game.bites%5===0&&event.type==='eat')announce(`Level ${game.level}. Golden bite available.`);
      }
      updateHud();
      if(game.over){finish(event);return;}
    }
    draw(Math.min(1,accumulator/game.interval),now);
    frame=requestAnimationFrame(loop);
  }
  function start(fresh=false){
    unlockAudio();stopLoop();
    if(fresh||state!=='paused'){game=new SnakeEngine({mode,difficulty});previous=null;particles=[];accumulator=0;startBest=records[recordKey()]||0;lastHudSecond=-1;}
    state='playing';$('#overlay').hidden=true;$('#run-summary').hidden=true;setControls();updateHud();
    canvas.focus({preventScroll:true});announce(`${labels[mode]}, ${difficulty}. Game started.`);frame=requestAnimationFrame(loop);
  }
  function pause(){
    if(state!=='playing')return;
    state='paused';stopLoop();previous=null;accumulator=0;draw(1,performance.now());
    showOverlay('Take a breather.','Your snake will be right here. Ready when you are.','Resume','A LITTLE PAUSE');$('#status').textContent='TAKE YOUR TIME';setControls();announce('Game paused.');
  }
  function steer(name){if(state==='playing')game.turn(name);}
  function syncPreferences(){
    document.documentElement.dataset.theme=night?'night':'day';$('meta[name="theme-color"]').content=night?'#1b251e':'#f5f4eb';
    $('#sound').setAttribute('aria-pressed',sound);$('#sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');$('#sound span').textContent=sound?'ON':'OFF';
    $('#theme').setAttribute('aria-pressed',night);$('#theme').setAttribute('aria-label',night?'Enable light theme':'Enable dark theme');
    $(`input[name="mode"][value="${mode}"]`).checked=true;$(`input[name="difficulty"][value="${difficulty}"]`).checked=true;
    $('#points-help').textContent=`${game.points} points`;$('#board-label').textContent=`20 × 20 · ${labels[mode]}`;
  }
  $('#start').addEventListener('click',()=>start());
  $('#pause').addEventListener('click',()=>state==='paused'?start():pause());
  $('#restart').addEventListener('click',()=>start(true));
  $('#sound').addEventListener('click',()=>{sound=!sound;syncPreferences();save();unlockAudio();tone(660);});
  $('#theme').addEventListener('click',()=>{night=!night;syncPreferences();save();});
  document.querySelectorAll('input[name="mode"], input[name="difficulty"]').forEach(input=>input.addEventListener('change',()=>{
    if(state==='playing'||state==='paused')return;
    mode=$('input[name="mode"]:checked').value;difficulty=$('input[name="difficulty"]:checked').value;
    state='ready';game=new SnakeEngine({mode,difficulty});previous=null;particles=[];$('#run-summary').hidden=true;
    showOverlay('Ready for another bite?',mode==='wrap'?'Cross an edge to come out the other side. Your tail still bites.':mode==='maze'?'Weave between the blocks. Leave room for your growing tail.':'Collect the bites. Grow your snake. Keep your tail out of trouble.','Let’s play','THE ORIGINAL TIME KILLER');
    $('#status').textContent='READY WHEN YOU ARE';$('#run-info').textContent='A fresh start looks good on you.';
    syncPreferences();save();updateHud();setControls();draw();
  }));
  document.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,select,textarea,[contenteditable="true"]'))return;
    const key=event.key.toLowerCase();
    const keys={arrowup:'up',arrowdown:'down',arrowleft:'left',arrowright:'right',w:'up',s:'down',a:'left',d:'right'};
    if(keys[key]){event.preventDefault();if(!event.repeat)steer(keys[key]);return;}
    if(event.code==='Space'){
      if(event.target.closest('button'))return;
      event.preventDefault();if(event.repeat)return;state==='playing'?pause():start();
    }else if(key==='escape'&&state==='playing'){event.preventDefault();pause();}
    else if(key==='r'&&!event.repeat){event.preventDefault();start(true);}
  });
  document.querySelectorAll('[data-dir]').forEach(button=>{
    button.addEventListener('pointerdown',event=>{event.preventDefault();steer(button.dataset.dir);});
    button.addEventListener('click',event=>{if(event.detail===0)steer(button.dataset.dir);});
  });
  let touch=null;
  canvas.addEventListener('pointerdown',event=>{if(!event.isPrimary)return;touch={x:event.clientX,y:event.clientY,id:event.pointerId};canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{
    if(!touch||touch.id!==event.pointerId)return;
    const dx=event.clientX-touch.x,dy=event.clientY-touch.y;
    if(Math.max(Math.abs(dx),Math.abs(dy))<16)return;
    steer(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');touch.x=event.clientX;touch.y=event.clientY;
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{touch=null;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);
  const fullscreen=$('#fullscreen');
  if(document.fullscreenEnabled&&$('.console').requestFullscreen){fullscreen.hidden=false;fullscreen.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('.console').requestFullscreen();}catch{announce('Fullscreen is unavailable in this browser.');}});}
  document.addEventListener('fullscreenchange',()=>{fullscreen.textContent=document.fullscreenElement?'⛶ COLLAPSE':'⛶ EXPAND';resize();});
  syncPreferences();updateHud();setControls();
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe($('#screen'));else window.addEventListener('resize',resize);
  resize();
})();
