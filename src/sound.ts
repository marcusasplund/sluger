import { creatureVoice, type VoiceKind } from "./voice";
import * as T from 'three';

// Short recorded foley is combined with restrained nonverbal, musical stress cues.
// All sources feed one compressor and one master gain, including delayed events.
export class SoundDirector {
  private context?:AudioContext;
  private master?:GainNode;
  private buffers=new Map<string,AudioBuffer>();
  private enabled=false;
  private lastBeat=0;
  private lastChew=0;
  private lastCrawl=0;
  private previousAlert=0;
  private sources=new Set<AudioScheduledSourceNode>();
  private generation=0;
  private voiceTimes=new Map<VoiceKind,number>();
  readonly reactions:Partial<Record<VoiceKind,number>>={};
  private deathAge=-1;
  private deathStage=0;
  private deathCause='';
  private motorGain?:GainNode;
  private motorPan?:StereoPannerNode;
  events=0;
  ready=false;
  async configure(enabled:boolean,volume:number,playing:boolean){
    this.enabled=enabled&&playing;
    if(!this.enabled){for(const source of this.sources){try{source.stop();}catch{}}this.sources.clear();}
    if(!this.context&&enabled&&playing){
      this.context=new AudioContext();this.master=this.context.createGain();
      const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=5;this.master.connect(compressor).connect(this.context.destination);
      void Promise.all(['step_grass','step_wood','fish_flop','rod_swish'].map(async name=>{
        try{const response=await fetch(`/audio/${name}.ogg`);if(!response.ok)return;const buffer=await this.context!.decodeAudioData(await response.arrayBuffer());this.buffers.set(name,buffer);}catch{/* Sound loading never blocks the game. */}
      })).then(()=>this.ready=true);
    }
    if(!this.context)return;
    this.master!.gain.setTargetAtTime(this.enabled?volume*.85:0,this.context.currentTime,.06);
    if(this.enabled)await this.context.resume().catch(()=>{});
  }
  private track(source:AudioScheduledSourceNode){this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();};this.events++;}
  reset(){this.voiceTimes.clear();for(const key of Object.keys(this.reactions))delete this.reactions[key as VoiceKind];this.deathAge=-1;this.deathStage=0;this.generation++;for(const s of this.sources){try{s.stop();}catch{}}this.sources.clear();this.previousAlert=0;this.lastBeat=0;this.lastChew=0;}
  private sample(name:string,start:number,duration:number,gain:number,rate=1,pan=0,delay=0){
    if(!this.context||!this.enabled)return;const buffer=this.buffers.get(name);if(!buffer)return;
    const source=this.context.createBufferSource();source.buffer=buffer;source.playbackRate.value=rate;
    const amp=this.context.createGain();amp.gain.value=gain;const panner=this.context.createStereoPanner();panner.pan.value=T.MathUtils.clamp(pan,-1,1);
    source.connect(amp).connect(panner).connect(this.master!);const end=()=>{amp.disconnect();panner.disconnect();};this.track(source);const original=source.onended;source.onended=e=>{original?.call(source,e);end();};source.start(this.context.currentTime+delay,start,Math.min(duration,buffer.duration-start));
  }
  private tone(frequency:number,endFrequency:number,duration:number,gain:number,delay=0,type:OscillatorType='sine'){
    if(!this.context||!this.enabled)return;const t=this.context.currentTime+delay,osc=this.context.createOscillator(),amp=this.context.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,t);osc.frequency.exponentialRampToValueAtTime(Math.max(15,endFrequency),t+duration);amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime(gain,t+.012);amp.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(amp).connect(this.master!);this.track(osc);const original=osc.onended;osc.onended=e=>{original?.call(osc,e);amp.disconnect();};osc.start(t);osc.stop(t+duration+.025);
  }
  step(position:T.Vector3,player:T.Vector3,camera:T.Camera,strength:number){
    const d=position.distanceTo(player);if(d>10)return;
    const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion);const pan=position.clone().sub(player).normalize().dot(right);
    const index=this.events%5,starts=[.08,.464,.8993,1.2633,1.5973];this.sample('step_grass',starts[index],.245,strength*.65/(1+d*d*.13),.8+index*.025,pan);
  }
  update(time:number,alert:number,eating:boolean,moving:boolean,wet:boolean){
    if(!this.enabled)return;
    if(alert>.15&&time-this.lastBeat>1.08-alert*.72){this.lastBeat=time;this.tone(72,38,.13,.14*alert);this.tone(59,34,.16,.085*alert,.17);}
    if(alert>.68&&this.previousAlert<=.68)this.react('noticed');
    this.previousAlert=alert;
    if(eating&&time-this.lastChew>.27){this.lastChew=time;this.sample('fish_flop',1.514,.16,.16,1.5);this.sample('step_grass',.8993,.12,.09,1.6);}
    if(moving&&time-this.lastCrawl>.7){this.lastCrawl=time;this.sample(wet?'fish_flop':'step_grass',wet?1.898:.464,.12,.025,wet?.65:.55);}
  }
  mower(distance:number,pan:number,running:boolean){
    if(!this.context||!this.master)return;
    if(!this.motorGain&&running){
      const motor=this.context.createOscillator();motor.type='sawtooth';motor.frequency.value=86;
      const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=480;filter.Q.value=.6;
      this.motorGain=this.context.createGain();this.motorGain.gain.value=0;
      this.motorPan=this.context.createStereoPanner();
      motor.connect(filter).connect(this.motorGain).connect(this.motorPan).connect(this.master);motor.start();
    }
    this.motorGain?.gain.setTargetAtTime(running&&this.enabled ? .14/(1+distance*distance*.14):0,this.context.currentTime,.12);
    this.motorPan?.pan.setTargetAtTime(T.MathUtils.clamp(pan,-1,1),this.context.currentTime,.1);
  }
  react(kind:VoiceKind,intensity=1){
    if(!this.context||!this.enabled||!this.master)return;
    const cooldown={spade:.5,salt:2.2,poison:3.1,noticed:5,tipsy:1.1,drown:1.5}[kind];
    const now=this.context.currentTime;
    if(now-(this.voiceTimes.get(kind)??-Infinity)<cooldown)return;
    this.voiceTimes.set(kind,now);this.reactions[kind]=(this.reactions[kind]??0)+1;
    creatureVoice(this.context,this.master,kind,s=>this.track(s),intensity);
  }
  discomfort(salted:boolean,poison:number){
    if(salted)this.react('salt');
    else if(poison>.08)this.react('poison',.6+poison*.4);
  }
  beginDeath(cause:string){
    this.deathAge=0;this.deathStage=0;this.deathCause=cause;
    if(cause==='beer')this.react('tipsy');
    else if(cause==='salt'||cause==='poison')this.react(cause);
    else if(cause==='dry')this.dying();
  }
  deathUpdate(dt:number){
    if(this.deathAge<0)return;this.deathAge+=dt;
    if(this.deathCause==='beer'){
      if(this.deathStage===0&&this.deathAge>=1.25){this.deathStage=1;this.react('tipsy',.85);}
      if(this.deathStage===1&&this.deathAge>=2.5){this.deathStage=2;this.react('drown');}
    }
  }
  home(){
    if(!this.context||!this.master)return;
    this.mower(0,0,false);
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(0,this.context.currentTime,.25);
  }
  eat(){this.tone(280,380,.11,.025);this.tone(390,470,.14,.02,.09);}
  hurt(){this.react('spade');this.sample('fish_flop',1.898,.26,.3,.75);}
  swing(){this.sample('rod_swish',.08,.4,.55,.78);}
  chop(){this.react('spade');this.sample('step_wood',.08,.24,.65,.7);this.sample('fish_flop',.08,.75,.85,.68);this.tone(85,22,.24,.28);this.tone(190,42,.35,.12,.025,'triangle');}
  dying(){this.tone(145,35,.8,.1,0,'triangle');}
  win(){this.tone(261.6,261.6,.5,.045);this.tone(329.6,329.6,.6,.035,.12);this.tone(392,392,.7,.03,.24);}
}
