export class AudioParam {
 constructor(value=0){this.value=value;this.calls=[];}
 setValueAtTime(value,t){this.value=value;this.calls.push(['set',value,t]);return this;}
 exponentialRampToValueAtTime(value,t){this.value=value;this.calls.push(['exp',value,t]);return this;}
 linearRampToValueAtTime(value,t){this.value=value;this.calls.push(['linear',value,t]);return this;}
 setTargetAtTime(value,t,constant){this.value=value;this.calls.push(['target',value,t,constant]);return this;}
 cancelScheduledValues(t){this.calls.push(['cancel',t]);return this;}
}
export class AudioNode {
 constructor(ctx,type){this.ctx=ctx;this.nodeType=type;this.gain=new AudioParam();this.frequency=new AudioParam();this.Q=new AudioParam();this.pan=new AudioParam();this.playbackRate=new AudioParam(1);this.delayTime=new AudioParam();this.connections=[];this.disconnectCount=0;this.stoppedAt=null;this.startedAt=null;this.onended=null;ctx.nodes.push(this);}
 connect(other){this.connections.push(other);return other;}
 disconnect(){this.disconnectCount++;this.connections=[];}
 start(t){this.startedAt=t;}
 stop(t){this.stoppedAt=t;}
 addEventListener(name,fn){if(name==='ended')this.onended=fn;}
}
export class AudioContextMock {
 constructor(){this.nodes=[];this.destination={nodeType:'destination'};this.currentTime=10;this.sampleRate=48000;this.state='running';this.resumeCount=0;}
 resume(){this.resumeCount++;this.state='running';return Promise.resolve();}
 close(){this.state='closed';return Promise.resolve();}
 createOscillator(){return new AudioNode(this,'oscillator');}
 createGain(){return new AudioNode(this,'gain');}
 createBiquadFilter(){return new AudioNode(this,'filter');}
 createStereoPanner(){return new AudioNode(this,'panner');}
 createPanner(){return new AudioNode(this,'panner3d');}
 createBufferSource(){return new AudioNode(this,'buffer-source');}
 createDynamicsCompressor(){return new AudioNode(this,'compressor');}
 createConvolver(){return new AudioNode(this,'convolver');}
 createDelay(){return new AudioNode(this,'delay');}
 createBuffer(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length));return {numberOfChannels:channels,length,sampleRate:rate,duration:length/rate,getChannelData:index=>data[index]};}
 flush(){for(const node of [...this.nodes])if(node.stoppedAt!==null&&node.onended){const callback=node.onended;node.onended=null;callback();}}
}
