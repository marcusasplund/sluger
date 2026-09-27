// Wordless creature vocals: a pitched glottal source shaped by vowel resonances.
// Small independent gestures keep pain, fear and intoxication distinguishable.
export type VoiceKind = 'spade'|'salt'|'poison'|'noticed'|'tipsy'|'drown';
export function creatureVoice(ctx:BaseAudioContext,output:AudioNode,kind:VoiceKind,track:(s:AudioScheduledSourceNode)=>void,intensity=1){
  const settings:Record<VoiceKind,{pitch:number;peak:number;end:number;duration:number;gain:number;formants:number[];wobble:number}>={
    spade:{pitch:240,peak:540,end:110,duration:.72,gain:.24,formants:[730,1250,2550],wobble:18},
    salt:{pitch:210,peak:410,end:150,duration:.85,gain:.16,formants:[470,1750,2600],wobble:24},
    poison:{pitch:130,peak:180,end:80,duration:1.1,gain:.12,formants:[380,820,2200],wobble:13},
    noticed:{pitch:170,peak:310,end:190,duration:.3,gain:.075,formants:[520,1300,2500],wobble:8},
    tipsy:{pitch:140,peak:240,end:105,duration:1.05,gain:.12,formants:[430,1000,2300],wobble:52},
    drown:{pitch:210,peak:300,end:65,duration:1.25,gain:.14,formants:[360,700,1700],wobble:25},
  };
  const s=settings[kind],t=ctx.currentTime,d=s.duration,jitter=.95+Math.random()*.1;
  const source=ctx.createOscillator(),vibrato=ctx.createOscillator(),vibratoGain=ctx.createGain(),envelope=ctx.createGain();
  source.type='sawtooth';source.frequency.setValueAtTime(s.pitch*jitter,t);source.frequency.exponentialRampToValueAtTime(s.peak*jitter,t+d*.22);source.frequency.exponentialRampToValueAtTime(s.end*jitter,t+d);
  vibrato.frequency.value=kind==='tipsy'?3.6:kind==='poison'?8:11;vibratoGain.gain.value=s.wobble;
  vibrato.connect(vibratoGain).connect(source.frequency);
  envelope.gain.setValueAtTime(0,t);envelope.gain.linearRampToValueAtTime(s.gain*intensity,t+.025);envelope.gain.setTargetAtTime(s.gain*intensity*.6,t+d*.3,.1);envelope.gain.exponentialRampToValueAtTime(.0001,t+d);
  const filters=s.formants.map((f,i)=>{const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.setValueAtTime(f,t);filter.frequency.linearRampToValueAtTime(f*(kind==='drown'?.55:.88),t+d);filter.Q.value=3+i;const gain=ctx.createGain();gain.gain.value=[1,.55,.2][i];source.connect(filter).connect(gain).connect(envelope);return {filter,gain};});
  envelope.connect(output);track(source);track(vibrato);
  const previous=source.onended;source.onended=e=>{previous?.call(source,e);filters.forEach(({filter,gain})=>{filter.disconnect();gain.disconnect();});vibratoGain.disconnect();envelope.disconnect();};
  source.start(t);vibrato.start(t);source.stop(t+d+.04);vibrato.stop(t+d+.04);
}
