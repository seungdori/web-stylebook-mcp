// SPDX-License-Identifier: MIT
import type { VisualContract, VisualResolutionOptions, ResolvedVisualContract } from './types.js';
import { COLOR_ROLES, TYPOGRAPHY_ROLES } from './types.js';
import { zVisualContract, zVisualResolutionOptions, zResolvedVisualContract } from './schema.js';
import { visualContentHash } from './hash.js';
import { proposeContrastRepairs } from './contrast.js';

/** Browser/server shared resolver. Authored data is supplied by the catalog, never inferred from palette order. */
export function resolveContract(input: VisualContract, options: VisualResolutionOptions = {}): ResolvedVisualContract {
  const contract=zVisualContract.parse(input);
  const {revision,...revisionData}=contract;
  if(visualContentHash(revisionData)!==revision)throw new Error(`The visual contract revision for '${contract.styleId}' is stale`);
  const opts=zVisualResolutionOptions.parse(options);
  const mode=opts.mode??contract.defaultMode;
  const authoredMode=contract.modes[mode];
  if(!authoredMode)throw new Error(`Style '${contract.styleId}' has no authored '${mode}' mode. Available: ${Object.keys(contract.modes).join(', ')}`);
  const {modes:_,defaultMode:__,...common}=contract; void _;void __;
  const {colors:___,backdropDependent:____,...modeFields}=authoredMode;void ___;void ____;
  const base={...common,...modeFields};
  const overrides=opts.overrides??{};
  const contentLocale=opts.contentLocale??'en';
  const colors={...authoredMode.colors,...overrides.colors};
  const typography=structuredClone(base.typography);
  const origins:ResolvedVisualContract['origins']={};
  function recordOrigins(value:unknown,path:string){
    // Font metadata carries its own source/license. One origin covers the group;
    // enumerating each available weight and script would repeat that provenance.
    if(path==='typography.fonts'){origins[path]='adaptation';return;}
    if(value&&typeof value==='object')for(const [key,child] of Object.entries(value))recordOrigins(child,`${path}.${key}`);
    else origins[path]=contract.provenance.authoredPaths.includes(path)?'authored':'adaptation';
  }
  for(const key of ['colors','typography','spacing','borders','radii','shadows','motion'] as const)recordOrigins(key==='colors'?colors:base[key],key);
  const warnings:string[]=[];
  for(const color of COLOR_ROLES)origins[`colors.${color}`]=contract.provenance.authoredPaths.includes(`colors.${color}`)?'authored':'adaptation';
  for(const key of Object.keys(overrides.colors??{}))origins[`colors.${key}`]='override';
  for(const name of TYPOGRAPHY_ROLES){
    const role=typography.roles[name];
    for(const field of Object.keys(role))origins[`typography.roles.${name}.${field}`]=contract.provenance.authoredPaths.includes(`typography.roles.${name}.${field}`)?'authored':'adaptation';
    if(contentLocale!=='en'){
      const serif=/(?:^|,)\s*(?:ui-)?serif\s*$/.test(role.fontFamily);
      const script=contentLocale==='ko'?'hangul':'japanese';
      const fallback=contentLocale==='ko'?(serif?'Noto Serif KR':'Noto Sans KR'):(serif?'Noto Serif JP':'Noto Sans JP');
      const parts=role.fontFamily.split(',').map(part=>part.trim());
      const metadataFor=(part:string)=>typography.fonts.find(font=>font.family===part.replace(/^['"]|['"]$/g,''));
      // A Korean font can cover shared Han glyphs before the Japanese fallback.
      // Remove only incompatible CJK faces; preserve the original Latin sequence.
      const localized=parts.filter(part=>{
        const font=metadataFor(part);
        return !font || !font.scripts.some(value=>value==='hangul'||value==='japanese') || font.scripts.includes(script);
      });
      if(!localized.some(part=>metadataFor(part)?.scripts.includes(script))){
        const genericIndex=localized.findIndex(part=>['serif','sans-serif','monospace','system-ui','ui-serif','ui-sans-serif','ui-monospace'].includes(part));
        localized.splice(genericIndex<0?localized.length:genericIndex,0,`'${fallback}'`);
      }
      const family=localized.join(', ');
      if(role.fontFamily!==family){role.fontFamily=family;origins[`typography.roles.${name}.fontFamily`]='locale';}
      role.letterSpacingEm=0;role.textTransform='none';role.wordBreak=contentLocale==='ko'?'keep-all':'normal';
      role.lineHeight=Math.max(role.lineHeight,name==='display'||name==='heading'?1.2:1.65);
      for(const field of ['letterSpacingEm','textTransform','wordBreak','lineHeight'])origins[`typography.roles.${name}.${field}`]='locale';
    }
    Object.assign(role,overrides.typography?.[name]);
    for(const field of Object.keys(overrides.typography?.[name]??{}))origins[`typography.roles.${name}.${field}`]='override';
    if(role.sizeMinRem>role.sizeMaxRem)throw new Error(`${name}: minimum font size must not exceed maximum`);
  }
  if(overrides.fonts){typography.fonts=structuredClone(overrides.fonts);origins['typography.fonts']='override';}
  const knownFamilies=new Set(typography.fonts.map(f=>f.family));
  for(const name of TYPOGRAPHY_ROLES){
    const family=typography.roles[name].fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g,'')??'';
    if(!knownFamilies.has(family)){
      const system=['serif','sans-serif','monospace','system-ui','ui-serif','ui-sans-serif','ui-monospace','ui-rounded','-apple-system','BlinkMacSystemFont'].includes(family);
      typography.fonts.push({family,source:system?'system':'user',license:system?'System-provided font; not redistributed':'User supplied font; availability and license require verification',weights:[typography.roles[name].fontWeight],scripts:[],fallback:'system-ui, sans-serif',availability:system?'system-dependent':'unverified'});
      knownFamilies.add(family);
      if(!system)warnings.push(`Font '${family}' is user supplied; verify availability, weights, script coverage, and license.`);
    }
  }
  for(const name of TYPOGRAPHY_ROLES){
    const role=typography.roles[name];const family=role.fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g,'');
    const font=typography.fonts.find(f=>f.family===family);
    if(font?.source==='external'&&!font.weights.includes(role.fontWeight))warnings.push(`${name}: '${family}' does not declare weight ${role.fontWeight}; verify font synthesis or select an available weight.`);
  }
  const spacing={...base.spacing,...overrides.spacing};
  for(const field of Object.keys(spacing))origins[`spacing.${field}`]='adaptation';
  for(const field of Object.keys(overrides.spacing??{}))origins[`spacing.${field}`]='override';
  if(overrides.density){
    spacing.density=overrides.density;spacing.row=overrides.density==='compact'?32:44;spacing.gutter=overrides.density==='compact'?12:24;spacing.stack=overrides.density==='compact'?12:20;
    for(const field of ['density','row','gutter','stack'])origins[`spacing.${field}`]='override';
  }
  if(authoredMode.backdropDependent)warnings.push('Backdrop-dependent colors need rendered review; flat-color contrast cannot verify the original effect.');
  if(contentLocale!=='en')warnings.push('Locale reading adjustments are applied; verify actual glyph fallback and heading wrapping in the target browser.');
  const data:Omit<ResolvedVisualContract,'contentHash'>={...base,mode,contentLocale,colors,typography,spacing,backdropDependent:authoredMode.backdropDependent,overrides,origins,repairs:[],warnings};
  for(const requested of opts.acceptedRepairs??[]){
    const state={...data,contentHash:visualContentHash(data)};
    const proposal=proposeContrastRepairs(state).find(p=>p.id===requested.id&&p.role===requested.role&&p.before===requested.before&&p.after===requested.after&&p.pairId===requested.pairId);
    if(!proposal)throw new Error(`Repair '${requested.id}' is stale or is not a current proposal`);
    data.colors[proposal.role]=proposal.after;data.origins[`colors.${proposal.role}`]='repair';data.repairs.push(proposal);
  }
  const normalized=zResolvedVisualContract.parse({...data,contentHash:visualContentHash(data)});
  const {contentHash:priorHash,...normalizedData}=normalized;void priorHash;
  return {...normalizedData,contentHash:visualContentHash(normalizedData)};
}
