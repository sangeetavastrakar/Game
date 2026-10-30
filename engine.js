/* Pure game rules, shared by the browser and the Node test runner. */
(function (root) {
  'use strict';
  const DIRECTIONS = Object.freeze({up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}});
  const PACES = Object.freeze({chill:{interval:190,min:100,points:10},normal:{interval:140,min:65,points:10},turbo:{interval:95,min:48,points:20}});
  class SnakeEngine {
    constructor({mode='classic',difficulty='normal',random=Math.random}={}) {
      this.size=20;
      this.mode=['classic','wrap','maze'].includes(mode)?mode:'classic';
      this.difficulty=Object.hasOwn(PACES,difficulty)?difficulty:'normal';
      this.random=random;
      this.snake=[{x:7,y:10},{x:6,y:10},{x:5,y:10}];
      this.direction='right';
      this.queue=[];
      this.score=0;
      this.bites=0;
      this.bonusBites=0;
      this.elapsed=0;
      this.over=false;
      this.won=false;
      this.bonus=null;
      this.obstacles=[];
      if(this.mode==='maze') {
        for(const y of [4,15]) for(const x of [4,5,6,7,12,13,14,15]) this.obstacles.push({x,y});
        for(const x of [4,15]) for(const y of [5,6,13,14]) this.obstacles.push({x,y});
      }
      this.walls=new Set(this.obstacles.map(p=>this.key(p)));
      this.food=this.emptyCell();
    }
    key(p){return p.y*this.size+p.x;}
    same(a,b){return a && b && a.x===b.x && a.y===b.y;}
    get level(){return Math.floor(this.bites/5)+1;}
    get interval(){const pace=PACES[this.difficulty];return Math.max(pace.min,pace.interval-(this.level-1)*9);}
    get points(){return PACES[this.difficulty].points;}
    emptyCell(extra=[]) {
      const occupied=new Set([...this.snake,...this.obstacles,...extra.filter(Boolean)].map(p=>this.key(p)));
      const free=[];
      for(let y=0;y<this.size;y++) for(let x=0;x<this.size;x++) if(!occupied.has(y*this.size+x)) free.push({x,y});
      return free.length?free[Math.floor(this.random()*free.length)]:null;
    }
    turn(name) {
      if(this.over||!Object.hasOwn(DIRECTIONS,name)||this.queue.length>=2)return false;
      const last=this.queue.at(-1)||this.direction;
      const previous=DIRECTIONS[last],next=DIRECTIONS[name];
      if(name===last||(previous.x===-next.x&&previous.y===-next.y))return false;
      this.queue.push(name);return true;
    }
    step() {
      if(this.over)return {type:'idle'};
      this.elapsed+=this.interval;
      if(this.bonus && this.elapsed>=this.bonus.expires)this.bonus=null;
      this.direction=this.queue.shift()||this.direction;
      const v=DIRECTIONS[this.direction];
      const head={x:this.snake[0].x+v.x,y:this.snake[0].y+v.y};
      if(this.mode==='wrap'){head.x=(head.x+this.size)%this.size;head.y=(head.y+this.size)%this.size;}
      const eating=this.same(head,this.food),golden=this.same(head,this.bonus);
      const body=(eating||golden)?this.snake:this.snake.slice(0,-1);
      let reason=null;
      if(head.x<0||head.y<0||head.x>=this.size||head.y>=this.size)reason='wall';
      else if(this.walls.has(this.key(head)))reason='obstacle';
      else if(body.some(p=>this.same(p,head)))reason='tail';
      if(reason){this.over=true;return {type:'over',reason};}
      this.snake.unshift(head);
      if(!eating&&!golden)this.snake.pop();
      if(eating||golden){
        this.score+=this.points*(golden?3:1);
        if(eating)this.bites++;else{this.bonusBites++;this.bonus=null;}
        if(this.snake.length+this.obstacles.length===this.size*this.size){this.over=true;this.won=true;this.food=null;this.bonus=null;return {type:'win'};}
        if(eating){
          // A regular bite always remains available, even on a nearly full board.
          this.food=this.emptyCell([this.bonus]);
          if(!this.food){this.bonus=null;this.food=this.emptyCell();}
          if(this.bites%5===0){const cell=this.emptyCell([this.food]);this.bonus=cell?{...cell,expires:this.elapsed+6500}:null;}
        }
        return {type:golden?'bonus':'eat',head};
      }
      return {type:'move'};
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={SnakeEngine,DIRECTIONS,PACES};
  else root.SnakeEngine=SnakeEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
