// SPDX-License-Identifier: MIT
import type { ResolvedVisualContract, ContrastCheck, VisualRepair } from './types.js';
import { zVisualColor } from './schema.js';
export interface VisualRgba {r:number;g:number;b:number;a:number}
export function parseVisualColor(input:string):VisualRgba|null {
  if (!zVisualColor.safeParse(input).success) return null;
  if (input.startsWith('#')) {
    let raw=input.slice(1); if(raw.length===3||raw.length===4) raw=[...raw].map(v=>v+v).join('');
    return {r:parseInt(raw.slice(0,2),16),g:parseInt(raw.slice(2,4),16),b:parseInt(raw.slice(4,6),16),a:raw.length===8?parseInt(raw.slice(6,8),16)/255:1};
  }
  const v=(input.match(/(?:\d*\.)?\d+/g)??[]).map(Number);return {r:v[0]??0,g:v[1]??0,b:v[2]??0,a:v[3]??1};
}
function luminance(c:VisualRgba):number {const v=[c.r,c.g,c.b].map(n=>{const s=n/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4});return (v[0]??0)*.2126+(v[1]??0)*.7152+(v[2]??0)*.0722;}
export function visualContrastRatio(foreground:string,background:string):number|null {
  const f=parseVisualColor(foreground),b=parseVisualColor(background);if(!f||!b||b.a!==1)return null;
  const fc={r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1};
  const a=luminance(fc),c=luminance(b);return (Math.max(a,c)+.05)/(Math.min(a,c)+.05);
}
export function assessContrast(spec:ResolvedVisualContract):ContrastCheck[] {
  return spec.components.map(pair=>{
    if(pair.kind==='decorative')return {...pair,ratio:null,threshold:null,status:'not-applicable'};
    const threshold=pair.kind==='text'?4.5:3;
    const ratio=spec.backdropDependent&&['canvas','surface','surfaceRaised','surfaceMuted'].includes(pair.background)?null:visualContrastRatio(spec.colors[pair.foreground],spec.colors[pair.background]);
    return {...pair,ratio,threshold,status:ratio===null?'needs-rendered-review':ratio>=threshold?'pass':'fail'};
  });
}
/** Suggestions are inert until explicitly accepted; accents remain identity values. */
export function proposeContrastRepairs(spec:ResolvedVisualContract):VisualRepair[] {
  const seen=new Set<string>();return assessContrast(spec).flatMap(pair=>{
    if(pair.status!=='fail'||seen.has(pair.foreground)||['accent','accentSecondary'].includes(pair.foreground))return [];
    const candidates=['#000000','#ffffff'].map(after=>({after,ratio:visualContrastRatio(after,spec.colors[pair.background])??0})).sort((a,b)=>b.ratio-a.ratio);
    const candidate=candidates[0];if(!candidate)return [];
    if(candidate.ratio<(pair.threshold??4.5))return [];
    seen.add(pair.foreground);return [{id:`${pair.id}:${pair.foreground}:${candidate.after.slice(1)}`,role:pair.foreground,before:spec.colors[pair.foreground],after:candidate.after,pairId:pair.id,reason:`${pair.context}: ${pair.threshold}:1 contrast required`}];
  });
}
