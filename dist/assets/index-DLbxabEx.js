var ec=Object.defineProperty;var nc=(s,t,e)=>t in s?ec(s,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):s[t]=e;var b=(s,t,e)=>nc(s,typeof t!="symbol"?t+"":t,e);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function e(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(i){if(i.ep)return;i.ep=!0;const r=e(i);fetch(i.href,r)}})();/**
 * @license
 * Copyright 2010-2023 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Kr="160",ic=0,xa=1,sc=2,nl=1,il=2,mn=3,Pn=0,Fe=1,Ne=2,bn=0,Gn=1,Yi=2,ya=3,Ma=4,rc=5,zn=100,ac=101,oc=102,Sa=103,Ea=104,lc=200,cc=201,hc=202,uc=203,Or=204,Br=205,dc=206,fc=207,pc=208,mc=209,gc=210,_c=211,vc=212,xc=213,yc=214,Mc=0,Sc=1,Ec=2,Bs=3,wc=4,Tc=5,bc=6,Ac=7,sl=0,Cc=1,Rc=2,An=0,Pc=1,Lc=2,Dc=3,Ic=4,Uc=5,Nc=6,rl=300,Ei=301,wi=302,zr=303,Hr=304,Ys=306,Gr=1e3,Ke=1001,kr=1002,Ue=1003,wa=1004,nr=1005,We=1006,Fc=1007,$i=1008,Cn=1009,Oc=1010,Bc=1011,Qr=1012,al=1013,wn=1014,Tn=1015,Zi=1016,ol=1017,ll=1018,kn=1020,zc=1021,Qe=1023,Hc=1024,Gc=1025,Vn=1026,Ti=1027,kc=1028,cl=1029,Vc=1030,hl=1031,ul=1033,ir=33776,sr=33777,rr=33778,ar=33779,Ta=35840,ba=35841,Aa=35842,Ca=35843,dl=36196,Ra=37492,Pa=37496,La=37808,Da=37809,Ia=37810,Ua=37811,Na=37812,Fa=37813,Oa=37814,Ba=37815,za=37816,Ha=37817,Ga=37818,ka=37819,Va=37820,Wa=37821,or=36492,Xa=36494,qa=36495,Wc=36283,Ya=36284,$a=36285,Za=36286,fl=3e3,Wn=3001,Xc=3200,qc=3201,pl=0,Yc=1,Ye="",Me="srgb",_n="srgb-linear",ta="display-p3",$s="display-p3-linear",zs="linear",ee="srgb",Hs="rec709",Gs="p3",Zn=7680,ja=519,$c=512,Zc=513,jc=514,ml=515,Jc=516,Kc=517,Qc=518,th=519,Vr=35044,Ja="300 es",Wr=1035,gn=2e3,ks=2001;class Ai{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const i=this._listeners[t];if(i!==void 0){const r=i.indexOf(e);r!==-1&&i.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const n=this._listeners[t.type];if(n!==void 0){t.target=this;const i=n.slice(0);for(let r=0,a=i.length;r<a;r++)i[r].call(this,t);t.target=null}}}const Te=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let Ka=1234567;const Gi=Math.PI/180,ji=180/Math.PI;function on(){const s=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Te[s&255]+Te[s>>8&255]+Te[s>>16&255]+Te[s>>24&255]+"-"+Te[t&255]+Te[t>>8&255]+"-"+Te[t>>16&15|64]+Te[t>>24&255]+"-"+Te[e&63|128]+Te[e>>8&255]+"-"+Te[e>>16&255]+Te[e>>24&255]+Te[n&255]+Te[n>>8&255]+Te[n>>16&255]+Te[n>>24&255]).toLowerCase()}function Se(s,t,e){return Math.max(t,Math.min(e,s))}function ea(s,t){return(s%t+t)%t}function eh(s,t,e,n,i){return n+(s-t)*(i-n)/(e-t)}function nh(s,t,e){return s!==t?(e-s)/(t-s):0}function ki(s,t,e){return(1-e)*s+e*t}function ih(s,t,e,n){return ki(s,t,1-Math.exp(-e*n))}function sh(s,t=1){return t-Math.abs(ea(s,t*2)-t)}function rh(s,t,e){return s<=t?0:s>=e?1:(s=(s-t)/(e-t),s*s*(3-2*s))}function ah(s,t,e){return s<=t?0:s>=e?1:(s=(s-t)/(e-t),s*s*s*(s*(s*6-15)+10))}function oh(s,t){return s+Math.floor(Math.random()*(t-s+1))}function lh(s,t){return s+Math.random()*(t-s)}function ch(s){return s*(.5-Math.random())}function hh(s){s!==void 0&&(Ka=s);let t=Ka+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function uh(s){return s*Gi}function dh(s){return s*ji}function Xr(s){return(s&s-1)===0&&s!==0}function fh(s){return Math.pow(2,Math.ceil(Math.log(s)/Math.LN2))}function Vs(s){return Math.pow(2,Math.floor(Math.log(s)/Math.LN2))}function ph(s,t,e,n,i){const r=Math.cos,a=Math.sin,o=r(e/2),l=a(e/2),c=r((t+n)/2),h=a((t+n)/2),u=r((t-n)/2),d=a((t-n)/2),p=r((n-t)/2),g=a((n-t)/2);switch(i){case"XYX":s.set(o*h,l*u,l*d,o*c);break;case"YZY":s.set(l*d,o*h,l*u,o*c);break;case"ZXZ":s.set(l*u,l*d,o*h,o*c);break;case"XZX":s.set(o*h,l*g,l*p,o*c);break;case"YXY":s.set(l*p,o*h,l*g,o*c);break;case"ZYZ":s.set(l*g,l*p,o*h,o*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+i)}}function rn(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("Invalid component type.")}}function Zt(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("Invalid component type.")}}const mh={DEG2RAD:Gi,RAD2DEG:ji,generateUUID:on,clamp:Se,euclideanModulo:ea,mapLinear:eh,inverseLerp:nh,lerp:ki,damp:ih,pingpong:sh,smoothstep:rh,smootherstep:ah,randInt:oh,randFloat:lh,randFloatSpread:ch,seededRandom:hh,degToRad:uh,radToDeg:dh,isPowerOfTwo:Xr,ceilPowerOfTwo:fh,floorPowerOfTwo:Vs,setQuaternionFromProperEuler:ph,normalize:Zt,denormalize:rn};class rt{constructor(t=0,e=0){rt.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,i=t.elements;return this.x=i[0]*e+i[3]*n+i[6],this.y=i[1]*e+i[4]*n+i[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(Se(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),i=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*n-a*i+t.x,this.y=r*i+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Xt{constructor(t,e,n,i,r,a,o,l,c){Xt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,i,r,a,o,l,c)}set(t,e,n,i,r,a,o,l,c){const h=this.elements;return h[0]=t,h[1]=i,h[2]=o,h[3]=e,h[4]=r,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],u=n[7],d=n[2],p=n[5],g=n[8],_=i[0],m=i[3],f=i[6],M=i[1],v=i[4],S=i[7],L=i[2],A=i[5],C=i[8];return r[0]=a*_+o*M+l*L,r[3]=a*m+o*v+l*A,r[6]=a*f+o*S+l*C,r[1]=c*_+h*M+u*L,r[4]=c*m+h*v+u*A,r[7]=c*f+h*S+u*C,r[2]=d*_+p*M+g*L,r[5]=d*m+p*v+g*A,r[8]=d*f+p*S+g*C,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return e*a*h-e*o*c-n*r*h+n*o*l+i*r*c-i*a*l}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=h*a-o*c,d=o*l-h*r,p=c*r-a*l,g=e*u+n*d+i*p;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const _=1/g;return t[0]=u*_,t[1]=(i*c-h*n)*_,t[2]=(o*n-i*a)*_,t[3]=d*_,t[4]=(h*e-i*l)*_,t[5]=(i*r-o*e)*_,t[6]=p*_,t[7]=(n*l-c*e)*_,t[8]=(a*e-n*r)*_,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,i,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+t,-i*c,i*l,-i*(-c*a+l*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(lr.makeScale(t,e)),this}rotate(t){return this.premultiply(lr.makeRotation(-t)),this}translate(t,e){return this.premultiply(lr.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<9;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const lr=new Xt;function gl(s){for(let t=s.length-1;t>=0;--t)if(s[t]>=65535)return!0;return!1}function Ws(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function gh(){const s=Ws("canvas");return s.style.display="block",s}const Qa={};function Vi(s){s in Qa||(Qa[s]=!0,console.warn(s))}const to=new Xt().set(.8224621,.177538,0,.0331941,.9668058,0,.0170827,.0723974,.9105199),eo=new Xt().set(1.2249401,-.2249404,0,-.0420569,1.0420571,0,-.0196376,-.0786361,1.0982735),rs={[_n]:{transfer:zs,primaries:Hs,toReference:s=>s,fromReference:s=>s},[Me]:{transfer:ee,primaries:Hs,toReference:s=>s.convertSRGBToLinear(),fromReference:s=>s.convertLinearToSRGB()},[$s]:{transfer:zs,primaries:Gs,toReference:s=>s.applyMatrix3(eo),fromReference:s=>s.applyMatrix3(to)},[ta]:{transfer:ee,primaries:Gs,toReference:s=>s.convertSRGBToLinear().applyMatrix3(eo),fromReference:s=>s.applyMatrix3(to).convertLinearToSRGB()}},_h=new Set([_n,$s]),jt={enabled:!0,_workingColorSpace:_n,get workingColorSpace(){return this._workingColorSpace},set workingColorSpace(s){if(!_h.has(s))throw new Error(`Unsupported working color space, "${s}".`);this._workingColorSpace=s},convert:function(s,t,e){if(this.enabled===!1||t===e||!t||!e)return s;const n=rs[t].toReference,i=rs[e].fromReference;return i(n(s))},fromWorkingColorSpace:function(s,t){return this.convert(s,this._workingColorSpace,t)},toWorkingColorSpace:function(s,t){return this.convert(s,t,this._workingColorSpace)},getPrimaries:function(s){return rs[s].primaries},getTransfer:function(s){return s===Ye?zs:rs[s].transfer}};function yi(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function cr(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}let jn;class _l{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{jn===void 0&&(jn=Ws("canvas")),jn.width=t.width,jn.height=t.height;const n=jn.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=jn}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=Ws("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const i=n.getImageData(0,0,t.width,t.height),r=i.data;for(let a=0;a<r.length;a++)r[a]=yi(r[a]/255)*255;return n.putImageData(i,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(yi(e[n]/255)*255):e[n]=yi(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let vh=0;class vl{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:vh++}),this.uuid=on(),this.data=t,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let a=0,o=i.length;a<o;a++)i[a].isDataTexture?r.push(hr(i[a].image)):r.push(hr(i[a]))}else r=hr(i);n.url=r}return e||(t.images[this.uuid]=n),n}}function hr(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?_l.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let xh=0;class Oe extends Ai{constructor(t=Oe.DEFAULT_IMAGE,e=Oe.DEFAULT_MAPPING,n=Ke,i=Ke,r=We,a=$i,o=Qe,l=Cn,c=Oe.DEFAULT_ANISOTROPY,h=Ye){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:xh++}),this.uuid=on(),this.name="",this.source=new vl(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new rt(0,0),this.repeat=new rt(1,1),this.center=new rt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Xt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,typeof h=="string"?this.colorSpace=h:(Vi("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=h===Wn?Me:Ye),this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.needsPMREMUpdate=!1}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==rl)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Gr:t.x=t.x-Math.floor(t.x);break;case Ke:t.x=t.x<0?0:1;break;case kr:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Gr:t.y=t.y-Math.floor(t.y);break;case Ke:t.y=t.y<0?0:1;break;case kr:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}get encoding(){return Vi("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace===Me?Wn:fl}set encoding(t){Vi("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=t===Wn?Me:Ye}}Oe.DEFAULT_IMAGE=null;Oe.DEFAULT_MAPPING=rl;Oe.DEFAULT_ANISOTROPY=1;class ve{constructor(t=0,e=0,n=0,i=1){ve.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=i}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,i){return this.x=t,this.y=e,this.z=n,this.w=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*i+a[12]*r,this.y=a[1]*e+a[5]*n+a[9]*i+a[13]*r,this.z=a[2]*e+a[6]*n+a[10]*i+a[14]*r,this.w=a[3]*e+a[7]*n+a[11]*i+a[15]*r,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,i,r;const l=t.elements,c=l[0],h=l[4],u=l[8],d=l[1],p=l[5],g=l[9],_=l[2],m=l[6],f=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-_)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+_)<.1&&Math.abs(g+m)<.1&&Math.abs(c+p+f-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const v=(c+1)/2,S=(p+1)/2,L=(f+1)/2,A=(h+d)/4,C=(u+_)/4,B=(g+m)/4;return v>S&&v>L?v<.01?(n=0,i=.707106781,r=.707106781):(n=Math.sqrt(v),i=A/n,r=C/n):S>L?S<.01?(n=.707106781,i=0,r=.707106781):(i=Math.sqrt(S),n=A/i,r=B/i):L<.01?(n=.707106781,i=.707106781,r=0):(r=Math.sqrt(L),n=C/r,i=B/r),this.set(n,i,r,e),this}let M=Math.sqrt((m-g)*(m-g)+(u-_)*(u-_)+(d-h)*(d-h));return Math.abs(M)<.001&&(M=1),this.x=(m-g)/M,this.y=(u-_)/M,this.z=(d-h)/M,this.w=Math.acos((c+p+f-1)/2),this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class yh extends Ai{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new ve(0,0,t,e),this.scissorTest=!1,this.viewport=new ve(0,0,t,e);const i={width:t,height:e,depth:1};n.encoding!==void 0&&(Vi("THREE.WebGLRenderTarget: option.encoding has been replaced by option.colorSpace."),n.colorSpace=n.encoding===Wn?Me:Ye),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:We,depthBuffer:!0,stencilBuffer:!1,depthTexture:null,samples:0},n),this.texture=new Oe(i,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.flipY=!1,this.texture.generateMipmaps=n.generateMipmaps,this.texture.internalFormat=n.internalFormat,this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}setSize(t,e,n=1){(this.width!==t||this.height!==e||this.depth!==n)&&(this.width=t,this.height=e,this.depth=n,this.texture.image.width=t,this.texture.image.height=e,this.texture.image.depth=n,this.dispose()),this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.texture=t.texture.clone(),this.texture.isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new vl(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Xn extends yh{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class xl extends Oe{constructor(t=null,e=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=Ue,this.minFilter=Ue,this.wrapR=Ke,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Mh extends Oe{constructor(t=null,e=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=Ue,this.minFilter=Ue,this.wrapR=Ke,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Ci{constructor(t=0,e=0,n=0,i=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=i}static slerpFlat(t,e,n,i,r,a,o){let l=n[i+0],c=n[i+1],h=n[i+2],u=n[i+3];const d=r[a+0],p=r[a+1],g=r[a+2],_=r[a+3];if(o===0){t[e+0]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u;return}if(o===1){t[e+0]=d,t[e+1]=p,t[e+2]=g,t[e+3]=_;return}if(u!==_||l!==d||c!==p||h!==g){let m=1-o;const f=l*d+c*p+h*g+u*_,M=f>=0?1:-1,v=1-f*f;if(v>Number.EPSILON){const L=Math.sqrt(v),A=Math.atan2(L,f*M);m=Math.sin(m*A)/L,o=Math.sin(o*A)/L}const S=o*M;if(l=l*m+d*S,c=c*m+p*S,h=h*m+g*S,u=u*m+_*S,m===1-o){const L=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=L,c*=L,h*=L,u*=L}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,i,r,a){const o=n[i],l=n[i+1],c=n[i+2],h=n[i+3],u=r[a],d=r[a+1],p=r[a+2],g=r[a+3];return t[e]=o*g+h*u+l*p-c*d,t[e+1]=l*g+h*d+c*u-o*p,t[e+2]=c*g+h*p+o*d-l*u,t[e+3]=h*g-o*u-l*d-c*p,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,i){return this._x=t,this._y=e,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,i=t._y,r=t._z,a=t._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(i/2),u=o(r/2),d=l(n/2),p=l(i/2),g=l(r/2);switch(a){case"XYZ":this._x=d*h*u+c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u-d*p*g;break;case"YXZ":this._x=d*h*u+c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u+d*p*g;break;case"ZXY":this._x=d*h*u-c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u-d*p*g;break;case"ZYX":this._x=d*h*u-c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u+d*p*g;break;case"YZX":this._x=d*h*u+c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u-d*p*g;break;case"XZY":this._x=d*h*u-c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u+d*p*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,i=Math.sin(n);return this._x=t.x*i,this._y=t.y*i,this._z=t.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],i=e[4],r=e[8],a=e[1],o=e[5],l=e[9],c=e[2],h=e[6],u=e[10],d=n+o+u;if(d>0){const p=.5/Math.sqrt(d+1);this._w=.25/p,this._x=(h-l)*p,this._y=(r-c)*p,this._z=(a-i)*p}else if(n>o&&n>u){const p=2*Math.sqrt(1+n-o-u);this._w=(h-l)/p,this._x=.25*p,this._y=(i+a)/p,this._z=(r+c)/p}else if(o>u){const p=2*Math.sqrt(1+o-n-u);this._w=(r-c)/p,this._x=(i+a)/p,this._y=.25*p,this._z=(l+h)/p}else{const p=2*Math.sqrt(1+u-n-o);this._w=(a-i)/p,this._x=(r+c)/p,this._y=(l+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Se(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const i=Math.min(1,e/n);return this.slerp(t,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,i=t._y,r=t._z,a=t._w,o=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+a*o+i*c-r*l,this._y=i*h+a*l+r*o-n*c,this._z=r*h+a*c+n*l-i*o,this._w=a*h-n*o-i*l-r*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,i=this._y,r=this._z,a=this._w;let o=a*t._w+n*t._x+i*t._y+r*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=a,this._x=n,this._y=i,this._z=r,this;const l=1-o*o;if(l<=Number.EPSILON){const p=1-e;return this._w=p*a+e*this._w,this._x=p*n+e*this._x,this._y=p*i+e*this._y,this._z=p*r+e*this._z,this.normalize(),this}const c=Math.sqrt(l),h=Math.atan2(c,o),u=Math.sin((1-e)*h)/c,d=Math.sin(e*h)/c;return this._w=a*u+this._w*d,this._x=n*u+this._x*d,this._y=i*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=Math.random(),e=Math.sqrt(1-t),n=Math.sqrt(t),i=2*Math.PI*Math.random(),r=2*Math.PI*Math.random();return this.set(e*Math.cos(i),n*Math.sin(r),n*Math.cos(r),e*Math.sin(i))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class R{constructor(t=0,e=0,n=0){R.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(no.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(no.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,i=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*i,this.y=r[1]*e+r[4]*n+r[7]*i,this.z=r[2]*e+r[5]*n+r[8]*i,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,r=t.elements,a=1/(r[3]*e+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*i+r[12])*a,this.y=(r[1]*e+r[5]*n+r[9]*i+r[13])*a,this.z=(r[2]*e+r[6]*n+r[10]*i+r[14])*a,this}applyQuaternion(t){const e=this.x,n=this.y,i=this.z,r=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*i-o*n),h=2*(o*e-r*i),u=2*(r*n-a*e);return this.x=e+l*c+a*u-o*h,this.y=n+l*h+o*c-r*u,this.z=i+l*u+r*h-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,i=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*i,this.y=r[1]*e+r[5]*n+r[9]*i,this.z=r[2]*e+r[6]*n+r[10]*i,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,i=t.y,r=t.z,a=e.x,o=e.y,l=e.z;return this.x=i*l-r*o,this.y=r*a-n*l,this.z=n*o-i*a,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return ur.copy(this).projectOnVector(t),this.sub(ur)}reflect(t){return this.sub(ur.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(Se(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,i=this.z-t.z;return e*e+n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const i=Math.sin(e)*t;return this.x=i*Math.sin(n),this.y=Math.cos(e)*t,this.z=i*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),i=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=i,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=(Math.random()-.5)*2,e=Math.random()*Math.PI*2,n=Math.sqrt(1-t**2);return this.x=n*Math.cos(e),this.y=n*Math.sin(e),this.z=t,this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const ur=new R,no=new Ci;class $n{constructor(t=new R(1/0,1/0,1/0),e=new R(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(Ze.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(Ze.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=Ze.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,Ze):Ze.fromBufferAttribute(r,a),Ze.applyMatrix4(t.matrixWorld),this.expandByPoint(Ze);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),as.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),as.copy(n.boundingBox)),as.applyMatrix4(t.matrixWorld),this.union(as)}const i=t.children;for(let r=0,a=i.length;r<a;r++)this.expandByObject(i[r],e);return this}containsPoint(t){return!(t.x<this.min.x||t.x>this.max.x||t.y<this.min.y||t.y>this.max.y||t.z<this.min.z||t.z>this.max.z)}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return!(t.max.x<this.min.x||t.min.x>this.max.x||t.max.y<this.min.y||t.min.y>this.max.y||t.max.z<this.min.z||t.min.z>this.max.z)}intersectsSphere(t){return this.clampPoint(t.center,Ze),Ze.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Di),os.subVectors(this.max,Di),Jn.subVectors(t.a,Di),Kn.subVectors(t.b,Di),Qn.subVectors(t.c,Di),xn.subVectors(Kn,Jn),yn.subVectors(Qn,Kn),In.subVectors(Jn,Qn);let e=[0,-xn.z,xn.y,0,-yn.z,yn.y,0,-In.z,In.y,xn.z,0,-xn.x,yn.z,0,-yn.x,In.z,0,-In.x,-xn.y,xn.x,0,-yn.y,yn.x,0,-In.y,In.x,0];return!dr(e,Jn,Kn,Qn,os)||(e=[1,0,0,0,1,0,0,0,1],!dr(e,Jn,Kn,Qn,os))?!1:(ls.crossVectors(xn,yn),e=[ls.x,ls.y,ls.z],dr(e,Jn,Kn,Qn,os))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,Ze).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(Ze).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(hn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),hn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),hn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),hn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),hn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),hn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),hn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),hn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(hn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const hn=[new R,new R,new R,new R,new R,new R,new R,new R],Ze=new R,as=new $n,Jn=new R,Kn=new R,Qn=new R,xn=new R,yn=new R,In=new R,Di=new R,os=new R,ls=new R,Un=new R;function dr(s,t,e,n,i){for(let r=0,a=s.length-3;r<=a;r+=3){Un.fromArray(s,r);const o=i.x*Math.abs(Un.x)+i.y*Math.abs(Un.y)+i.z*Math.abs(Un.z),l=t.dot(Un),c=e.dot(Un),h=n.dot(Un);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}const Sh=new $n,Ii=new R,fr=new R;class Ri{constructor(t=new R,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):Sh.setFromPoints(t).getCenter(n);let i=0;for(let r=0,a=t.length;r<a;r++)i=Math.max(i,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(i),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Ii.subVectors(t,this.center);const e=Ii.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),i=(n-this.radius)*.5;this.center.addScaledVector(Ii,i/n),this.radius+=i}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(fr.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Ii.copy(t.center).add(fr)),this.expandByPoint(Ii.copy(t.center).sub(fr))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const un=new R,pr=new R,cs=new R,Mn=new R,mr=new R,hs=new R,gr=new R;class yl{constructor(t=new R,e=new R(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,un)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=un.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(un.copy(this.origin).addScaledVector(this.direction,e),un.distanceToSquared(t))}distanceSqToSegment(t,e,n,i){pr.copy(t).add(e).multiplyScalar(.5),cs.copy(e).sub(t).normalize(),Mn.copy(this.origin).sub(pr);const r=t.distanceTo(e)*.5,a=-this.direction.dot(cs),o=Mn.dot(this.direction),l=-Mn.dot(cs),c=Mn.lengthSq(),h=Math.abs(1-a*a);let u,d,p,g;if(h>0)if(u=a*l-o,d=a*o-l,g=r*h,u>=0)if(d>=-g)if(d<=g){const _=1/h;u*=_,d*=_,p=u*(u+a*d+2*o)+d*(a*u+d+2*l)+c}else d=r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d=-r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d<=-g?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-l),r),p=-u*u+d*(d+2*l)+c):d<=g?(u=0,d=Math.min(Math.max(-r,-l),r),p=d*(d+2*l)+c):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-l),r),p=-u*u+d*(d+2*l)+c);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),i&&i.copy(pr).addScaledVector(cs,d),p}intersectSphere(t,e){un.subVectors(t.center,this.origin);const n=un.dot(this.direction),i=un.dot(un)-n*n,r=t.radius*t.radius;if(i>r)return null;const a=Math.sqrt(r-i),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,i,r,a,o,l;const c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(t.min.x-d.x)*c,i=(t.max.x-d.x)*c):(n=(t.max.x-d.x)*c,i=(t.min.x-d.x)*c),h>=0?(r=(t.min.y-d.y)*h,a=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,a=(t.min.y-d.y)*h),n>a||r>i||((r>n||isNaN(n))&&(n=r),(a<i||isNaN(i))&&(i=a),u>=0?(o=(t.min.z-d.z)*u,l=(t.max.z-d.z)*u):(o=(t.max.z-d.z)*u,l=(t.min.z-d.z)*u),n>l||o>i)||((o>n||n!==n)&&(n=o),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,e)}intersectsBox(t){return this.intersectBox(t,un)!==null}intersectTriangle(t,e,n,i,r){mr.subVectors(e,t),hs.subVectors(n,t),gr.crossVectors(mr,hs);let a=this.direction.dot(gr),o;if(a>0){if(i)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Mn.subVectors(this.origin,t);const l=o*this.direction.dot(hs.crossVectors(Mn,hs));if(l<0)return null;const c=o*this.direction.dot(mr.cross(Mn));if(c<0||l+c>a)return null;const h=-o*Mn.dot(gr);return h<0?null:this.at(h/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class ne{constructor(t,e,n,i,r,a,o,l,c,h,u,d,p,g,_,m){ne.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,i,r,a,o,l,c,h,u,d,p,g,_,m)}set(t,e,n,i,r,a,o,l,c,h,u,d,p,g,_,m){const f=this.elements;return f[0]=t,f[4]=e,f[8]=n,f[12]=i,f[1]=r,f[5]=a,f[9]=o,f[13]=l,f[2]=c,f[6]=h,f[10]=u,f[14]=d,f[3]=p,f[7]=g,f[11]=_,f[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ne().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,i=1/ti.setFromMatrixColumn(t,0).length(),r=1/ti.setFromMatrixColumn(t,1).length(),a=1/ti.setFromMatrixColumn(t,2).length();return e[0]=n[0]*i,e[1]=n[1]*i,e[2]=n[2]*i,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,i=t.y,r=t.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(i),c=Math.sin(i),h=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){const d=a*h,p=a*u,g=o*h,_=o*u;e[0]=l*h,e[4]=-l*u,e[8]=c,e[1]=p+g*c,e[5]=d-_*c,e[9]=-o*l,e[2]=_-d*c,e[6]=g+p*c,e[10]=a*l}else if(t.order==="YXZ"){const d=l*h,p=l*u,g=c*h,_=c*u;e[0]=d+_*o,e[4]=g*o-p,e[8]=a*c,e[1]=a*u,e[5]=a*h,e[9]=-o,e[2]=p*o-g,e[6]=_+d*o,e[10]=a*l}else if(t.order==="ZXY"){const d=l*h,p=l*u,g=c*h,_=c*u;e[0]=d-_*o,e[4]=-a*u,e[8]=g+p*o,e[1]=p+g*o,e[5]=a*h,e[9]=_-d*o,e[2]=-a*c,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){const d=a*h,p=a*u,g=o*h,_=o*u;e[0]=l*h,e[4]=g*c-p,e[8]=d*c+_,e[1]=l*u,e[5]=_*c+d,e[9]=p*c-g,e[2]=-c,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){const d=a*l,p=a*c,g=o*l,_=o*c;e[0]=l*h,e[4]=_-d*u,e[8]=g*u+p,e[1]=u,e[5]=a*h,e[9]=-o*h,e[2]=-c*h,e[6]=p*u+g,e[10]=d-_*u}else if(t.order==="XZY"){const d=a*l,p=a*c,g=o*l,_=o*c;e[0]=l*h,e[4]=-u,e[8]=c*h,e[1]=d*u+_,e[5]=a*h,e[9]=p*u-g,e[2]=g*u-p,e[6]=o*h,e[10]=_*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(Eh,t,wh)}lookAt(t,e,n){const i=this.elements;return ze.subVectors(t,e),ze.lengthSq()===0&&(ze.z=1),ze.normalize(),Sn.crossVectors(n,ze),Sn.lengthSq()===0&&(Math.abs(n.z)===1?ze.x+=1e-4:ze.z+=1e-4,ze.normalize(),Sn.crossVectors(n,ze)),Sn.normalize(),us.crossVectors(ze,Sn),i[0]=Sn.x,i[4]=us.x,i[8]=ze.x,i[1]=Sn.y,i[5]=us.y,i[9]=ze.y,i[2]=Sn.z,i[6]=us.z,i[10]=ze.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],u=n[5],d=n[9],p=n[13],g=n[2],_=n[6],m=n[10],f=n[14],M=n[3],v=n[7],S=n[11],L=n[15],A=i[0],C=i[4],B=i[8],y=i[12],T=i[1],F=i[5],V=i[9],nt=i[13],I=i[2],O=i[6],k=i[10],Z=i[14],Y=i[3],$=i[7],j=i[11],it=i[15];return r[0]=a*A+o*T+l*I+c*Y,r[4]=a*C+o*F+l*O+c*$,r[8]=a*B+o*V+l*k+c*j,r[12]=a*y+o*nt+l*Z+c*it,r[1]=h*A+u*T+d*I+p*Y,r[5]=h*C+u*F+d*O+p*$,r[9]=h*B+u*V+d*k+p*j,r[13]=h*y+u*nt+d*Z+p*it,r[2]=g*A+_*T+m*I+f*Y,r[6]=g*C+_*F+m*O+f*$,r[10]=g*B+_*V+m*k+f*j,r[14]=g*y+_*nt+m*Z+f*it,r[3]=M*A+v*T+S*I+L*Y,r[7]=M*C+v*F+S*O+L*$,r[11]=M*B+v*V+S*k+L*j,r[15]=M*y+v*nt+S*Z+L*it,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],i=t[8],r=t[12],a=t[1],o=t[5],l=t[9],c=t[13],h=t[2],u=t[6],d=t[10],p=t[14],g=t[3],_=t[7],m=t[11],f=t[15];return g*(+r*l*u-i*c*u-r*o*d+n*c*d+i*o*p-n*l*p)+_*(+e*l*p-e*c*d+r*a*d-i*a*p+i*c*h-r*l*h)+m*(+e*c*u-e*o*p-r*a*u+n*a*p+r*o*h-n*c*h)+f*(-i*o*h-e*l*u+e*o*d+i*a*u-n*a*d+n*l*h)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const i=this.elements;return t.isVector3?(i[12]=t.x,i[13]=t.y,i[14]=t.z):(i[12]=t,i[13]=e,i[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=t[9],d=t[10],p=t[11],g=t[12],_=t[13],m=t[14],f=t[15],M=u*m*c-_*d*c+_*l*p-o*m*p-u*l*f+o*d*f,v=g*d*c-h*m*c-g*l*p+a*m*p+h*l*f-a*d*f,S=h*_*c-g*u*c+g*o*p-a*_*p-h*o*f+a*u*f,L=g*u*l-h*_*l-g*o*d+a*_*d+h*o*m-a*u*m,A=e*M+n*v+i*S+r*L;if(A===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const C=1/A;return t[0]=M*C,t[1]=(_*d*r-u*m*r-_*i*p+n*m*p+u*i*f-n*d*f)*C,t[2]=(o*m*r-_*l*r+_*i*c-n*m*c-o*i*f+n*l*f)*C,t[3]=(u*l*r-o*d*r-u*i*c+n*d*c+o*i*p-n*l*p)*C,t[4]=v*C,t[5]=(h*m*r-g*d*r+g*i*p-e*m*p-h*i*f+e*d*f)*C,t[6]=(g*l*r-a*m*r-g*i*c+e*m*c+a*i*f-e*l*f)*C,t[7]=(a*d*r-h*l*r+h*i*c-e*d*c-a*i*p+e*l*p)*C,t[8]=S*C,t[9]=(g*u*r-h*_*r-g*n*p+e*_*p+h*n*f-e*u*f)*C,t[10]=(a*_*r-g*o*r+g*n*c-e*_*c-a*n*f+e*o*f)*C,t[11]=(h*o*r-a*u*r-h*n*c+e*u*c+a*n*p-e*o*p)*C,t[12]=L*C,t[13]=(h*_*i-g*u*i+g*n*d-e*_*d-h*n*m+e*u*m)*C,t[14]=(g*o*i-a*_*i-g*n*l+e*_*l+a*n*m-e*o*m)*C,t[15]=(a*u*i-h*o*i+h*n*l-e*u*l-a*n*d+e*o*d)*C,this}scale(t){const e=this.elements,n=t.x,i=t.y,r=t.z;return e[0]*=n,e[4]*=i,e[8]*=r,e[1]*=n,e[5]*=i,e[9]*=r,e[2]*=n,e[6]*=i,e[10]*=r,e[3]*=n,e[7]*=i,e[11]*=r,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],i=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,i))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),i=Math.sin(e),r=1-n,a=t.x,o=t.y,l=t.z,c=r*a,h=r*o;return this.set(c*a+n,c*o-i*l,c*l+i*o,0,c*o+i*l,h*o+n,h*l-i*a,0,c*l-i*o,h*l+i*a,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,i,r,a){return this.set(1,n,r,0,t,1,a,0,e,i,1,0,0,0,0,1),this}compose(t,e,n){const i=this.elements,r=e._x,a=e._y,o=e._z,l=e._w,c=r+r,h=a+a,u=o+o,d=r*c,p=r*h,g=r*u,_=a*h,m=a*u,f=o*u,M=l*c,v=l*h,S=l*u,L=n.x,A=n.y,C=n.z;return i[0]=(1-(_+f))*L,i[1]=(p+S)*L,i[2]=(g-v)*L,i[3]=0,i[4]=(p-S)*A,i[5]=(1-(d+f))*A,i[6]=(m+M)*A,i[7]=0,i[8]=(g+v)*C,i[9]=(m-M)*C,i[10]=(1-(d+_))*C,i[11]=0,i[12]=t.x,i[13]=t.y,i[14]=t.z,i[15]=1,this}decompose(t,e,n){const i=this.elements;let r=ti.set(i[0],i[1],i[2]).length();const a=ti.set(i[4],i[5],i[6]).length(),o=ti.set(i[8],i[9],i[10]).length();this.determinant()<0&&(r=-r),t.x=i[12],t.y=i[13],t.z=i[14],je.copy(this);const c=1/r,h=1/a,u=1/o;return je.elements[0]*=c,je.elements[1]*=c,je.elements[2]*=c,je.elements[4]*=h,je.elements[5]*=h,je.elements[6]*=h,je.elements[8]*=u,je.elements[9]*=u,je.elements[10]*=u,e.setFromRotationMatrix(je),n.x=r,n.y=a,n.z=o,this}makePerspective(t,e,n,i,r,a,o=gn){const l=this.elements,c=2*r/(e-t),h=2*r/(n-i),u=(e+t)/(e-t),d=(n+i)/(n-i);let p,g;if(o===gn)p=-(a+r)/(a-r),g=-2*a*r/(a-r);else if(o===ks)p=-a/(a-r),g=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=h,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,n,i,r,a,o=gn){const l=this.elements,c=1/(e-t),h=1/(n-i),u=1/(a-r),d=(e+t)*c,p=(n+i)*h;let g,_;if(o===gn)g=(a+r)*u,_=-2*u;else if(o===ks)g=r*u,_=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-p,l[2]=0,l[6]=0,l[10]=_,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<16;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const ti=new R,je=new ne,Eh=new R(0,0,0),wh=new R(1,1,1),Sn=new R,us=new R,ze=new R,io=new ne,so=new Ci;class Zs{constructor(t=0,e=0,n=0,i=Zs.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=i}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,i=this._order){return this._x=t,this._y=e,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const i=t.elements,r=i[0],a=i[4],o=i[8],l=i[1],c=i[5],h=i[9],u=i[2],d=i[6],p=i[10];switch(e){case"XYZ":this._y=Math.asin(Se(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Se(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(Se(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Se(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,p),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Se(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-Se(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return io.makeRotationFromQuaternion(t),this.setFromRotationMatrix(io,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return so.setFromEuler(this),this.setFromQuaternion(so,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Zs.DEFAULT_ORDER="XYZ";class Ml{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let Th=0;const ro=new R,ei=new Ci,dn=new ne,ds=new R,Ui=new R,bh=new R,Ah=new Ci,ao=new R(1,0,0),oo=new R(0,1,0),lo=new R(0,0,1),Ch={type:"added"},Rh={type:"removed"};class ae extends Ai{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Th++}),this.uuid=on(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=ae.DEFAULT_UP.clone();const t=new R,e=new Zs,n=new Ci,i=new R(1,1,1);function r(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new ne},normalMatrix:{value:new Xt}}),this.matrix=new ne,this.matrixWorld=new ne,this.matrixAutoUpdate=ae.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=ae.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Ml,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return ei.setFromAxisAngle(t,e),this.quaternion.multiply(ei),this}rotateOnWorldAxis(t,e){return ei.setFromAxisAngle(t,e),this.quaternion.premultiply(ei),this}rotateX(t){return this.rotateOnAxis(ao,t)}rotateY(t){return this.rotateOnAxis(oo,t)}rotateZ(t){return this.rotateOnAxis(lo,t)}translateOnAxis(t,e){return ro.copy(t).applyQuaternion(this.quaternion),this.position.add(ro.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(ao,t)}translateY(t){return this.translateOnAxis(oo,t)}translateZ(t){return this.translateOnAxis(lo,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(dn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?ds.copy(t):ds.set(t,e,n);const i=this.parent;this.updateWorldMatrix(!0,!1),Ui.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?dn.lookAt(Ui,ds,this.up):dn.lookAt(ds,Ui,this.up),this.quaternion.setFromRotationMatrix(dn),i&&(dn.extractRotation(i.matrixWorld),ei.setFromRotationMatrix(dn),this.quaternion.premultiply(ei.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.parent!==null&&t.parent.remove(t),t.parent=this,this.children.push(t),t.dispatchEvent(Ch)):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Rh)),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),dn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),dn.multiply(t.parent.matrixWorld)),t.applyMatrix4(dn),this.add(t),t.updateWorldMatrix(!1,!0),this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,i=this.children.length;n<i;n++){const a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const i=this.children;for(let r=0,a=i.length;r<a;r++)i[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ui,t,bh),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ui,Ah,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,i=e.length;n<i;n++){const r=e[n];(r.matrixWorldAutoUpdate===!0||t===!0)&&r.updateMatrixWorld(t)}}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.matrixWorldAutoUpdate===!0&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),e===!0){const i=this.children;for(let r=0,a=i.length;r<a;r++){const o=i[r];o.matrixWorldAutoUpdate===!0&&o.updateWorldMatrix(!1,!0)}}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.visibility=this._visibility,i.active=this._active,i.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),i.maxGeometryCount=this._maxGeometryCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.geometryCount=this._geometryCount,i.matricesTexture=this._matricesTexture.toJSON(t),this.boundingSphere!==null&&(i.boundingSphere={center:i.boundingSphere.center.toArray(),radius:i.boundingSphere.radius}),this.boundingBox!==null&&(i.boundingBox={min:i.boundingBox.min.toArray(),max:i.boundingBox.max.toArray()}));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(t.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];r(t.shapes,u)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(t.materials,this.material[l]));i.material=o}else i.material=r(t.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];i.animations.push(r(t.animations,l))}}if(e){const o=a(t.geometries),l=a(t.materials),c=a(t.textures),h=a(t.images),u=a(t.shapes),d=a(t.skeletons),p=a(t.animations),g=a(t.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),p.length>0&&(n.animations=p),g.length>0&&(n.nodes=g)}return n.object=i,n;function a(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const i=t.children[n];this.add(i.clone())}return this}}ae.DEFAULT_UP=new R(0,1,0);ae.DEFAULT_MATRIX_AUTO_UPDATE=!0;ae.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Je=new R,fn=new R,_r=new R,pn=new R,ni=new R,ii=new R,co=new R,vr=new R,xr=new R,yr=new R;let fs=!1;class Xe{constructor(t=new R,e=new R,n=new R){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,i){i.subVectors(n,e),Je.subVectors(t,e),i.cross(Je);const r=i.lengthSq();return r>0?i.multiplyScalar(1/Math.sqrt(r)):i.set(0,0,0)}static getBarycoord(t,e,n,i,r){Je.subVectors(i,e),fn.subVectors(n,e),_r.subVectors(t,e);const a=Je.dot(Je),o=Je.dot(fn),l=Je.dot(_r),c=fn.dot(fn),h=fn.dot(_r),u=a*c-o*o;if(u===0)return r.set(0,0,0),null;const d=1/u,p=(c*l-o*h)*d,g=(a*h-o*l)*d;return r.set(1-p-g,g,p)}static containsPoint(t,e,n,i){return this.getBarycoord(t,e,n,i,pn)===null?!1:pn.x>=0&&pn.y>=0&&pn.x+pn.y<=1}static getUV(t,e,n,i,r,a,o,l){return fs===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),fs=!0),this.getInterpolation(t,e,n,i,r,a,o,l)}static getInterpolation(t,e,n,i,r,a,o,l){return this.getBarycoord(t,e,n,i,pn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,pn.x),l.addScaledVector(a,pn.y),l.addScaledVector(o,pn.z),l)}static isFrontFacing(t,e,n,i){return Je.subVectors(n,e),fn.subVectors(t,e),Je.cross(fn).dot(i)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,i){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[i]),this}setFromAttributeAndIndices(t,e,n,i){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,i),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Je.subVectors(this.c,this.b),fn.subVectors(this.a,this.b),Je.cross(fn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Xe.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return Xe.getBarycoord(t,this.a,this.b,this.c,e)}getUV(t,e,n,i,r){return fs===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),fs=!0),Xe.getInterpolation(t,this.a,this.b,this.c,e,n,i,r)}getInterpolation(t,e,n,i,r){return Xe.getInterpolation(t,this.a,this.b,this.c,e,n,i,r)}containsPoint(t){return Xe.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Xe.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,i=this.b,r=this.c;let a,o;ni.subVectors(i,n),ii.subVectors(r,n),vr.subVectors(t,n);const l=ni.dot(vr),c=ii.dot(vr);if(l<=0&&c<=0)return e.copy(n);xr.subVectors(t,i);const h=ni.dot(xr),u=ii.dot(xr);if(h>=0&&u<=h)return e.copy(i);const d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return a=l/(l-h),e.copy(n).addScaledVector(ni,a);yr.subVectors(t,r);const p=ni.dot(yr),g=ii.dot(yr);if(g>=0&&p<=g)return e.copy(r);const _=p*c-l*g;if(_<=0&&c>=0&&g<=0)return o=c/(c-g),e.copy(n).addScaledVector(ii,o);const m=h*g-p*u;if(m<=0&&u-h>=0&&p-g>=0)return co.subVectors(r,i),o=(u-h)/(u-h+(p-g)),e.copy(i).addScaledVector(co,o);const f=1/(m+_+d);return a=_*f,o=d*f,e.copy(n).addScaledVector(ni,a).addScaledVector(ii,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const Sl={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},En={h:0,s:0,l:0},ps={h:0,s:0,l:0};function Mr(s,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?s+(t-s)*6*e:e<1/2?t:e<2/3?s+(t-s)*6*(2/3-e):s}class Tt{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const i=t;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Me){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,jt.toWorkingColorSpace(this,e),this}setRGB(t,e,n,i=jt.workingColorSpace){return this.r=t,this.g=e,this.b=n,jt.toWorkingColorSpace(this,i),this}setHSL(t,e,n,i=jt.workingColorSpace){if(t=ea(t,1),e=Se(e,0,1),n=Se(n,0,1),e===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+e):n+e-n*e,a=2*n-r;this.r=Mr(a,r,t+1/3),this.g=Mr(a,r,t),this.b=Mr(a,r,t-1/3)}return jt.toWorkingColorSpace(this,i),this}setStyle(t,e=Me){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(t)){let r;const a=i[1],o=i[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=i[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Me){const n=Sl[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=yi(t.r),this.g=yi(t.g),this.b=yi(t.b),this}copyLinearToSRGB(t){return this.r=cr(t.r),this.g=cr(t.g),this.b=cr(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Me){return jt.fromWorkingColorSpace(be.copy(this),t),Math.round(Se(be.r*255,0,255))*65536+Math.round(Se(be.g*255,0,255))*256+Math.round(Se(be.b*255,0,255))}getHexString(t=Me){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=jt.workingColorSpace){jt.fromWorkingColorSpace(be.copy(this),e);const n=be.r,i=be.g,r=be.b,a=Math.max(n,i,r),o=Math.min(n,i,r);let l,c;const h=(o+a)/2;if(o===a)l=0,c=0;else{const u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case n:l=(i-r)/u+(i<r?6:0);break;case i:l=(r-n)/u+2;break;case r:l=(n-i)/u+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=jt.workingColorSpace){return jt.fromWorkingColorSpace(be.copy(this),e),t.r=be.r,t.g=be.g,t.b=be.b,t}getStyle(t=Me){jt.fromWorkingColorSpace(be.copy(this),t);const e=be.r,n=be.g,i=be.b;return t!==Me?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(t,e,n){return this.getHSL(En),this.setHSL(En.h+t,En.s+e,En.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(En),t.getHSL(ps);const n=ki(En.h,ps.h,e),i=ki(En.s,ps.s,e),r=ki(En.l,ps.l,e);return this.setHSL(n,i,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,i=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*i,this.g=r[1]*e+r[4]*n+r[7]*i,this.b=r[2]*e+r[5]*n+r[8]*i,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const be=new Tt;Tt.NAMES=Sl;let Ph=0;class vn extends Ai{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ph++}),this.uuid=on(),this.name="",this.type="Material",this.blending=Gn,this.side=Pn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Or,this.blendDst=Br,this.blendEquation=zn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Tt(0,0,0),this.blendAlpha=0,this.depthFunc=Bs,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=ja,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Zn,this.stencilZFail=Zn,this.stencilZPass=Zn,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBuild(){}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const i=this[e];if(i===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Gn&&(n.blending=this.blending),this.side!==Pn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Or&&(n.blendSrc=this.blendSrc),this.blendDst!==Br&&(n.blendDst=this.blendDst),this.blendEquation!==zn&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Bs&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==ja&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Zn&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Zn&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Zn&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(e){const r=i(t.textures),a=i(t.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const i=e.length;n=new Array(i);for(let r=0;r!==i;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}}class _e extends vn{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Tt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=sl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const ue=new R,ms=new rt;class Re{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=Vr,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.gpuType=Tn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}get updateRange(){return console.warn("THREE.BufferAttribute: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[t+i]=e.array[n+i];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)ms.fromBufferAttribute(this,e),ms.applyMatrix3(t),this.setXY(e,ms.x,ms.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)ue.fromBufferAttribute(this,e),ue.applyMatrix3(t),this.setXYZ(e,ue.x,ue.y,ue.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)ue.fromBufferAttribute(this,e),ue.applyMatrix4(t),this.setXYZ(e,ue.x,ue.y,ue.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)ue.fromBufferAttribute(this,e),ue.applyNormalMatrix(t),this.setXYZ(e,ue.x,ue.y,ue.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)ue.fromBufferAttribute(this,e),ue.transformDirection(t),this.setXYZ(e,ue.x,ue.y,ue.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=rn(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Zt(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=rn(e,this.array)),e}setX(t,e){return this.normalized&&(e=Zt(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=rn(e,this.array)),e}setY(t,e){return this.normalized&&(e=Zt(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=rn(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Zt(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=rn(e,this.array)),e}setW(t,e){return this.normalized&&(e=Zt(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Zt(e,this.array),n=Zt(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,i){return t*=this.itemSize,this.normalized&&(e=Zt(e,this.array),n=Zt(n,this.array),i=Zt(i,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this}setXYZW(t,e,n,i,r){return t*=this.itemSize,this.normalized&&(e=Zt(e,this.array),n=Zt(n,this.array),i=Zt(i,this.array),r=Zt(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Vr&&(t.usage=this.usage),t}}class El extends Re{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class wl extends Re{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class ie extends Re{constructor(t,e,n){super(new Float32Array(t),e,n)}}let Lh=0;const ke=new ne,Sr=new ae,si=new R,He=new $n,Ni=new $n,ge=new R;class Ee extends Ai{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Lh++}),this.uuid=on(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(gl(t)?wl:El)(t,1):this.index=t,this}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Xt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}const i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(t),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return ke.makeRotationFromQuaternion(t),this.applyMatrix4(ke),this}rotateX(t){return ke.makeRotationX(t),this.applyMatrix4(ke),this}rotateY(t){return ke.makeRotationY(t),this.applyMatrix4(ke),this}rotateZ(t){return ke.makeRotationZ(t),this.applyMatrix4(ke),this}translate(t,e,n){return ke.makeTranslation(t,e,n),this.applyMatrix4(ke),this}scale(t,e,n){return ke.makeScale(t,e,n),this.applyMatrix4(ke),this}lookAt(t){return Sr.lookAt(t),Sr.updateMatrix(),this.applyMatrix4(Sr.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(si).negate(),this.translate(si.x,si.y,si.z),this}setFromPoints(t){const e=[];for(let n=0,i=t.length;n<i;n++){const r=t[n];e.push(r.x,r.y,r.z||0)}return this.setAttribute("position",new ie(e,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new $n);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingBox.set(new R(-1/0,-1/0,-1/0),new R(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,i=e.length;n<i;n++){const r=e[n];He.setFromBufferAttribute(r),this.morphTargetsRelative?(ge.addVectors(this.boundingBox.min,He.min),this.boundingBox.expandByPoint(ge),ge.addVectors(this.boundingBox.max,He.max),this.boundingBox.expandByPoint(ge)):(this.boundingBox.expandByPoint(He.min),this.boundingBox.expandByPoint(He.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Ri);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingSphere.set(new R,1/0);return}if(t){const n=this.boundingSphere.center;if(He.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){const o=e[r];Ni.setFromBufferAttribute(o),this.morphTargetsRelative?(ge.addVectors(He.min,Ni.min),He.expandByPoint(ge),ge.addVectors(He.max,Ni.max),He.expandByPoint(ge)):(He.expandByPoint(Ni.min),He.expandByPoint(Ni.max))}He.getCenter(n);let i=0;for(let r=0,a=t.count;r<a;r++)ge.fromBufferAttribute(t,r),i=Math.max(i,n.distanceToSquared(ge));if(e)for(let r=0,a=e.length;r<a;r++){const o=e[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)ge.fromBufferAttribute(o,c),l&&(si.fromBufferAttribute(t,c),ge.add(si)),i=Math.max(i,n.distanceToSquared(ge))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.array,i=e.position.array,r=e.normal.array,a=e.uv.array,o=i.length/3;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Re(new Float32Array(4*o),4));const l=this.getAttribute("tangent").array,c=[],h=[];for(let T=0;T<o;T++)c[T]=new R,h[T]=new R;const u=new R,d=new R,p=new R,g=new rt,_=new rt,m=new rt,f=new R,M=new R;function v(T,F,V){u.fromArray(i,T*3),d.fromArray(i,F*3),p.fromArray(i,V*3),g.fromArray(a,T*2),_.fromArray(a,F*2),m.fromArray(a,V*2),d.sub(u),p.sub(u),_.sub(g),m.sub(g);const nt=1/(_.x*m.y-m.x*_.y);isFinite(nt)&&(f.copy(d).multiplyScalar(m.y).addScaledVector(p,-_.y).multiplyScalar(nt),M.copy(p).multiplyScalar(_.x).addScaledVector(d,-m.x).multiplyScalar(nt),c[T].add(f),c[F].add(f),c[V].add(f),h[T].add(M),h[F].add(M),h[V].add(M))}let S=this.groups;S.length===0&&(S=[{start:0,count:n.length}]);for(let T=0,F=S.length;T<F;++T){const V=S[T],nt=V.start,I=V.count;for(let O=nt,k=nt+I;O<k;O+=3)v(n[O+0],n[O+1],n[O+2])}const L=new R,A=new R,C=new R,B=new R;function y(T){C.fromArray(r,T*3),B.copy(C);const F=c[T];L.copy(F),L.sub(C.multiplyScalar(C.dot(F))).normalize(),A.crossVectors(B,F);const nt=A.dot(h[T])<0?-1:1;l[T*4]=L.x,l[T*4+1]=L.y,l[T*4+2]=L.z,l[T*4+3]=nt}for(let T=0,F=S.length;T<F;++T){const V=S[T],nt=V.start,I=V.count;for(let O=nt,k=nt+I;O<k;O+=3)y(n[O+0]),y(n[O+1]),y(n[O+2])}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Re(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,p=n.count;d<p;d++)n.setXYZ(d,0,0,0);const i=new R,r=new R,a=new R,o=new R,l=new R,c=new R,h=new R,u=new R;if(t)for(let d=0,p=t.count;d<p;d+=3){const g=t.getX(d+0),_=t.getX(d+1),m=t.getX(d+2);i.fromBufferAttribute(e,g),r.fromBufferAttribute(e,_),a.fromBufferAttribute(e,m),h.subVectors(a,r),u.subVectors(i,r),h.cross(u),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,_),c.fromBufferAttribute(n,m),o.add(h),l.add(h),c.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(_,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,p=e.count;d<p;d+=3)i.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),a.fromBufferAttribute(e,d+2),h.subVectors(a,r),u.subVectors(i,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)ge.fromBufferAttribute(t,e),ge.normalize(),t.setXYZ(e,ge.x,ge.y,ge.z)}toNonIndexed(){function t(o,l){const c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h);let p=0,g=0;for(let _=0,m=l.length;_<m;_++){o.isInterleavedBufferAttribute?p=l[_]*o.data.stride+o.offset:p=l[_]*h;for(let f=0;f<h;f++)d[g++]=c[p++]}return new Re(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new Ee,n=this.index.array,i=this.attributes;for(const o in i){const l=i[o],c=t(l,n);e.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let h=0,u=c.length;h<u;h++){const d=c[h],p=t(d,n);l.push(p)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const l in n){const c=n[l];t.data.attributes[l]=c.toJSON(t.data)}const i={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){const p=c[u];h.push(p.toJSON(t.data))}h.length>0&&(i[l]=h,r=!0)}r&&(t.data.morphAttributes=i,t.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(t.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone(e));const i=t.attributes;for(const c in i){const h=i[c];this.setAttribute(c,h.clone(e))}const r=t.morphAttributes;for(const c in r){const h=[],u=r[c];for(let d=0,p=u.length;d<p;d++)h.push(u[d].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;const a=t.groups;for(let c=0,h=a.length;c<h;c++){const u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}const o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const ho=new ne,Nn=new yl,gs=new Ri,uo=new R,ri=new R,ai=new R,oi=new R,Er=new R,_s=new R,vs=new rt,xs=new rt,ys=new rt,fo=new R,po=new R,mo=new R,Ms=new R,Ss=new R;class ot extends ae{constructor(t=new Ee,e=new _e){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){const n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(i,t);const o=this.morphTargetInfluences;if(r&&o){_s.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const h=o[l],u=r[l];h!==0&&(Er.fromBufferAttribute(u,t),a?_s.addScaledVector(Er,h):_s.addScaledVector(Er.sub(e),h))}e.add(_s)}return e}raycast(t,e){const n=this.geometry,i=this.material,r=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),gs.copy(n.boundingSphere),gs.applyMatrix4(r),Nn.copy(t.ray).recast(t.near),!(gs.containsPoint(Nn.origin)===!1&&(Nn.intersectSphere(gs,uo)===null||Nn.origin.distanceToSquared(uo)>(t.far-t.near)**2))&&(ho.copy(r).invert(),Nn.copy(t.ray).applyMatrix4(ho),!(n.boundingBox!==null&&Nn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Nn)))}_computeIntersections(t,e,n){let i;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,p=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,_=d.length;g<_;g++){const m=d[g],f=a[m.materialIndex],M=Math.max(m.start,p.start),v=Math.min(o.count,Math.min(m.start+m.count,p.start+p.count));for(let S=M,L=v;S<L;S+=3){const A=o.getX(S),C=o.getX(S+1),B=o.getX(S+2);i=Es(this,f,t,n,c,h,u,A,C,B),i&&(i.faceIndex=Math.floor(S/3),i.face.materialIndex=m.materialIndex,e.push(i))}}else{const g=Math.max(0,p.start),_=Math.min(o.count,p.start+p.count);for(let m=g,f=_;m<f;m+=3){const M=o.getX(m),v=o.getX(m+1),S=o.getX(m+2);i=Es(this,a,t,n,c,h,u,M,v,S),i&&(i.faceIndex=Math.floor(m/3),e.push(i))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,_=d.length;g<_;g++){const m=d[g],f=a[m.materialIndex],M=Math.max(m.start,p.start),v=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let S=M,L=v;S<L;S+=3){const A=S,C=S+1,B=S+2;i=Es(this,f,t,n,c,h,u,A,C,B),i&&(i.faceIndex=Math.floor(S/3),i.face.materialIndex=m.materialIndex,e.push(i))}}else{const g=Math.max(0,p.start),_=Math.min(l.count,p.start+p.count);for(let m=g,f=_;m<f;m+=3){const M=m,v=m+1,S=m+2;i=Es(this,a,t,n,c,h,u,M,v,S),i&&(i.faceIndex=Math.floor(m/3),e.push(i))}}}}function Dh(s,t,e,n,i,r,a,o){let l;if(t.side===Fe?l=n.intersectTriangle(a,r,i,!0,o):l=n.intersectTriangle(i,r,a,t.side===Pn,o),l===null)return null;Ss.copy(o),Ss.applyMatrix4(s.matrixWorld);const c=e.ray.origin.distanceTo(Ss);return c<e.near||c>e.far?null:{distance:c,point:Ss.clone(),object:s}}function Es(s,t,e,n,i,r,a,o,l,c){s.getVertexPosition(o,ri),s.getVertexPosition(l,ai),s.getVertexPosition(c,oi);const h=Dh(s,t,e,n,ri,ai,oi,Ms);if(h){i&&(vs.fromBufferAttribute(i,o),xs.fromBufferAttribute(i,l),ys.fromBufferAttribute(i,c),h.uv=Xe.getInterpolation(Ms,ri,ai,oi,vs,xs,ys,new rt)),r&&(vs.fromBufferAttribute(r,o),xs.fromBufferAttribute(r,l),ys.fromBufferAttribute(r,c),h.uv1=Xe.getInterpolation(Ms,ri,ai,oi,vs,xs,ys,new rt),h.uv2=h.uv1),a&&(fo.fromBufferAttribute(a,o),po.fromBufferAttribute(a,l),mo.fromBufferAttribute(a,c),h.normal=Xe.getInterpolation(Ms,ri,ai,oi,fo,po,mo,new R),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const u={a:o,b:l,c,normal:new R,materialIndex:0};Xe.getNormal(ri,ai,oi,u.normal),h.face=u}return h}class $e extends Ee{constructor(t=1,e=1,n=1,i=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:i,heightSegments:r,depthSegments:a};const o=this;i=Math.floor(i),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],h=[],u=[];let d=0,p=0;g("z","y","x",-1,-1,n,e,t,a,r,0),g("z","y","x",1,-1,n,e,-t,a,r,1),g("x","z","y",1,1,t,n,e,i,a,2),g("x","z","y",1,-1,t,n,-e,i,a,3),g("x","y","z",1,-1,t,e,n,i,r,4),g("x","y","z",-1,-1,t,e,-n,i,r,5),this.setIndex(l),this.setAttribute("position",new ie(c,3)),this.setAttribute("normal",new ie(h,3)),this.setAttribute("uv",new ie(u,2));function g(_,m,f,M,v,S,L,A,C,B,y){const T=S/C,F=L/B,V=S/2,nt=L/2,I=A/2,O=C+1,k=B+1;let Z=0,Y=0;const $=new R;for(let j=0;j<k;j++){const it=j*F-nt;for(let at=0;at<O;at++){const W=at*T-V;$[_]=W*M,$[m]=it*v,$[f]=I,c.push($.x,$.y,$.z),$[_]=0,$[m]=0,$[f]=A>0?1:-1,h.push($.x,$.y,$.z),u.push(at/C),u.push(1-j/B),Z+=1}}for(let j=0;j<B;j++)for(let it=0;it<C;it++){const at=d+it+O*j,W=d+it+O*(j+1),K=d+(it+1)+O*(j+1),pt=d+(it+1)+O*j;l.push(at,W,pt),l.push(W,K,pt),Y+=6}o.addGroup(p,Y,y),p+=Y,d+=Z}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new $e(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function bi(s){const t={};for(const e in s){t[e]={};for(const n in s[e]){const i=s[e][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=i.clone():Array.isArray(i)?t[e][n]=i.slice():t[e][n]=i}}return t}function Ie(s){const t={};for(let e=0;e<s.length;e++){const n=bi(s[e]);for(const i in n)t[i]=n[i]}return t}function Ih(s){const t=[];for(let e=0;e<s.length;e++)t.push(s[e].clone());return t}function Tl(s){return s.getRenderTarget()===null?s.outputColorSpace:jt.workingColorSpace}const Uh={clone:bi,merge:Ie};var Nh=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Fh=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class qn extends vn{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Nh,this.fragmentShader=Fh,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1,clipCullDistance:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=bi(t.uniforms),this.uniformsGroups=Ih(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const i in this.uniforms){const a=this.uniforms[i].value;a&&a.isTexture?e.uniforms[i]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[i]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[i]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[i]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[i]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[i]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[i]={type:"m4",value:a.toArray()}:e.uniforms[i]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class bl extends ae{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ne,this.projectionMatrix=new ne,this.projectionMatrixInverse=new ne,this.coordinateSystem=gn}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}class qe extends bl{constructor(t=50,e=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=ji*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(Gi*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return ji*2*Math.atan(Math.tan(Gi*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}setViewOffset(t,e,n,i,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(Gi*.5*this.fov)/this.zoom,n=2*e,i=this.aspect*n,r=-.5*i;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*i/l,e-=a.offsetY*n/c,i*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const li=-90,ci=1;class Oh extends ae{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const i=new qe(li,ci,t,e);i.layers=this.layers,this.add(i);const r=new qe(li,ci,t,e);r.layers=this.layers,this.add(r);const a=new qe(li,ci,t,e);a.layers=this.layers,this.add(a);const o=new qe(li,ci,t,e);o.layers=this.layers,this.add(o);const l=new qe(li,ci,t,e);l.layers=this.layers,this.add(l);const c=new qe(li,ci,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,i,r,a,o,l]=e;for(const c of e)this.remove(c);if(t===gn)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===ks)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,h]=this.children,u=t.getRenderTarget(),d=t.getActiveCubeFace(),p=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;const _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,i),t.render(e,r),t.setRenderTarget(n,1,i),t.render(e,a),t.setRenderTarget(n,2,i),t.render(e,o),t.setRenderTarget(n,3,i),t.render(e,l),t.setRenderTarget(n,4,i),t.render(e,c),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,i),t.render(e,h),t.setRenderTarget(u,d,p),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class Al extends Oe{constructor(t,e,n,i,r,a,o,l,c,h){t=t!==void 0?t:[],e=e!==void 0?e:Ei,super(t,e,n,i,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class Bh extends Xn{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},i=[n,n,n,n,n,n];e.encoding!==void 0&&(Vi("THREE.WebGLCubeRenderTarget: option.encoding has been replaced by option.colorSpace."),e.colorSpace=e.encoding===Wn?Me:Ye),this.texture=new Al(i,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:We}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new $e(5,5,5),r=new qn({name:"CubemapFromEquirect",uniforms:bi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Fe,blending:bn});r.uniforms.tEquirect.value=e;const a=new ot(i,r),o=e.minFilter;return e.minFilter===$i&&(e.minFilter=We),new Oh(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e,n,i){const r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,i);t.setRenderTarget(r)}}const wr=new R,zh=new R,Hh=new Xt;class On{constructor(t=new R(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,i){return this.normal.set(t,e,n),this.constant=i,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const i=wr.subVectors(n,e).cross(zh.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(i,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta(wr),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const r=-(t.start.dot(this.normal)+this.constant)/i;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||Hh.getNormalMatrix(t),i=this.coplanarPoint(wr).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Fn=new Ri,ws=new R;class na{constructor(t=new On,e=new On,n=new On,i=new On,r=new On,a=new On){this.planes=[t,e,n,i,r,a]}set(t,e,n,i,r,a){const o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(i),o[4].copy(r),o[5].copy(a),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=gn){const n=this.planes,i=t.elements,r=i[0],a=i[1],o=i[2],l=i[3],c=i[4],h=i[5],u=i[6],d=i[7],p=i[8],g=i[9],_=i[10],m=i[11],f=i[12],M=i[13],v=i[14],S=i[15];if(n[0].setComponents(l-r,d-c,m-p,S-f).normalize(),n[1].setComponents(l+r,d+c,m+p,S+f).normalize(),n[2].setComponents(l+a,d+h,m+g,S+M).normalize(),n[3].setComponents(l-a,d-h,m-g,S-M).normalize(),n[4].setComponents(l-o,d-u,m-_,S-v).normalize(),e===gn)n[5].setComponents(l+o,d+u,m+_,S+v).normalize();else if(e===ks)n[5].setComponents(o,u,_,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Fn.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Fn.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Fn)}intersectsSprite(t){return Fn.center.set(0,0,0),Fn.radius=.7071067811865476,Fn.applyMatrix4(t.matrixWorld),this.intersectsSphere(Fn)}intersectsSphere(t){const e=this.planes,n=t.center,i=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const i=e[n];if(ws.x=i.normal.x>0?t.max.x:t.min.x,ws.y=i.normal.y>0?t.max.y:t.min.y,ws.z=i.normal.z>0?t.max.z:t.min.z,i.distanceToPoint(ws)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Cl(){let s=null,t=!1,e=null,n=null;function i(r,a){e(r,a),n=s.requestAnimationFrame(i)}return{start:function(){t!==!0&&e!==null&&(n=s.requestAnimationFrame(i),t=!0)},stop:function(){s.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){s=r}}}function Gh(s,t){const e=t.isWebGL2,n=new WeakMap;function i(c,h){const u=c.array,d=c.usage,p=u.byteLength,g=s.createBuffer();s.bindBuffer(h,g),s.bufferData(h,u,d),c.onUploadCallback();let _;if(u instanceof Float32Array)_=s.FLOAT;else if(u instanceof Uint16Array)if(c.isFloat16BufferAttribute)if(e)_=s.HALF_FLOAT;else throw new Error("THREE.WebGLAttributes: Usage of Float16BufferAttribute requires WebGL2.");else _=s.UNSIGNED_SHORT;else if(u instanceof Int16Array)_=s.SHORT;else if(u instanceof Uint32Array)_=s.UNSIGNED_INT;else if(u instanceof Int32Array)_=s.INT;else if(u instanceof Int8Array)_=s.BYTE;else if(u instanceof Uint8Array)_=s.UNSIGNED_BYTE;else if(u instanceof Uint8ClampedArray)_=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+u);return{buffer:g,type:_,bytesPerElement:u.BYTES_PER_ELEMENT,version:c.version,size:p}}function r(c,h,u){const d=h.array,p=h._updateRange,g=h.updateRanges;if(s.bindBuffer(u,c),p.count===-1&&g.length===0&&s.bufferSubData(u,0,d),g.length!==0){for(let _=0,m=g.length;_<m;_++){const f=g[_];e?s.bufferSubData(u,f.start*d.BYTES_PER_ELEMENT,d,f.start,f.count):s.bufferSubData(u,f.start*d.BYTES_PER_ELEMENT,d.subarray(f.start,f.start+f.count))}h.clearUpdateRanges()}p.count!==-1&&(e?s.bufferSubData(u,p.offset*d.BYTES_PER_ELEMENT,d,p.offset,p.count):s.bufferSubData(u,p.offset*d.BYTES_PER_ELEMENT,d.subarray(p.offset,p.offset+p.count)),p.count=-1),h.onUploadCallback()}function a(c){return c.isInterleavedBufferAttribute&&(c=c.data),n.get(c)}function o(c){c.isInterleavedBufferAttribute&&(c=c.data);const h=n.get(c);h&&(s.deleteBuffer(h.buffer),n.delete(c))}function l(c,h){if(c.isGLBufferAttribute){const d=n.get(c);(!d||d.version<c.version)&&n.set(c,{buffer:c.buffer,type:c.type,bytesPerElement:c.elementSize,version:c.version});return}c.isInterleavedBufferAttribute&&(c=c.data);const u=n.get(c);if(u===void 0)n.set(c,i(c,h));else if(u.version<c.version){if(u.size!==c.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");r(u.buffer,c,h),u.version=c.version}}return{get:a,remove:o,update:l}}class Ae extends Ee{constructor(t=1,e=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:i};const r=t/2,a=e/2,o=Math.floor(n),l=Math.floor(i),c=o+1,h=l+1,u=t/o,d=e/l,p=[],g=[],_=[],m=[];for(let f=0;f<h;f++){const M=f*d-a;for(let v=0;v<c;v++){const S=v*u-r;g.push(S,-M,0),_.push(0,0,1),m.push(v/o),m.push(1-f/l)}}for(let f=0;f<l;f++)for(let M=0;M<o;M++){const v=M+c*f,S=M+c*(f+1),L=M+1+c*(f+1),A=M+1+c*f;p.push(v,S,A),p.push(S,L,A)}this.setIndex(p),this.setAttribute("position",new ie(g,3)),this.setAttribute("normal",new ie(_,3)),this.setAttribute("uv",new ie(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ae(t.width,t.height,t.widthSegments,t.heightSegments)}}var kh=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Vh=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Wh=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Xh=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,qh=`#ifdef USE_ALPHATEST
	if ( diffuseColor.a < alphaTest ) discard;
#endif`,Yh=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,$h=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Zh=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,jh=`#ifdef USE_BATCHING
	attribute float batchId;
	uniform highp sampler2D batchingTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Jh=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( batchId );
#endif`,Kh=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Qh=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,tu=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,eu=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,nu=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,iu=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#pragma unroll_loop_start
	for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
		plane = clippingPlanes[ i ];
		if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
	}
	#pragma unroll_loop_end
	#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
		bool clipped = true;
		#pragma unroll_loop_start
		for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
		}
		#pragma unroll_loop_end
		if ( clipped ) discard;
	#endif
#endif`,su=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,ru=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,au=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,ou=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,lu=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,cu=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,hu=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,uu=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
float luminance( const in vec3 rgb ) {
	const vec3 weights = vec3( 0.2126729, 0.7151522, 0.0721750 );
	return dot( weights, rgb );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,du=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,fu=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,pu=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,mu=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,gu=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,_u=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,vu="gl_FragColor = linearToOutputTexel( gl_FragColor );",xu=`
const mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(
	vec3( 0.8224621, 0.177538, 0.0 ),
	vec3( 0.0331941, 0.9668058, 0.0 ),
	vec3( 0.0170827, 0.0723974, 0.9105199 )
);
const mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(
	vec3( 1.2249401, - 0.2249404, 0.0 ),
	vec3( - 0.0420569, 1.0420571, 0.0 ),
	vec3( - 0.0196376, - 0.0786361, 1.0982735 )
);
vec4 LinearSRGBToLinearDisplayP3( in vec4 value ) {
	return vec4( value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a );
}
vec4 LinearDisplayP3ToLinearSRGB( in vec4 value ) {
	return vec4( value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a );
}
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 LinearToLinear( in vec4 value ) {
	return value;
}
vec4 LinearTosRGB( in vec4 value ) {
	return sRGBTransferOETF( value );
}`,yu=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,Mu=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Su=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Eu=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,wu=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Tu=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,bu=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Au=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Cu=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Ru=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Pu=`#ifdef USE_LIGHTMAP
	vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
	vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
	reflectedLight.indirectDiffuse += lightMapIrradiance;
#endif`,Lu=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Du=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Iu=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Uu=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	#if defined ( LEGACY_LIGHTS )
		if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
			return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );
		}
		return 1.0;
	#else
		float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
		if ( cutoffDistance > 0.0 ) {
			distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
		}
		return distanceFalloff;
	#endif
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Nu=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Fu=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Ou=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Bu=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,zu=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Hu=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Gu=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,ku=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Vu=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Wu=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Xu=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,qu=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Yu=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
		varying float vIsPerspective;
	#else
		uniform float logDepthBufFC;
	#endif
#endif`,$u=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
	#else
		if ( isPerspectiveMatrix( projectionMatrix ) ) {
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		}
	#endif
#endif`,Zu=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
	
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,ju=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Ju=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Ku=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Qu=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,td=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,ed=`#if defined( USE_MORPHCOLORS ) && defined( MORPHTARGETS_TEXTURE )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,nd=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
	#endif
#endif`,id=`#ifdef USE_MORPHTARGETS
	uniform float morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
		uniform sampler2DArray morphTargetsTexture;
		uniform ivec2 morphTargetsTextureSize;
		vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
			int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
			int y = texelIndex / morphTargetsTextureSize.x;
			int x = texelIndex - y * morphTargetsTextureSize.x;
			ivec3 morphUV = ivec3( x, y, morphTargetIndex );
			return texelFetch( morphTargetsTexture, morphUV, 0 );
		}
	#else
		#ifndef USE_MORPHNORMALS
			uniform float morphTargetInfluences[ 8 ];
		#else
			uniform float morphTargetInfluences[ 4 ];
		#endif
	#endif
#endif`,sd=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		transformed += morphTarget0 * morphTargetInfluences[ 0 ];
		transformed += morphTarget1 * morphTargetInfluences[ 1 ];
		transformed += morphTarget2 * morphTargetInfluences[ 2 ];
		transformed += morphTarget3 * morphTargetInfluences[ 3 ];
		#ifndef USE_MORPHNORMALS
			transformed += morphTarget4 * morphTargetInfluences[ 4 ];
			transformed += morphTarget5 * morphTargetInfluences[ 5 ];
			transformed += morphTarget6 * morphTargetInfluences[ 6 ];
			transformed += morphTarget7 * morphTargetInfluences[ 7 ];
		#endif
	#endif
#endif`,rd=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,ad=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,od=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,ld=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,cd=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,hd=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,ud=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,dd=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,fd=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,pd=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,md=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,gd=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;
const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );
const float ShiftRight8 = 1. / 256.;
vec4 packDepthToRGBA( const in float v ) {
	vec4 r = vec4( fract( v * PackFactors ), v );
	r.yzw -= r.xyz * ShiftRight8;	return r * PackUpscale;
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors );
}
vec2 packDepthToRG( in highp float v ) {
	return packDepthToRGBA( v ).yx;
}
float unpackRGToDepth( const in highp vec2 v ) {
	return unpackRGBAToDepth( vec4( v.xy, 0.0, 0.0 ) );
}
vec4 pack2HalfToRGBA( vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,_d=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,vd=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,xd=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,yd=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Md=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Sd=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Ed=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return shadow;
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
		vec3 lightToPosition = shadowCoord.xyz;
		float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );		dp += shadowBias;
		vec3 bd3D = normalize( lightToPosition );
		#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
			vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
			return (
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
			) * ( 1.0 / 9.0 );
		#else
			return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
		#endif
	}
#endif`,wd=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Td=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,bd=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Ad=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Cd=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Rd=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Pd=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Ld=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Dd=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Id=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Ud=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 OptimizedCineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color *= toneMappingExposure;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	return color;
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Nd=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Fd=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
		vec3 refractedRayExit = position + transmissionRay;
		vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
		vec2 refractionCoords = ndcPos.xy / ndcPos.w;
		refractionCoords += 1.0;
		refractionCoords /= 2.0;
		vec4 transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
		vec3 transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Od=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Bd=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,zd=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Hd=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Gd=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,kd=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Vd=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Wd=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Xd=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,qd=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Yd=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,$d=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#endif
}`,Zd=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,jd=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,Jd=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Kd=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Qd=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,tf=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,ef=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,nf=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,sf=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,rf=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,af=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,of=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,lf=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,cf=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), opacity );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,hf=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,uf=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,df=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,ff=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,pf=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,mf=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,gf=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,_f=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,vf=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,xf=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,yf=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec2 scale;
	scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
	scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Mf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Gt={alphahash_fragment:kh,alphahash_pars_fragment:Vh,alphamap_fragment:Wh,alphamap_pars_fragment:Xh,alphatest_fragment:qh,alphatest_pars_fragment:Yh,aomap_fragment:$h,aomap_pars_fragment:Zh,batching_pars_vertex:jh,batching_vertex:Jh,begin_vertex:Kh,beginnormal_vertex:Qh,bsdfs:tu,iridescence_fragment:eu,bumpmap_pars_fragment:nu,clipping_planes_fragment:iu,clipping_planes_pars_fragment:su,clipping_planes_pars_vertex:ru,clipping_planes_vertex:au,color_fragment:ou,color_pars_fragment:lu,color_pars_vertex:cu,color_vertex:hu,common:uu,cube_uv_reflection_fragment:du,defaultnormal_vertex:fu,displacementmap_pars_vertex:pu,displacementmap_vertex:mu,emissivemap_fragment:gu,emissivemap_pars_fragment:_u,colorspace_fragment:vu,colorspace_pars_fragment:xu,envmap_fragment:yu,envmap_common_pars_fragment:Mu,envmap_pars_fragment:Su,envmap_pars_vertex:Eu,envmap_physical_pars_fragment:Nu,envmap_vertex:wu,fog_vertex:Tu,fog_pars_vertex:bu,fog_fragment:Au,fog_pars_fragment:Cu,gradientmap_pars_fragment:Ru,lightmap_fragment:Pu,lightmap_pars_fragment:Lu,lights_lambert_fragment:Du,lights_lambert_pars_fragment:Iu,lights_pars_begin:Uu,lights_toon_fragment:Fu,lights_toon_pars_fragment:Ou,lights_phong_fragment:Bu,lights_phong_pars_fragment:zu,lights_physical_fragment:Hu,lights_physical_pars_fragment:Gu,lights_fragment_begin:ku,lights_fragment_maps:Vu,lights_fragment_end:Wu,logdepthbuf_fragment:Xu,logdepthbuf_pars_fragment:qu,logdepthbuf_pars_vertex:Yu,logdepthbuf_vertex:$u,map_fragment:Zu,map_pars_fragment:ju,map_particle_fragment:Ju,map_particle_pars_fragment:Ku,metalnessmap_fragment:Qu,metalnessmap_pars_fragment:td,morphcolor_vertex:ed,morphnormal_vertex:nd,morphtarget_pars_vertex:id,morphtarget_vertex:sd,normal_fragment_begin:rd,normal_fragment_maps:ad,normal_pars_fragment:od,normal_pars_vertex:ld,normal_vertex:cd,normalmap_pars_fragment:hd,clearcoat_normal_fragment_begin:ud,clearcoat_normal_fragment_maps:dd,clearcoat_pars_fragment:fd,iridescence_pars_fragment:pd,opaque_fragment:md,packing:gd,premultiplied_alpha_fragment:_d,project_vertex:vd,dithering_fragment:xd,dithering_pars_fragment:yd,roughnessmap_fragment:Md,roughnessmap_pars_fragment:Sd,shadowmap_pars_fragment:Ed,shadowmap_pars_vertex:wd,shadowmap_vertex:Td,shadowmask_pars_fragment:bd,skinbase_vertex:Ad,skinning_pars_vertex:Cd,skinning_vertex:Rd,skinnormal_vertex:Pd,specularmap_fragment:Ld,specularmap_pars_fragment:Dd,tonemapping_fragment:Id,tonemapping_pars_fragment:Ud,transmission_fragment:Nd,transmission_pars_fragment:Fd,uv_pars_fragment:Od,uv_pars_vertex:Bd,uv_vertex:zd,worldpos_vertex:Hd,background_vert:Gd,background_frag:kd,backgroundCube_vert:Vd,backgroundCube_frag:Wd,cube_vert:Xd,cube_frag:qd,depth_vert:Yd,depth_frag:$d,distanceRGBA_vert:Zd,distanceRGBA_frag:jd,equirect_vert:Jd,equirect_frag:Kd,linedashed_vert:Qd,linedashed_frag:tf,meshbasic_vert:ef,meshbasic_frag:nf,meshlambert_vert:sf,meshlambert_frag:rf,meshmatcap_vert:af,meshmatcap_frag:of,meshnormal_vert:lf,meshnormal_frag:cf,meshphong_vert:hf,meshphong_frag:uf,meshphysical_vert:df,meshphysical_frag:ff,meshtoon_vert:pf,meshtoon_frag:mf,points_vert:gf,points_frag:_f,shadow_vert:vf,shadow_frag:xf,sprite_vert:yf,sprite_frag:Mf},ht={common:{diffuse:{value:new Tt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Xt},alphaMap:{value:null},alphaMapTransform:{value:new Xt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Xt}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Xt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Xt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Xt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Xt},normalScale:{value:new rt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Xt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Xt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Xt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Xt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Tt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Tt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Xt},alphaTest:{value:0},uvTransform:{value:new Xt}},sprite:{diffuse:{value:new Tt(16777215)},opacity:{value:1},center:{value:new rt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Xt},alphaMap:{value:null},alphaMapTransform:{value:new Xt},alphaTest:{value:0}}},sn={basic:{uniforms:Ie([ht.common,ht.specularmap,ht.envmap,ht.aomap,ht.lightmap,ht.fog]),vertexShader:Gt.meshbasic_vert,fragmentShader:Gt.meshbasic_frag},lambert:{uniforms:Ie([ht.common,ht.specularmap,ht.envmap,ht.aomap,ht.lightmap,ht.emissivemap,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.fog,ht.lights,{emissive:{value:new Tt(0)}}]),vertexShader:Gt.meshlambert_vert,fragmentShader:Gt.meshlambert_frag},phong:{uniforms:Ie([ht.common,ht.specularmap,ht.envmap,ht.aomap,ht.lightmap,ht.emissivemap,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.fog,ht.lights,{emissive:{value:new Tt(0)},specular:{value:new Tt(1118481)},shininess:{value:30}}]),vertexShader:Gt.meshphong_vert,fragmentShader:Gt.meshphong_frag},standard:{uniforms:Ie([ht.common,ht.envmap,ht.aomap,ht.lightmap,ht.emissivemap,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.roughnessmap,ht.metalnessmap,ht.fog,ht.lights,{emissive:{value:new Tt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Gt.meshphysical_vert,fragmentShader:Gt.meshphysical_frag},toon:{uniforms:Ie([ht.common,ht.aomap,ht.lightmap,ht.emissivemap,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.gradientmap,ht.fog,ht.lights,{emissive:{value:new Tt(0)}}]),vertexShader:Gt.meshtoon_vert,fragmentShader:Gt.meshtoon_frag},matcap:{uniforms:Ie([ht.common,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.fog,{matcap:{value:null}}]),vertexShader:Gt.meshmatcap_vert,fragmentShader:Gt.meshmatcap_frag},points:{uniforms:Ie([ht.points,ht.fog]),vertexShader:Gt.points_vert,fragmentShader:Gt.points_frag},dashed:{uniforms:Ie([ht.common,ht.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Gt.linedashed_vert,fragmentShader:Gt.linedashed_frag},depth:{uniforms:Ie([ht.common,ht.displacementmap]),vertexShader:Gt.depth_vert,fragmentShader:Gt.depth_frag},normal:{uniforms:Ie([ht.common,ht.bumpmap,ht.normalmap,ht.displacementmap,{opacity:{value:1}}]),vertexShader:Gt.meshnormal_vert,fragmentShader:Gt.meshnormal_frag},sprite:{uniforms:Ie([ht.sprite,ht.fog]),vertexShader:Gt.sprite_vert,fragmentShader:Gt.sprite_frag},background:{uniforms:{uvTransform:{value:new Xt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Gt.background_vert,fragmentShader:Gt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1}},vertexShader:Gt.backgroundCube_vert,fragmentShader:Gt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Gt.cube_vert,fragmentShader:Gt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Gt.equirect_vert,fragmentShader:Gt.equirect_frag},distanceRGBA:{uniforms:Ie([ht.common,ht.displacementmap,{referencePosition:{value:new R},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Gt.distanceRGBA_vert,fragmentShader:Gt.distanceRGBA_frag},shadow:{uniforms:Ie([ht.lights,ht.fog,{color:{value:new Tt(0)},opacity:{value:1}}]),vertexShader:Gt.shadow_vert,fragmentShader:Gt.shadow_frag}};sn.physical={uniforms:Ie([sn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Xt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Xt},clearcoatNormalScale:{value:new rt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Xt},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Xt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Xt},sheen:{value:0},sheenColor:{value:new Tt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Xt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Xt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Xt},transmissionSamplerSize:{value:new rt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Xt},attenuationDistance:{value:0},attenuationColor:{value:new Tt(0)},specularColor:{value:new Tt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Xt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Xt},anisotropyVector:{value:new rt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Xt}}]),vertexShader:Gt.meshphysical_vert,fragmentShader:Gt.meshphysical_frag};const Ts={r:0,b:0,g:0};function Sf(s,t,e,n,i,r,a){const o=new Tt(0);let l=r===!0?0:1,c,h,u=null,d=0,p=null;function g(m,f){let M=!1,v=f.isScene===!0?f.background:null;v&&v.isTexture&&(v=(f.backgroundBlurriness>0?e:t).get(v)),v===null?_(o,l):v&&v.isColor&&(_(v,1),M=!0);const S=s.xr.getEnvironmentBlendMode();S==="additive"?n.buffers.color.setClear(0,0,0,1,a):S==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(s.autoClear||M)&&s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil),v&&(v.isCubeTexture||v.mapping===Ys)?(h===void 0&&(h=new ot(new $e(1,1,1),new qn({name:"BackgroundCubeMaterial",uniforms:bi(sn.backgroundCube.uniforms),vertexShader:sn.backgroundCube.vertexShader,fragmentShader:sn.backgroundCube.fragmentShader,side:Fe,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(L,A,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(h)),h.material.uniforms.envMap.value=v,h.material.uniforms.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=f.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,h.material.toneMapped=jt.getTransfer(v.colorSpace)!==ee,(u!==v||d!==v.version||p!==s.toneMapping)&&(h.material.needsUpdate=!0,u=v,d=v.version,p=s.toneMapping),h.layers.enableAll(),m.unshift(h,h.geometry,h.material,0,0,null)):v&&v.isTexture&&(c===void 0&&(c=new ot(new Ae(2,2),new qn({name:"BackgroundMaterial",uniforms:bi(sn.background.uniforms),vertexShader:sn.background.vertexShader,fragmentShader:sn.background.fragmentShader,side:Pn,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(c)),c.material.uniforms.t2D.value=v,c.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,c.material.toneMapped=jt.getTransfer(v.colorSpace)!==ee,v.matrixAutoUpdate===!0&&v.updateMatrix(),c.material.uniforms.uvTransform.value.copy(v.matrix),(u!==v||d!==v.version||p!==s.toneMapping)&&(c.material.needsUpdate=!0,u=v,d=v.version,p=s.toneMapping),c.layers.enableAll(),m.unshift(c,c.geometry,c.material,0,0,null))}function _(m,f){m.getRGB(Ts,Tl(s)),n.buffers.color.setClear(Ts.r,Ts.g,Ts.b,f,a)}return{getClearColor:function(){return o},setClearColor:function(m,f=1){o.set(m),l=f,_(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(m){l=m,_(o,l)},render:g}}function Ef(s,t,e,n){const i=s.getParameter(s.MAX_VERTEX_ATTRIBS),r=n.isWebGL2?null:t.get("OES_vertex_array_object"),a=n.isWebGL2||r!==null,o={},l=m(null);let c=l,h=!1;function u(I,O,k,Z,Y){let $=!1;if(a){const j=_(Z,k,O);c!==j&&(c=j,p(c.object)),$=f(I,Z,k,Y),$&&M(I,Z,k,Y)}else{const j=O.wireframe===!0;(c.geometry!==Z.id||c.program!==k.id||c.wireframe!==j)&&(c.geometry=Z.id,c.program=k.id,c.wireframe=j,$=!0)}Y!==null&&e.update(Y,s.ELEMENT_ARRAY_BUFFER),($||h)&&(h=!1,B(I,O,k,Z),Y!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,e.get(Y).buffer))}function d(){return n.isWebGL2?s.createVertexArray():r.createVertexArrayOES()}function p(I){return n.isWebGL2?s.bindVertexArray(I):r.bindVertexArrayOES(I)}function g(I){return n.isWebGL2?s.deleteVertexArray(I):r.deleteVertexArrayOES(I)}function _(I,O,k){const Z=k.wireframe===!0;let Y=o[I.id];Y===void 0&&(Y={},o[I.id]=Y);let $=Y[O.id];$===void 0&&($={},Y[O.id]=$);let j=$[Z];return j===void 0&&(j=m(d()),$[Z]=j),j}function m(I){const O=[],k=[],Z=[];for(let Y=0;Y<i;Y++)O[Y]=0,k[Y]=0,Z[Y]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:O,enabledAttributes:k,attributeDivisors:Z,object:I,attributes:{},index:null}}function f(I,O,k,Z){const Y=c.attributes,$=O.attributes;let j=0;const it=k.getAttributes();for(const at in it)if(it[at].location>=0){const K=Y[at];let pt=$[at];if(pt===void 0&&(at==="instanceMatrix"&&I.instanceMatrix&&(pt=I.instanceMatrix),at==="instanceColor"&&I.instanceColor&&(pt=I.instanceColor)),K===void 0||K.attribute!==pt||pt&&K.data!==pt.data)return!0;j++}return c.attributesNum!==j||c.index!==Z}function M(I,O,k,Z){const Y={},$=O.attributes;let j=0;const it=k.getAttributes();for(const at in it)if(it[at].location>=0){let K=$[at];K===void 0&&(at==="instanceMatrix"&&I.instanceMatrix&&(K=I.instanceMatrix),at==="instanceColor"&&I.instanceColor&&(K=I.instanceColor));const pt={};pt.attribute=K,K&&K.data&&(pt.data=K.data),Y[at]=pt,j++}c.attributes=Y,c.attributesNum=j,c.index=Z}function v(){const I=c.newAttributes;for(let O=0,k=I.length;O<k;O++)I[O]=0}function S(I){L(I,0)}function L(I,O){const k=c.newAttributes,Z=c.enabledAttributes,Y=c.attributeDivisors;k[I]=1,Z[I]===0&&(s.enableVertexAttribArray(I),Z[I]=1),Y[I]!==O&&((n.isWebGL2?s:t.get("ANGLE_instanced_arrays"))[n.isWebGL2?"vertexAttribDivisor":"vertexAttribDivisorANGLE"](I,O),Y[I]=O)}function A(){const I=c.newAttributes,O=c.enabledAttributes;for(let k=0,Z=O.length;k<Z;k++)O[k]!==I[k]&&(s.disableVertexAttribArray(k),O[k]=0)}function C(I,O,k,Z,Y,$,j){j===!0?s.vertexAttribIPointer(I,O,k,Y,$):s.vertexAttribPointer(I,O,k,Z,Y,$)}function B(I,O,k,Z){if(n.isWebGL2===!1&&(I.isInstancedMesh||Z.isInstancedBufferGeometry)&&t.get("ANGLE_instanced_arrays")===null)return;v();const Y=Z.attributes,$=k.getAttributes(),j=O.defaultAttributeValues;for(const it in $){const at=$[it];if(at.location>=0){let W=Y[it];if(W===void 0&&(it==="instanceMatrix"&&I.instanceMatrix&&(W=I.instanceMatrix),it==="instanceColor"&&I.instanceColor&&(W=I.instanceColor)),W!==void 0){const K=W.normalized,pt=W.itemSize,Mt=e.get(W);if(Mt===void 0)continue;const _t=Mt.buffer,Pt=Mt.type,Ft=Mt.bytesPerElement,St=n.isWebGL2===!0&&(Pt===s.INT||Pt===s.UNSIGNED_INT||W.gpuType===al);if(W.isInterleavedBufferAttribute){const Ut=W.data,P=Ut.stride,lt=W.offset;if(Ut.isInstancedInterleavedBuffer){for(let q=0;q<at.locationSize;q++)L(at.location+q,Ut.meshPerAttribute);I.isInstancedMesh!==!0&&Z._maxInstanceCount===void 0&&(Z._maxInstanceCount=Ut.meshPerAttribute*Ut.count)}else for(let q=0;q<at.locationSize;q++)S(at.location+q);s.bindBuffer(s.ARRAY_BUFFER,_t);for(let q=0;q<at.locationSize;q++)C(at.location+q,pt/at.locationSize,Pt,K,P*Ft,(lt+pt/at.locationSize*q)*Ft,St)}else{if(W.isInstancedBufferAttribute){for(let Ut=0;Ut<at.locationSize;Ut++)L(at.location+Ut,W.meshPerAttribute);I.isInstancedMesh!==!0&&Z._maxInstanceCount===void 0&&(Z._maxInstanceCount=W.meshPerAttribute*W.count)}else for(let Ut=0;Ut<at.locationSize;Ut++)S(at.location+Ut);s.bindBuffer(s.ARRAY_BUFFER,_t);for(let Ut=0;Ut<at.locationSize;Ut++)C(at.location+Ut,pt/at.locationSize,Pt,K,pt*Ft,pt/at.locationSize*Ut*Ft,St)}}else if(j!==void 0){const K=j[it];if(K!==void 0)switch(K.length){case 2:s.vertexAttrib2fv(at.location,K);break;case 3:s.vertexAttrib3fv(at.location,K);break;case 4:s.vertexAttrib4fv(at.location,K);break;default:s.vertexAttrib1fv(at.location,K)}}}}A()}function y(){V();for(const I in o){const O=o[I];for(const k in O){const Z=O[k];for(const Y in Z)g(Z[Y].object),delete Z[Y];delete O[k]}delete o[I]}}function T(I){if(o[I.id]===void 0)return;const O=o[I.id];for(const k in O){const Z=O[k];for(const Y in Z)g(Z[Y].object),delete Z[Y];delete O[k]}delete o[I.id]}function F(I){for(const O in o){const k=o[O];if(k[I.id]===void 0)continue;const Z=k[I.id];for(const Y in Z)g(Z[Y].object),delete Z[Y];delete k[I.id]}}function V(){nt(),h=!0,c!==l&&(c=l,p(c.object))}function nt(){l.geometry=null,l.program=null,l.wireframe=!1}return{setup:u,reset:V,resetDefaultState:nt,dispose:y,releaseStatesOfGeometry:T,releaseStatesOfProgram:F,initAttributes:v,enableAttribute:S,disableUnusedAttributes:A}}function wf(s,t,e,n){const i=n.isWebGL2;let r;function a(h){r=h}function o(h,u){s.drawArrays(r,h,u),e.update(u,r,1)}function l(h,u,d){if(d===0)return;let p,g;if(i)p=s,g="drawArraysInstanced";else if(p=t.get("ANGLE_instanced_arrays"),g="drawArraysInstancedANGLE",p===null){console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}p[g](r,h,u,d),e.update(u,r,d)}function c(h,u,d){if(d===0)return;const p=t.get("WEBGL_multi_draw");if(p===null)for(let g=0;g<d;g++)this.render(h[g],u[g]);else{p.multiDrawArraysWEBGL(r,h,0,u,0,d);let g=0;for(let _=0;_<d;_++)g+=u[_];e.update(g,r,1)}}this.setMode=a,this.render=o,this.renderInstances=l,this.renderMultiDraw=c}function Tf(s,t,e){let n;function i(){if(n!==void 0)return n;if(t.has("EXT_texture_filter_anisotropic")===!0){const C=t.get("EXT_texture_filter_anisotropic");n=s.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n}function r(C){if(C==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}const a=typeof WebGL2RenderingContext<"u"&&s.constructor.name==="WebGL2RenderingContext";let o=e.precision!==void 0?e.precision:"highp";const l=r(o);l!==o&&(console.warn("THREE.WebGLRenderer:",o,"not supported, using",l,"instead."),o=l);const c=a||t.has("WEBGL_draw_buffers"),h=e.logarithmicDepthBuffer===!0,u=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),d=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),p=s.getParameter(s.MAX_TEXTURE_SIZE),g=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),_=s.getParameter(s.MAX_VERTEX_ATTRIBS),m=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),f=s.getParameter(s.MAX_VARYING_VECTORS),M=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),v=d>0,S=a||t.has("OES_texture_float"),L=v&&S,A=a?s.getParameter(s.MAX_SAMPLES):0;return{isWebGL2:a,drawBuffers:c,getMaxAnisotropy:i,getMaxPrecision:r,precision:o,logarithmicDepthBuffer:h,maxTextures:u,maxVertexTextures:d,maxTextureSize:p,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:m,maxVaryings:f,maxFragmentUniforms:M,vertexTextures:v,floatFragmentTextures:S,floatVertexTextures:L,maxSamples:A}}function bf(s){const t=this;let e=null,n=0,i=!1,r=!1;const a=new On,o=new Xt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){const p=u.length!==0||d||n!==0||i;return i=d,n=u.length,p},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){e=h(u,d,0)},this.setState=function(u,d,p){const g=u.clippingPlanes,_=u.clipIntersection,m=u.clipShadows,f=s.get(u);if(!i||g===null||g.length===0||r&&!m)r?h(null):c();else{const M=r?0:n,v=M*4;let S=f.clippingState||null;l.value=S,S=h(g,d,v,p);for(let L=0;L!==v;++L)S[L]=e[L];f.clippingState=S,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=M}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(u,d,p,g){const _=u!==null?u.length:0;let m=null;if(_!==0){if(m=l.value,g!==!0||m===null){const f=p+_*4,M=d.matrixWorldInverse;o.getNormalMatrix(M),(m===null||m.length<f)&&(m=new Float32Array(f));for(let v=0,S=p;v!==_;++v,S+=4)a.copy(u[v]).applyMatrix4(M,o),a.normal.toArray(m,S),m[S+3]=a.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,m}}function Af(s){let t=new WeakMap;function e(a,o){return o===zr?a.mapping=Ei:o===Hr&&(a.mapping=wi),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===zr||o===Hr)if(t.has(a)){const l=t.get(a).texture;return e(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new Bh(l.height/2);return c.fromEquirectangularTexture(s,a),t.set(a,c),a.addEventListener("dispose",i),e(c.texture,a.mapping)}else return null}}return a}function i(a){const o=a.target;o.removeEventListener("dispose",i);const l=t.get(o);l!==void 0&&(t.delete(o),l.dispose())}function r(){t=new WeakMap}return{get:n,dispose:r}}class Rl extends bl{constructor(t=-1,e=1,n=1,i=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=i,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,i,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2;let r=n-t,a=n+t,o=i+e,l=i-e;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const _i=4,go=[.125,.215,.35,.446,.526,.582],Hn=20,Tr=new Rl,_o=new Tt;let br=null,Ar=0,Cr=0;const Bn=(1+Math.sqrt(5))/2,hi=1/Bn,vo=[new R(1,1,1),new R(-1,1,1),new R(1,1,-1),new R(-1,1,-1),new R(0,Bn,hi),new R(0,Bn,-hi),new R(hi,0,Bn),new R(-hi,0,Bn),new R(Bn,hi,0),new R(-Bn,hi,0)];class xo{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,i=100){br=this._renderer.getRenderTarget(),Ar=this._renderer.getActiveCubeFace(),Cr=this._renderer.getActiveMipmapLevel(),this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,n,i,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=So(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Mo(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(br,Ar,Cr),t.scissorTest=!1,bs(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Ei||t.mapping===wi?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),br=this._renderer.getRenderTarget(),Ar=this._renderer.getActiveCubeFace(),Cr=this._renderer.getActiveMipmapLevel();const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:We,minFilter:We,generateMipmaps:!1,type:Zi,format:Qe,colorSpace:_n,depthBuffer:!1},i=yo(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=yo(t,e,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Cf(r)),this._blurMaterial=Rf(r,t,e)}return i}_compileMaterial(t){const e=new ot(this._lodPlanes[0],t);this._renderer.compile(e,Tr)}_sceneToCubeUV(t,e,n,i){const o=new qe(90,1,e,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(_o),h.toneMapping=An,h.autoClear=!1;const p=new _e({name:"PMREM.Background",side:Fe,depthWrite:!1,depthTest:!1}),g=new ot(new $e,p);let _=!1;const m=t.background;m?m.isColor&&(p.color.copy(m),t.background=null,_=!0):(p.color.copy(_o),_=!0);for(let f=0;f<6;f++){const M=f%3;M===0?(o.up.set(0,l[f],0),o.lookAt(c[f],0,0)):M===1?(o.up.set(0,0,l[f]),o.lookAt(0,c[f],0)):(o.up.set(0,l[f],0),o.lookAt(0,0,c[f]));const v=this._cubeSize;bs(i,M*v,f>2?v:0,v,v),h.setRenderTarget(i),_&&h.render(g,o),h.render(t,o)}g.geometry.dispose(),g.material.dispose(),h.toneMapping=d,h.autoClear=u,t.background=m}_textureToCubeUV(t,e){const n=this._renderer,i=t.mapping===Ei||t.mapping===wi;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=So()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Mo());const r=i?this._cubemapMaterial:this._equirectMaterial,a=new ot(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=t;const l=this._cubeSize;bs(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(a,Tr)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;for(let i=1;i<this._lodPlanes.length;i++){const r=Math.sqrt(this._sigmas[i]*this._sigmas[i]-this._sigmas[i-1]*this._sigmas[i-1]),a=vo[(i-1)%vo.length];this._blur(t,i-1,i,r,a)}e.autoClear=n}_blur(t,e,n,i,r){const a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,i,"latitudinal",r),this._halfBlur(a,t,n,n,i,"longitudinal",r)}_halfBlur(t,e,n,i,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,u=new ot(this._lodPlanes[i],c),d=c.uniforms,p=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*p):2*Math.PI/(2*Hn-1),_=r/g,m=isFinite(r)?1+Math.floor(h*_):Hn;m>Hn&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Hn}`);const f=[];let M=0;for(let C=0;C<Hn;++C){const B=C/_,y=Math.exp(-B*B/2);f.push(y),C===0?M+=y:C<m&&(M+=2*y)}for(let C=0;C<f.length;C++)f[C]=f[C]/M;d.envMap.value=t.texture,d.samples.value=m,d.weights.value=f,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:v}=this;d.dTheta.value=g,d.mipInt.value=v-n;const S=this._sizeLods[i],L=3*S*(i>v-_i?i-v+_i:0),A=4*(this._cubeSize-S);bs(e,L,A,3*S,2*S),l.setRenderTarget(e),l.render(u,Tr)}}function Cf(s){const t=[],e=[],n=[];let i=s;const r=s-_i+1+go.length;for(let a=0;a<r;a++){const o=Math.pow(2,i);e.push(o);let l=1/o;a>s-_i?l=go[a-s+_i-1]:a===0&&(l=0),n.push(l);const c=1/(o-2),h=-c,u=1+c,d=[h,h,u,h,u,u,h,h,u,u,h,u],p=6,g=6,_=3,m=2,f=1,M=new Float32Array(_*g*p),v=new Float32Array(m*g*p),S=new Float32Array(f*g*p);for(let A=0;A<p;A++){const C=A%3*2/3-1,B=A>2?0:-1,y=[C,B,0,C+2/3,B,0,C+2/3,B+1,0,C,B,0,C+2/3,B+1,0,C,B+1,0];M.set(y,_*g*A),v.set(d,m*g*A);const T=[A,A,A,A,A,A];S.set(T,f*g*A)}const L=new Ee;L.setAttribute("position",new Re(M,_)),L.setAttribute("uv",new Re(v,m)),L.setAttribute("faceIndex",new Re(S,f)),t.push(L),i>_i&&i--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function yo(s,t,e){const n=new Xn(s,t,e);return n.texture.mapping=Ys,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function bs(s,t,e,n,i){s.viewport.set(t,e,n,i),s.scissor.set(t,e,n,i)}function Rf(s,t,e){const n=new Float32Array(Hn),i=new R(0,1,0);return new qn({name:"SphericalGaussianBlur",defines:{n:Hn,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:ia(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:bn,depthTest:!1,depthWrite:!1})}function Mo(){return new qn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:ia(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:bn,depthTest:!1,depthWrite:!1})}function So(){return new qn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:ia(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:bn,depthTest:!1,depthWrite:!1})}function ia(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Pf(s){let t=new WeakMap,e=null;function n(o){if(o&&o.isTexture){const l=o.mapping,c=l===zr||l===Hr,h=l===Ei||l===wi;if(c||h)if(o.isRenderTargetTexture&&o.needsPMREMUpdate===!0){o.needsPMREMUpdate=!1;let u=t.get(o);return e===null&&(e=new xo(s)),u=c?e.fromEquirectangular(o,u):e.fromCubemap(o,u),t.set(o,u),u.texture}else{if(t.has(o))return t.get(o).texture;{const u=o.image;if(c&&u&&u.height>0||h&&u&&i(u)){e===null&&(e=new xo(s));const d=c?e.fromEquirectangular(o):e.fromCubemap(o);return t.set(o,d),o.addEventListener("dispose",r),d.texture}else return null}}}return o}function i(o){let l=0;const c=6;for(let h=0;h<c;h++)o[h]!==void 0&&l++;return l===c}function r(o){const l=o.target;l.removeEventListener("dispose",r);const c=t.get(l);c!==void 0&&(t.delete(l),c.dispose())}function a(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:a}}function Lf(s){const t={};function e(n){if(t[n]!==void 0)return t[n];let i;switch(n){case"WEBGL_depth_texture":i=s.getExtension("WEBGL_depth_texture")||s.getExtension("MOZ_WEBGL_depth_texture")||s.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=s.getExtension("EXT_texture_filter_anisotropic")||s.getExtension("MOZ_EXT_texture_filter_anisotropic")||s.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=s.getExtension("WEBGL_compressed_texture_s3tc")||s.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=s.getExtension("WEBGL_compressed_texture_pvrtc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=s.getExtension(n)}return t[n]=i,i}return{has:function(n){return e(n)!==null},init:function(n){n.isWebGL2?(e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance")):(e("WEBGL_depth_texture"),e("OES_texture_float"),e("OES_texture_half_float"),e("OES_texture_half_float_linear"),e("OES_standard_derivatives"),e("OES_element_index_uint"),e("OES_vertex_array_object"),e("ANGLE_instanced_arrays")),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture")},get:function(n){const i=e(n);return i===null&&console.warn("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function Df(s,t,e,n){const i={},r=new WeakMap;function a(u){const d=u.target;d.index!==null&&t.remove(d.index);for(const g in d.attributes)t.remove(d.attributes[g]);for(const g in d.morphAttributes){const _=d.morphAttributes[g];for(let m=0,f=_.length;m<f;m++)t.remove(_[m])}d.removeEventListener("dispose",a),delete i[d.id];const p=r.get(d);p&&(t.remove(p),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function o(u,d){return i[d.id]===!0||(d.addEventListener("dispose",a),i[d.id]=!0,e.memory.geometries++),d}function l(u){const d=u.attributes;for(const g in d)t.update(d[g],s.ARRAY_BUFFER);const p=u.morphAttributes;for(const g in p){const _=p[g];for(let m=0,f=_.length;m<f;m++)t.update(_[m],s.ARRAY_BUFFER)}}function c(u){const d=[],p=u.index,g=u.attributes.position;let _=0;if(p!==null){const M=p.array;_=p.version;for(let v=0,S=M.length;v<S;v+=3){const L=M[v+0],A=M[v+1],C=M[v+2];d.push(L,A,A,C,C,L)}}else if(g!==void 0){const M=g.array;_=g.version;for(let v=0,S=M.length/3-1;v<S;v+=3){const L=v+0,A=v+1,C=v+2;d.push(L,A,A,C,C,L)}}else return;const m=new(gl(d)?wl:El)(d,1);m.version=_;const f=r.get(u);f&&t.remove(f),r.set(u,m)}function h(u){const d=r.get(u);if(d){const p=u.index;p!==null&&d.version<p.version&&c(u)}else c(u);return r.get(u)}return{get:o,update:l,getWireframeAttribute:h}}function If(s,t,e,n){const i=n.isWebGL2;let r;function a(p){r=p}let o,l;function c(p){o=p.type,l=p.bytesPerElement}function h(p,g){s.drawElements(r,g,o,p*l),e.update(g,r,1)}function u(p,g,_){if(_===0)return;let m,f;if(i)m=s,f="drawElementsInstanced";else if(m=t.get("ANGLE_instanced_arrays"),f="drawElementsInstancedANGLE",m===null){console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}m[f](r,g,o,p*l,_),e.update(g,r,_)}function d(p,g,_){if(_===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let f=0;f<_;f++)this.render(p[f]/l,g[f]);else{m.multiDrawElementsWEBGL(r,g,0,o,p,0,_);let f=0;for(let M=0;M<_;M++)f+=g[M];e.update(f,r,1)}}this.setMode=a,this.setIndex=c,this.render=h,this.renderInstances=u,this.renderMultiDraw=d}function Uf(s){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(e.calls++,a){case s.TRIANGLES:e.triangles+=o*(r/3);break;case s.LINES:e.lines+=o*(r/2);break;case s.LINE_STRIP:e.lines+=o*(r-1);break;case s.LINE_LOOP:e.lines+=o*r;break;case s.POINTS:e.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function i(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:i,update:n}}function Nf(s,t){return s[0]-t[0]}function Ff(s,t){return Math.abs(t[1])-Math.abs(s[1])}function Of(s,t,e){const n={},i=new Float32Array(8),r=new WeakMap,a=new ve,o=[];for(let c=0;c<8;c++)o[c]=[c,0];function l(c,h,u){const d=c.morphTargetInfluences;if(t.isWebGL2===!0){const g=h.morphAttributes.position||h.morphAttributes.normal||h.morphAttributes.color,_=g!==void 0?g.length:0;let m=r.get(h);if(m===void 0||m.count!==_){let O=function(){nt.dispose(),r.delete(h),h.removeEventListener("dispose",O)};var p=O;m!==void 0&&m.texture.dispose();const v=h.morphAttributes.position!==void 0,S=h.morphAttributes.normal!==void 0,L=h.morphAttributes.color!==void 0,A=h.morphAttributes.position||[],C=h.morphAttributes.normal||[],B=h.morphAttributes.color||[];let y=0;v===!0&&(y=1),S===!0&&(y=2),L===!0&&(y=3);let T=h.attributes.position.count*y,F=1;T>t.maxTextureSize&&(F=Math.ceil(T/t.maxTextureSize),T=t.maxTextureSize);const V=new Float32Array(T*F*4*_),nt=new xl(V,T,F,_);nt.type=Tn,nt.needsUpdate=!0;const I=y*4;for(let k=0;k<_;k++){const Z=A[k],Y=C[k],$=B[k],j=T*F*4*k;for(let it=0;it<Z.count;it++){const at=it*I;v===!0&&(a.fromBufferAttribute(Z,it),V[j+at+0]=a.x,V[j+at+1]=a.y,V[j+at+2]=a.z,V[j+at+3]=0),S===!0&&(a.fromBufferAttribute(Y,it),V[j+at+4]=a.x,V[j+at+5]=a.y,V[j+at+6]=a.z,V[j+at+7]=0),L===!0&&(a.fromBufferAttribute($,it),V[j+at+8]=a.x,V[j+at+9]=a.y,V[j+at+10]=a.z,V[j+at+11]=$.itemSize===4?a.w:1)}}m={count:_,texture:nt,size:new rt(T,F)},r.set(h,m),h.addEventListener("dispose",O)}let f=0;for(let v=0;v<d.length;v++)f+=d[v];const M=h.morphTargetsRelative?1:1-f;u.getUniforms().setValue(s,"morphTargetBaseInfluence",M),u.getUniforms().setValue(s,"morphTargetInfluences",d),u.getUniforms().setValue(s,"morphTargetsTexture",m.texture,e),u.getUniforms().setValue(s,"morphTargetsTextureSize",m.size)}else{const g=d===void 0?0:d.length;let _=n[h.id];if(_===void 0||_.length!==g){_=[];for(let S=0;S<g;S++)_[S]=[S,0];n[h.id]=_}for(let S=0;S<g;S++){const L=_[S];L[0]=S,L[1]=d[S]}_.sort(Ff);for(let S=0;S<8;S++)S<g&&_[S][1]?(o[S][0]=_[S][0],o[S][1]=_[S][1]):(o[S][0]=Number.MAX_SAFE_INTEGER,o[S][1]=0);o.sort(Nf);const m=h.morphAttributes.position,f=h.morphAttributes.normal;let M=0;for(let S=0;S<8;S++){const L=o[S],A=L[0],C=L[1];A!==Number.MAX_SAFE_INTEGER&&C?(m&&h.getAttribute("morphTarget"+S)!==m[A]&&h.setAttribute("morphTarget"+S,m[A]),f&&h.getAttribute("morphNormal"+S)!==f[A]&&h.setAttribute("morphNormal"+S,f[A]),i[S]=C,M+=C):(m&&h.hasAttribute("morphTarget"+S)===!0&&h.deleteAttribute("morphTarget"+S),f&&h.hasAttribute("morphNormal"+S)===!0&&h.deleteAttribute("morphNormal"+S),i[S]=0)}const v=h.morphTargetsRelative?1:1-M;u.getUniforms().setValue(s,"morphTargetBaseInfluence",v),u.getUniforms().setValue(s,"morphTargetInfluences",i)}}return{update:l}}function Bf(s,t,e,n){let i=new WeakMap;function r(l){const c=n.render.frame,h=l.geometry,u=t.get(l,h);if(i.get(u)!==c&&(t.update(u),i.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),i.get(l)!==c&&(e.update(l.instanceMatrix,s.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,s.ARRAY_BUFFER),i.set(l,c))),l.isSkinnedMesh){const d=l.skeleton;i.get(d)!==c&&(d.update(),i.set(d,c))}return u}function a(){i=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:r,dispose:a}}class Pl extends Oe{constructor(t,e,n,i,r,a,o,l,c,h){if(h=h!==void 0?h:Vn,h!==Vn&&h!==Ti)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===Vn&&(n=wn),n===void 0&&h===Ti&&(n=kn),super(null,i,r,a,o,l,h,n,c),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=o!==void 0?o:Ue,this.minFilter=l!==void 0?l:Ue,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const Ll=new Oe,Dl=new Pl(1,1);Dl.compareFunction=ml;const Il=new xl,Ul=new Mh,Nl=new Al,Eo=[],wo=[],To=new Float32Array(16),bo=new Float32Array(9),Ao=new Float32Array(4);function Pi(s,t,e){const n=s[0];if(n<=0||n>0)return s;const i=t*e;let r=Eo[i];if(r===void 0&&(r=new Float32Array(i),Eo[i]=r),t!==0){n.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,s[a].toArray(r,o)}return r}function de(s,t){if(s.length!==t.length)return!1;for(let e=0,n=s.length;e<n;e++)if(s[e]!==t[e])return!1;return!0}function fe(s,t){for(let e=0,n=t.length;e<n;e++)s[e]=t[e]}function js(s,t){let e=wo[t];e===void 0&&(e=new Int32Array(t),wo[t]=e);for(let n=0;n!==t;++n)e[n]=s.allocateTextureUnit();return e}function zf(s,t){const e=this.cache;e[0]!==t&&(s.uniform1f(this.addr,t),e[0]=t)}function Hf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(de(e,t))return;s.uniform2fv(this.addr,t),fe(e,t)}}function Gf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(s.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(de(e,t))return;s.uniform3fv(this.addr,t),fe(e,t)}}function kf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(de(e,t))return;s.uniform4fv(this.addr,t),fe(e,t)}}function Vf(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(de(e,t))return;s.uniformMatrix2fv(this.addr,!1,t),fe(e,t)}else{if(de(e,n))return;Ao.set(n),s.uniformMatrix2fv(this.addr,!1,Ao),fe(e,n)}}function Wf(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(de(e,t))return;s.uniformMatrix3fv(this.addr,!1,t),fe(e,t)}else{if(de(e,n))return;bo.set(n),s.uniformMatrix3fv(this.addr,!1,bo),fe(e,n)}}function Xf(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(de(e,t))return;s.uniformMatrix4fv(this.addr,!1,t),fe(e,t)}else{if(de(e,n))return;To.set(n),s.uniformMatrix4fv(this.addr,!1,To),fe(e,n)}}function qf(s,t){const e=this.cache;e[0]!==t&&(s.uniform1i(this.addr,t),e[0]=t)}function Yf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(de(e,t))return;s.uniform2iv(this.addr,t),fe(e,t)}}function $f(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(de(e,t))return;s.uniform3iv(this.addr,t),fe(e,t)}}function Zf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(de(e,t))return;s.uniform4iv(this.addr,t),fe(e,t)}}function jf(s,t){const e=this.cache;e[0]!==t&&(s.uniform1ui(this.addr,t),e[0]=t)}function Jf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(de(e,t))return;s.uniform2uiv(this.addr,t),fe(e,t)}}function Kf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(de(e,t))return;s.uniform3uiv(this.addr,t),fe(e,t)}}function Qf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(de(e,t))return;s.uniform4uiv(this.addr,t),fe(e,t)}}function tp(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i);const r=this.type===s.SAMPLER_2D_SHADOW?Dl:Ll;e.setTexture2D(t||r,i)}function ep(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTexture3D(t||Ul,i)}function np(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTextureCube(t||Nl,i)}function ip(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTexture2DArray(t||Il,i)}function sp(s){switch(s){case 5126:return zf;case 35664:return Hf;case 35665:return Gf;case 35666:return kf;case 35674:return Vf;case 35675:return Wf;case 35676:return Xf;case 5124:case 35670:return qf;case 35667:case 35671:return Yf;case 35668:case 35672:return $f;case 35669:case 35673:return Zf;case 5125:return jf;case 36294:return Jf;case 36295:return Kf;case 36296:return Qf;case 35678:case 36198:case 36298:case 36306:case 35682:return tp;case 35679:case 36299:case 36307:return ep;case 35680:case 36300:case 36308:case 36293:return np;case 36289:case 36303:case 36311:case 36292:return ip}}function rp(s,t){s.uniform1fv(this.addr,t)}function ap(s,t){const e=Pi(t,this.size,2);s.uniform2fv(this.addr,e)}function op(s,t){const e=Pi(t,this.size,3);s.uniform3fv(this.addr,e)}function lp(s,t){const e=Pi(t,this.size,4);s.uniform4fv(this.addr,e)}function cp(s,t){const e=Pi(t,this.size,4);s.uniformMatrix2fv(this.addr,!1,e)}function hp(s,t){const e=Pi(t,this.size,9);s.uniformMatrix3fv(this.addr,!1,e)}function up(s,t){const e=Pi(t,this.size,16);s.uniformMatrix4fv(this.addr,!1,e)}function dp(s,t){s.uniform1iv(this.addr,t)}function fp(s,t){s.uniform2iv(this.addr,t)}function pp(s,t){s.uniform3iv(this.addr,t)}function mp(s,t){s.uniform4iv(this.addr,t)}function gp(s,t){s.uniform1uiv(this.addr,t)}function _p(s,t){s.uniform2uiv(this.addr,t)}function vp(s,t){s.uniform3uiv(this.addr,t)}function xp(s,t){s.uniform4uiv(this.addr,t)}function yp(s,t,e){const n=this.cache,i=t.length,r=js(e,i);de(n,r)||(s.uniform1iv(this.addr,r),fe(n,r));for(let a=0;a!==i;++a)e.setTexture2D(t[a]||Ll,r[a])}function Mp(s,t,e){const n=this.cache,i=t.length,r=js(e,i);de(n,r)||(s.uniform1iv(this.addr,r),fe(n,r));for(let a=0;a!==i;++a)e.setTexture3D(t[a]||Ul,r[a])}function Sp(s,t,e){const n=this.cache,i=t.length,r=js(e,i);de(n,r)||(s.uniform1iv(this.addr,r),fe(n,r));for(let a=0;a!==i;++a)e.setTextureCube(t[a]||Nl,r[a])}function Ep(s,t,e){const n=this.cache,i=t.length,r=js(e,i);de(n,r)||(s.uniform1iv(this.addr,r),fe(n,r));for(let a=0;a!==i;++a)e.setTexture2DArray(t[a]||Il,r[a])}function wp(s){switch(s){case 5126:return rp;case 35664:return ap;case 35665:return op;case 35666:return lp;case 35674:return cp;case 35675:return hp;case 35676:return up;case 5124:case 35670:return dp;case 35667:case 35671:return fp;case 35668:case 35672:return pp;case 35669:case 35673:return mp;case 5125:return gp;case 36294:return _p;case 36295:return vp;case 36296:return xp;case 35678:case 36198:case 36298:case 36306:case 35682:return yp;case 35679:case 36299:case 36307:return Mp;case 35680:case 36300:case 36308:case 36293:return Sp;case 36289:case 36303:case 36311:case 36292:return Ep}}class Tp{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=sp(e.type)}}class bp{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=wp(e.type)}}class Ap{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const i=this.seq;for(let r=0,a=i.length;r!==a;++r){const o=i[r];o.setValue(t,e[o.id],n)}}}const Rr=/(\w+)(\])?(\[|\.)?/g;function Co(s,t){s.seq.push(t),s.map[t.id]=t}function Cp(s,t,e){const n=s.name,i=n.length;for(Rr.lastIndex=0;;){const r=Rr.exec(n),a=Rr.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===i){Co(e,c===void 0?new Tp(o,s,t):new bp(o,s,t));break}else{let u=e.map[o];u===void 0&&(u=new Ap(o),Co(e,u)),e=u}}}class Fs{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let i=0;i<n;++i){const r=t.getActiveUniform(e,i),a=t.getUniformLocation(e,r.name);Cp(r,a,this)}}setValue(t,e,n,i){const r=this.map[e];r!==void 0&&r.setValue(t,n,i)}setOptional(t,e,n){const i=e[n];i!==void 0&&this.setValue(t,n,i)}static upload(t,e,n,i){for(let r=0,a=e.length;r!==a;++r){const o=e[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,i)}}static seqWithValue(t,e){const n=[];for(let i=0,r=t.length;i!==r;++i){const a=t[i];a.id in e&&n.push(a)}return n}}function Ro(s,t,e){const n=s.createShader(t);return s.shaderSource(n,e),s.compileShader(n),n}const Rp=37297;let Pp=0;function Lp(s,t){const e=s.split(`
`),n=[],i=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=i;a<r;a++){const o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}function Dp(s){const t=jt.getPrimaries(jt.workingColorSpace),e=jt.getPrimaries(s);let n;switch(t===e?n="":t===Gs&&e===Hs?n="LinearDisplayP3ToLinearSRGB":t===Hs&&e===Gs&&(n="LinearSRGBToLinearDisplayP3"),s){case _n:case $s:return[n,"LinearTransferOETF"];case Me:case ta:return[n,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space:",s),[n,"LinearTransferOETF"]}}function Po(s,t,e){const n=s.getShaderParameter(t,s.COMPILE_STATUS),i=s.getShaderInfoLog(t).trim();if(n&&i==="")return"";const r=/ERROR: 0:(\d+)/.exec(i);if(r){const a=parseInt(r[1]);return e.toUpperCase()+`

`+i+`

`+Lp(s.getShaderSource(t),a)}else return i}function Ip(s,t){const e=Dp(t);return`vec4 ${s}( vec4 value ) { return ${e[0]}( ${e[1]}( value ) ); }`}function Up(s,t){let e;switch(t){case Pc:e="Linear";break;case Lc:e="Reinhard";break;case Dc:e="OptimizedCineon";break;case Ic:e="ACESFilmic";break;case Nc:e="AgX";break;case Uc:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+s+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}function Np(s){return[s.extensionDerivatives||s.envMapCubeUVHeight||s.bumpMap||s.normalMapTangentSpace||s.clearcoatNormalMap||s.flatShading||s.shaderID==="physical"?"#extension GL_OES_standard_derivatives : enable":"",(s.extensionFragDepth||s.logarithmicDepthBuffer)&&s.rendererExtensionFragDepth?"#extension GL_EXT_frag_depth : enable":"",s.extensionDrawBuffers&&s.rendererExtensionDrawBuffers?"#extension GL_EXT_draw_buffers : require":"",(s.extensionShaderTextureLOD||s.envMap||s.transmission)&&s.rendererExtensionShaderTextureLod?"#extension GL_EXT_shader_texture_lod : enable":""].filter(vi).join(`
`)}function Fp(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":""].filter(vi).join(`
`)}function Op(s){const t=[];for(const e in s){const n=s[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function Bp(s,t){const e={},n=s.getProgramParameter(t,s.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){const r=s.getActiveAttrib(t,i),a=r.name;let o=1;r.type===s.FLOAT_MAT2&&(o=2),r.type===s.FLOAT_MAT3&&(o=3),r.type===s.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:s.getAttribLocation(t,a),locationSize:o}}return e}function vi(s){return s!==""}function Lo(s,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return s.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Do(s,t){return s.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const zp=/^[ \t]*#include +<([\w\d./]+)>/gm;function qr(s){return s.replace(zp,Gp)}const Hp=new Map([["encodings_fragment","colorspace_fragment"],["encodings_pars_fragment","colorspace_pars_fragment"],["output_fragment","opaque_fragment"]]);function Gp(s,t){let e=Gt[t];if(e===void 0){const n=Hp.get(t);if(n!==void 0)e=Gt[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return qr(e)}const kp=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Io(s){return s.replace(kp,Vp)}function Vp(s,t,e,n){let i="";for(let r=parseInt(t);r<parseInt(e);r++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return i}function Uo(s){let t="precision "+s.precision+` float;
precision `+s.precision+" int;";return s.precision==="highp"?t+=`
#define HIGH_PRECISION`:s.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function Wp(s){let t="SHADOWMAP_TYPE_BASIC";return s.shadowMapType===nl?t="SHADOWMAP_TYPE_PCF":s.shadowMapType===il?t="SHADOWMAP_TYPE_PCF_SOFT":s.shadowMapType===mn&&(t="SHADOWMAP_TYPE_VSM"),t}function Xp(s){let t="ENVMAP_TYPE_CUBE";if(s.envMap)switch(s.envMapMode){case Ei:case wi:t="ENVMAP_TYPE_CUBE";break;case Ys:t="ENVMAP_TYPE_CUBE_UV";break}return t}function qp(s){let t="ENVMAP_MODE_REFLECTION";if(s.envMap)switch(s.envMapMode){case wi:t="ENVMAP_MODE_REFRACTION";break}return t}function Yp(s){let t="ENVMAP_BLENDING_NONE";if(s.envMap)switch(s.combine){case sl:t="ENVMAP_BLENDING_MULTIPLY";break;case Cc:t="ENVMAP_BLENDING_MIX";break;case Rc:t="ENVMAP_BLENDING_ADD";break}return t}function $p(s){const t=s.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),7*16)),texelHeight:n,maxMip:e}}function Zp(s,t,e,n){const i=s.getContext(),r=e.defines;let a=e.vertexShader,o=e.fragmentShader;const l=Wp(e),c=Xp(e),h=qp(e),u=Yp(e),d=$p(e),p=e.isWebGL2?"":Np(e),g=Fp(e),_=Op(r),m=i.createProgram();let f,M,v=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(f=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_].filter(vi).join(`
`),f.length>0&&(f+=`
`),M=[p,"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_].filter(vi).join(`
`),M.length>0&&(M+=`
`)):(f=[Uo(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors&&e.isWebGL2?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0&&e.isWebGL2?"#define MORPHTARGETS_TEXTURE":"",e.morphTargetsCount>0&&e.isWebGL2?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0&&e.isWebGL2?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.useLegacyLights?"#define LEGACY_LIGHTS":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.logarithmicDepthBuffer&&e.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#if ( defined( USE_MORPHTARGETS ) && ! defined( MORPHTARGETS_TEXTURE ) )","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(vi).join(`
`),M=[p,Uo(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.useLegacyLights?"#define LEGACY_LIGHTS":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.logarithmicDepthBuffer&&e.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==An?"#define TONE_MAPPING":"",e.toneMapping!==An?Gt.tonemapping_pars_fragment:"",e.toneMapping!==An?Up("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Gt.colorspace_pars_fragment,Ip("linearToOutputTexel",e.outputColorSpace),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(vi).join(`
`)),a=qr(a),a=Lo(a,e),a=Do(a,e),o=qr(o),o=Lo(o,e),o=Do(o,e),a=Io(a),o=Io(o),e.isWebGL2&&e.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,f=[g,"precision mediump sampler2DArray;","#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+f,M=["precision mediump sampler2DArray;","#define varying in",e.glslVersion===Ja?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===Ja?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+M);const S=v+f+a,L=v+M+o,A=Ro(i,i.VERTEX_SHADER,S),C=Ro(i,i.FRAGMENT_SHADER,L);i.attachShader(m,A),i.attachShader(m,C),e.index0AttributeName!==void 0?i.bindAttribLocation(m,0,e.index0AttributeName):e.morphTargets===!0&&i.bindAttribLocation(m,0,"position"),i.linkProgram(m);function B(V){if(s.debug.checkShaderErrors){const nt=i.getProgramInfoLog(m).trim(),I=i.getShaderInfoLog(A).trim(),O=i.getShaderInfoLog(C).trim();let k=!0,Z=!0;if(i.getProgramParameter(m,i.LINK_STATUS)===!1)if(k=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(i,m,A,C);else{const Y=Po(i,A,"vertex"),$=Po(i,C,"fragment");console.error("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(m,i.VALIDATE_STATUS)+`

Program Info Log: `+nt+`
`+Y+`
`+$)}else nt!==""?console.warn("THREE.WebGLProgram: Program Info Log:",nt):(I===""||O==="")&&(Z=!1);Z&&(V.diagnostics={runnable:k,programLog:nt,vertexShader:{log:I,prefix:f},fragmentShader:{log:O,prefix:M}})}i.deleteShader(A),i.deleteShader(C),y=new Fs(i,m),T=Bp(i,m)}let y;this.getUniforms=function(){return y===void 0&&B(this),y};let T;this.getAttributes=function(){return T===void 0&&B(this),T};let F=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return F===!1&&(F=i.getProgramParameter(m,Rp)),F},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(m),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=Pp++,this.cacheKey=t,this.usedTimes=1,this.program=m,this.vertexShader=A,this.fragmentShader=C,this}let jp=0;class Jp{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,i=this._getShaderStage(e),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(t);return a.has(i)===!1&&(a.add(i),i.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new Kp(t),e.set(t,n)),n}}class Kp{constructor(t){this.id=jp++,this.code=t,this.usedTimes=0}}function Qp(s,t,e,n,i,r,a){const o=new Ml,l=new Jp,c=[],h=i.isWebGL2,u=i.logarithmicDepthBuffer,d=i.vertexTextures;let p=i.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(y){return y===0?"uv":`uv${y}`}function m(y,T,F,V,nt){const I=V.fog,O=nt.geometry,k=y.isMeshStandardMaterial?V.environment:null,Z=(y.isMeshStandardMaterial?e:t).get(y.envMap||k),Y=Z&&Z.mapping===Ys?Z.image.height:null,$=g[y.type];y.precision!==null&&(p=i.getMaxPrecision(y.precision),p!==y.precision&&console.warn("THREE.WebGLProgram.getParameters:",y.precision,"not supported, using",p,"instead."));const j=O.morphAttributes.position||O.morphAttributes.normal||O.morphAttributes.color,it=j!==void 0?j.length:0;let at=0;O.morphAttributes.position!==void 0&&(at=1),O.morphAttributes.normal!==void 0&&(at=2),O.morphAttributes.color!==void 0&&(at=3);let W,K,pt,Mt;if($){const Pe=sn[$];W=Pe.vertexShader,K=Pe.fragmentShader}else W=y.vertexShader,K=y.fragmentShader,l.update(y),pt=l.getVertexShaderID(y),Mt=l.getFragmentShaderID(y);const _t=s.getRenderTarget(),Pt=nt.isInstancedMesh===!0,Ft=nt.isBatchedMesh===!0,St=!!y.map,Ut=!!y.matcap,P=!!Z,lt=!!y.aoMap,q=!!y.lightMap,st=!!y.bumpMap,X=!!y.normalMap,wt=!!y.displacementMap,mt=!!y.emissiveMap,E=!!y.metalnessMap,x=!!y.roughnessMap,N=y.anisotropy>0,et=y.clearcoat>0,Q=y.iridescence>0,J=y.sheen>0,yt=y.transmission>0,ut=N&&!!y.anisotropyMap,vt=et&&!!y.clearcoatMap,At=et&&!!y.clearcoatNormalMap,Bt=et&&!!y.clearcoatRoughnessMap,tt=Q&&!!y.iridescenceMap,Yt=Q&&!!y.iridescenceThicknessMap,qt=J&&!!y.sheenColorMap,Nt=J&&!!y.sheenRoughnessMap,bt=!!y.specularMap,xt=!!y.specularColorMap,Ht=!!y.specularIntensityMap,$t=yt&&!!y.transmissionMap,oe=yt&&!!y.thicknessMap,Vt=!!y.gradientMap,ct=!!y.alphaMap,D=y.alphaTest>0,dt=!!y.alphaHash,ft=!!y.extensions,Lt=!!O.attributes.uv1,Ct=!!O.attributes.uv2,Jt=!!O.attributes.uv3;let Kt=An;return y.toneMapped&&(_t===null||_t.isXRRenderTarget===!0)&&(Kt=s.toneMapping),{isWebGL2:h,shaderID:$,shaderType:y.type,shaderName:y.name,vertexShader:W,fragmentShader:K,defines:y.defines,customVertexShaderID:pt,customFragmentShaderID:Mt,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:p,batching:Ft,instancing:Pt,instancingColor:Pt&&nt.instanceColor!==null,supportsVertexTextures:d,outputColorSpace:_t===null?s.outputColorSpace:_t.isXRRenderTarget===!0?_t.texture.colorSpace:_n,map:St,matcap:Ut,envMap:P,envMapMode:P&&Z.mapping,envMapCubeUVHeight:Y,aoMap:lt,lightMap:q,bumpMap:st,normalMap:X,displacementMap:d&&wt,emissiveMap:mt,normalMapObjectSpace:X&&y.normalMapType===Yc,normalMapTangentSpace:X&&y.normalMapType===pl,metalnessMap:E,roughnessMap:x,anisotropy:N,anisotropyMap:ut,clearcoat:et,clearcoatMap:vt,clearcoatNormalMap:At,clearcoatRoughnessMap:Bt,iridescence:Q,iridescenceMap:tt,iridescenceThicknessMap:Yt,sheen:J,sheenColorMap:qt,sheenRoughnessMap:Nt,specularMap:bt,specularColorMap:xt,specularIntensityMap:Ht,transmission:yt,transmissionMap:$t,thicknessMap:oe,gradientMap:Vt,opaque:y.transparent===!1&&y.blending===Gn,alphaMap:ct,alphaTest:D,alphaHash:dt,combine:y.combine,mapUv:St&&_(y.map.channel),aoMapUv:lt&&_(y.aoMap.channel),lightMapUv:q&&_(y.lightMap.channel),bumpMapUv:st&&_(y.bumpMap.channel),normalMapUv:X&&_(y.normalMap.channel),displacementMapUv:wt&&_(y.displacementMap.channel),emissiveMapUv:mt&&_(y.emissiveMap.channel),metalnessMapUv:E&&_(y.metalnessMap.channel),roughnessMapUv:x&&_(y.roughnessMap.channel),anisotropyMapUv:ut&&_(y.anisotropyMap.channel),clearcoatMapUv:vt&&_(y.clearcoatMap.channel),clearcoatNormalMapUv:At&&_(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Bt&&_(y.clearcoatRoughnessMap.channel),iridescenceMapUv:tt&&_(y.iridescenceMap.channel),iridescenceThicknessMapUv:Yt&&_(y.iridescenceThicknessMap.channel),sheenColorMapUv:qt&&_(y.sheenColorMap.channel),sheenRoughnessMapUv:Nt&&_(y.sheenRoughnessMap.channel),specularMapUv:bt&&_(y.specularMap.channel),specularColorMapUv:xt&&_(y.specularColorMap.channel),specularIntensityMapUv:Ht&&_(y.specularIntensityMap.channel),transmissionMapUv:$t&&_(y.transmissionMap.channel),thicknessMapUv:oe&&_(y.thicknessMap.channel),alphaMapUv:ct&&_(y.alphaMap.channel),vertexTangents:!!O.attributes.tangent&&(X||N),vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!O.attributes.color&&O.attributes.color.itemSize===4,vertexUv1s:Lt,vertexUv2s:Ct,vertexUv3s:Jt,pointsUvs:nt.isPoints===!0&&!!O.attributes.uv&&(St||ct),fog:!!I,useFog:y.fog===!0,fogExp2:I&&I.isFogExp2,flatShading:y.flatShading===!0,sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:u,skinning:nt.isSkinnedMesh===!0,morphTargets:O.morphAttributes.position!==void 0,morphNormals:O.morphAttributes.normal!==void 0,morphColors:O.morphAttributes.color!==void 0,morphTargetsCount:it,morphTextureStride:at,numDirLights:T.directional.length,numPointLights:T.point.length,numSpotLights:T.spot.length,numSpotLightMaps:T.spotLightMap.length,numRectAreaLights:T.rectArea.length,numHemiLights:T.hemi.length,numDirLightShadows:T.directionalShadowMap.length,numPointLightShadows:T.pointShadowMap.length,numSpotLightShadows:T.spotShadowMap.length,numSpotLightShadowsWithMaps:T.numSpotLightShadowsWithMaps,numLightProbes:T.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:y.dithering,shadowMapEnabled:s.shadowMap.enabled&&F.length>0,shadowMapType:s.shadowMap.type,toneMapping:Kt,useLegacyLights:s._useLegacyLights,decodeVideoTexture:St&&y.map.isVideoTexture===!0&&jt.getTransfer(y.map.colorSpace)===ee,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===Ne,flipSided:y.side===Fe,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionDerivatives:ft&&y.extensions.derivatives===!0,extensionFragDepth:ft&&y.extensions.fragDepth===!0,extensionDrawBuffers:ft&&y.extensions.drawBuffers===!0,extensionShaderTextureLOD:ft&&y.extensions.shaderTextureLOD===!0,extensionClipCullDistance:ft&&y.extensions.clipCullDistance&&n.has("WEBGL_clip_cull_distance"),rendererExtensionFragDepth:h||n.has("EXT_frag_depth"),rendererExtensionDrawBuffers:h||n.has("WEBGL_draw_buffers"),rendererExtensionShaderTextureLod:h||n.has("EXT_shader_texture_lod"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()}}function f(y){const T=[];if(y.shaderID?T.push(y.shaderID):(T.push(y.customVertexShaderID),T.push(y.customFragmentShaderID)),y.defines!==void 0)for(const F in y.defines)T.push(F),T.push(y.defines[F]);return y.isRawShaderMaterial===!1&&(M(T,y),v(T,y),T.push(s.outputColorSpace)),T.push(y.customProgramCacheKey),T.join()}function M(y,T){y.push(T.precision),y.push(T.outputColorSpace),y.push(T.envMapMode),y.push(T.envMapCubeUVHeight),y.push(T.mapUv),y.push(T.alphaMapUv),y.push(T.lightMapUv),y.push(T.aoMapUv),y.push(T.bumpMapUv),y.push(T.normalMapUv),y.push(T.displacementMapUv),y.push(T.emissiveMapUv),y.push(T.metalnessMapUv),y.push(T.roughnessMapUv),y.push(T.anisotropyMapUv),y.push(T.clearcoatMapUv),y.push(T.clearcoatNormalMapUv),y.push(T.clearcoatRoughnessMapUv),y.push(T.iridescenceMapUv),y.push(T.iridescenceThicknessMapUv),y.push(T.sheenColorMapUv),y.push(T.sheenRoughnessMapUv),y.push(T.specularMapUv),y.push(T.specularColorMapUv),y.push(T.specularIntensityMapUv),y.push(T.transmissionMapUv),y.push(T.thicknessMapUv),y.push(T.combine),y.push(T.fogExp2),y.push(T.sizeAttenuation),y.push(T.morphTargetsCount),y.push(T.morphAttributeCount),y.push(T.numDirLights),y.push(T.numPointLights),y.push(T.numSpotLights),y.push(T.numSpotLightMaps),y.push(T.numHemiLights),y.push(T.numRectAreaLights),y.push(T.numDirLightShadows),y.push(T.numPointLightShadows),y.push(T.numSpotLightShadows),y.push(T.numSpotLightShadowsWithMaps),y.push(T.numLightProbes),y.push(T.shadowMapType),y.push(T.toneMapping),y.push(T.numClippingPlanes),y.push(T.numClipIntersection),y.push(T.depthPacking)}function v(y,T){o.disableAll(),T.isWebGL2&&o.enable(0),T.supportsVertexTextures&&o.enable(1),T.instancing&&o.enable(2),T.instancingColor&&o.enable(3),T.matcap&&o.enable(4),T.envMap&&o.enable(5),T.normalMapObjectSpace&&o.enable(6),T.normalMapTangentSpace&&o.enable(7),T.clearcoat&&o.enable(8),T.iridescence&&o.enable(9),T.alphaTest&&o.enable(10),T.vertexColors&&o.enable(11),T.vertexAlphas&&o.enable(12),T.vertexUv1s&&o.enable(13),T.vertexUv2s&&o.enable(14),T.vertexUv3s&&o.enable(15),T.vertexTangents&&o.enable(16),T.anisotropy&&o.enable(17),T.alphaHash&&o.enable(18),T.batching&&o.enable(19),y.push(o.mask),o.disableAll(),T.fog&&o.enable(0),T.useFog&&o.enable(1),T.flatShading&&o.enable(2),T.logarithmicDepthBuffer&&o.enable(3),T.skinning&&o.enable(4),T.morphTargets&&o.enable(5),T.morphNormals&&o.enable(6),T.morphColors&&o.enable(7),T.premultipliedAlpha&&o.enable(8),T.shadowMapEnabled&&o.enable(9),T.useLegacyLights&&o.enable(10),T.doubleSided&&o.enable(11),T.flipSided&&o.enable(12),T.useDepthPacking&&o.enable(13),T.dithering&&o.enable(14),T.transmission&&o.enable(15),T.sheen&&o.enable(16),T.opaque&&o.enable(17),T.pointsUvs&&o.enable(18),T.decodeVideoTexture&&o.enable(19),y.push(o.mask)}function S(y){const T=g[y.type];let F;if(T){const V=sn[T];F=Uh.clone(V.uniforms)}else F=y.uniforms;return F}function L(y,T){let F;for(let V=0,nt=c.length;V<nt;V++){const I=c[V];if(I.cacheKey===T){F=I,++F.usedTimes;break}}return F===void 0&&(F=new Zp(s,T,y,r),c.push(F)),F}function A(y){if(--y.usedTimes===0){const T=c.indexOf(y);c[T]=c[c.length-1],c.pop(),y.destroy()}}function C(y){l.remove(y)}function B(){l.dispose()}return{getParameters:m,getProgramCacheKey:f,getUniforms:S,acquireProgram:L,releaseProgram:A,releaseShaderCache:C,programs:c,dispose:B}}function tm(){let s=new WeakMap;function t(r){let a=s.get(r);return a===void 0&&(a={},s.set(r,a)),a}function e(r){s.delete(r)}function n(r,a,o){s.get(r)[a]=o}function i(){s=new WeakMap}return{get:t,remove:e,update:n,dispose:i}}function em(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.material.id!==t.material.id?s.material.id-t.material.id:s.z!==t.z?s.z-t.z:s.id-t.id}function No(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.z!==t.z?t.z-s.z:s.id-t.id}function Fo(){const s=[];let t=0;const e=[],n=[],i=[];function r(){t=0,e.length=0,n.length=0,i.length=0}function a(u,d,p,g,_,m){let f=s[t];return f===void 0?(f={id:u.id,object:u,geometry:d,material:p,groupOrder:g,renderOrder:u.renderOrder,z:_,group:m},s[t]=f):(f.id=u.id,f.object=u,f.geometry=d,f.material=p,f.groupOrder=g,f.renderOrder=u.renderOrder,f.z=_,f.group=m),t++,f}function o(u,d,p,g,_,m){const f=a(u,d,p,g,_,m);p.transmission>0?n.push(f):p.transparent===!0?i.push(f):e.push(f)}function l(u,d,p,g,_,m){const f=a(u,d,p,g,_,m);p.transmission>0?n.unshift(f):p.transparent===!0?i.unshift(f):e.unshift(f)}function c(u,d){e.length>1&&e.sort(u||em),n.length>1&&n.sort(d||No),i.length>1&&i.sort(d||No)}function h(){for(let u=t,d=s.length;u<d;u++){const p=s[u];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:e,transmissive:n,transparent:i,init:r,push:o,unshift:l,finish:h,sort:c}}function nm(){let s=new WeakMap;function t(n,i){const r=s.get(n);let a;return r===void 0?(a=new Fo,s.set(n,[a])):i>=r.length?(a=new Fo,r.push(a)):a=r[i],a}function e(){s=new WeakMap}return{get:t,dispose:e}}function im(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new R,color:new Tt};break;case"SpotLight":e={position:new R,direction:new R,color:new Tt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new R,color:new Tt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new R,skyColor:new Tt,groundColor:new Tt};break;case"RectAreaLight":e={color:new Tt,position:new R,halfWidth:new R,halfHeight:new R};break}return s[t.id]=e,e}}}function sm(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new rt};break;case"SpotLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new rt};break;case"PointLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new rt,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[t.id]=e,e}}}let rm=0;function am(s,t){return(t.castShadow?2:0)-(s.castShadow?2:0)+(t.map?1:0)-(s.map?1:0)}function om(s,t){const e=new im,n=sm(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let h=0;h<9;h++)i.probe.push(new R);const r=new R,a=new ne,o=new ne;function l(h,u){let d=0,p=0,g=0;for(let V=0;V<9;V++)i.probe[V].set(0,0,0);let _=0,m=0,f=0,M=0,v=0,S=0,L=0,A=0,C=0,B=0,y=0;h.sort(am);const T=u===!0?Math.PI:1;for(let V=0,nt=h.length;V<nt;V++){const I=h[V],O=I.color,k=I.intensity,Z=I.distance,Y=I.shadow&&I.shadow.map?I.shadow.map.texture:null;if(I.isAmbientLight)d+=O.r*k*T,p+=O.g*k*T,g+=O.b*k*T;else if(I.isLightProbe){for(let $=0;$<9;$++)i.probe[$].addScaledVector(I.sh.coefficients[$],k);y++}else if(I.isDirectionalLight){const $=e.get(I);if($.color.copy(I.color).multiplyScalar(I.intensity*T),I.castShadow){const j=I.shadow,it=n.get(I);it.shadowBias=j.bias,it.shadowNormalBias=j.normalBias,it.shadowRadius=j.radius,it.shadowMapSize=j.mapSize,i.directionalShadow[_]=it,i.directionalShadowMap[_]=Y,i.directionalShadowMatrix[_]=I.shadow.matrix,S++}i.directional[_]=$,_++}else if(I.isSpotLight){const $=e.get(I);$.position.setFromMatrixPosition(I.matrixWorld),$.color.copy(O).multiplyScalar(k*T),$.distance=Z,$.coneCos=Math.cos(I.angle),$.penumbraCos=Math.cos(I.angle*(1-I.penumbra)),$.decay=I.decay,i.spot[f]=$;const j=I.shadow;if(I.map&&(i.spotLightMap[C]=I.map,C++,j.updateMatrices(I),I.castShadow&&B++),i.spotLightMatrix[f]=j.matrix,I.castShadow){const it=n.get(I);it.shadowBias=j.bias,it.shadowNormalBias=j.normalBias,it.shadowRadius=j.radius,it.shadowMapSize=j.mapSize,i.spotShadow[f]=it,i.spotShadowMap[f]=Y,A++}f++}else if(I.isRectAreaLight){const $=e.get(I);$.color.copy(O).multiplyScalar(k),$.halfWidth.set(I.width*.5,0,0),$.halfHeight.set(0,I.height*.5,0),i.rectArea[M]=$,M++}else if(I.isPointLight){const $=e.get(I);if($.color.copy(I.color).multiplyScalar(I.intensity*T),$.distance=I.distance,$.decay=I.decay,I.castShadow){const j=I.shadow,it=n.get(I);it.shadowBias=j.bias,it.shadowNormalBias=j.normalBias,it.shadowRadius=j.radius,it.shadowMapSize=j.mapSize,it.shadowCameraNear=j.camera.near,it.shadowCameraFar=j.camera.far,i.pointShadow[m]=it,i.pointShadowMap[m]=Y,i.pointShadowMatrix[m]=I.shadow.matrix,L++}i.point[m]=$,m++}else if(I.isHemisphereLight){const $=e.get(I);$.skyColor.copy(I.color).multiplyScalar(k*T),$.groundColor.copy(I.groundColor).multiplyScalar(k*T),i.hemi[v]=$,v++}}M>0&&(t.isWebGL2?s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ht.LTC_FLOAT_1,i.rectAreaLTC2=ht.LTC_FLOAT_2):(i.rectAreaLTC1=ht.LTC_HALF_1,i.rectAreaLTC2=ht.LTC_HALF_2):s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ht.LTC_FLOAT_1,i.rectAreaLTC2=ht.LTC_FLOAT_2):s.has("OES_texture_half_float_linear")===!0?(i.rectAreaLTC1=ht.LTC_HALF_1,i.rectAreaLTC2=ht.LTC_HALF_2):console.error("THREE.WebGLRenderer: Unable to use RectAreaLight. Missing WebGL extensions.")),i.ambient[0]=d,i.ambient[1]=p,i.ambient[2]=g;const F=i.hash;(F.directionalLength!==_||F.pointLength!==m||F.spotLength!==f||F.rectAreaLength!==M||F.hemiLength!==v||F.numDirectionalShadows!==S||F.numPointShadows!==L||F.numSpotShadows!==A||F.numSpotMaps!==C||F.numLightProbes!==y)&&(i.directional.length=_,i.spot.length=f,i.rectArea.length=M,i.point.length=m,i.hemi.length=v,i.directionalShadow.length=S,i.directionalShadowMap.length=S,i.pointShadow.length=L,i.pointShadowMap.length=L,i.spotShadow.length=A,i.spotShadowMap.length=A,i.directionalShadowMatrix.length=S,i.pointShadowMatrix.length=L,i.spotLightMatrix.length=A+C-B,i.spotLightMap.length=C,i.numSpotLightShadowsWithMaps=B,i.numLightProbes=y,F.directionalLength=_,F.pointLength=m,F.spotLength=f,F.rectAreaLength=M,F.hemiLength=v,F.numDirectionalShadows=S,F.numPointShadows=L,F.numSpotShadows=A,F.numSpotMaps=C,F.numLightProbes=y,i.version=rm++)}function c(h,u){let d=0,p=0,g=0,_=0,m=0;const f=u.matrixWorldInverse;for(let M=0,v=h.length;M<v;M++){const S=h[M];if(S.isDirectionalLight){const L=i.directional[d];L.direction.setFromMatrixPosition(S.matrixWorld),r.setFromMatrixPosition(S.target.matrixWorld),L.direction.sub(r),L.direction.transformDirection(f),d++}else if(S.isSpotLight){const L=i.spot[g];L.position.setFromMatrixPosition(S.matrixWorld),L.position.applyMatrix4(f),L.direction.setFromMatrixPosition(S.matrixWorld),r.setFromMatrixPosition(S.target.matrixWorld),L.direction.sub(r),L.direction.transformDirection(f),g++}else if(S.isRectAreaLight){const L=i.rectArea[_];L.position.setFromMatrixPosition(S.matrixWorld),L.position.applyMatrix4(f),o.identity(),a.copy(S.matrixWorld),a.premultiply(f),o.extractRotation(a),L.halfWidth.set(S.width*.5,0,0),L.halfHeight.set(0,S.height*.5,0),L.halfWidth.applyMatrix4(o),L.halfHeight.applyMatrix4(o),_++}else if(S.isPointLight){const L=i.point[p];L.position.setFromMatrixPosition(S.matrixWorld),L.position.applyMatrix4(f),p++}else if(S.isHemisphereLight){const L=i.hemi[m];L.direction.setFromMatrixPosition(S.matrixWorld),L.direction.transformDirection(f),m++}}}return{setup:l,setupView:c,state:i}}function Oo(s,t){const e=new om(s,t),n=[],i=[];function r(){n.length=0,i.length=0}function a(u){n.push(u)}function o(u){i.push(u)}function l(u){e.setup(n,u)}function c(u){e.setupView(n,u)}return{init:r,state:{lightsArray:n,shadowsArray:i,lights:e},setupLights:l,setupLightsView:c,pushLight:a,pushShadow:o}}function lm(s,t){let e=new WeakMap;function n(r,a=0){const o=e.get(r);let l;return o===void 0?(l=new Oo(s,t),e.set(r,[l])):a>=o.length?(l=new Oo(s,t),o.push(l)):l=o[a],l}function i(){e=new WeakMap}return{get:n,dispose:i}}class cm extends vn{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Xc,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class hm extends vn{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const um=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,dm=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function fm(s,t,e){let n=new na;const i=new rt,r=new rt,a=new ve,o=new cm({depthPacking:qc}),l=new hm,c={},h=e.maxTextureSize,u={[Pn]:Fe,[Fe]:Pn,[Ne]:Ne},d=new qn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new rt},radius:{value:4}},vertexShader:um,fragmentShader:dm}),p=d.clone();p.defines.HORIZONTAL_PASS=1;const g=new Ee;g.setAttribute("position",new Re(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const _=new ot(g,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=nl;let f=this.type;this.render=function(A,C,B){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||A.length===0)return;const y=s.getRenderTarget(),T=s.getActiveCubeFace(),F=s.getActiveMipmapLevel(),V=s.state;V.setBlending(bn),V.buffers.color.setClear(1,1,1,1),V.buffers.depth.setTest(!0),V.setScissorTest(!1);const nt=f!==mn&&this.type===mn,I=f===mn&&this.type!==mn;for(let O=0,k=A.length;O<k;O++){const Z=A[O],Y=Z.shadow;if(Y===void 0){console.warn("THREE.WebGLShadowMap:",Z,"has no shadow.");continue}if(Y.autoUpdate===!1&&Y.needsUpdate===!1)continue;i.copy(Y.mapSize);const $=Y.getFrameExtents();if(i.multiply($),r.copy(Y.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(r.x=Math.floor(h/$.x),i.x=r.x*$.x,Y.mapSize.x=r.x),i.y>h&&(r.y=Math.floor(h/$.y),i.y=r.y*$.y,Y.mapSize.y=r.y)),Y.map===null||nt===!0||I===!0){const it=this.type!==mn?{minFilter:Ue,magFilter:Ue}:{};Y.map!==null&&Y.map.dispose(),Y.map=new Xn(i.x,i.y,it),Y.map.texture.name=Z.name+".shadowMap",Y.camera.updateProjectionMatrix()}s.setRenderTarget(Y.map),s.clear();const j=Y.getViewportCount();for(let it=0;it<j;it++){const at=Y.getViewport(it);a.set(r.x*at.x,r.y*at.y,r.x*at.z,r.y*at.w),V.viewport(a),Y.updateMatrices(Z,it),n=Y.getFrustum(),S(C,B,Y.camera,Z,this.type)}Y.isPointLightShadow!==!0&&this.type===mn&&M(Y,B),Y.needsUpdate=!1}f=this.type,m.needsUpdate=!1,s.setRenderTarget(y,T,F)};function M(A,C){const B=t.update(_);d.defines.VSM_SAMPLES!==A.blurSamples&&(d.defines.VSM_SAMPLES=A.blurSamples,p.defines.VSM_SAMPLES=A.blurSamples,d.needsUpdate=!0,p.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new Xn(i.x,i.y)),d.uniforms.shadow_pass.value=A.map.texture,d.uniforms.resolution.value=A.mapSize,d.uniforms.radius.value=A.radius,s.setRenderTarget(A.mapPass),s.clear(),s.renderBufferDirect(C,null,B,d,_,null),p.uniforms.shadow_pass.value=A.mapPass.texture,p.uniforms.resolution.value=A.mapSize,p.uniforms.radius.value=A.radius,s.setRenderTarget(A.map),s.clear(),s.renderBufferDirect(C,null,B,p,_,null)}function v(A,C,B,y){let T=null;const F=B.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(F!==void 0)T=F;else if(T=B.isPointLight===!0?l:o,s.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0){const V=T.uuid,nt=C.uuid;let I=c[V];I===void 0&&(I={},c[V]=I);let O=I[nt];O===void 0&&(O=T.clone(),I[nt]=O,C.addEventListener("dispose",L)),T=O}if(T.visible=C.visible,T.wireframe=C.wireframe,y===mn?T.side=C.shadowSide!==null?C.shadowSide:C.side:T.side=C.shadowSide!==null?C.shadowSide:u[C.side],T.alphaMap=C.alphaMap,T.alphaTest=C.alphaTest,T.map=C.map,T.clipShadows=C.clipShadows,T.clippingPlanes=C.clippingPlanes,T.clipIntersection=C.clipIntersection,T.displacementMap=C.displacementMap,T.displacementScale=C.displacementScale,T.displacementBias=C.displacementBias,T.wireframeLinewidth=C.wireframeLinewidth,T.linewidth=C.linewidth,B.isPointLight===!0&&T.isMeshDistanceMaterial===!0){const V=s.properties.get(T);V.light=B}return T}function S(A,C,B,y,T){if(A.visible===!1)return;if(A.layers.test(C.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&T===mn)&&(!A.frustumCulled||n.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(B.matrixWorldInverse,A.matrixWorld);const nt=t.update(A),I=A.material;if(Array.isArray(I)){const O=nt.groups;for(let k=0,Z=O.length;k<Z;k++){const Y=O[k],$=I[Y.materialIndex];if($&&$.visible){const j=v(A,$,y,T);A.onBeforeShadow(s,A,C,B,nt,j,Y),s.renderBufferDirect(B,null,nt,j,A,Y),A.onAfterShadow(s,A,C,B,nt,j,Y)}}}else if(I.visible){const O=v(A,I,y,T);A.onBeforeShadow(s,A,C,B,nt,O,null),s.renderBufferDirect(B,null,nt,O,A,null),A.onAfterShadow(s,A,C,B,nt,O,null)}}const V=A.children;for(let nt=0,I=V.length;nt<I;nt++)S(V[nt],C,B,y,T)}function L(A){A.target.removeEventListener("dispose",L);for(const B in c){const y=c[B],T=A.target.uuid;T in y&&(y[T].dispose(),delete y[T])}}}function pm(s,t,e){const n=e.isWebGL2;function i(){let D=!1;const dt=new ve;let ft=null;const Lt=new ve(0,0,0,0);return{setMask:function(Ct){ft!==Ct&&!D&&(s.colorMask(Ct,Ct,Ct,Ct),ft=Ct)},setLocked:function(Ct){D=Ct},setClear:function(Ct,Jt,Kt,pe,Pe){Pe===!0&&(Ct*=pe,Jt*=pe,Kt*=pe),dt.set(Ct,Jt,Kt,pe),Lt.equals(dt)===!1&&(s.clearColor(Ct,Jt,Kt,pe),Lt.copy(dt))},reset:function(){D=!1,ft=null,Lt.set(-1,0,0,0)}}}function r(){let D=!1,dt=null,ft=null,Lt=null;return{setTest:function(Ct){Ct?Ft(s.DEPTH_TEST):St(s.DEPTH_TEST)},setMask:function(Ct){dt!==Ct&&!D&&(s.depthMask(Ct),dt=Ct)},setFunc:function(Ct){if(ft!==Ct){switch(Ct){case Mc:s.depthFunc(s.NEVER);break;case Sc:s.depthFunc(s.ALWAYS);break;case Ec:s.depthFunc(s.LESS);break;case Bs:s.depthFunc(s.LEQUAL);break;case wc:s.depthFunc(s.EQUAL);break;case Tc:s.depthFunc(s.GEQUAL);break;case bc:s.depthFunc(s.GREATER);break;case Ac:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}ft=Ct}},setLocked:function(Ct){D=Ct},setClear:function(Ct){Lt!==Ct&&(s.clearDepth(Ct),Lt=Ct)},reset:function(){D=!1,dt=null,ft=null,Lt=null}}}function a(){let D=!1,dt=null,ft=null,Lt=null,Ct=null,Jt=null,Kt=null,pe=null,Pe=null;return{setTest:function(Qt){D||(Qt?Ft(s.STENCIL_TEST):St(s.STENCIL_TEST))},setMask:function(Qt){dt!==Qt&&!D&&(s.stencilMask(Qt),dt=Qt)},setFunc:function(Qt,Le,tn){(ft!==Qt||Lt!==Le||Ct!==tn)&&(s.stencilFunc(Qt,Le,tn),ft=Qt,Lt=Le,Ct=tn)},setOp:function(Qt,Le,tn){(Jt!==Qt||Kt!==Le||pe!==tn)&&(s.stencilOp(Qt,Le,tn),Jt=Qt,Kt=Le,pe=tn)},setLocked:function(Qt){D=Qt},setClear:function(Qt){Pe!==Qt&&(s.clearStencil(Qt),Pe=Qt)},reset:function(){D=!1,dt=null,ft=null,Lt=null,Ct=null,Jt=null,Kt=null,pe=null,Pe=null}}}const o=new i,l=new r,c=new a,h=new WeakMap,u=new WeakMap;let d={},p={},g=new WeakMap,_=[],m=null,f=!1,M=null,v=null,S=null,L=null,A=null,C=null,B=null,y=new Tt(0,0,0),T=0,F=!1,V=null,nt=null,I=null,O=null,k=null;const Z=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let Y=!1,$=0;const j=s.getParameter(s.VERSION);j.indexOf("WebGL")!==-1?($=parseFloat(/^WebGL (\d)/.exec(j)[1]),Y=$>=1):j.indexOf("OpenGL ES")!==-1&&($=parseFloat(/^OpenGL ES (\d)/.exec(j)[1]),Y=$>=2);let it=null,at={};const W=s.getParameter(s.SCISSOR_BOX),K=s.getParameter(s.VIEWPORT),pt=new ve().fromArray(W),Mt=new ve().fromArray(K);function _t(D,dt,ft,Lt){const Ct=new Uint8Array(4),Jt=s.createTexture();s.bindTexture(D,Jt),s.texParameteri(D,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(D,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let Kt=0;Kt<ft;Kt++)n&&(D===s.TEXTURE_3D||D===s.TEXTURE_2D_ARRAY)?s.texImage3D(dt,0,s.RGBA,1,1,Lt,0,s.RGBA,s.UNSIGNED_BYTE,Ct):s.texImage2D(dt+Kt,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,Ct);return Jt}const Pt={};Pt[s.TEXTURE_2D]=_t(s.TEXTURE_2D,s.TEXTURE_2D,1),Pt[s.TEXTURE_CUBE_MAP]=_t(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),n&&(Pt[s.TEXTURE_2D_ARRAY]=_t(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),Pt[s.TEXTURE_3D]=_t(s.TEXTURE_3D,s.TEXTURE_3D,1,1)),o.setClear(0,0,0,1),l.setClear(1),c.setClear(0),Ft(s.DEPTH_TEST),l.setFunc(Bs),mt(!1),E(xa),Ft(s.CULL_FACE),X(bn);function Ft(D){d[D]!==!0&&(s.enable(D),d[D]=!0)}function St(D){d[D]!==!1&&(s.disable(D),d[D]=!1)}function Ut(D,dt){return p[D]!==dt?(s.bindFramebuffer(D,dt),p[D]=dt,n&&(D===s.DRAW_FRAMEBUFFER&&(p[s.FRAMEBUFFER]=dt),D===s.FRAMEBUFFER&&(p[s.DRAW_FRAMEBUFFER]=dt)),!0):!1}function P(D,dt){let ft=_,Lt=!1;if(D)if(ft=g.get(dt),ft===void 0&&(ft=[],g.set(dt,ft)),D.isWebGLMultipleRenderTargets){const Ct=D.texture;if(ft.length!==Ct.length||ft[0]!==s.COLOR_ATTACHMENT0){for(let Jt=0,Kt=Ct.length;Jt<Kt;Jt++)ft[Jt]=s.COLOR_ATTACHMENT0+Jt;ft.length=Ct.length,Lt=!0}}else ft[0]!==s.COLOR_ATTACHMENT0&&(ft[0]=s.COLOR_ATTACHMENT0,Lt=!0);else ft[0]!==s.BACK&&(ft[0]=s.BACK,Lt=!0);Lt&&(e.isWebGL2?s.drawBuffers(ft):t.get("WEBGL_draw_buffers").drawBuffersWEBGL(ft))}function lt(D){return m!==D?(s.useProgram(D),m=D,!0):!1}const q={[zn]:s.FUNC_ADD,[ac]:s.FUNC_SUBTRACT,[oc]:s.FUNC_REVERSE_SUBTRACT};if(n)q[Sa]=s.MIN,q[Ea]=s.MAX;else{const D=t.get("EXT_blend_minmax");D!==null&&(q[Sa]=D.MIN_EXT,q[Ea]=D.MAX_EXT)}const st={[lc]:s.ZERO,[cc]:s.ONE,[hc]:s.SRC_COLOR,[Or]:s.SRC_ALPHA,[gc]:s.SRC_ALPHA_SATURATE,[pc]:s.DST_COLOR,[dc]:s.DST_ALPHA,[uc]:s.ONE_MINUS_SRC_COLOR,[Br]:s.ONE_MINUS_SRC_ALPHA,[mc]:s.ONE_MINUS_DST_COLOR,[fc]:s.ONE_MINUS_DST_ALPHA,[_c]:s.CONSTANT_COLOR,[vc]:s.ONE_MINUS_CONSTANT_COLOR,[xc]:s.CONSTANT_ALPHA,[yc]:s.ONE_MINUS_CONSTANT_ALPHA};function X(D,dt,ft,Lt,Ct,Jt,Kt,pe,Pe,Qt){if(D===bn){f===!0&&(St(s.BLEND),f=!1);return}if(f===!1&&(Ft(s.BLEND),f=!0),D!==rc){if(D!==M||Qt!==F){if((v!==zn||A!==zn)&&(s.blendEquation(s.FUNC_ADD),v=zn,A=zn),Qt)switch(D){case Gn:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case Yi:s.blendFunc(s.ONE,s.ONE);break;case ya:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case Ma:s.blendFuncSeparate(s.ZERO,s.SRC_COLOR,s.ZERO,s.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}else switch(D){case Gn:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case Yi:s.blendFunc(s.SRC_ALPHA,s.ONE);break;case ya:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case Ma:s.blendFunc(s.ZERO,s.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}S=null,L=null,C=null,B=null,y.set(0,0,0),T=0,M=D,F=Qt}return}Ct=Ct||dt,Jt=Jt||ft,Kt=Kt||Lt,(dt!==v||Ct!==A)&&(s.blendEquationSeparate(q[dt],q[Ct]),v=dt,A=Ct),(ft!==S||Lt!==L||Jt!==C||Kt!==B)&&(s.blendFuncSeparate(st[ft],st[Lt],st[Jt],st[Kt]),S=ft,L=Lt,C=Jt,B=Kt),(pe.equals(y)===!1||Pe!==T)&&(s.blendColor(pe.r,pe.g,pe.b,Pe),y.copy(pe),T=Pe),M=D,F=!1}function wt(D,dt){D.side===Ne?St(s.CULL_FACE):Ft(s.CULL_FACE);let ft=D.side===Fe;dt&&(ft=!ft),mt(ft),D.blending===Gn&&D.transparent===!1?X(bn):X(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),l.setFunc(D.depthFunc),l.setTest(D.depthTest),l.setMask(D.depthWrite),o.setMask(D.colorWrite);const Lt=D.stencilWrite;c.setTest(Lt),Lt&&(c.setMask(D.stencilWriteMask),c.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),c.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),N(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?Ft(s.SAMPLE_ALPHA_TO_COVERAGE):St(s.SAMPLE_ALPHA_TO_COVERAGE)}function mt(D){V!==D&&(D?s.frontFace(s.CW):s.frontFace(s.CCW),V=D)}function E(D){D!==ic?(Ft(s.CULL_FACE),D!==nt&&(D===xa?s.cullFace(s.BACK):D===sc?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):St(s.CULL_FACE),nt=D}function x(D){D!==I&&(Y&&s.lineWidth(D),I=D)}function N(D,dt,ft){D?(Ft(s.POLYGON_OFFSET_FILL),(O!==dt||k!==ft)&&(s.polygonOffset(dt,ft),O=dt,k=ft)):St(s.POLYGON_OFFSET_FILL)}function et(D){D?Ft(s.SCISSOR_TEST):St(s.SCISSOR_TEST)}function Q(D){D===void 0&&(D=s.TEXTURE0+Z-1),it!==D&&(s.activeTexture(D),it=D)}function J(D,dt,ft){ft===void 0&&(it===null?ft=s.TEXTURE0+Z-1:ft=it);let Lt=at[ft];Lt===void 0&&(Lt={type:void 0,texture:void 0},at[ft]=Lt),(Lt.type!==D||Lt.texture!==dt)&&(it!==ft&&(s.activeTexture(ft),it=ft),s.bindTexture(D,dt||Pt[D]),Lt.type=D,Lt.texture=dt)}function yt(){const D=at[it];D!==void 0&&D.type!==void 0&&(s.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function ut(){try{s.compressedTexImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function vt(){try{s.compressedTexImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function At(){try{s.texSubImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Bt(){try{s.texSubImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function tt(){try{s.compressedTexSubImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Yt(){try{s.compressedTexSubImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function qt(){try{s.texStorage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Nt(){try{s.texStorage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function bt(){try{s.texImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function xt(){try{s.texImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Ht(D){pt.equals(D)===!1&&(s.scissor(D.x,D.y,D.z,D.w),pt.copy(D))}function $t(D){Mt.equals(D)===!1&&(s.viewport(D.x,D.y,D.z,D.w),Mt.copy(D))}function oe(D,dt){let ft=u.get(dt);ft===void 0&&(ft=new WeakMap,u.set(dt,ft));let Lt=ft.get(D);Lt===void 0&&(Lt=s.getUniformBlockIndex(dt,D.name),ft.set(D,Lt))}function Vt(D,dt){const Lt=u.get(dt).get(D);h.get(dt)!==Lt&&(s.uniformBlockBinding(dt,Lt,D.__bindingPointIndex),h.set(dt,Lt))}function ct(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),n===!0&&(s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null)),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),d={},it=null,at={},p={},g=new WeakMap,_=[],m=null,f=!1,M=null,v=null,S=null,L=null,A=null,C=null,B=null,y=new Tt(0,0,0),T=0,F=!1,V=null,nt=null,I=null,O=null,k=null,pt.set(0,0,s.canvas.width,s.canvas.height),Mt.set(0,0,s.canvas.width,s.canvas.height),o.reset(),l.reset(),c.reset()}return{buffers:{color:o,depth:l,stencil:c},enable:Ft,disable:St,bindFramebuffer:Ut,drawBuffers:P,useProgram:lt,setBlending:X,setMaterial:wt,setFlipSided:mt,setCullFace:E,setLineWidth:x,setPolygonOffset:N,setScissorTest:et,activeTexture:Q,bindTexture:J,unbindTexture:yt,compressedTexImage2D:ut,compressedTexImage3D:vt,texImage2D:bt,texImage3D:xt,updateUBOMapping:oe,uniformBlockBinding:Vt,texStorage2D:qt,texStorage3D:Nt,texSubImage2D:At,texSubImage3D:Bt,compressedTexSubImage2D:tt,compressedTexSubImage3D:Yt,scissor:Ht,viewport:$t,reset:ct}}function mm(s,t,e,n,i,r,a){const o=i.isWebGL2,l=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),h=new WeakMap;let u;const d=new WeakMap;let p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(E,x){return p?new OffscreenCanvas(E,x):Ws("canvas")}function _(E,x,N,et){let Q=1;if((E.width>et||E.height>et)&&(Q=et/Math.max(E.width,E.height)),Q<1||x===!0)if(typeof HTMLImageElement<"u"&&E instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&E instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&E instanceof ImageBitmap){const J=x?Vs:Math.floor,yt=J(Q*E.width),ut=J(Q*E.height);u===void 0&&(u=g(yt,ut));const vt=N?g(yt,ut):u;return vt.width=yt,vt.height=ut,vt.getContext("2d").drawImage(E,0,0,yt,ut),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+E.width+"x"+E.height+") to ("+yt+"x"+ut+")."),vt}else return"data"in E&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+E.width+"x"+E.height+")."),E;return E}function m(E){return Xr(E.width)&&Xr(E.height)}function f(E){return o?!1:E.wrapS!==Ke||E.wrapT!==Ke||E.minFilter!==Ue&&E.minFilter!==We}function M(E,x){return E.generateMipmaps&&x&&E.minFilter!==Ue&&E.minFilter!==We}function v(E){s.generateMipmap(E)}function S(E,x,N,et,Q=!1){if(o===!1)return x;if(E!==null){if(s[E]!==void 0)return s[E];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+E+"'")}let J=x;if(x===s.RED&&(N===s.FLOAT&&(J=s.R32F),N===s.HALF_FLOAT&&(J=s.R16F),N===s.UNSIGNED_BYTE&&(J=s.R8)),x===s.RED_INTEGER&&(N===s.UNSIGNED_BYTE&&(J=s.R8UI),N===s.UNSIGNED_SHORT&&(J=s.R16UI),N===s.UNSIGNED_INT&&(J=s.R32UI),N===s.BYTE&&(J=s.R8I),N===s.SHORT&&(J=s.R16I),N===s.INT&&(J=s.R32I)),x===s.RG&&(N===s.FLOAT&&(J=s.RG32F),N===s.HALF_FLOAT&&(J=s.RG16F),N===s.UNSIGNED_BYTE&&(J=s.RG8)),x===s.RGBA){const yt=Q?zs:jt.getTransfer(et);N===s.FLOAT&&(J=s.RGBA32F),N===s.HALF_FLOAT&&(J=s.RGBA16F),N===s.UNSIGNED_BYTE&&(J=yt===ee?s.SRGB8_ALPHA8:s.RGBA8),N===s.UNSIGNED_SHORT_4_4_4_4&&(J=s.RGBA4),N===s.UNSIGNED_SHORT_5_5_5_1&&(J=s.RGB5_A1)}return(J===s.R16F||J===s.R32F||J===s.RG16F||J===s.RG32F||J===s.RGBA16F||J===s.RGBA32F)&&t.get("EXT_color_buffer_float"),J}function L(E,x,N){return M(E,N)===!0||E.isFramebufferTexture&&E.minFilter!==Ue&&E.minFilter!==We?Math.log2(Math.max(x.width,x.height))+1:E.mipmaps!==void 0&&E.mipmaps.length>0?E.mipmaps.length:E.isCompressedTexture&&Array.isArray(E.image)?x.mipmaps.length:1}function A(E){return E===Ue||E===wa||E===nr?s.NEAREST:s.LINEAR}function C(E){const x=E.target;x.removeEventListener("dispose",C),y(x),x.isVideoTexture&&h.delete(x)}function B(E){const x=E.target;x.removeEventListener("dispose",B),F(x)}function y(E){const x=n.get(E);if(x.__webglInit===void 0)return;const N=E.source,et=d.get(N);if(et){const Q=et[x.__cacheKey];Q.usedTimes--,Q.usedTimes===0&&T(E),Object.keys(et).length===0&&d.delete(N)}n.remove(E)}function T(E){const x=n.get(E);s.deleteTexture(x.__webglTexture);const N=E.source,et=d.get(N);delete et[x.__cacheKey],a.memory.textures--}function F(E){const x=E.texture,N=n.get(E),et=n.get(x);if(et.__webglTexture!==void 0&&(s.deleteTexture(et.__webglTexture),a.memory.textures--),E.depthTexture&&E.depthTexture.dispose(),E.isWebGLCubeRenderTarget)for(let Q=0;Q<6;Q++){if(Array.isArray(N.__webglFramebuffer[Q]))for(let J=0;J<N.__webglFramebuffer[Q].length;J++)s.deleteFramebuffer(N.__webglFramebuffer[Q][J]);else s.deleteFramebuffer(N.__webglFramebuffer[Q]);N.__webglDepthbuffer&&s.deleteRenderbuffer(N.__webglDepthbuffer[Q])}else{if(Array.isArray(N.__webglFramebuffer))for(let Q=0;Q<N.__webglFramebuffer.length;Q++)s.deleteFramebuffer(N.__webglFramebuffer[Q]);else s.deleteFramebuffer(N.__webglFramebuffer);if(N.__webglDepthbuffer&&s.deleteRenderbuffer(N.__webglDepthbuffer),N.__webglMultisampledFramebuffer&&s.deleteFramebuffer(N.__webglMultisampledFramebuffer),N.__webglColorRenderbuffer)for(let Q=0;Q<N.__webglColorRenderbuffer.length;Q++)N.__webglColorRenderbuffer[Q]&&s.deleteRenderbuffer(N.__webglColorRenderbuffer[Q]);N.__webglDepthRenderbuffer&&s.deleteRenderbuffer(N.__webglDepthRenderbuffer)}if(E.isWebGLMultipleRenderTargets)for(let Q=0,J=x.length;Q<J;Q++){const yt=n.get(x[Q]);yt.__webglTexture&&(s.deleteTexture(yt.__webglTexture),a.memory.textures--),n.remove(x[Q])}n.remove(x),n.remove(E)}let V=0;function nt(){V=0}function I(){const E=V;return E>=i.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+E+" texture units while this GPU supports only "+i.maxTextures),V+=1,E}function O(E){const x=[];return x.push(E.wrapS),x.push(E.wrapT),x.push(E.wrapR||0),x.push(E.magFilter),x.push(E.minFilter),x.push(E.anisotropy),x.push(E.internalFormat),x.push(E.format),x.push(E.type),x.push(E.generateMipmaps),x.push(E.premultiplyAlpha),x.push(E.flipY),x.push(E.unpackAlignment),x.push(E.colorSpace),x.join()}function k(E,x){const N=n.get(E);if(E.isVideoTexture&&wt(E),E.isRenderTargetTexture===!1&&E.version>0&&N.__version!==E.version){const et=E.image;if(et===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(et.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{pt(N,E,x);return}}e.bindTexture(s.TEXTURE_2D,N.__webglTexture,s.TEXTURE0+x)}function Z(E,x){const N=n.get(E);if(E.version>0&&N.__version!==E.version){pt(N,E,x);return}e.bindTexture(s.TEXTURE_2D_ARRAY,N.__webglTexture,s.TEXTURE0+x)}function Y(E,x){const N=n.get(E);if(E.version>0&&N.__version!==E.version){pt(N,E,x);return}e.bindTexture(s.TEXTURE_3D,N.__webglTexture,s.TEXTURE0+x)}function $(E,x){const N=n.get(E);if(E.version>0&&N.__version!==E.version){Mt(N,E,x);return}e.bindTexture(s.TEXTURE_CUBE_MAP,N.__webglTexture,s.TEXTURE0+x)}const j={[Gr]:s.REPEAT,[Ke]:s.CLAMP_TO_EDGE,[kr]:s.MIRRORED_REPEAT},it={[Ue]:s.NEAREST,[wa]:s.NEAREST_MIPMAP_NEAREST,[nr]:s.NEAREST_MIPMAP_LINEAR,[We]:s.LINEAR,[Fc]:s.LINEAR_MIPMAP_NEAREST,[$i]:s.LINEAR_MIPMAP_LINEAR},at={[$c]:s.NEVER,[th]:s.ALWAYS,[Zc]:s.LESS,[ml]:s.LEQUAL,[jc]:s.EQUAL,[Qc]:s.GEQUAL,[Jc]:s.GREATER,[Kc]:s.NOTEQUAL};function W(E,x,N){if(N?(s.texParameteri(E,s.TEXTURE_WRAP_S,j[x.wrapS]),s.texParameteri(E,s.TEXTURE_WRAP_T,j[x.wrapT]),(E===s.TEXTURE_3D||E===s.TEXTURE_2D_ARRAY)&&s.texParameteri(E,s.TEXTURE_WRAP_R,j[x.wrapR]),s.texParameteri(E,s.TEXTURE_MAG_FILTER,it[x.magFilter]),s.texParameteri(E,s.TEXTURE_MIN_FILTER,it[x.minFilter])):(s.texParameteri(E,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(E,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),(E===s.TEXTURE_3D||E===s.TEXTURE_2D_ARRAY)&&s.texParameteri(E,s.TEXTURE_WRAP_R,s.CLAMP_TO_EDGE),(x.wrapS!==Ke||x.wrapT!==Ke)&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping."),s.texParameteri(E,s.TEXTURE_MAG_FILTER,A(x.magFilter)),s.texParameteri(E,s.TEXTURE_MIN_FILTER,A(x.minFilter)),x.minFilter!==Ue&&x.minFilter!==We&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.")),x.compareFunction&&(s.texParameteri(E,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(E,s.TEXTURE_COMPARE_FUNC,at[x.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){const et=t.get("EXT_texture_filter_anisotropic");if(x.magFilter===Ue||x.minFilter!==nr&&x.minFilter!==$i||x.type===Tn&&t.has("OES_texture_float_linear")===!1||o===!1&&x.type===Zi&&t.has("OES_texture_half_float_linear")===!1)return;(x.anisotropy>1||n.get(x).__currentAnisotropy)&&(s.texParameterf(E,et.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,i.getMaxAnisotropy())),n.get(x).__currentAnisotropy=x.anisotropy)}}function K(E,x){let N=!1;E.__webglInit===void 0&&(E.__webglInit=!0,x.addEventListener("dispose",C));const et=x.source;let Q=d.get(et);Q===void 0&&(Q={},d.set(et,Q));const J=O(x);if(J!==E.__cacheKey){Q[J]===void 0&&(Q[J]={texture:s.createTexture(),usedTimes:0},a.memory.textures++,N=!0),Q[J].usedTimes++;const yt=Q[E.__cacheKey];yt!==void 0&&(Q[E.__cacheKey].usedTimes--,yt.usedTimes===0&&T(x)),E.__cacheKey=J,E.__webglTexture=Q[J].texture}return N}function pt(E,x,N){let et=s.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&(et=s.TEXTURE_2D_ARRAY),x.isData3DTexture&&(et=s.TEXTURE_3D);const Q=K(E,x),J=x.source;e.bindTexture(et,E.__webglTexture,s.TEXTURE0+N);const yt=n.get(J);if(J.version!==yt.__version||Q===!0){e.activeTexture(s.TEXTURE0+N);const ut=jt.getPrimaries(jt.workingColorSpace),vt=x.colorSpace===Ye?null:jt.getPrimaries(x.colorSpace),At=x.colorSpace===Ye||ut===vt?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,x.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,x.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,At);const Bt=f(x)&&m(x.image)===!1;let tt=_(x.image,Bt,!1,i.maxTextureSize);tt=mt(x,tt);const Yt=m(tt)||o,qt=r.convert(x.format,x.colorSpace);let Nt=r.convert(x.type),bt=S(x.internalFormat,qt,Nt,x.colorSpace,x.isVideoTexture);W(et,x,Yt);let xt;const Ht=x.mipmaps,$t=o&&x.isVideoTexture!==!0&&bt!==dl,oe=yt.__version===void 0||Q===!0,Vt=L(x,tt,Yt);if(x.isDepthTexture)bt=s.DEPTH_COMPONENT,o?x.type===Tn?bt=s.DEPTH_COMPONENT32F:x.type===wn?bt=s.DEPTH_COMPONENT24:x.type===kn?bt=s.DEPTH24_STENCIL8:bt=s.DEPTH_COMPONENT16:x.type===Tn&&console.error("WebGLRenderer: Floating point depth texture requires WebGL2."),x.format===Vn&&bt===s.DEPTH_COMPONENT&&x.type!==Qr&&x.type!==wn&&(console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture."),x.type=wn,Nt=r.convert(x.type)),x.format===Ti&&bt===s.DEPTH_COMPONENT&&(bt=s.DEPTH_STENCIL,x.type!==kn&&(console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture."),x.type=kn,Nt=r.convert(x.type))),oe&&($t?e.texStorage2D(s.TEXTURE_2D,1,bt,tt.width,tt.height):e.texImage2D(s.TEXTURE_2D,0,bt,tt.width,tt.height,0,qt,Nt,null));else if(x.isDataTexture)if(Ht.length>0&&Yt){$t&&oe&&e.texStorage2D(s.TEXTURE_2D,Vt,bt,Ht[0].width,Ht[0].height);for(let ct=0,D=Ht.length;ct<D;ct++)xt=Ht[ct],$t?e.texSubImage2D(s.TEXTURE_2D,ct,0,0,xt.width,xt.height,qt,Nt,xt.data):e.texImage2D(s.TEXTURE_2D,ct,bt,xt.width,xt.height,0,qt,Nt,xt.data);x.generateMipmaps=!1}else $t?(oe&&e.texStorage2D(s.TEXTURE_2D,Vt,bt,tt.width,tt.height),e.texSubImage2D(s.TEXTURE_2D,0,0,0,tt.width,tt.height,qt,Nt,tt.data)):e.texImage2D(s.TEXTURE_2D,0,bt,tt.width,tt.height,0,qt,Nt,tt.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){$t&&oe&&e.texStorage3D(s.TEXTURE_2D_ARRAY,Vt,bt,Ht[0].width,Ht[0].height,tt.depth);for(let ct=0,D=Ht.length;ct<D;ct++)xt=Ht[ct],x.format!==Qe?qt!==null?$t?e.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,ct,0,0,0,xt.width,xt.height,tt.depth,qt,xt.data,0,0):e.compressedTexImage3D(s.TEXTURE_2D_ARRAY,ct,bt,xt.width,xt.height,tt.depth,0,xt.data,0,0):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):$t?e.texSubImage3D(s.TEXTURE_2D_ARRAY,ct,0,0,0,xt.width,xt.height,tt.depth,qt,Nt,xt.data):e.texImage3D(s.TEXTURE_2D_ARRAY,ct,bt,xt.width,xt.height,tt.depth,0,qt,Nt,xt.data)}else{$t&&oe&&e.texStorage2D(s.TEXTURE_2D,Vt,bt,Ht[0].width,Ht[0].height);for(let ct=0,D=Ht.length;ct<D;ct++)xt=Ht[ct],x.format!==Qe?qt!==null?$t?e.compressedTexSubImage2D(s.TEXTURE_2D,ct,0,0,xt.width,xt.height,qt,xt.data):e.compressedTexImage2D(s.TEXTURE_2D,ct,bt,xt.width,xt.height,0,xt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):$t?e.texSubImage2D(s.TEXTURE_2D,ct,0,0,xt.width,xt.height,qt,Nt,xt.data):e.texImage2D(s.TEXTURE_2D,ct,bt,xt.width,xt.height,0,qt,Nt,xt.data)}else if(x.isDataArrayTexture)$t?(oe&&e.texStorage3D(s.TEXTURE_2D_ARRAY,Vt,bt,tt.width,tt.height,tt.depth),e.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,tt.width,tt.height,tt.depth,qt,Nt,tt.data)):e.texImage3D(s.TEXTURE_2D_ARRAY,0,bt,tt.width,tt.height,tt.depth,0,qt,Nt,tt.data);else if(x.isData3DTexture)$t?(oe&&e.texStorage3D(s.TEXTURE_3D,Vt,bt,tt.width,tt.height,tt.depth),e.texSubImage3D(s.TEXTURE_3D,0,0,0,0,tt.width,tt.height,tt.depth,qt,Nt,tt.data)):e.texImage3D(s.TEXTURE_3D,0,bt,tt.width,tt.height,tt.depth,0,qt,Nt,tt.data);else if(x.isFramebufferTexture){if(oe)if($t)e.texStorage2D(s.TEXTURE_2D,Vt,bt,tt.width,tt.height);else{let ct=tt.width,D=tt.height;for(let dt=0;dt<Vt;dt++)e.texImage2D(s.TEXTURE_2D,dt,bt,ct,D,0,qt,Nt,null),ct>>=1,D>>=1}}else if(Ht.length>0&&Yt){$t&&oe&&e.texStorage2D(s.TEXTURE_2D,Vt,bt,Ht[0].width,Ht[0].height);for(let ct=0,D=Ht.length;ct<D;ct++)xt=Ht[ct],$t?e.texSubImage2D(s.TEXTURE_2D,ct,0,0,qt,Nt,xt):e.texImage2D(s.TEXTURE_2D,ct,bt,qt,Nt,xt);x.generateMipmaps=!1}else $t?(oe&&e.texStorage2D(s.TEXTURE_2D,Vt,bt,tt.width,tt.height),e.texSubImage2D(s.TEXTURE_2D,0,0,0,qt,Nt,tt)):e.texImage2D(s.TEXTURE_2D,0,bt,qt,Nt,tt);M(x,Yt)&&v(et),yt.__version=J.version,x.onUpdate&&x.onUpdate(x)}E.__version=x.version}function Mt(E,x,N){if(x.image.length!==6)return;const et=K(E,x),Q=x.source;e.bindTexture(s.TEXTURE_CUBE_MAP,E.__webglTexture,s.TEXTURE0+N);const J=n.get(Q);if(Q.version!==J.__version||et===!0){e.activeTexture(s.TEXTURE0+N);const yt=jt.getPrimaries(jt.workingColorSpace),ut=x.colorSpace===Ye?null:jt.getPrimaries(x.colorSpace),vt=x.colorSpace===Ye||yt===ut?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,x.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,x.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,vt);const At=x.isCompressedTexture||x.image[0].isCompressedTexture,Bt=x.image[0]&&x.image[0].isDataTexture,tt=[];for(let ct=0;ct<6;ct++)!At&&!Bt?tt[ct]=_(x.image[ct],!1,!0,i.maxCubemapSize):tt[ct]=Bt?x.image[ct].image:x.image[ct],tt[ct]=mt(x,tt[ct]);const Yt=tt[0],qt=m(Yt)||o,Nt=r.convert(x.format,x.colorSpace),bt=r.convert(x.type),xt=S(x.internalFormat,Nt,bt,x.colorSpace),Ht=o&&x.isVideoTexture!==!0,$t=J.__version===void 0||et===!0;let oe=L(x,Yt,qt);W(s.TEXTURE_CUBE_MAP,x,qt);let Vt;if(At){Ht&&$t&&e.texStorage2D(s.TEXTURE_CUBE_MAP,oe,xt,Yt.width,Yt.height);for(let ct=0;ct<6;ct++){Vt=tt[ct].mipmaps;for(let D=0;D<Vt.length;D++){const dt=Vt[D];x.format!==Qe?Nt!==null?Ht?e.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,D,0,0,dt.width,dt.height,Nt,dt.data):e.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,D,xt,dt.width,dt.height,0,dt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Ht?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,D,0,0,dt.width,dt.height,Nt,bt,dt.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,D,xt,dt.width,dt.height,0,Nt,bt,dt.data)}}}else{Vt=x.mipmaps,Ht&&$t&&(Vt.length>0&&oe++,e.texStorage2D(s.TEXTURE_CUBE_MAP,oe,xt,tt[0].width,tt[0].height));for(let ct=0;ct<6;ct++)if(Bt){Ht?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,0,0,0,tt[ct].width,tt[ct].height,Nt,bt,tt[ct].data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,0,xt,tt[ct].width,tt[ct].height,0,Nt,bt,tt[ct].data);for(let D=0;D<Vt.length;D++){const ft=Vt[D].image[ct].image;Ht?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,D+1,0,0,ft.width,ft.height,Nt,bt,ft.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,D+1,xt,ft.width,ft.height,0,Nt,bt,ft.data)}}else{Ht?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,0,0,0,Nt,bt,tt[ct]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,0,xt,Nt,bt,tt[ct]);for(let D=0;D<Vt.length;D++){const dt=Vt[D];Ht?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,D+1,0,0,Nt,bt,dt.image[ct]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,D+1,xt,Nt,bt,dt.image[ct])}}}M(x,qt)&&v(s.TEXTURE_CUBE_MAP),J.__version=Q.version,x.onUpdate&&x.onUpdate(x)}E.__version=x.version}function _t(E,x,N,et,Q,J){const yt=r.convert(N.format,N.colorSpace),ut=r.convert(N.type),vt=S(N.internalFormat,yt,ut,N.colorSpace);if(!n.get(x).__hasExternalTextures){const Bt=Math.max(1,x.width>>J),tt=Math.max(1,x.height>>J);Q===s.TEXTURE_3D||Q===s.TEXTURE_2D_ARRAY?e.texImage3D(Q,J,vt,Bt,tt,x.depth,0,yt,ut,null):e.texImage2D(Q,J,vt,Bt,tt,0,yt,ut,null)}e.bindFramebuffer(s.FRAMEBUFFER,E),X(x)?l.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,et,Q,n.get(N).__webglTexture,0,st(x)):(Q===s.TEXTURE_2D||Q>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&Q<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,et,Q,n.get(N).__webglTexture,J),e.bindFramebuffer(s.FRAMEBUFFER,null)}function Pt(E,x,N){if(s.bindRenderbuffer(s.RENDERBUFFER,E),x.depthBuffer&&!x.stencilBuffer){let et=o===!0?s.DEPTH_COMPONENT24:s.DEPTH_COMPONENT16;if(N||X(x)){const Q=x.depthTexture;Q&&Q.isDepthTexture&&(Q.type===Tn?et=s.DEPTH_COMPONENT32F:Q.type===wn&&(et=s.DEPTH_COMPONENT24));const J=st(x);X(x)?l.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,J,et,x.width,x.height):s.renderbufferStorageMultisample(s.RENDERBUFFER,J,et,x.width,x.height)}else s.renderbufferStorage(s.RENDERBUFFER,et,x.width,x.height);s.framebufferRenderbuffer(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.RENDERBUFFER,E)}else if(x.depthBuffer&&x.stencilBuffer){const et=st(x);N&&X(x)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,et,s.DEPTH24_STENCIL8,x.width,x.height):X(x)?l.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,et,s.DEPTH24_STENCIL8,x.width,x.height):s.renderbufferStorage(s.RENDERBUFFER,s.DEPTH_STENCIL,x.width,x.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.RENDERBUFFER,E)}else{const et=x.isWebGLMultipleRenderTargets===!0?x.texture:[x.texture];for(let Q=0;Q<et.length;Q++){const J=et[Q],yt=r.convert(J.format,J.colorSpace),ut=r.convert(J.type),vt=S(J.internalFormat,yt,ut,J.colorSpace),At=st(x);N&&X(x)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,At,vt,x.width,x.height):X(x)?l.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,At,vt,x.width,x.height):s.renderbufferStorage(s.RENDERBUFFER,vt,x.width,x.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function Ft(E,x){if(x&&x.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(s.FRAMEBUFFER,E),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!n.get(x.depthTexture).__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),k(x.depthTexture,0);const et=n.get(x.depthTexture).__webglTexture,Q=st(x);if(x.depthTexture.format===Vn)X(x)?l.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,et,0,Q):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,et,0);else if(x.depthTexture.format===Ti)X(x)?l.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,et,0,Q):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,et,0);else throw new Error("Unknown depthTexture format")}function St(E){const x=n.get(E),N=E.isWebGLCubeRenderTarget===!0;if(E.depthTexture&&!x.__autoAllocateDepthBuffer){if(N)throw new Error("target.depthTexture not supported in Cube render targets");Ft(x.__webglFramebuffer,E)}else if(N){x.__webglDepthbuffer=[];for(let et=0;et<6;et++)e.bindFramebuffer(s.FRAMEBUFFER,x.__webglFramebuffer[et]),x.__webglDepthbuffer[et]=s.createRenderbuffer(),Pt(x.__webglDepthbuffer[et],E,!1)}else e.bindFramebuffer(s.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer=s.createRenderbuffer(),Pt(x.__webglDepthbuffer,E,!1);e.bindFramebuffer(s.FRAMEBUFFER,null)}function Ut(E,x,N){const et=n.get(E);x!==void 0&&_t(et.__webglFramebuffer,E,E.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),N!==void 0&&St(E)}function P(E){const x=E.texture,N=n.get(E),et=n.get(x);E.addEventListener("dispose",B),E.isWebGLMultipleRenderTargets!==!0&&(et.__webglTexture===void 0&&(et.__webglTexture=s.createTexture()),et.__version=x.version,a.memory.textures++);const Q=E.isWebGLCubeRenderTarget===!0,J=E.isWebGLMultipleRenderTargets===!0,yt=m(E)||o;if(Q){N.__webglFramebuffer=[];for(let ut=0;ut<6;ut++)if(o&&x.mipmaps&&x.mipmaps.length>0){N.__webglFramebuffer[ut]=[];for(let vt=0;vt<x.mipmaps.length;vt++)N.__webglFramebuffer[ut][vt]=s.createFramebuffer()}else N.__webglFramebuffer[ut]=s.createFramebuffer()}else{if(o&&x.mipmaps&&x.mipmaps.length>0){N.__webglFramebuffer=[];for(let ut=0;ut<x.mipmaps.length;ut++)N.__webglFramebuffer[ut]=s.createFramebuffer()}else N.__webglFramebuffer=s.createFramebuffer();if(J)if(i.drawBuffers){const ut=E.texture;for(let vt=0,At=ut.length;vt<At;vt++){const Bt=n.get(ut[vt]);Bt.__webglTexture===void 0&&(Bt.__webglTexture=s.createTexture(),a.memory.textures++)}}else console.warn("THREE.WebGLRenderer: WebGLMultipleRenderTargets can only be used with WebGL2 or WEBGL_draw_buffers extension.");if(o&&E.samples>0&&X(E)===!1){const ut=J?x:[x];N.__webglMultisampledFramebuffer=s.createFramebuffer(),N.__webglColorRenderbuffer=[],e.bindFramebuffer(s.FRAMEBUFFER,N.__webglMultisampledFramebuffer);for(let vt=0;vt<ut.length;vt++){const At=ut[vt];N.__webglColorRenderbuffer[vt]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,N.__webglColorRenderbuffer[vt]);const Bt=r.convert(At.format,At.colorSpace),tt=r.convert(At.type),Yt=S(At.internalFormat,Bt,tt,At.colorSpace,E.isXRRenderTarget===!0),qt=st(E);s.renderbufferStorageMultisample(s.RENDERBUFFER,qt,Yt,E.width,E.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+vt,s.RENDERBUFFER,N.__webglColorRenderbuffer[vt])}s.bindRenderbuffer(s.RENDERBUFFER,null),E.depthBuffer&&(N.__webglDepthRenderbuffer=s.createRenderbuffer(),Pt(N.__webglDepthRenderbuffer,E,!0)),e.bindFramebuffer(s.FRAMEBUFFER,null)}}if(Q){e.bindTexture(s.TEXTURE_CUBE_MAP,et.__webglTexture),W(s.TEXTURE_CUBE_MAP,x,yt);for(let ut=0;ut<6;ut++)if(o&&x.mipmaps&&x.mipmaps.length>0)for(let vt=0;vt<x.mipmaps.length;vt++)_t(N.__webglFramebuffer[ut][vt],E,x,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ut,vt);else _t(N.__webglFramebuffer[ut],E,x,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ut,0);M(x,yt)&&v(s.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(J){const ut=E.texture;for(let vt=0,At=ut.length;vt<At;vt++){const Bt=ut[vt],tt=n.get(Bt);e.bindTexture(s.TEXTURE_2D,tt.__webglTexture),W(s.TEXTURE_2D,Bt,yt),_t(N.__webglFramebuffer,E,Bt,s.COLOR_ATTACHMENT0+vt,s.TEXTURE_2D,0),M(Bt,yt)&&v(s.TEXTURE_2D)}e.unbindTexture()}else{let ut=s.TEXTURE_2D;if((E.isWebGL3DRenderTarget||E.isWebGLArrayRenderTarget)&&(o?ut=E.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY:console.error("THREE.WebGLTextures: THREE.Data3DTexture and THREE.DataArrayTexture only supported with WebGL2.")),e.bindTexture(ut,et.__webglTexture),W(ut,x,yt),o&&x.mipmaps&&x.mipmaps.length>0)for(let vt=0;vt<x.mipmaps.length;vt++)_t(N.__webglFramebuffer[vt],E,x,s.COLOR_ATTACHMENT0,ut,vt);else _t(N.__webglFramebuffer,E,x,s.COLOR_ATTACHMENT0,ut,0);M(x,yt)&&v(ut),e.unbindTexture()}E.depthBuffer&&St(E)}function lt(E){const x=m(E)||o,N=E.isWebGLMultipleRenderTargets===!0?E.texture:[E.texture];for(let et=0,Q=N.length;et<Q;et++){const J=N[et];if(M(J,x)){const yt=E.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:s.TEXTURE_2D,ut=n.get(J).__webglTexture;e.bindTexture(yt,ut),v(yt),e.unbindTexture()}}}function q(E){if(o&&E.samples>0&&X(E)===!1){const x=E.isWebGLMultipleRenderTargets?E.texture:[E.texture],N=E.width,et=E.height;let Q=s.COLOR_BUFFER_BIT;const J=[],yt=E.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ut=n.get(E),vt=E.isWebGLMultipleRenderTargets===!0;if(vt)for(let At=0;At<x.length;At++)e.bindFramebuffer(s.FRAMEBUFFER,ut.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+At,s.RENDERBUFFER,null),e.bindFramebuffer(s.FRAMEBUFFER,ut.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+At,s.TEXTURE_2D,null,0);e.bindFramebuffer(s.READ_FRAMEBUFFER,ut.__webglMultisampledFramebuffer),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,ut.__webglFramebuffer);for(let At=0;At<x.length;At++){J.push(s.COLOR_ATTACHMENT0+At),E.depthBuffer&&J.push(yt);const Bt=ut.__ignoreDepthValues!==void 0?ut.__ignoreDepthValues:!1;if(Bt===!1&&(E.depthBuffer&&(Q|=s.DEPTH_BUFFER_BIT),E.stencilBuffer&&(Q|=s.STENCIL_BUFFER_BIT)),vt&&s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,ut.__webglColorRenderbuffer[At]),Bt===!0&&(s.invalidateFramebuffer(s.READ_FRAMEBUFFER,[yt]),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[yt])),vt){const tt=n.get(x[At]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,tt,0)}s.blitFramebuffer(0,0,N,et,0,0,N,et,Q,s.NEAREST),c&&s.invalidateFramebuffer(s.READ_FRAMEBUFFER,J)}if(e.bindFramebuffer(s.READ_FRAMEBUFFER,null),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),vt)for(let At=0;At<x.length;At++){e.bindFramebuffer(s.FRAMEBUFFER,ut.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+At,s.RENDERBUFFER,ut.__webglColorRenderbuffer[At]);const Bt=n.get(x[At]).__webglTexture;e.bindFramebuffer(s.FRAMEBUFFER,ut.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+At,s.TEXTURE_2D,Bt,0)}e.bindFramebuffer(s.DRAW_FRAMEBUFFER,ut.__webglMultisampledFramebuffer)}}function st(E){return Math.min(i.maxSamples,E.samples)}function X(E){const x=n.get(E);return o&&E.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function wt(E){const x=a.render.frame;h.get(E)!==x&&(h.set(E,x),E.update())}function mt(E,x){const N=E.colorSpace,et=E.format,Q=E.type;return E.isCompressedTexture===!0||E.isVideoTexture===!0||E.format===Wr||N!==_n&&N!==Ye&&(jt.getTransfer(N)===ee?o===!1?t.has("EXT_sRGB")===!0&&et===Qe?(E.format=Wr,E.minFilter=We,E.generateMipmaps=!1):x=_l.sRGBToLinear(x):(et!==Qe||Q!==Cn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",N)),x}this.allocateTextureUnit=I,this.resetTextureUnits=nt,this.setTexture2D=k,this.setTexture2DArray=Z,this.setTexture3D=Y,this.setTextureCube=$,this.rebindTextures=Ut,this.setupRenderTarget=P,this.updateRenderTargetMipmap=lt,this.updateMultisampleRenderTarget=q,this.setupDepthRenderbuffer=St,this.setupFrameBufferTexture=_t,this.useMultisampledRTT=X}function gm(s,t,e){const n=e.isWebGL2;function i(r,a=Ye){let o;const l=jt.getTransfer(a);if(r===Cn)return s.UNSIGNED_BYTE;if(r===ol)return s.UNSIGNED_SHORT_4_4_4_4;if(r===ll)return s.UNSIGNED_SHORT_5_5_5_1;if(r===Oc)return s.BYTE;if(r===Bc)return s.SHORT;if(r===Qr)return s.UNSIGNED_SHORT;if(r===al)return s.INT;if(r===wn)return s.UNSIGNED_INT;if(r===Tn)return s.FLOAT;if(r===Zi)return n?s.HALF_FLOAT:(o=t.get("OES_texture_half_float"),o!==null?o.HALF_FLOAT_OES:null);if(r===zc)return s.ALPHA;if(r===Qe)return s.RGBA;if(r===Hc)return s.LUMINANCE;if(r===Gc)return s.LUMINANCE_ALPHA;if(r===Vn)return s.DEPTH_COMPONENT;if(r===Ti)return s.DEPTH_STENCIL;if(r===Wr)return o=t.get("EXT_sRGB"),o!==null?o.SRGB_ALPHA_EXT:null;if(r===kc)return s.RED;if(r===cl)return s.RED_INTEGER;if(r===Vc)return s.RG;if(r===hl)return s.RG_INTEGER;if(r===ul)return s.RGBA_INTEGER;if(r===ir||r===sr||r===rr||r===ar)if(l===ee)if(o=t.get("WEBGL_compressed_texture_s3tc_srgb"),o!==null){if(r===ir)return o.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(r===sr)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(r===rr)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(r===ar)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(o=t.get("WEBGL_compressed_texture_s3tc"),o!==null){if(r===ir)return o.COMPRESSED_RGB_S3TC_DXT1_EXT;if(r===sr)return o.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(r===rr)return o.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(r===ar)return o.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(r===Ta||r===ba||r===Aa||r===Ca)if(o=t.get("WEBGL_compressed_texture_pvrtc"),o!==null){if(r===Ta)return o.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(r===ba)return o.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(r===Aa)return o.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(r===Ca)return o.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(r===dl)return o=t.get("WEBGL_compressed_texture_etc1"),o!==null?o.COMPRESSED_RGB_ETC1_WEBGL:null;if(r===Ra||r===Pa)if(o=t.get("WEBGL_compressed_texture_etc"),o!==null){if(r===Ra)return l===ee?o.COMPRESSED_SRGB8_ETC2:o.COMPRESSED_RGB8_ETC2;if(r===Pa)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:o.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(r===La||r===Da||r===Ia||r===Ua||r===Na||r===Fa||r===Oa||r===Ba||r===za||r===Ha||r===Ga||r===ka||r===Va||r===Wa)if(o=t.get("WEBGL_compressed_texture_astc"),o!==null){if(r===La)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:o.COMPRESSED_RGBA_ASTC_4x4_KHR;if(r===Da)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:o.COMPRESSED_RGBA_ASTC_5x4_KHR;if(r===Ia)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:o.COMPRESSED_RGBA_ASTC_5x5_KHR;if(r===Ua)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:o.COMPRESSED_RGBA_ASTC_6x5_KHR;if(r===Na)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:o.COMPRESSED_RGBA_ASTC_6x6_KHR;if(r===Fa)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:o.COMPRESSED_RGBA_ASTC_8x5_KHR;if(r===Oa)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:o.COMPRESSED_RGBA_ASTC_8x6_KHR;if(r===Ba)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:o.COMPRESSED_RGBA_ASTC_8x8_KHR;if(r===za)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:o.COMPRESSED_RGBA_ASTC_10x5_KHR;if(r===Ha)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:o.COMPRESSED_RGBA_ASTC_10x6_KHR;if(r===Ga)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:o.COMPRESSED_RGBA_ASTC_10x8_KHR;if(r===ka)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:o.COMPRESSED_RGBA_ASTC_10x10_KHR;if(r===Va)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:o.COMPRESSED_RGBA_ASTC_12x10_KHR;if(r===Wa)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:o.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(r===or||r===Xa||r===qa)if(o=t.get("EXT_texture_compression_bptc"),o!==null){if(r===or)return l===ee?o.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:o.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(r===Xa)return o.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(r===qa)return o.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(r===Wc||r===Ya||r===$a||r===Za)if(o=t.get("EXT_texture_compression_rgtc"),o!==null){if(r===or)return o.COMPRESSED_RED_RGTC1_EXT;if(r===Ya)return o.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(r===$a)return o.COMPRESSED_RED_GREEN_RGTC2_EXT;if(r===Za)return o.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return r===kn?n?s.UNSIGNED_INT_24_8:(o=t.get("WEBGL_depth_texture"),o!==null?o.UNSIGNED_INT_24_8_WEBGL:null):s[r]!==void 0?s[r]:null}return{convert:i}}class _m extends qe{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class he extends ae{constructor(){super(),this.isGroup=!0,this.type="Group"}}const vm={type:"move"};class Pr{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new he,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new he,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new R,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new R),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new he,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new R,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new R),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let i=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){a=!0;for(const _ of t.hand.values()){const m=e.getJointPose(_,n),f=this._getHandJoint(c,_);m!==null&&(f.matrix.fromArray(m.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=m.radius),f.visible=m!==null}const h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),p=.02,g=.005;c.inputState.pinching&&d>p+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&d<=p-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(i=e.getPose(t.targetRaySpace,n),i===null&&r!==null&&(i=r),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity)):o.hasLinearVelocity=!1,i.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(vm)))}return o!==null&&(o.visible=i!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new he;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}class xm extends Ai{constructor(t,e){super();const n=this;let i=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,p=null,g=null;const _=e.getContextAttributes();let m=null,f=null;const M=[],v=[],S=new rt;let L=null;const A=new qe;A.layers.enable(1),A.viewport=new ve;const C=new qe;C.layers.enable(2),C.viewport=new ve;const B=[A,C],y=new _m;y.layers.enable(1),y.layers.enable(2);let T=null,F=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(W){let K=M[W];return K===void 0&&(K=new Pr,M[W]=K),K.getTargetRaySpace()},this.getControllerGrip=function(W){let K=M[W];return K===void 0&&(K=new Pr,M[W]=K),K.getGripSpace()},this.getHand=function(W){let K=M[W];return K===void 0&&(K=new Pr,M[W]=K),K.getHandSpace()};function V(W){const K=v.indexOf(W.inputSource);if(K===-1)return;const pt=M[K];pt!==void 0&&(pt.update(W.inputSource,W.frame,c||a),pt.dispatchEvent({type:W.type,data:W.inputSource}))}function nt(){i.removeEventListener("select",V),i.removeEventListener("selectstart",V),i.removeEventListener("selectend",V),i.removeEventListener("squeeze",V),i.removeEventListener("squeezestart",V),i.removeEventListener("squeezeend",V),i.removeEventListener("end",nt),i.removeEventListener("inputsourceschange",I);for(let W=0;W<M.length;W++){const K=v[W];K!==null&&(v[W]=null,M[W].disconnect(K))}T=null,F=null,t.setRenderTarget(m),p=null,d=null,u=null,i=null,f=null,at.stop(),n.isPresenting=!1,t.setPixelRatio(L),t.setSize(S.width,S.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(W){r=W,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(W){o=W,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(W){c=W},this.getBaseLayer=function(){return d!==null?d:p},this.getBinding=function(){return u},this.getFrame=function(){return g},this.getSession=function(){return i},this.setSession=async function(W){if(i=W,i!==null){if(m=t.getRenderTarget(),i.addEventListener("select",V),i.addEventListener("selectstart",V),i.addEventListener("selectend",V),i.addEventListener("squeeze",V),i.addEventListener("squeezestart",V),i.addEventListener("squeezeend",V),i.addEventListener("end",nt),i.addEventListener("inputsourceschange",I),_.xrCompatible!==!0&&await e.makeXRCompatible(),L=t.getPixelRatio(),t.getSize(S),i.renderState.layers===void 0||t.capabilities.isWebGL2===!1){const K={antialias:i.renderState.layers===void 0?_.antialias:!0,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(i,e,K),i.updateRenderState({baseLayer:p}),t.setPixelRatio(1),t.setSize(p.framebufferWidth,p.framebufferHeight,!1),f=new Xn(p.framebufferWidth,p.framebufferHeight,{format:Qe,type:Cn,colorSpace:t.outputColorSpace,stencilBuffer:_.stencil})}else{let K=null,pt=null,Mt=null;_.depth&&(Mt=_.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,K=_.stencil?Ti:Vn,pt=_.stencil?kn:wn);const _t={colorFormat:e.RGBA8,depthFormat:Mt,scaleFactor:r};u=new XRWebGLBinding(i,e),d=u.createProjectionLayer(_t),i.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),f=new Xn(d.textureWidth,d.textureHeight,{format:Qe,type:Cn,depthTexture:new Pl(d.textureWidth,d.textureHeight,pt,void 0,void 0,void 0,void 0,void 0,void 0,K),stencilBuffer:_.stencil,colorSpace:t.outputColorSpace,samples:_.antialias?4:0});const Pt=t.properties.get(f);Pt.__ignoreDepthValues=d.ignoreDepthValues}f.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await i.requestReferenceSpace(o),at.setContext(i),at.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode};function I(W){for(let K=0;K<W.removed.length;K++){const pt=W.removed[K],Mt=v.indexOf(pt);Mt>=0&&(v[Mt]=null,M[Mt].disconnect(pt))}for(let K=0;K<W.added.length;K++){const pt=W.added[K];let Mt=v.indexOf(pt);if(Mt===-1){for(let Pt=0;Pt<M.length;Pt++)if(Pt>=v.length){v.push(pt),Mt=Pt;break}else if(v[Pt]===null){v[Pt]=pt,Mt=Pt;break}if(Mt===-1)break}const _t=M[Mt];_t&&_t.connect(pt)}}const O=new R,k=new R;function Z(W,K,pt){O.setFromMatrixPosition(K.matrixWorld),k.setFromMatrixPosition(pt.matrixWorld);const Mt=O.distanceTo(k),_t=K.projectionMatrix.elements,Pt=pt.projectionMatrix.elements,Ft=_t[14]/(_t[10]-1),St=_t[14]/(_t[10]+1),Ut=(_t[9]+1)/_t[5],P=(_t[9]-1)/_t[5],lt=(_t[8]-1)/_t[0],q=(Pt[8]+1)/Pt[0],st=Ft*lt,X=Ft*q,wt=Mt/(-lt+q),mt=wt*-lt;K.matrixWorld.decompose(W.position,W.quaternion,W.scale),W.translateX(mt),W.translateZ(wt),W.matrixWorld.compose(W.position,W.quaternion,W.scale),W.matrixWorldInverse.copy(W.matrixWorld).invert();const E=Ft+wt,x=St+wt,N=st-mt,et=X+(Mt-mt),Q=Ut*St/x*E,J=P*St/x*E;W.projectionMatrix.makePerspective(N,et,Q,J,E,x),W.projectionMatrixInverse.copy(W.projectionMatrix).invert()}function Y(W,K){K===null?W.matrixWorld.copy(W.matrix):W.matrixWorld.multiplyMatrices(K.matrixWorld,W.matrix),W.matrixWorldInverse.copy(W.matrixWorld).invert()}this.updateCamera=function(W){if(i===null)return;y.near=C.near=A.near=W.near,y.far=C.far=A.far=W.far,(T!==y.near||F!==y.far)&&(i.updateRenderState({depthNear:y.near,depthFar:y.far}),T=y.near,F=y.far);const K=W.parent,pt=y.cameras;Y(y,K);for(let Mt=0;Mt<pt.length;Mt++)Y(pt[Mt],K);pt.length===2?Z(y,A,C):y.projectionMatrix.copy(A.projectionMatrix),$(W,y,K)};function $(W,K,pt){pt===null?W.matrix.copy(K.matrixWorld):(W.matrix.copy(pt.matrixWorld),W.matrix.invert(),W.matrix.multiply(K.matrixWorld)),W.matrix.decompose(W.position,W.quaternion,W.scale),W.updateMatrixWorld(!0),W.projectionMatrix.copy(K.projectionMatrix),W.projectionMatrixInverse.copy(K.projectionMatrixInverse),W.isPerspectiveCamera&&(W.fov=ji*2*Math.atan(1/W.projectionMatrix.elements[5]),W.zoom=1)}this.getCamera=function(){return y},this.getFoveation=function(){if(!(d===null&&p===null))return l},this.setFoveation=function(W){l=W,d!==null&&(d.fixedFoveation=W),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=W)};let j=null;function it(W,K){if(h=K.getViewerPose(c||a),g=K,h!==null){const pt=h.views;p!==null&&(t.setRenderTargetFramebuffer(f,p.framebuffer),t.setRenderTarget(f));let Mt=!1;pt.length!==y.cameras.length&&(y.cameras.length=0,Mt=!0);for(let _t=0;_t<pt.length;_t++){const Pt=pt[_t];let Ft=null;if(p!==null)Ft=p.getViewport(Pt);else{const Ut=u.getViewSubImage(d,Pt);Ft=Ut.viewport,_t===0&&(t.setRenderTargetTextures(f,Ut.colorTexture,d.ignoreDepthValues?void 0:Ut.depthStencilTexture),t.setRenderTarget(f))}let St=B[_t];St===void 0&&(St=new qe,St.layers.enable(_t),St.viewport=new ve,B[_t]=St),St.matrix.fromArray(Pt.transform.matrix),St.matrix.decompose(St.position,St.quaternion,St.scale),St.projectionMatrix.fromArray(Pt.projectionMatrix),St.projectionMatrixInverse.copy(St.projectionMatrix).invert(),St.viewport.set(Ft.x,Ft.y,Ft.width,Ft.height),_t===0&&(y.matrix.copy(St.matrix),y.matrix.decompose(y.position,y.quaternion,y.scale)),Mt===!0&&y.cameras.push(St)}}for(let pt=0;pt<M.length;pt++){const Mt=v[pt],_t=M[pt];Mt!==null&&_t!==void 0&&_t.update(Mt,K,c||a)}j&&j(W,K),K.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:K}),g=null}const at=new Cl;at.setAnimationLoop(it),this.setAnimationLoop=function(W){j=W},this.dispose=function(){}}}function ym(s,t){function e(m,f){m.matrixAutoUpdate===!0&&m.updateMatrix(),f.value.copy(m.matrix)}function n(m,f){f.color.getRGB(m.fogColor.value,Tl(s)),f.isFog?(m.fogNear.value=f.near,m.fogFar.value=f.far):f.isFogExp2&&(m.fogDensity.value=f.density)}function i(m,f,M,v,S){f.isMeshBasicMaterial||f.isMeshLambertMaterial?r(m,f):f.isMeshToonMaterial?(r(m,f),u(m,f)):f.isMeshPhongMaterial?(r(m,f),h(m,f)):f.isMeshStandardMaterial?(r(m,f),d(m,f),f.isMeshPhysicalMaterial&&p(m,f,S)):f.isMeshMatcapMaterial?(r(m,f),g(m,f)):f.isMeshDepthMaterial?r(m,f):f.isMeshDistanceMaterial?(r(m,f),_(m,f)):f.isMeshNormalMaterial?r(m,f):f.isLineBasicMaterial?(a(m,f),f.isLineDashedMaterial&&o(m,f)):f.isPointsMaterial?l(m,f,M,v):f.isSpriteMaterial?c(m,f):f.isShadowMaterial?(m.color.value.copy(f.color),m.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function r(m,f){m.opacity.value=f.opacity,f.color&&m.diffuse.value.copy(f.color),f.emissive&&m.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(m.map.value=f.map,e(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,e(f.alphaMap,m.alphaMapTransform)),f.bumpMap&&(m.bumpMap.value=f.bumpMap,e(f.bumpMap,m.bumpMapTransform),m.bumpScale.value=f.bumpScale,f.side===Fe&&(m.bumpScale.value*=-1)),f.normalMap&&(m.normalMap.value=f.normalMap,e(f.normalMap,m.normalMapTransform),m.normalScale.value.copy(f.normalScale),f.side===Fe&&m.normalScale.value.negate()),f.displacementMap&&(m.displacementMap.value=f.displacementMap,e(f.displacementMap,m.displacementMapTransform),m.displacementScale.value=f.displacementScale,m.displacementBias.value=f.displacementBias),f.emissiveMap&&(m.emissiveMap.value=f.emissiveMap,e(f.emissiveMap,m.emissiveMapTransform)),f.specularMap&&(m.specularMap.value=f.specularMap,e(f.specularMap,m.specularMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest);const M=t.get(f).envMap;if(M&&(m.envMap.value=M,m.flipEnvMap.value=M.isCubeTexture&&M.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=f.reflectivity,m.ior.value=f.ior,m.refractionRatio.value=f.refractionRatio),f.lightMap){m.lightMap.value=f.lightMap;const v=s._useLegacyLights===!0?Math.PI:1;m.lightMapIntensity.value=f.lightMapIntensity*v,e(f.lightMap,m.lightMapTransform)}f.aoMap&&(m.aoMap.value=f.aoMap,m.aoMapIntensity.value=f.aoMapIntensity,e(f.aoMap,m.aoMapTransform))}function a(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,f.map&&(m.map.value=f.map,e(f.map,m.mapTransform))}function o(m,f){m.dashSize.value=f.dashSize,m.totalSize.value=f.dashSize+f.gapSize,m.scale.value=f.scale}function l(m,f,M,v){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.size.value=f.size*M,m.scale.value=v*.5,f.map&&(m.map.value=f.map,e(f.map,m.uvTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,e(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function c(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.rotation.value=f.rotation,f.map&&(m.map.value=f.map,e(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,e(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function h(m,f){m.specular.value.copy(f.specular),m.shininess.value=Math.max(f.shininess,1e-4)}function u(m,f){f.gradientMap&&(m.gradientMap.value=f.gradientMap)}function d(m,f){m.metalness.value=f.metalness,f.metalnessMap&&(m.metalnessMap.value=f.metalnessMap,e(f.metalnessMap,m.metalnessMapTransform)),m.roughness.value=f.roughness,f.roughnessMap&&(m.roughnessMap.value=f.roughnessMap,e(f.roughnessMap,m.roughnessMapTransform)),t.get(f).envMap&&(m.envMapIntensity.value=f.envMapIntensity)}function p(m,f,M){m.ior.value=f.ior,f.sheen>0&&(m.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),m.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(m.sheenColorMap.value=f.sheenColorMap,e(f.sheenColorMap,m.sheenColorMapTransform)),f.sheenRoughnessMap&&(m.sheenRoughnessMap.value=f.sheenRoughnessMap,e(f.sheenRoughnessMap,m.sheenRoughnessMapTransform))),f.clearcoat>0&&(m.clearcoat.value=f.clearcoat,m.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(m.clearcoatMap.value=f.clearcoatMap,e(f.clearcoatMap,m.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,e(f.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(m.clearcoatNormalMap.value=f.clearcoatNormalMap,e(f.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===Fe&&m.clearcoatNormalScale.value.negate())),f.iridescence>0&&(m.iridescence.value=f.iridescence,m.iridescenceIOR.value=f.iridescenceIOR,m.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(m.iridescenceMap.value=f.iridescenceMap,e(f.iridescenceMap,m.iridescenceMapTransform)),f.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=f.iridescenceThicknessMap,e(f.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),f.transmission>0&&(m.transmission.value=f.transmission,m.transmissionSamplerMap.value=M.texture,m.transmissionSamplerSize.value.set(M.width,M.height),f.transmissionMap&&(m.transmissionMap.value=f.transmissionMap,e(f.transmissionMap,m.transmissionMapTransform)),m.thickness.value=f.thickness,f.thicknessMap&&(m.thicknessMap.value=f.thicknessMap,e(f.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=f.attenuationDistance,m.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(m.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(m.anisotropyMap.value=f.anisotropyMap,e(f.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=f.specularIntensity,m.specularColor.value.copy(f.specularColor),f.specularColorMap&&(m.specularColorMap.value=f.specularColorMap,e(f.specularColorMap,m.specularColorMapTransform)),f.specularIntensityMap&&(m.specularIntensityMap.value=f.specularIntensityMap,e(f.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,f){f.matcap&&(m.matcap.value=f.matcap)}function _(m,f){const M=t.get(f).light;m.referencePosition.value.setFromMatrixPosition(M.matrixWorld),m.nearDistance.value=M.shadow.camera.near,m.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function Mm(s,t,e,n){let i={},r={},a=[];const o=e.isWebGL2?s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS):0;function l(M,v){const S=v.program;n.uniformBlockBinding(M,S)}function c(M,v){let S=i[M.id];S===void 0&&(g(M),S=h(M),i[M.id]=S,M.addEventListener("dispose",m));const L=v.program;n.updateUBOMapping(M,L);const A=t.render.frame;r[M.id]!==A&&(d(M),r[M.id]=A)}function h(M){const v=u();M.__bindingPointIndex=v;const S=s.createBuffer(),L=M.__size,A=M.usage;return s.bindBuffer(s.UNIFORM_BUFFER,S),s.bufferData(s.UNIFORM_BUFFER,L,A),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,v,S),S}function u(){for(let M=0;M<o;M++)if(a.indexOf(M)===-1)return a.push(M),M;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(M){const v=i[M.id],S=M.uniforms,L=M.__cache;s.bindBuffer(s.UNIFORM_BUFFER,v);for(let A=0,C=S.length;A<C;A++){const B=Array.isArray(S[A])?S[A]:[S[A]];for(let y=0,T=B.length;y<T;y++){const F=B[y];if(p(F,A,y,L)===!0){const V=F.__offset,nt=Array.isArray(F.value)?F.value:[F.value];let I=0;for(let O=0;O<nt.length;O++){const k=nt[O],Z=_(k);typeof k=="number"||typeof k=="boolean"?(F.__data[0]=k,s.bufferSubData(s.UNIFORM_BUFFER,V+I,F.__data)):k.isMatrix3?(F.__data[0]=k.elements[0],F.__data[1]=k.elements[1],F.__data[2]=k.elements[2],F.__data[3]=0,F.__data[4]=k.elements[3],F.__data[5]=k.elements[4],F.__data[6]=k.elements[5],F.__data[7]=0,F.__data[8]=k.elements[6],F.__data[9]=k.elements[7],F.__data[10]=k.elements[8],F.__data[11]=0):(k.toArray(F.__data,I),I+=Z.storage/Float32Array.BYTES_PER_ELEMENT)}s.bufferSubData(s.UNIFORM_BUFFER,V,F.__data)}}}s.bindBuffer(s.UNIFORM_BUFFER,null)}function p(M,v,S,L){const A=M.value,C=v+"_"+S;if(L[C]===void 0)return typeof A=="number"||typeof A=="boolean"?L[C]=A:L[C]=A.clone(),!0;{const B=L[C];if(typeof A=="number"||typeof A=="boolean"){if(B!==A)return L[C]=A,!0}else if(B.equals(A)===!1)return B.copy(A),!0}return!1}function g(M){const v=M.uniforms;let S=0;const L=16;for(let C=0,B=v.length;C<B;C++){const y=Array.isArray(v[C])?v[C]:[v[C]];for(let T=0,F=y.length;T<F;T++){const V=y[T],nt=Array.isArray(V.value)?V.value:[V.value];for(let I=0,O=nt.length;I<O;I++){const k=nt[I],Z=_(k),Y=S%L;Y!==0&&L-Y<Z.boundary&&(S+=L-Y),V.__data=new Float32Array(Z.storage/Float32Array.BYTES_PER_ELEMENT),V.__offset=S,S+=Z.storage}}}const A=S%L;return A>0&&(S+=L-A),M.__size=S,M.__cache={},this}function _(M){const v={boundary:0,storage:0};return typeof M=="number"||typeof M=="boolean"?(v.boundary=4,v.storage=4):M.isVector2?(v.boundary=8,v.storage=8):M.isVector3||M.isColor?(v.boundary=16,v.storage=12):M.isVector4?(v.boundary=16,v.storage=16):M.isMatrix3?(v.boundary=48,v.storage=48):M.isMatrix4?(v.boundary=64,v.storage=64):M.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",M),v}function m(M){const v=M.target;v.removeEventListener("dispose",m);const S=a.indexOf(v.__bindingPointIndex);a.splice(S,1),s.deleteBuffer(i[v.id]),delete i[v.id],delete r[v.id]}function f(){for(const M in i)s.deleteBuffer(i[M]);a=[],i={},r={}}return{bind:l,update:c,dispose:f}}class Fl{constructor(t={}){const{canvas:e=gh(),context:n=null,depth:i=!0,stencil:r=!0,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1}=t;this.isWebGLRenderer=!0;let d;n!==null?d=n.getContextAttributes().alpha:d=a;const p=new Uint32Array(4),g=new Int32Array(4);let _=null,m=null;const f=[],M=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=Me,this._useLegacyLights=!1,this.toneMapping=An,this.toneMappingExposure=1;const v=this;let S=!1,L=0,A=0,C=null,B=-1,y=null;const T=new ve,F=new ve;let V=null;const nt=new Tt(0);let I=0,O=e.width,k=e.height,Z=1,Y=null,$=null;const j=new ve(0,0,O,k),it=new ve(0,0,O,k);let at=!1;const W=new na;let K=!1,pt=!1,Mt=null;const _t=new ne,Pt=new rt,Ft=new R,St={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function Ut(){return C===null?Z:1}let P=n;function lt(w,U){for(let H=0;H<w.length;H++){const G=w[H],z=e.getContext(G,U);if(z!==null)return z}return null}try{const w={alpha:!0,depth:i,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${Kr}`),e.addEventListener("webglcontextlost",ct,!1),e.addEventListener("webglcontextrestored",D,!1),e.addEventListener("webglcontextcreationerror",dt,!1),P===null){const U=["webgl2","webgl","experimental-webgl"];if(v.isWebGL1Renderer===!0&&U.shift(),P=lt(U,w),P===null)throw lt(U)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}typeof WebGLRenderingContext<"u"&&P instanceof WebGLRenderingContext&&console.warn("THREE.WebGLRenderer: WebGL 1 support was deprecated in r153 and will be removed in r163."),P.getShaderPrecisionFormat===void 0&&(P.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(w){throw console.error("THREE.WebGLRenderer: "+w.message),w}let q,st,X,wt,mt,E,x,N,et,Q,J,yt,ut,vt,At,Bt,tt,Yt,qt,Nt,bt,xt,Ht,$t;function oe(){q=new Lf(P),st=new Tf(P,q,t),q.init(st),xt=new gm(P,q,st),X=new pm(P,q,st),wt=new Uf(P),mt=new tm,E=new mm(P,q,X,mt,st,xt,wt),x=new Af(v),N=new Pf(v),et=new Gh(P,st),Ht=new Ef(P,q,et,st),Q=new Df(P,et,wt,Ht),J=new Bf(P,Q,et,wt),qt=new Of(P,st,E),Bt=new bf(mt),yt=new Qp(v,x,N,q,st,Ht,Bt),ut=new ym(v,mt),vt=new nm,At=new lm(q,st),Yt=new Sf(v,x,N,X,J,d,l),tt=new fm(v,J,st),$t=new Mm(P,wt,st,X),Nt=new wf(P,q,wt,st),bt=new If(P,q,wt,st),wt.programs=yt.programs,v.capabilities=st,v.extensions=q,v.properties=mt,v.renderLists=vt,v.shadowMap=tt,v.state=X,v.info=wt}oe();const Vt=new xm(v,P);this.xr=Vt,this.getContext=function(){return P},this.getContextAttributes=function(){return P.getContextAttributes()},this.forceContextLoss=function(){const w=q.get("WEBGL_lose_context");w&&w.loseContext()},this.forceContextRestore=function(){const w=q.get("WEBGL_lose_context");w&&w.restoreContext()},this.getPixelRatio=function(){return Z},this.setPixelRatio=function(w){w!==void 0&&(Z=w,this.setSize(O,k,!1))},this.getSize=function(w){return w.set(O,k)},this.setSize=function(w,U,H=!0){if(Vt.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}O=w,k=U,e.width=Math.floor(w*Z),e.height=Math.floor(U*Z),H===!0&&(e.style.width=w+"px",e.style.height=U+"px"),this.setViewport(0,0,w,U)},this.getDrawingBufferSize=function(w){return w.set(O*Z,k*Z).floor()},this.setDrawingBufferSize=function(w,U,H){O=w,k=U,Z=H,e.width=Math.floor(w*H),e.height=Math.floor(U*H),this.setViewport(0,0,w,U)},this.getCurrentViewport=function(w){return w.copy(T)},this.getViewport=function(w){return w.copy(j)},this.setViewport=function(w,U,H,G){w.isVector4?j.set(w.x,w.y,w.z,w.w):j.set(w,U,H,G),X.viewport(T.copy(j).multiplyScalar(Z).floor())},this.getScissor=function(w){return w.copy(it)},this.setScissor=function(w,U,H,G){w.isVector4?it.set(w.x,w.y,w.z,w.w):it.set(w,U,H,G),X.scissor(F.copy(it).multiplyScalar(Z).floor())},this.getScissorTest=function(){return at},this.setScissorTest=function(w){X.setScissorTest(at=w)},this.setOpaqueSort=function(w){Y=w},this.setTransparentSort=function(w){$=w},this.getClearColor=function(w){return w.copy(Yt.getClearColor())},this.setClearColor=function(){Yt.setClearColor.apply(Yt,arguments)},this.getClearAlpha=function(){return Yt.getClearAlpha()},this.setClearAlpha=function(){Yt.setClearAlpha.apply(Yt,arguments)},this.clear=function(w=!0,U=!0,H=!0){let G=0;if(w){let z=!1;if(C!==null){const gt=C.texture.format;z=gt===ul||gt===hl||gt===cl}if(z){const gt=C.texture.type,Et=gt===Cn||gt===wn||gt===Qr||gt===kn||gt===ol||gt===ll,Rt=Yt.getClearColor(),Dt=Yt.getClearAlpha(),kt=Rt.r,Ot=Rt.g,zt=Rt.b;Et?(p[0]=kt,p[1]=Ot,p[2]=zt,p[3]=Dt,P.clearBufferuiv(P.COLOR,0,p)):(g[0]=kt,g[1]=Ot,g[2]=zt,g[3]=Dt,P.clearBufferiv(P.COLOR,0,g))}else G|=P.COLOR_BUFFER_BIT}U&&(G|=P.DEPTH_BUFFER_BIT),H&&(G|=P.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),P.clear(G)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",ct,!1),e.removeEventListener("webglcontextrestored",D,!1),e.removeEventListener("webglcontextcreationerror",dt,!1),vt.dispose(),At.dispose(),mt.dispose(),x.dispose(),N.dispose(),J.dispose(),Ht.dispose(),$t.dispose(),yt.dispose(),Vt.dispose(),Vt.removeEventListener("sessionstart",Pe),Vt.removeEventListener("sessionend",Qt),Mt&&(Mt.dispose(),Mt=null),Le.stop()};function ct(w){w.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),S=!0}function D(){console.log("THREE.WebGLRenderer: Context Restored."),S=!1;const w=wt.autoReset,U=tt.enabled,H=tt.autoUpdate,G=tt.needsUpdate,z=tt.type;oe(),wt.autoReset=w,tt.enabled=U,tt.autoUpdate=H,tt.needsUpdate=G,tt.type=z}function dt(w){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function ft(w){const U=w.target;U.removeEventListener("dispose",ft),Lt(U)}function Lt(w){Ct(w),mt.remove(w)}function Ct(w){const U=mt.get(w).programs;U!==void 0&&(U.forEach(function(H){yt.releaseProgram(H)}),w.isShaderMaterial&&yt.releaseShaderCache(w))}this.renderBufferDirect=function(w,U,H,G,z,gt){U===null&&(U=St);const Et=z.isMesh&&z.matrixWorld.determinant()<0,Rt=Jl(w,U,H,G,z);X.setMaterial(G,Et);let Dt=H.index,kt=1;if(G.wireframe===!0){if(Dt=Q.getWireframeAttribute(H),Dt===void 0)return;kt=2}const Ot=H.drawRange,zt=H.attributes.position;let ce=Ot.start*kt,Be=(Ot.start+Ot.count)*kt;gt!==null&&(ce=Math.max(ce,gt.start*kt),Be=Math.min(Be,(gt.start+gt.count)*kt)),Dt!==null?(ce=Math.max(ce,0),Be=Math.min(Be,Dt.count)):zt!=null&&(ce=Math.max(ce,0),Be=Math.min(Be,zt.count));const me=Be-ce;if(me<0||me===1/0)return;Ht.setup(z,G,Rt,H,Dt);let cn,se=Nt;if(Dt!==null&&(cn=et.get(Dt),se=bt,se.setIndex(cn)),z.isMesh)G.wireframe===!0?(X.setLineWidth(G.wireframeLinewidth*Ut()),se.setMode(P.LINES)):se.setMode(P.TRIANGLES);else if(z.isLine){let Wt=G.linewidth;Wt===void 0&&(Wt=1),X.setLineWidth(Wt*Ut()),z.isLineSegments?se.setMode(P.LINES):z.isLineLoop?se.setMode(P.LINE_LOOP):se.setMode(P.LINE_STRIP)}else z.isPoints?se.setMode(P.POINTS):z.isSprite&&se.setMode(P.TRIANGLES);if(z.isBatchedMesh)se.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else if(z.isInstancedMesh)se.renderInstances(ce,me,z.count);else if(H.isInstancedBufferGeometry){const Wt=H._maxInstanceCount!==void 0?H._maxInstanceCount:1/0,Ks=Math.min(H.instanceCount,Wt);se.renderInstances(ce,me,Ks)}else se.render(ce,me)};function Jt(w,U,H){w.transparent===!0&&w.side===Ne&&w.forceSinglePass===!1?(w.side=Fe,w.needsUpdate=!0,ss(w,U,H),w.side=Pn,w.needsUpdate=!0,ss(w,U,H),w.side=Ne):ss(w,U,H)}this.compile=function(w,U,H=null){H===null&&(H=w),m=At.get(H),m.init(),M.push(m),H.traverseVisible(function(z){z.isLight&&z.layers.test(U.layers)&&(m.pushLight(z),z.castShadow&&m.pushShadow(z))}),w!==H&&w.traverseVisible(function(z){z.isLight&&z.layers.test(U.layers)&&(m.pushLight(z),z.castShadow&&m.pushShadow(z))}),m.setupLights(v._useLegacyLights);const G=new Set;return w.traverse(function(z){const gt=z.material;if(gt)if(Array.isArray(gt))for(let Et=0;Et<gt.length;Et++){const Rt=gt[Et];Jt(Rt,H,z),G.add(Rt)}else Jt(gt,H,z),G.add(gt)}),M.pop(),m=null,G},this.compileAsync=function(w,U,H=null){const G=this.compile(w,U,H);return new Promise(z=>{function gt(){if(G.forEach(function(Et){mt.get(Et).currentProgram.isReady()&&G.delete(Et)}),G.size===0){z(w);return}setTimeout(gt,10)}q.get("KHR_parallel_shader_compile")!==null?gt():setTimeout(gt,10)})};let Kt=null;function pe(w){Kt&&Kt(w)}function Pe(){Le.stop()}function Qt(){Le.start()}const Le=new Cl;Le.setAnimationLoop(pe),typeof self<"u"&&Le.setContext(self),this.setAnimationLoop=function(w){Kt=w,Vt.setAnimationLoop(w),w===null?Le.stop():Le.start()},Vt.addEventListener("sessionstart",Pe),Vt.addEventListener("sessionend",Qt),this.render=function(w,U){if(U!==void 0&&U.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(S===!0)return;w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),U.parent===null&&U.matrixWorldAutoUpdate===!0&&U.updateMatrixWorld(),Vt.enabled===!0&&Vt.isPresenting===!0&&(Vt.cameraAutoUpdate===!0&&Vt.updateCamera(U),U=Vt.getCamera()),w.isScene===!0&&w.onBeforeRender(v,w,U,C),m=At.get(w,M.length),m.init(),M.push(m),_t.multiplyMatrices(U.projectionMatrix,U.matrixWorldInverse),W.setFromProjectionMatrix(_t),pt=this.localClippingEnabled,K=Bt.init(this.clippingPlanes,pt),_=vt.get(w,f.length),_.init(),f.push(_),tn(w,U,0,v.sortObjects),_.finish(),v.sortObjects===!0&&_.sort(Y,$),this.info.render.frame++,K===!0&&Bt.beginShadows();const H=m.state.shadowsArray;if(tt.render(H,w,U),K===!0&&Bt.endShadows(),this.info.autoReset===!0&&this.info.reset(),Yt.render(_,w),m.setupLights(v._useLegacyLights),U.isArrayCamera){const G=U.cameras;for(let z=0,gt=G.length;z<gt;z++){const Et=G[z];fa(_,w,Et,Et.viewport)}}else fa(_,w,U);C!==null&&(E.updateMultisampleRenderTarget(C),E.updateRenderTargetMipmap(C)),w.isScene===!0&&w.onAfterRender(v,w,U),Ht.resetDefaultState(),B=-1,y=null,M.pop(),M.length>0?m=M[M.length-1]:m=null,f.pop(),f.length>0?_=f[f.length-1]:_=null};function tn(w,U,H,G){if(w.visible===!1)return;if(w.layers.test(U.layers)){if(w.isGroup)H=w.renderOrder;else if(w.isLOD)w.autoUpdate===!0&&w.update(U);else if(w.isLight)m.pushLight(w),w.castShadow&&m.pushShadow(w);else if(w.isSprite){if(!w.frustumCulled||W.intersectsSprite(w)){G&&Ft.setFromMatrixPosition(w.matrixWorld).applyMatrix4(_t);const Et=J.update(w),Rt=w.material;Rt.visible&&_.push(w,Et,Rt,H,Ft.z,null)}}else if((w.isMesh||w.isLine||w.isPoints)&&(!w.frustumCulled||W.intersectsObject(w))){const Et=J.update(w),Rt=w.material;if(G&&(w.boundingSphere!==void 0?(w.boundingSphere===null&&w.computeBoundingSphere(),Ft.copy(w.boundingSphere.center)):(Et.boundingSphere===null&&Et.computeBoundingSphere(),Ft.copy(Et.boundingSphere.center)),Ft.applyMatrix4(w.matrixWorld).applyMatrix4(_t)),Array.isArray(Rt)){const Dt=Et.groups;for(let kt=0,Ot=Dt.length;kt<Ot;kt++){const zt=Dt[kt],ce=Rt[zt.materialIndex];ce&&ce.visible&&_.push(w,Et,ce,H,Ft.z,zt)}}else Rt.visible&&_.push(w,Et,Rt,H,Ft.z,null)}}const gt=w.children;for(let Et=0,Rt=gt.length;Et<Rt;Et++)tn(gt[Et],U,H,G)}function fa(w,U,H,G){const z=w.opaque,gt=w.transmissive,Et=w.transparent;m.setupLightsView(H),K===!0&&Bt.setGlobalState(v.clippingPlanes,H),gt.length>0&&jl(z,gt,U,H),G&&X.viewport(T.copy(G)),z.length>0&&is(z,U,H),gt.length>0&&is(gt,U,H),Et.length>0&&is(Et,U,H),X.buffers.depth.setTest(!0),X.buffers.depth.setMask(!0),X.buffers.color.setMask(!0),X.setPolygonOffset(!1)}function jl(w,U,H,G){if((H.isScene===!0?H.overrideMaterial:null)!==null)return;const gt=st.isWebGL2;Mt===null&&(Mt=new Xn(1,1,{generateMipmaps:!0,type:q.has("EXT_color_buffer_half_float")?Zi:Cn,minFilter:$i,samples:gt?4:0})),v.getDrawingBufferSize(Pt),gt?Mt.setSize(Pt.x,Pt.y):Mt.setSize(Vs(Pt.x),Vs(Pt.y));const Et=v.getRenderTarget();v.setRenderTarget(Mt),v.getClearColor(nt),I=v.getClearAlpha(),I<1&&v.setClearColor(16777215,.5),v.clear();const Rt=v.toneMapping;v.toneMapping=An,is(w,H,G),E.updateMultisampleRenderTarget(Mt),E.updateRenderTargetMipmap(Mt);let Dt=!1;for(let kt=0,Ot=U.length;kt<Ot;kt++){const zt=U[kt],ce=zt.object,Be=zt.geometry,me=zt.material,cn=zt.group;if(me.side===Ne&&ce.layers.test(G.layers)){const se=me.side;me.side=Fe,me.needsUpdate=!0,pa(ce,H,G,Be,me,cn),me.side=se,me.needsUpdate=!0,Dt=!0}}Dt===!0&&(E.updateMultisampleRenderTarget(Mt),E.updateRenderTargetMipmap(Mt)),v.setRenderTarget(Et),v.setClearColor(nt,I),v.toneMapping=Rt}function is(w,U,H){const G=U.isScene===!0?U.overrideMaterial:null;for(let z=0,gt=w.length;z<gt;z++){const Et=w[z],Rt=Et.object,Dt=Et.geometry,kt=G===null?Et.material:G,Ot=Et.group;Rt.layers.test(H.layers)&&pa(Rt,U,H,Dt,kt,Ot)}}function pa(w,U,H,G,z,gt){w.onBeforeRender(v,U,H,G,z,gt),w.modelViewMatrix.multiplyMatrices(H.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),z.onBeforeRender(v,U,H,G,w,gt),z.transparent===!0&&z.side===Ne&&z.forceSinglePass===!1?(z.side=Fe,z.needsUpdate=!0,v.renderBufferDirect(H,U,G,z,w,gt),z.side=Pn,z.needsUpdate=!0,v.renderBufferDirect(H,U,G,z,w,gt),z.side=Ne):v.renderBufferDirect(H,U,G,z,w,gt),w.onAfterRender(v,U,H,G,z,gt)}function ss(w,U,H){U.isScene!==!0&&(U=St);const G=mt.get(w),z=m.state.lights,gt=m.state.shadowsArray,Et=z.state.version,Rt=yt.getParameters(w,z.state,gt,U,H),Dt=yt.getProgramCacheKey(Rt);let kt=G.programs;G.environment=w.isMeshStandardMaterial?U.environment:null,G.fog=U.fog,G.envMap=(w.isMeshStandardMaterial?N:x).get(w.envMap||G.environment),kt===void 0&&(w.addEventListener("dispose",ft),kt=new Map,G.programs=kt);let Ot=kt.get(Dt);if(Ot!==void 0){if(G.currentProgram===Ot&&G.lightsStateVersion===Et)return ga(w,Rt),Ot}else Rt.uniforms=yt.getUniforms(w),w.onBuild(H,Rt,v),w.onBeforeCompile(Rt,v),Ot=yt.acquireProgram(Rt,Dt),kt.set(Dt,Ot),G.uniforms=Rt.uniforms;const zt=G.uniforms;return(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)&&(zt.clippingPlanes=Bt.uniform),ga(w,Rt),G.needsLights=Ql(w),G.lightsStateVersion=Et,G.needsLights&&(zt.ambientLightColor.value=z.state.ambient,zt.lightProbe.value=z.state.probe,zt.directionalLights.value=z.state.directional,zt.directionalLightShadows.value=z.state.directionalShadow,zt.spotLights.value=z.state.spot,zt.spotLightShadows.value=z.state.spotShadow,zt.rectAreaLights.value=z.state.rectArea,zt.ltc_1.value=z.state.rectAreaLTC1,zt.ltc_2.value=z.state.rectAreaLTC2,zt.pointLights.value=z.state.point,zt.pointLightShadows.value=z.state.pointShadow,zt.hemisphereLights.value=z.state.hemi,zt.directionalShadowMap.value=z.state.directionalShadowMap,zt.directionalShadowMatrix.value=z.state.directionalShadowMatrix,zt.spotShadowMap.value=z.state.spotShadowMap,zt.spotLightMatrix.value=z.state.spotLightMatrix,zt.spotLightMap.value=z.state.spotLightMap,zt.pointShadowMap.value=z.state.pointShadowMap,zt.pointShadowMatrix.value=z.state.pointShadowMatrix),G.currentProgram=Ot,G.uniformsList=null,Ot}function ma(w){if(w.uniformsList===null){const U=w.currentProgram.getUniforms();w.uniformsList=Fs.seqWithValue(U.seq,w.uniforms)}return w.uniformsList}function ga(w,U){const H=mt.get(w);H.outputColorSpace=U.outputColorSpace,H.batching=U.batching,H.instancing=U.instancing,H.instancingColor=U.instancingColor,H.skinning=U.skinning,H.morphTargets=U.morphTargets,H.morphNormals=U.morphNormals,H.morphColors=U.morphColors,H.morphTargetsCount=U.morphTargetsCount,H.numClippingPlanes=U.numClippingPlanes,H.numIntersection=U.numClipIntersection,H.vertexAlphas=U.vertexAlphas,H.vertexTangents=U.vertexTangents,H.toneMapping=U.toneMapping}function Jl(w,U,H,G,z){U.isScene!==!0&&(U=St),E.resetTextureUnits();const gt=U.fog,Et=G.isMeshStandardMaterial?U.environment:null,Rt=C===null?v.outputColorSpace:C.isXRRenderTarget===!0?C.texture.colorSpace:_n,Dt=(G.isMeshStandardMaterial?N:x).get(G.envMap||Et),kt=G.vertexColors===!0&&!!H.attributes.color&&H.attributes.color.itemSize===4,Ot=!!H.attributes.tangent&&(!!G.normalMap||G.anisotropy>0),zt=!!H.morphAttributes.position,ce=!!H.morphAttributes.normal,Be=!!H.morphAttributes.color;let me=An;G.toneMapped&&(C===null||C.isXRRenderTarget===!0)&&(me=v.toneMapping);const cn=H.morphAttributes.position||H.morphAttributes.normal||H.morphAttributes.color,se=cn!==void 0?cn.length:0,Wt=mt.get(G),Ks=m.state.lights;if(K===!0&&(pt===!0||w!==y)){const Ge=w===y&&G.id===B;Bt.setState(G,w,Ge)}let le=!1;G.version===Wt.__version?(Wt.needsLights&&Wt.lightsStateVersion!==Ks.state.version||Wt.outputColorSpace!==Rt||z.isBatchedMesh&&Wt.batching===!1||!z.isBatchedMesh&&Wt.batching===!0||z.isInstancedMesh&&Wt.instancing===!1||!z.isInstancedMesh&&Wt.instancing===!0||z.isSkinnedMesh&&Wt.skinning===!1||!z.isSkinnedMesh&&Wt.skinning===!0||z.isInstancedMesh&&Wt.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&Wt.instancingColor===!1&&z.instanceColor!==null||Wt.envMap!==Dt||G.fog===!0&&Wt.fog!==gt||Wt.numClippingPlanes!==void 0&&(Wt.numClippingPlanes!==Bt.numPlanes||Wt.numIntersection!==Bt.numIntersection)||Wt.vertexAlphas!==kt||Wt.vertexTangents!==Ot||Wt.morphTargets!==zt||Wt.morphNormals!==ce||Wt.morphColors!==Be||Wt.toneMapping!==me||st.isWebGL2===!0&&Wt.morphTargetsCount!==se)&&(le=!0):(le=!0,Wt.__version=G.version);let Ln=Wt.currentProgram;le===!0&&(Ln=ss(G,U,z));let _a=!1,Li=!1,Qs=!1;const we=Ln.getUniforms(),Dn=Wt.uniforms;if(X.useProgram(Ln.program)&&(_a=!0,Li=!0,Qs=!0),G.id!==B&&(B=G.id,Li=!0),_a||y!==w){we.setValue(P,"projectionMatrix",w.projectionMatrix),we.setValue(P,"viewMatrix",w.matrixWorldInverse);const Ge=we.map.cameraPosition;Ge!==void 0&&Ge.setValue(P,Ft.setFromMatrixPosition(w.matrixWorld)),st.logarithmicDepthBuffer&&we.setValue(P,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2)),(G.isMeshPhongMaterial||G.isMeshToonMaterial||G.isMeshLambertMaterial||G.isMeshBasicMaterial||G.isMeshStandardMaterial||G.isShaderMaterial)&&we.setValue(P,"isOrthographic",w.isOrthographicCamera===!0),y!==w&&(y=w,Li=!0,Qs=!0)}if(z.isSkinnedMesh){we.setOptional(P,z,"bindMatrix"),we.setOptional(P,z,"bindMatrixInverse");const Ge=z.skeleton;Ge&&(st.floatVertexTextures?(Ge.boneTexture===null&&Ge.computeBoneTexture(),we.setValue(P,"boneTexture",Ge.boneTexture,E)):console.warn("THREE.WebGLRenderer: SkinnedMesh can only be used with WebGL 2. With WebGL 1 OES_texture_float and vertex textures support is required."))}z.isBatchedMesh&&(we.setOptional(P,z,"batchingTexture"),we.setValue(P,"batchingTexture",z._matricesTexture,E));const tr=H.morphAttributes;if((tr.position!==void 0||tr.normal!==void 0||tr.color!==void 0&&st.isWebGL2===!0)&&qt.update(z,H,Ln),(Li||Wt.receiveShadow!==z.receiveShadow)&&(Wt.receiveShadow=z.receiveShadow,we.setValue(P,"receiveShadow",z.receiveShadow)),G.isMeshGouraudMaterial&&G.envMap!==null&&(Dn.envMap.value=Dt,Dn.flipEnvMap.value=Dt.isCubeTexture&&Dt.isRenderTargetTexture===!1?-1:1),Li&&(we.setValue(P,"toneMappingExposure",v.toneMappingExposure),Wt.needsLights&&Kl(Dn,Qs),gt&&G.fog===!0&&ut.refreshFogUniforms(Dn,gt),ut.refreshMaterialUniforms(Dn,G,Z,k,Mt),Fs.upload(P,ma(Wt),Dn,E)),G.isShaderMaterial&&G.uniformsNeedUpdate===!0&&(Fs.upload(P,ma(Wt),Dn,E),G.uniformsNeedUpdate=!1),G.isSpriteMaterial&&we.setValue(P,"center",z.center),we.setValue(P,"modelViewMatrix",z.modelViewMatrix),we.setValue(P,"normalMatrix",z.normalMatrix),we.setValue(P,"modelMatrix",z.matrixWorld),G.isShaderMaterial||G.isRawShaderMaterial){const Ge=G.uniformsGroups;for(let er=0,tc=Ge.length;er<tc;er++)if(st.isWebGL2){const va=Ge[er];$t.update(va,Ln),$t.bind(va,Ln)}else console.warn("THREE.WebGLRenderer: Uniform Buffer Objects can only be used with WebGL 2.")}return Ln}function Kl(w,U){w.ambientLightColor.needsUpdate=U,w.lightProbe.needsUpdate=U,w.directionalLights.needsUpdate=U,w.directionalLightShadows.needsUpdate=U,w.pointLights.needsUpdate=U,w.pointLightShadows.needsUpdate=U,w.spotLights.needsUpdate=U,w.spotLightShadows.needsUpdate=U,w.rectAreaLights.needsUpdate=U,w.hemisphereLights.needsUpdate=U}function Ql(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return L},this.getActiveMipmapLevel=function(){return A},this.getRenderTarget=function(){return C},this.setRenderTargetTextures=function(w,U,H){mt.get(w.texture).__webglTexture=U,mt.get(w.depthTexture).__webglTexture=H;const G=mt.get(w);G.__hasExternalTextures=!0,G.__hasExternalTextures&&(G.__autoAllocateDepthBuffer=H===void 0,G.__autoAllocateDepthBuffer||q.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),G.__useRenderToTexture=!1))},this.setRenderTargetFramebuffer=function(w,U){const H=mt.get(w);H.__webglFramebuffer=U,H.__useDefaultFramebuffer=U===void 0},this.setRenderTarget=function(w,U=0,H=0){C=w,L=U,A=H;let G=!0,z=null,gt=!1,Et=!1;if(w){const Dt=mt.get(w);Dt.__useDefaultFramebuffer!==void 0?(X.bindFramebuffer(P.FRAMEBUFFER,null),G=!1):Dt.__webglFramebuffer===void 0?E.setupRenderTarget(w):Dt.__hasExternalTextures&&E.rebindTextures(w,mt.get(w.texture).__webglTexture,mt.get(w.depthTexture).__webglTexture);const kt=w.texture;(kt.isData3DTexture||kt.isDataArrayTexture||kt.isCompressedArrayTexture)&&(Et=!0);const Ot=mt.get(w).__webglFramebuffer;w.isWebGLCubeRenderTarget?(Array.isArray(Ot[U])?z=Ot[U][H]:z=Ot[U],gt=!0):st.isWebGL2&&w.samples>0&&E.useMultisampledRTT(w)===!1?z=mt.get(w).__webglMultisampledFramebuffer:Array.isArray(Ot)?z=Ot[H]:z=Ot,T.copy(w.viewport),F.copy(w.scissor),V=w.scissorTest}else T.copy(j).multiplyScalar(Z).floor(),F.copy(it).multiplyScalar(Z).floor(),V=at;if(X.bindFramebuffer(P.FRAMEBUFFER,z)&&st.drawBuffers&&G&&X.drawBuffers(w,z),X.viewport(T),X.scissor(F),X.setScissorTest(V),gt){const Dt=mt.get(w.texture);P.framebufferTexture2D(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_CUBE_MAP_POSITIVE_X+U,Dt.__webglTexture,H)}else if(Et){const Dt=mt.get(w.texture),kt=U||0;P.framebufferTextureLayer(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,Dt.__webglTexture,H||0,kt)}B=-1},this.readRenderTargetPixels=function(w,U,H,G,z,gt,Et){if(!(w&&w.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Rt=mt.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&Et!==void 0&&(Rt=Rt[Et]),Rt){X.bindFramebuffer(P.FRAMEBUFFER,Rt);try{const Dt=w.texture,kt=Dt.format,Ot=Dt.type;if(kt!==Qe&&xt.convert(kt)!==P.getParameter(P.IMPLEMENTATION_COLOR_READ_FORMAT)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}const zt=Ot===Zi&&(q.has("EXT_color_buffer_half_float")||st.isWebGL2&&q.has("EXT_color_buffer_float"));if(Ot!==Cn&&xt.convert(Ot)!==P.getParameter(P.IMPLEMENTATION_COLOR_READ_TYPE)&&!(Ot===Tn&&(st.isWebGL2||q.has("OES_texture_float")||q.has("WEBGL_color_buffer_float")))&&!zt){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}U>=0&&U<=w.width-G&&H>=0&&H<=w.height-z&&P.readPixels(U,H,G,z,xt.convert(kt),xt.convert(Ot),gt)}finally{const Dt=C!==null?mt.get(C).__webglFramebuffer:null;X.bindFramebuffer(P.FRAMEBUFFER,Dt)}}},this.copyFramebufferToTexture=function(w,U,H=0){const G=Math.pow(2,-H),z=Math.floor(U.image.width*G),gt=Math.floor(U.image.height*G);E.setTexture2D(U,0),P.copyTexSubImage2D(P.TEXTURE_2D,H,0,0,w.x,w.y,z,gt),X.unbindTexture()},this.copyTextureToTexture=function(w,U,H,G=0){const z=U.image.width,gt=U.image.height,Et=xt.convert(H.format),Rt=xt.convert(H.type);E.setTexture2D(H,0),P.pixelStorei(P.UNPACK_FLIP_Y_WEBGL,H.flipY),P.pixelStorei(P.UNPACK_PREMULTIPLY_ALPHA_WEBGL,H.premultiplyAlpha),P.pixelStorei(P.UNPACK_ALIGNMENT,H.unpackAlignment),U.isDataTexture?P.texSubImage2D(P.TEXTURE_2D,G,w.x,w.y,z,gt,Et,Rt,U.image.data):U.isCompressedTexture?P.compressedTexSubImage2D(P.TEXTURE_2D,G,w.x,w.y,U.mipmaps[0].width,U.mipmaps[0].height,Et,U.mipmaps[0].data):P.texSubImage2D(P.TEXTURE_2D,G,w.x,w.y,Et,Rt,U.image),G===0&&H.generateMipmaps&&P.generateMipmap(P.TEXTURE_2D),X.unbindTexture()},this.copyTextureToTexture3D=function(w,U,H,G,z=0){if(v.isWebGL1Renderer){console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: can only be used with WebGL2.");return}const gt=w.max.x-w.min.x+1,Et=w.max.y-w.min.y+1,Rt=w.max.z-w.min.z+1,Dt=xt.convert(G.format),kt=xt.convert(G.type);let Ot;if(G.isData3DTexture)E.setTexture3D(G,0),Ot=P.TEXTURE_3D;else if(G.isDataArrayTexture||G.isCompressedArrayTexture)E.setTexture2DArray(G,0),Ot=P.TEXTURE_2D_ARRAY;else{console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");return}P.pixelStorei(P.UNPACK_FLIP_Y_WEBGL,G.flipY),P.pixelStorei(P.UNPACK_PREMULTIPLY_ALPHA_WEBGL,G.premultiplyAlpha),P.pixelStorei(P.UNPACK_ALIGNMENT,G.unpackAlignment);const zt=P.getParameter(P.UNPACK_ROW_LENGTH),ce=P.getParameter(P.UNPACK_IMAGE_HEIGHT),Be=P.getParameter(P.UNPACK_SKIP_PIXELS),me=P.getParameter(P.UNPACK_SKIP_ROWS),cn=P.getParameter(P.UNPACK_SKIP_IMAGES),se=H.isCompressedTexture?H.mipmaps[z]:H.image;P.pixelStorei(P.UNPACK_ROW_LENGTH,se.width),P.pixelStorei(P.UNPACK_IMAGE_HEIGHT,se.height),P.pixelStorei(P.UNPACK_SKIP_PIXELS,w.min.x),P.pixelStorei(P.UNPACK_SKIP_ROWS,w.min.y),P.pixelStorei(P.UNPACK_SKIP_IMAGES,w.min.z),H.isDataTexture||H.isData3DTexture?P.texSubImage3D(Ot,z,U.x,U.y,U.z,gt,Et,Rt,Dt,kt,se.data):H.isCompressedArrayTexture?(console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: untested support for compressed srcTexture."),P.compressedTexSubImage3D(Ot,z,U.x,U.y,U.z,gt,Et,Rt,Dt,se.data)):P.texSubImage3D(Ot,z,U.x,U.y,U.z,gt,Et,Rt,Dt,kt,se),P.pixelStorei(P.UNPACK_ROW_LENGTH,zt),P.pixelStorei(P.UNPACK_IMAGE_HEIGHT,ce),P.pixelStorei(P.UNPACK_SKIP_PIXELS,Be),P.pixelStorei(P.UNPACK_SKIP_ROWS,me),P.pixelStorei(P.UNPACK_SKIP_IMAGES,cn),z===0&&G.generateMipmaps&&P.generateMipmap(Ot),X.unbindTexture()},this.initTexture=function(w){w.isCubeTexture?E.setTextureCube(w,0):w.isData3DTexture?E.setTexture3D(w,0):w.isDataArrayTexture||w.isCompressedArrayTexture?E.setTexture2DArray(w,0):E.setTexture2D(w,0),X.unbindTexture()},this.resetState=function(){L=0,A=0,C=null,X.reset(),Ht.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return gn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorSpace=t===ta?"display-p3":"srgb",e.unpackColorSpace=jt.workingColorSpace===$s?"display-p3":"srgb"}get outputEncoding(){return console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace===Me?Wn:fl}set outputEncoding(t){console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace=t===Wn?Me:_n}get useLegacyLights(){return console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights}set useLegacyLights(t){console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights=t}}class Sm extends Fl{}Sm.prototype.isWebGL1Renderer=!0;class sa{constructor(t,e=25e-5){this.isFogExp2=!0,this.name="",this.color=new Tt(t),this.density=e}clone(){return new sa(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}}class ra{constructor(t,e=1,n=1e3){this.isFog=!0,this.name="",this.color=new Tt(t),this.near=e,this.far=n}clone(){return new ra(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class Em extends ae{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e}}class wm{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=Vr,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.version=0,this.uuid=on()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}get updateRange(){return console.warn("THREE.InterleavedBuffer: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,n){t*=this.stride,n*=e.stride;for(let i=0,r=this.stride;i<r;i++)this.array[t+i]=e.array[n+i];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=on()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(e,this.stride);return n.setUsage(this.usage),n}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=on()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const De=new R;class Xs{constructor(t,e,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,n=this.data.count;e<n;e++)De.fromBufferAttribute(this,e),De.applyMatrix4(t),this.setXYZ(e,De.x,De.y,De.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)De.fromBufferAttribute(this,e),De.applyNormalMatrix(t),this.setXYZ(e,De.x,De.y,De.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)De.fromBufferAttribute(this,e),De.transformDirection(t),this.setXYZ(e,De.x,De.y,De.z);return this}setX(t,e){return this.normalized&&(e=Zt(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=Zt(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=Zt(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=Zt(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=rn(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=rn(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=rn(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=rn(e,this.array)),e}setXY(t,e,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=Zt(e,this.array),n=Zt(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this}setXYZ(t,e,n,i){return t=t*this.data.stride+this.offset,this.normalized&&(e=Zt(e,this.array),n=Zt(n,this.array),i=Zt(i,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=i,this}setXYZW(t,e,n,i,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=Zt(e,this.array),n=Zt(n,this.array),i=Zt(i,this.array),r=Zt(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=i,this.data.array[t+3]=r,this}clone(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[i+r])}return new Re(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new Xs(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class Ji extends vn{constructor(t){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Tt(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}let ui;const Fi=new R,di=new R,fi=new R,pi=new rt,Oi=new rt,Ol=new ne,As=new R,Bi=new R,Cs=new R,Bo=new rt,Lr=new rt,zo=new rt;class Bl extends ae{constructor(t=new Ji){if(super(),this.isSprite=!0,this.type="Sprite",ui===void 0){ui=new Ee;const e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new wm(e,5);ui.setIndex([0,1,2,0,2,3]),ui.setAttribute("position",new Xs(n,3,0,!1)),ui.setAttribute("uv",new Xs(n,2,3,!1))}this.geometry=ui,this.material=t,this.center=new rt(.5,.5)}raycast(t,e){t.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),di.setFromMatrixScale(this.matrixWorld),Ol.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),fi.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&di.multiplyScalar(-fi.z);const n=this.material.rotation;let i,r;n!==0&&(r=Math.cos(n),i=Math.sin(n));const a=this.center;Rs(As.set(-.5,-.5,0),fi,a,di,i,r),Rs(Bi.set(.5,-.5,0),fi,a,di,i,r),Rs(Cs.set(.5,.5,0),fi,a,di,i,r),Bo.set(0,0),Lr.set(1,0),zo.set(1,1);let o=t.ray.intersectTriangle(As,Bi,Cs,!1,Fi);if(o===null&&(Rs(Bi.set(-.5,.5,0),fi,a,di,i,r),Lr.set(0,1),o=t.ray.intersectTriangle(As,Cs,Bi,!1,Fi),o===null))return;const l=t.ray.origin.distanceTo(Fi);l<t.near||l>t.far||e.push({distance:l,point:Fi.clone(),uv:Xe.getInterpolation(Fi,As,Bi,Cs,Bo,Lr,zo,new rt),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}}function Rs(s,t,e,n,i,r){pi.subVectors(s,e).addScalar(.5).multiply(n),i!==void 0?(Oi.x=r*pi.x-i*pi.y,Oi.y=i*pi.x+r*pi.y):Oi.copy(pi),s.copy(t),s.x+=Oi.x,s.y+=Oi.y,s.applyMatrix4(Ol)}class Ho extends Re{constructor(t,e,n,i=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const mi=new ne,Go=new ne,Ps=[],ko=new $n,Tm=new ne,zi=new ot,Hi=new Ri;class Vo extends ot{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new Ho(new Float32Array(n*16),16),this.instanceColor=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,Tm)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new $n),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,mi),ko.copy(t.boundingBox).applyMatrix4(mi),this.boundingBox.union(ko)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new Ri),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,mi),Hi.copy(t.boundingSphere).applyMatrix4(mi),this.boundingSphere.union(Hi)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}raycast(t,e){const n=this.matrixWorld,i=this.count;if(zi.geometry=this.geometry,zi.material=this.material,zi.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Hi.copy(this.boundingSphere),Hi.applyMatrix4(n),t.ray.intersectsSphere(Hi)!==!1))for(let r=0;r<i;r++){this.getMatrixAt(r,mi),Go.multiplyMatrices(n,mi),zi.matrixWorld=Go,zi.raycast(t,Ps);for(let a=0,o=Ps.length;a<o;a++){const l=Ps[a];l.instanceId=r,l.object=this,e.push(l)}Ps.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new Ho(new Float32Array(this.instanceMatrix.count*3),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"})}}class aa extends vn{constructor(t){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Tt(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}const Wo=new ne,Yr=new yl,Ls=new Ri,Ds=new R;class zl extends ae{constructor(t=new Ee,e=new aa){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){const n=this.geometry,i=this.matrixWorld,r=t.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Ls.copy(n.boundingSphere),Ls.applyMatrix4(i),Ls.radius+=r,t.ray.intersectsSphere(Ls)===!1)return;Wo.copy(i).invert(),Yr.copy(t.ray).applyMatrix4(Wo);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,u=n.attributes.position;if(c!==null){const d=Math.max(0,a.start),p=Math.min(c.count,a.start+a.count);for(let g=d,_=p;g<_;g++){const m=c.getX(g);Ds.fromBufferAttribute(u,m),Xo(Ds,m,l,i,t,e,this)}}else{const d=Math.max(0,a.start),p=Math.min(u.count,a.start+a.count);for(let g=d,_=p;g<_;g++)Ds.fromBufferAttribute(u,g),Xo(Ds,g,l,i,t,e,this)}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Xo(s,t,e,n,i,r,a){const o=Yr.distanceSqToPoint(s);if(o<e){const l=new R;Yr.closestPointToPoint(s,l),l.applyMatrix4(n);const c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:t,face:null,object:a})}}class ns extends Oe{constructor(t,e,n,i,r,a,o,l,c){super(t,e,n,i,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class ln{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(t,e){const n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){const t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const e=[];let n,i=this.getPoint(0),r=0;e.push(0);for(let a=1;a<=t;a++)n=this.getPoint(a/t),r+=n.distanceTo(i),e.push(r),i=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e){const n=this.getLengths();let i=0;const r=n.length;let a;e?a=e:a=t*n[r-1];let o=0,l=r-1,c;for(;o<=l;)if(i=Math.floor(o+(l-o)/2),c=n[i]-a,c<0)o=i+1;else if(c>0)l=i-1;else{l=i;break}if(i=l,n[i]===a)return i/(r-1);const h=n[i],d=n[i+1]-h,p=(a-h)/d;return(i+p)/(r-1)}getTangent(t,e){let i=t-1e-4,r=t+1e-4;i<0&&(i=0),r>1&&(r=1);const a=this.getPoint(i),o=this.getPoint(r),l=e||(a.isVector2?new rt:new R);return l.copy(o).sub(a).normalize(),l}getTangentAt(t,e){const n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e){const n=new R,i=[],r=[],a=[],o=new R,l=new ne;for(let p=0;p<=t;p++){const g=p/t;i[p]=this.getTangentAt(g,new R)}r[0]=new R,a[0]=new R;let c=Number.MAX_VALUE;const h=Math.abs(i[0].x),u=Math.abs(i[0].y),d=Math.abs(i[0].z);h<=c&&(c=h,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),o.crossVectors(i[0],n).normalize(),r[0].crossVectors(i[0],o),a[0].crossVectors(i[0],r[0]);for(let p=1;p<=t;p++){if(r[p]=r[p-1].clone(),a[p]=a[p-1].clone(),o.crossVectors(i[p-1],i[p]),o.length()>Number.EPSILON){o.normalize();const g=Math.acos(Se(i[p-1].dot(i[p]),-1,1));r[p].applyMatrix4(l.makeRotationAxis(o,g))}a[p].crossVectors(i[p],r[p])}if(e===!0){let p=Math.acos(Se(r[0].dot(r[t]),-1,1));p/=t,i[0].dot(o.crossVectors(r[0],r[t]))>0&&(p=-p);for(let g=1;g<=t;g++)r[g].applyMatrix4(l.makeRotationAxis(i[g],p*g)),a[g].crossVectors(i[g],r[g])}return{tangents:i,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){const t={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}}class oa extends ln{constructor(t=0,e=0,n=1,i=1,r=0,a=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=i,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(t,e){const n=e||new rt,i=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=i;for(;r>i;)r-=i;r<Number.EPSILON&&(a?r=0:r=i),this.aClockwise===!0&&!a&&(r===i?r=-i:r=r-i);const o=this.aStartAngle+t*r;let l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){const h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=l-this.aX,p=c-this.aY;l=d*h-p*u+this.aX,c=d*u+p*h+this.aY}return n.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){const t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}}class bm extends oa{constructor(t,e,n,i,r,a){super(t,e,n,n,i,r,a),this.isArcCurve=!0,this.type="ArcCurve"}}function la(){let s=0,t=0,e=0,n=0;function i(r,a,o,l){s=r,t=o,e=-3*r+3*a-2*o-l,n=2*r-2*a+o+l}return{initCatmullRom:function(r,a,o,l,c){i(a,o,c*(o-r),c*(l-a))},initNonuniformCatmullRom:function(r,a,o,l,c,h,u){let d=(a-r)/c-(o-r)/(c+h)+(o-a)/h,p=(o-a)/h-(l-a)/(h+u)+(l-o)/u;d*=h,p*=h,i(a,o,d,p)},calc:function(r){const a=r*r,o=a*r;return s+t*r+e*a+n*o}}}const Is=new R,Dr=new la,Ir=new la,Ur=new la;class Am extends ln{constructor(t=[],e=!1,n="centripetal",i=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=i}getPoint(t,e=new R){const n=e,i=this.points,r=i.length,a=(r-(this.closed?0:1))*t;let o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:l===0&&o===r-1&&(o=r-2,l=1);let c,h;this.closed||o>0?c=i[(o-1)%r]:(Is.subVectors(i[0],i[1]).add(i[0]),c=Is);const u=i[o%r],d=i[(o+1)%r];if(this.closed||o+2<r?h=i[(o+2)%r]:(Is.subVectors(i[r-1],i[r-2]).add(i[r-1]),h=Is),this.curveType==="centripetal"||this.curveType==="chordal"){const p=this.curveType==="chordal"?.5:.25;let g=Math.pow(c.distanceToSquared(u),p),_=Math.pow(u.distanceToSquared(d),p),m=Math.pow(d.distanceToSquared(h),p);_<1e-4&&(_=1),g<1e-4&&(g=_),m<1e-4&&(m=_),Dr.initNonuniformCatmullRom(c.x,u.x,d.x,h.x,g,_,m),Ir.initNonuniformCatmullRom(c.y,u.y,d.y,h.y,g,_,m),Ur.initNonuniformCatmullRom(c.z,u.z,d.z,h.z,g,_,m)}else this.curveType==="catmullrom"&&(Dr.initCatmullRom(c.x,u.x,d.x,h.x,this.tension),Ir.initCatmullRom(c.y,u.y,d.y,h.y,this.tension),Ur.initCatmullRom(c.z,u.z,d.z,h.z,this.tension));return n.set(Dr.calc(l),Ir.calc(l),Ur.calc(l)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(i.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const i=this.points[e];t.points.push(i.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(new R().fromArray(i))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}}function qo(s,t,e,n,i){const r=(n-t)*.5,a=(i-e)*.5,o=s*s,l=s*o;return(2*e-2*n+r+a)*l+(-3*e+3*n-2*r-a)*o+r*s+e}function Cm(s,t){const e=1-s;return e*e*t}function Rm(s,t){return 2*(1-s)*s*t}function Pm(s,t){return s*s*t}function Wi(s,t,e,n){return Cm(s,t)+Rm(s,e)+Pm(s,n)}function Lm(s,t){const e=1-s;return e*e*e*t}function Dm(s,t){const e=1-s;return 3*e*e*s*t}function Im(s,t){return 3*(1-s)*s*s*t}function Um(s,t){return s*s*s*t}function Xi(s,t,e,n,i){return Lm(s,t)+Dm(s,e)+Im(s,n)+Um(s,i)}class Hl extends ln{constructor(t=new rt,e=new rt,n=new rt,i=new rt){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=i}getPoint(t,e=new rt){const n=e,i=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(Xi(t,i.x,r.x,a.x,o.x),Xi(t,i.y,r.y,a.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class Nm extends ln{constructor(t=new R,e=new R,n=new R,i=new R){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=i}getPoint(t,e=new R){const n=e,i=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(Xi(t,i.x,r.x,a.x,o.x),Xi(t,i.y,r.y,a.y,o.y),Xi(t,i.z,r.z,a.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class Gl extends ln{constructor(t=new rt,e=new rt){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new rt){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new rt){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Fm extends ln{constructor(t=new R,e=new R){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new R){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new R){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class kl extends ln{constructor(t=new rt,e=new rt,n=new rt){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new rt){const n=e,i=this.v0,r=this.v1,a=this.v2;return n.set(Wi(t,i.x,r.x,a.x),Wi(t,i.y,r.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Om extends ln{constructor(t=new R,e=new R,n=new R){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new R){const n=e,i=this.v0,r=this.v1,a=this.v2;return n.set(Wi(t,i.x,r.x,a.x),Wi(t,i.y,r.y,a.y),Wi(t,i.z,r.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Vl extends ln{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new rt){const n=e,i=this.points,r=(i.length-1)*t,a=Math.floor(r),o=r-a,l=i[a===0?a:a-1],c=i[a],h=i[a>i.length-2?i.length-1:a+1],u=i[a>i.length-3?i.length-1:a+2];return n.set(qo(o,l.x,c.x,h.x,u.x),qo(o,l.y,c.y,h.y,u.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(i.clone())}return this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const i=this.points[e];t.points.push(i.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(new rt().fromArray(i))}return this}}var $r=Object.freeze({__proto__:null,ArcCurve:bm,CatmullRomCurve3:Am,CubicBezierCurve:Hl,CubicBezierCurve3:Nm,EllipseCurve:oa,LineCurve:Gl,LineCurve3:Fm,QuadraticBezierCurve:kl,QuadraticBezierCurve3:Om,SplineCurve:Vl});class Bm extends ln{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){const t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){const n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new $r[n](e,t))}return this}getPoint(t,e){const n=t*this.getLength(),i=this.getCurveLengths();let r=0;for(;r<i.length;){if(i[r]>=n){const a=i[r]-n,o=this.curves[r],l=o.getLength(),c=l===0?0:1-a/l;return o.getPointAt(c,e)}r++}return null}getLength(){const t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const t=[];let e=0;for(let n=0,i=this.curves.length;n<i;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){const e=[];let n;for(let i=0,r=this.curves;i<r.length;i++){const a=r[i],o=a.isEllipseCurve?t*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?t*a.points.length:t,l=a.getPoints(o);for(let c=0;c<l.length;c++){const h=l[c];n&&n.equals(h)||(e.push(h),n=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const i=t.curves[e];this.curves.push(i.clone())}return this.autoClose=t.autoClose,this}toJSON(){const t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){const i=this.curves[e];t.curves.push(i.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const i=t.curves[e];this.curves.push(new $r[i.type]().fromJSON(i))}return this}}class Yo extends Bm{constructor(t){super(),this.type="Path",this.currentPoint=new rt,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){const n=new Gl(this.currentPoint.clone(),new rt(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,i){const r=new kl(this.currentPoint.clone(),new rt(t,e),new rt(n,i));return this.curves.push(r),this.currentPoint.set(n,i),this}bezierCurveTo(t,e,n,i,r,a){const o=new Hl(this.currentPoint.clone(),new rt(t,e),new rt(n,i),new rt(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(t){const e=[this.currentPoint.clone()].concat(t),n=new Vl(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,i,r,a){const o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+o,e+l,n,i,r,a),this}absarc(t,e,n,i,r,a){return this.absellipse(t,e,n,n,i,r,a),this}ellipse(t,e,n,i,r,a,o,l){const c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,n,i,r,a,o,l),this}absellipse(t,e,n,i,r,a,o,l){const c=new oa(t,e,n,i,r,a,o,l);if(this.curves.length>0){const u=c.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(c);const h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){const t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}}class Ce extends Ee{constructor(t=1,e=1,n=1,i=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:i,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};const c=this;i=Math.floor(i),r=Math.floor(r);const h=[],u=[],d=[],p=[];let g=0;const _=[],m=n/2;let f=0;M(),a===!1&&(t>0&&v(!0),e>0&&v(!1)),this.setIndex(h),this.setAttribute("position",new ie(u,3)),this.setAttribute("normal",new ie(d,3)),this.setAttribute("uv",new ie(p,2));function M(){const S=new R,L=new R;let A=0;const C=(e-t)/n;for(let B=0;B<=r;B++){const y=[],T=B/r,F=T*(e-t)+t;for(let V=0;V<=i;V++){const nt=V/i,I=nt*l+o,O=Math.sin(I),k=Math.cos(I);L.x=F*O,L.y=-T*n+m,L.z=F*k,u.push(L.x,L.y,L.z),S.set(O,C,k).normalize(),d.push(S.x,S.y,S.z),p.push(nt,1-T),y.push(g++)}_.push(y)}for(let B=0;B<i;B++)for(let y=0;y<r;y++){const T=_[y][B],F=_[y+1][B],V=_[y+1][B+1],nt=_[y][B+1];h.push(T,F,nt),h.push(F,V,nt),A+=6}c.addGroup(f,A,0),f+=A}function v(S){const L=g,A=new rt,C=new R;let B=0;const y=S===!0?t:e,T=S===!0?1:-1;for(let V=1;V<=i;V++)u.push(0,m*T,0),d.push(0,T,0),p.push(.5,.5),g++;const F=g;for(let V=0;V<=i;V++){const I=V/i*l+o,O=Math.cos(I),k=Math.sin(I);C.x=y*k,C.y=m*T,C.z=y*O,u.push(C.x,C.y,C.z),d.push(0,T,0),A.x=O*.5+.5,A.y=k*.5*T+.5,p.push(A.x,A.y),g++}for(let V=0;V<i;V++){const nt=L+V,I=F+V;S===!0?h.push(I,I+1,nt):h.push(I+1,I,nt),B+=3}c.addGroup(f,B,S===!0?1:2),f+=B}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ce(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class ye extends Ce{constructor(t=1,e=1,n=32,i=1,r=!1,a=0,o=Math.PI*2){super(0,t,e,n,i,r,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:i,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(t){return new ye(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class ca extends Ee{constructor(t=[],e=[],n=1,i=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:n,detail:i};const r=[],a=[];o(i),c(n),h(),this.setAttribute("position",new ie(r,3)),this.setAttribute("normal",new ie(r.slice(),3)),this.setAttribute("uv",new ie(a,2)),i===0?this.computeVertexNormals():this.normalizeNormals();function o(M){const v=new R,S=new R,L=new R;for(let A=0;A<e.length;A+=3)p(e[A+0],v),p(e[A+1],S),p(e[A+2],L),l(v,S,L,M)}function l(M,v,S,L){const A=L+1,C=[];for(let B=0;B<=A;B++){C[B]=[];const y=M.clone().lerp(S,B/A),T=v.clone().lerp(S,B/A),F=A-B;for(let V=0;V<=F;V++)V===0&&B===A?C[B][V]=y:C[B][V]=y.clone().lerp(T,V/F)}for(let B=0;B<A;B++)for(let y=0;y<2*(A-B)-1;y++){const T=Math.floor(y/2);y%2===0?(d(C[B][T+1]),d(C[B+1][T]),d(C[B][T])):(d(C[B][T+1]),d(C[B+1][T+1]),d(C[B+1][T]))}}function c(M){const v=new R;for(let S=0;S<r.length;S+=3)v.x=r[S+0],v.y=r[S+1],v.z=r[S+2],v.normalize().multiplyScalar(M),r[S+0]=v.x,r[S+1]=v.y,r[S+2]=v.z}function h(){const M=new R;for(let v=0;v<r.length;v+=3){M.x=r[v+0],M.y=r[v+1],M.z=r[v+2];const S=m(M)/2/Math.PI+.5,L=f(M)/Math.PI+.5;a.push(S,1-L)}g(),u()}function u(){for(let M=0;M<a.length;M+=6){const v=a[M+0],S=a[M+2],L=a[M+4],A=Math.max(v,S,L),C=Math.min(v,S,L);A>.9&&C<.1&&(v<.2&&(a[M+0]+=1),S<.2&&(a[M+2]+=1),L<.2&&(a[M+4]+=1))}}function d(M){r.push(M.x,M.y,M.z)}function p(M,v){const S=M*3;v.x=t[S+0],v.y=t[S+1],v.z=t[S+2]}function g(){const M=new R,v=new R,S=new R,L=new R,A=new rt,C=new rt,B=new rt;for(let y=0,T=0;y<r.length;y+=9,T+=6){M.set(r[y+0],r[y+1],r[y+2]),v.set(r[y+3],r[y+4],r[y+5]),S.set(r[y+6],r[y+7],r[y+8]),A.set(a[T+0],a[T+1]),C.set(a[T+2],a[T+3]),B.set(a[T+4],a[T+5]),L.copy(M).add(v).add(S).divideScalar(3);const F=m(L);_(A,T+0,M,F),_(C,T+2,v,F),_(B,T+4,S,F)}}function _(M,v,S,L){L<0&&M.x===1&&(a[v]=M.x-1),S.x===0&&S.z===0&&(a[v]=L/2/Math.PI+.5)}function m(M){return Math.atan2(M.z,-M.x)}function f(M){return Math.atan2(-M.y,Math.sqrt(M.x*M.x+M.z*M.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ca(t.vertices,t.indices,t.radius,t.details)}}class ha extends ca{constructor(t=1,e=0){const n=(1+Math.sqrt(5))/2,i=1/n,r=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-i,-n,0,-i,n,0,i,-n,0,i,n,-i,-n,0,-i,n,0,i,-n,0,i,n,0,-n,0,-i,n,0,-i,-n,0,i,n,0,i],a=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(r,a,t,e),this.type="DodecahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new ha(t.radius,t.detail)}}class Ki extends Yo{constructor(t){super(t),this.uuid=on(),this.type="Shape",this.holes=[]}getPointsHoles(t){const e=[];for(let n=0,i=this.holes.length;n<i;n++)e[n]=this.holes[n].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){const i=t.holes[e];this.holes.push(i.clone())}return this}toJSON(){const t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,n=this.holes.length;e<n;e++){const i=this.holes[e];t.holes.push(i.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){const i=t.holes[e];this.holes.push(new Yo().fromJSON(i))}return this}}const zm={triangulate:function(s,t,e=2){const n=t&&t.length,i=n?t[0]*e:s.length;let r=Wl(s,0,i,e,!0);const a=[];if(!r||r.next===r.prev)return a;let o,l,c,h,u,d,p;if(n&&(r=Wm(s,t,r,e)),s.length>80*e){o=c=s[0],l=h=s[1];for(let g=e;g<i;g+=e)u=s[g],d=s[g+1],u<o&&(o=u),d<l&&(l=d),u>c&&(c=u),d>h&&(h=d);p=Math.max(c-o,h-l),p=p!==0?32767/p:0}return Qi(r,a,e,o,l,p,0),a}};function Wl(s,t,e,n,i){let r,a;if(i===eg(s,t,e,n)>0)for(r=t;r<e;r+=n)a=$o(r,s[r],s[r+1],a);else for(r=e-n;r>=t;r-=n)a=$o(r,s[r],s[r+1],a);return a&&Js(a,a.next)&&(es(a),a=a.next),a}function Yn(s,t){if(!s)return s;t||(t=s);let e=s,n;do if(n=!1,!e.steiner&&(Js(e,e.next)||re(e.prev,e,e.next)===0)){if(es(e),e=t=e.prev,e===e.next)break;n=!0}else e=e.next;while(n||e!==t);return t}function Qi(s,t,e,n,i,r,a){if(!s)return;!a&&r&&Zm(s,n,i,r);let o=s,l,c;for(;s.prev!==s.next;){if(l=s.prev,c=s.next,r?Gm(s,n,i,r):Hm(s)){t.push(l.i/e|0),t.push(s.i/e|0),t.push(c.i/e|0),es(s),s=c.next,o=c.next;continue}if(s=c,s===o){a?a===1?(s=km(Yn(s),t,e),Qi(s,t,e,n,i,r,2)):a===2&&Vm(s,t,e,n,i,r):Qi(Yn(s),t,e,n,i,r,1);break}}}function Hm(s){const t=s.prev,e=s,n=s.next;if(re(t,e,n)>=0)return!1;const i=t.x,r=e.x,a=n.x,o=t.y,l=e.y,c=n.y,h=i<r?i<a?i:a:r<a?r:a,u=o<l?o<c?o:c:l<c?l:c,d=i>r?i>a?i:a:r>a?r:a,p=o>l?o>c?o:c:l>c?l:c;let g=n.next;for(;g!==t;){if(g.x>=h&&g.x<=d&&g.y>=u&&g.y<=p&&xi(i,o,r,l,a,c,g.x,g.y)&&re(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function Gm(s,t,e,n){const i=s.prev,r=s,a=s.next;if(re(i,r,a)>=0)return!1;const o=i.x,l=r.x,c=a.x,h=i.y,u=r.y,d=a.y,p=o<l?o<c?o:c:l<c?l:c,g=h<u?h<d?h:d:u<d?u:d,_=o>l?o>c?o:c:l>c?l:c,m=h>u?h>d?h:d:u>d?u:d,f=Zr(p,g,t,e,n),M=Zr(_,m,t,e,n);let v=s.prevZ,S=s.nextZ;for(;v&&v.z>=f&&S&&S.z<=M;){if(v.x>=p&&v.x<=_&&v.y>=g&&v.y<=m&&v!==i&&v!==a&&xi(o,h,l,u,c,d,v.x,v.y)&&re(v.prev,v,v.next)>=0||(v=v.prevZ,S.x>=p&&S.x<=_&&S.y>=g&&S.y<=m&&S!==i&&S!==a&&xi(o,h,l,u,c,d,S.x,S.y)&&re(S.prev,S,S.next)>=0))return!1;S=S.nextZ}for(;v&&v.z>=f;){if(v.x>=p&&v.x<=_&&v.y>=g&&v.y<=m&&v!==i&&v!==a&&xi(o,h,l,u,c,d,v.x,v.y)&&re(v.prev,v,v.next)>=0)return!1;v=v.prevZ}for(;S&&S.z<=M;){if(S.x>=p&&S.x<=_&&S.y>=g&&S.y<=m&&S!==i&&S!==a&&xi(o,h,l,u,c,d,S.x,S.y)&&re(S.prev,S,S.next)>=0)return!1;S=S.nextZ}return!0}function km(s,t,e){let n=s;do{const i=n.prev,r=n.next.next;!Js(i,r)&&Xl(i,n,n.next,r)&&ts(i,r)&&ts(r,i)&&(t.push(i.i/e|0),t.push(n.i/e|0),t.push(r.i/e|0),es(n),es(n.next),n=s=r),n=n.next}while(n!==s);return Yn(n)}function Vm(s,t,e,n,i,r){let a=s;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&Km(a,o)){let l=ql(a,o);a=Yn(a,a.next),l=Yn(l,l.next),Qi(a,t,e,n,i,r,0),Qi(l,t,e,n,i,r,0);return}o=o.next}a=a.next}while(a!==s)}function Wm(s,t,e,n){const i=[];let r,a,o,l,c;for(r=0,a=t.length;r<a;r++)o=t[r]*n,l=r<a-1?t[r+1]*n:s.length,c=Wl(s,o,l,n,!1),c===c.next&&(c.steiner=!0),i.push(Jm(c));for(i.sort(Xm),r=0;r<i.length;r++)e=qm(i[r],e);return e}function Xm(s,t){return s.x-t.x}function qm(s,t){const e=Ym(s,t);if(!e)return t;const n=ql(e,s);return Yn(n,n.next),Yn(e,e.next)}function Ym(s,t){let e=t,n=-1/0,i;const r=s.x,a=s.y;do{if(a<=e.y&&a>=e.next.y&&e.next.y!==e.y){const d=e.x+(a-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(d<=r&&d>n&&(n=d,i=e.x<e.next.x?e:e.next,d===r))return i}e=e.next}while(e!==t);if(!i)return null;const o=i,l=i.x,c=i.y;let h=1/0,u;e=i;do r>=e.x&&e.x>=l&&r!==e.x&&xi(a<c?r:n,a,l,c,a<c?n:r,a,e.x,e.y)&&(u=Math.abs(a-e.y)/(r-e.x),ts(e,s)&&(u<h||u===h&&(e.x>i.x||e.x===i.x&&$m(i,e)))&&(i=e,h=u)),e=e.next;while(e!==o);return i}function $m(s,t){return re(s.prev,s,t.prev)<0&&re(t.next,s,s.next)<0}function Zm(s,t,e,n){let i=s;do i.z===0&&(i.z=Zr(i.x,i.y,t,e,n)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next;while(i!==s);i.prevZ.nextZ=null,i.prevZ=null,jm(i)}function jm(s){let t,e,n,i,r,a,o,l,c=1;do{for(e=s,s=null,r=null,a=0;e;){for(a++,n=e,o=0,t=0;t<c&&(o++,n=n.nextZ,!!n);t++);for(l=c;o>0||l>0&&n;)o!==0&&(l===0||!n||e.z<=n.z)?(i=e,e=e.nextZ,o--):(i=n,n=n.nextZ,l--),r?r.nextZ=i:s=i,i.prevZ=r,r=i;e=n}r.nextZ=null,c*=2}while(a>1);return s}function Zr(s,t,e,n,i){return s=(s-e)*i|0,t=(t-n)*i|0,s=(s|s<<8)&16711935,s=(s|s<<4)&252645135,s=(s|s<<2)&858993459,s=(s|s<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,s|t<<1}function Jm(s){let t=s,e=s;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==s);return e}function xi(s,t,e,n,i,r,a,o){return(i-a)*(t-o)>=(s-a)*(r-o)&&(s-a)*(n-o)>=(e-a)*(t-o)&&(e-a)*(r-o)>=(i-a)*(n-o)}function Km(s,t){return s.next.i!==t.i&&s.prev.i!==t.i&&!Qm(s,t)&&(ts(s,t)&&ts(t,s)&&tg(s,t)&&(re(s.prev,s,t.prev)||re(s,t.prev,t))||Js(s,t)&&re(s.prev,s,s.next)>0&&re(t.prev,t,t.next)>0)}function re(s,t,e){return(t.y-s.y)*(e.x-t.x)-(t.x-s.x)*(e.y-t.y)}function Js(s,t){return s.x===t.x&&s.y===t.y}function Xl(s,t,e,n){const i=Ns(re(s,t,e)),r=Ns(re(s,t,n)),a=Ns(re(e,n,s)),o=Ns(re(e,n,t));return!!(i!==r&&a!==o||i===0&&Us(s,e,t)||r===0&&Us(s,n,t)||a===0&&Us(e,s,n)||o===0&&Us(e,t,n))}function Us(s,t,e){return t.x<=Math.max(s.x,e.x)&&t.x>=Math.min(s.x,e.x)&&t.y<=Math.max(s.y,e.y)&&t.y>=Math.min(s.y,e.y)}function Ns(s){return s>0?1:s<0?-1:0}function Qm(s,t){let e=s;do{if(e.i!==s.i&&e.next.i!==s.i&&e.i!==t.i&&e.next.i!==t.i&&Xl(e,e.next,s,t))return!0;e=e.next}while(e!==s);return!1}function ts(s,t){return re(s.prev,s,s.next)<0?re(s,t,s.next)>=0&&re(s,s.prev,t)>=0:re(s,t,s.prev)<0||re(s,s.next,t)<0}function tg(s,t){let e=s,n=!1;const i=(s.x+t.x)/2,r=(s.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&i<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(n=!n),e=e.next;while(e!==s);return n}function ql(s,t){const e=new jr(s.i,s.x,s.y),n=new jr(t.i,t.x,t.y),i=s.next,r=t.prev;return s.next=t,t.prev=s,e.next=i,i.prev=e,n.next=e,e.prev=n,r.next=n,n.prev=r,n}function $o(s,t,e,n){const i=new jr(s,t,e);return n?(i.next=n.next,i.prev=n,n.next.prev=i,n.next=i):(i.prev=i,i.next=i),i}function es(s){s.next.prev=s.prev,s.prev.next=s.next,s.prevZ&&(s.prevZ.nextZ=s.nextZ),s.nextZ&&(s.nextZ.prevZ=s.prevZ)}function jr(s,t,e){this.i=s,this.x=t,this.y=e,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}function eg(s,t,e,n){let i=0;for(let r=t,a=e-n;r<e;r+=n)i+=(s[a]-s[r])*(s[r+1]+s[a+1]),a=r;return i}class Rn{static area(t){const e=t.length;let n=0;for(let i=e-1,r=0;r<e;i=r++)n+=t[i].x*t[r].y-t[r].x*t[i].y;return n*.5}static isClockWise(t){return Rn.area(t)<0}static triangulateShape(t,e){const n=[],i=[],r=[];Zo(t),jo(n,t);let a=t.length;e.forEach(Zo);for(let l=0;l<e.length;l++)i.push(a),a+=e[l].length,jo(n,e[l]);const o=zm.triangulate(n,i);for(let l=0;l<o.length;l+=3)r.push(o.slice(l,l+3));return r}}function Zo(s){const t=s.length;t>2&&s[t-1].equals(s[0])&&s.pop()}function jo(s,t){for(let e=0;e<t.length;e++)s.push(t[e].x),s.push(t[e].y)}class ua extends Ee{constructor(t=new Ki([new rt(.5,.5),new rt(-.5,.5),new rt(-.5,-.5),new rt(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];const n=this,i=[],r=[];for(let o=0,l=t.length;o<l;o++){const c=t[o];a(c)}this.setAttribute("position",new ie(i,3)),this.setAttribute("uv",new ie(r,2)),this.computeVertexNormals();function a(o){const l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,u=e.depth!==void 0?e.depth:1;let d=e.bevelEnabled!==void 0?e.bevelEnabled:!0,p=e.bevelThickness!==void 0?e.bevelThickness:.2,g=e.bevelSize!==void 0?e.bevelSize:p-.1,_=e.bevelOffset!==void 0?e.bevelOffset:0,m=e.bevelSegments!==void 0?e.bevelSegments:3;const f=e.extrudePath,M=e.UVGenerator!==void 0?e.UVGenerator:ng;let v,S=!1,L,A,C,B;f&&(v=f.getSpacedPoints(h),S=!0,d=!1,L=f.computeFrenetFrames(h,!1),A=new R,C=new R,B=new R),d||(m=0,p=0,g=0,_=0);const y=o.extractPoints(c);let T=y.shape;const F=y.holes;if(!Rn.isClockWise(T)){T=T.reverse();for(let P=0,lt=F.length;P<lt;P++){const q=F[P];Rn.isClockWise(q)&&(F[P]=q.reverse())}}const nt=Rn.triangulateShape(T,F),I=T;for(let P=0,lt=F.length;P<lt;P++){const q=F[P];T=T.concat(q)}function O(P,lt,q){return lt||console.error("THREE.ExtrudeGeometry: vec does not exist"),P.clone().addScaledVector(lt,q)}const k=T.length,Z=nt.length;function Y(P,lt,q){let st,X,wt;const mt=P.x-lt.x,E=P.y-lt.y,x=q.x-P.x,N=q.y-P.y,et=mt*mt+E*E,Q=mt*N-E*x;if(Math.abs(Q)>Number.EPSILON){const J=Math.sqrt(et),yt=Math.sqrt(x*x+N*N),ut=lt.x-E/J,vt=lt.y+mt/J,At=q.x-N/yt,Bt=q.y+x/yt,tt=((At-ut)*N-(Bt-vt)*x)/(mt*N-E*x);st=ut+mt*tt-P.x,X=vt+E*tt-P.y;const Yt=st*st+X*X;if(Yt<=2)return new rt(st,X);wt=Math.sqrt(Yt/2)}else{let J=!1;mt>Number.EPSILON?x>Number.EPSILON&&(J=!0):mt<-Number.EPSILON?x<-Number.EPSILON&&(J=!0):Math.sign(E)===Math.sign(N)&&(J=!0),J?(st=-E,X=mt,wt=Math.sqrt(et)):(st=mt,X=E,wt=Math.sqrt(et/2))}return new rt(st/wt,X/wt)}const $=[];for(let P=0,lt=I.length,q=lt-1,st=P+1;P<lt;P++,q++,st++)q===lt&&(q=0),st===lt&&(st=0),$[P]=Y(I[P],I[q],I[st]);const j=[];let it,at=$.concat();for(let P=0,lt=F.length;P<lt;P++){const q=F[P];it=[];for(let st=0,X=q.length,wt=X-1,mt=st+1;st<X;st++,wt++,mt++)wt===X&&(wt=0),mt===X&&(mt=0),it[st]=Y(q[st],q[wt],q[mt]);j.push(it),at=at.concat(it)}for(let P=0;P<m;P++){const lt=P/m,q=p*Math.cos(lt*Math.PI/2),st=g*Math.sin(lt*Math.PI/2)+_;for(let X=0,wt=I.length;X<wt;X++){const mt=O(I[X],$[X],st);_t(mt.x,mt.y,-q)}for(let X=0,wt=F.length;X<wt;X++){const mt=F[X];it=j[X];for(let E=0,x=mt.length;E<x;E++){const N=O(mt[E],it[E],st);_t(N.x,N.y,-q)}}}const W=g+_;for(let P=0;P<k;P++){const lt=d?O(T[P],at[P],W):T[P];S?(C.copy(L.normals[0]).multiplyScalar(lt.x),A.copy(L.binormals[0]).multiplyScalar(lt.y),B.copy(v[0]).add(C).add(A),_t(B.x,B.y,B.z)):_t(lt.x,lt.y,0)}for(let P=1;P<=h;P++)for(let lt=0;lt<k;lt++){const q=d?O(T[lt],at[lt],W):T[lt];S?(C.copy(L.normals[P]).multiplyScalar(q.x),A.copy(L.binormals[P]).multiplyScalar(q.y),B.copy(v[P]).add(C).add(A),_t(B.x,B.y,B.z)):_t(q.x,q.y,u/h*P)}for(let P=m-1;P>=0;P--){const lt=P/m,q=p*Math.cos(lt*Math.PI/2),st=g*Math.sin(lt*Math.PI/2)+_;for(let X=0,wt=I.length;X<wt;X++){const mt=O(I[X],$[X],st);_t(mt.x,mt.y,u+q)}for(let X=0,wt=F.length;X<wt;X++){const mt=F[X];it=j[X];for(let E=0,x=mt.length;E<x;E++){const N=O(mt[E],it[E],st);S?_t(N.x,N.y+v[h-1].y,v[h-1].x+q):_t(N.x,N.y,u+q)}}}K(),pt();function K(){const P=i.length/3;if(d){let lt=0,q=k*lt;for(let st=0;st<Z;st++){const X=nt[st];Pt(X[2]+q,X[1]+q,X[0]+q)}lt=h+m*2,q=k*lt;for(let st=0;st<Z;st++){const X=nt[st];Pt(X[0]+q,X[1]+q,X[2]+q)}}else{for(let lt=0;lt<Z;lt++){const q=nt[lt];Pt(q[2],q[1],q[0])}for(let lt=0;lt<Z;lt++){const q=nt[lt];Pt(q[0]+k*h,q[1]+k*h,q[2]+k*h)}}n.addGroup(P,i.length/3-P,0)}function pt(){const P=i.length/3;let lt=0;Mt(I,lt),lt+=I.length;for(let q=0,st=F.length;q<st;q++){const X=F[q];Mt(X,lt),lt+=X.length}n.addGroup(P,i.length/3-P,1)}function Mt(P,lt){let q=P.length;for(;--q>=0;){const st=q;let X=q-1;X<0&&(X=P.length-1);for(let wt=0,mt=h+m*2;wt<mt;wt++){const E=k*wt,x=k*(wt+1),N=lt+st+E,et=lt+X+E,Q=lt+X+x,J=lt+st+x;Ft(N,et,Q,J)}}}function _t(P,lt,q){l.push(P),l.push(lt),l.push(q)}function Pt(P,lt,q){St(P),St(lt),St(q);const st=i.length/3,X=M.generateTopUV(n,i,st-3,st-2,st-1);Ut(X[0]),Ut(X[1]),Ut(X[2])}function Ft(P,lt,q,st){St(P),St(lt),St(st),St(lt),St(q),St(st);const X=i.length/3,wt=M.generateSideWallUV(n,i,X-6,X-3,X-2,X-1);Ut(wt[0]),Ut(wt[1]),Ut(wt[3]),Ut(wt[1]),Ut(wt[2]),Ut(wt[3])}function St(P){i.push(l[P*3+0]),i.push(l[P*3+1]),i.push(l[P*3+2])}function Ut(P){r.push(P.x),r.push(P.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON(),e=this.parameters.shapes,n=this.parameters.options;return ig(e,n,t)}static fromJSON(t,e){const n=[];for(let r=0,a=t.shapes.length;r<a;r++){const o=e[t.shapes[r]];n.push(o)}const i=t.options.extrudePath;return i!==void 0&&(t.options.extrudePath=new $r[i.type]().fromJSON(i)),new ua(n,t.options)}}const ng={generateTopUV:function(s,t,e,n,i){const r=t[e*3],a=t[e*3+1],o=t[n*3],l=t[n*3+1],c=t[i*3],h=t[i*3+1];return[new rt(r,a),new rt(o,l),new rt(c,h)]},generateSideWallUV:function(s,t,e,n,i,r){const a=t[e*3],o=t[e*3+1],l=t[e*3+2],c=t[n*3],h=t[n*3+1],u=t[n*3+2],d=t[i*3],p=t[i*3+1],g=t[i*3+2],_=t[r*3],m=t[r*3+1],f=t[r*3+2];return Math.abs(o-h)<Math.abs(a-c)?[new rt(a,1-l),new rt(c,1-u),new rt(d,1-g),new rt(_,1-f)]:[new rt(o,1-l),new rt(h,1-u),new rt(p,1-g),new rt(m,1-f)]}};function ig(s,t,e){if(e.shapes=[],Array.isArray(s))for(let n=0,i=s.length;n<i;n++){const r=s[n];e.shapes.push(r.uuid)}else e.shapes.push(s.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}class qs extends Ee{constructor(t=new Ki([new rt(0,.5),new rt(-.5,-.5),new rt(.5,-.5)]),e=12){super(),this.type="ShapeGeometry",this.parameters={shapes:t,curveSegments:e};const n=[],i=[],r=[],a=[];let o=0,l=0;if(Array.isArray(t)===!1)c(t);else for(let h=0;h<t.length;h++)c(t[h]),this.addGroup(o,l,h),o+=l,l=0;this.setIndex(n),this.setAttribute("position",new ie(i,3)),this.setAttribute("normal",new ie(r,3)),this.setAttribute("uv",new ie(a,2));function c(h){const u=i.length/3,d=h.extractPoints(e);let p=d.shape;const g=d.holes;Rn.isClockWise(p)===!1&&(p=p.reverse());for(let m=0,f=g.length;m<f;m++){const M=g[m];Rn.isClockWise(M)===!0&&(g[m]=M.reverse())}const _=Rn.triangulateShape(p,g);for(let m=0,f=g.length;m<f;m++){const M=g[m];p=p.concat(M)}for(let m=0,f=p.length;m<f;m++){const M=p[m];i.push(M.x,M.y,0),r.push(0,0,1),a.push(M.x,M.y)}for(let m=0,f=_.length;m<f;m++){const M=_[m],v=M[0]+u,S=M[1]+u,L=M[2]+u;n.push(v,S,L),l+=3}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON(),e=this.parameters.shapes;return sg(e,t)}static fromJSON(t,e){const n=[];for(let i=0,r=t.shapes.length;i<r;i++){const a=e[t.shapes[i]];n.push(a)}return new qs(n,t.curveSegments)}}function sg(s,t){if(t.shapes=[],Array.isArray(s))for(let e=0,n=s.length;e<n;e++){const i=s[e];t.shapes.push(i.uuid)}else t.shapes.push(s.uuid);return t}class xe extends Ee{constructor(t=1,e=32,n=16,i=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:i,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));const l=Math.min(a+o,Math.PI);let c=0;const h=[],u=new R,d=new R,p=[],g=[],_=[],m=[];for(let f=0;f<=n;f++){const M=[],v=f/n;let S=0;f===0&&a===0?S=.5/e:f===n&&l===Math.PI&&(S=-.5/e);for(let L=0;L<=e;L++){const A=L/e;u.x=-t*Math.cos(i+A*r)*Math.sin(a+v*o),u.y=t*Math.cos(a+v*o),u.z=t*Math.sin(i+A*r)*Math.sin(a+v*o),g.push(u.x,u.y,u.z),d.copy(u).normalize(),_.push(d.x,d.y,d.z),m.push(A+S,1-v),M.push(c++)}h.push(M)}for(let f=0;f<n;f++)for(let M=0;M<e;M++){const v=h[f][M+1],S=h[f][M],L=h[f+1][M],A=h[f+1][M+1];(f!==0||a>0)&&p.push(v,S,A),(f!==n-1||l<Math.PI)&&p.push(S,L,A)}this.setIndex(p),this.setAttribute("position",new ie(g,3)),this.setAttribute("normal",new ie(_,3)),this.setAttribute("uv",new ie(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new xe(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class Mi extends Ee{constructor(t=1,e=.4,n=12,i=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:n,tubularSegments:i,arc:r},n=Math.floor(n),i=Math.floor(i);const a=[],o=[],l=[],c=[],h=new R,u=new R,d=new R;for(let p=0;p<=n;p++)for(let g=0;g<=i;g++){const _=g/i*r,m=p/n*Math.PI*2;u.x=(t+e*Math.cos(m))*Math.cos(_),u.y=(t+e*Math.cos(m))*Math.sin(_),u.z=e*Math.sin(m),o.push(u.x,u.y,u.z),h.x=t*Math.cos(_),h.y=t*Math.sin(_),d.subVectors(u,h).normalize(),l.push(d.x,d.y,d.z),c.push(g/i),c.push(p/n)}for(let p=1;p<=n;p++)for(let g=1;g<=i;g++){const _=(i+1)*p+g-1,m=(i+1)*(p-1)+g-1,f=(i+1)*(p-1)+g,M=(i+1)*p+g;a.push(_,m,M),a.push(m,f,M)}this.setIndex(a),this.setAttribute("position",new ie(o,3)),this.setAttribute("normal",new ie(l,3)),this.setAttribute("uv",new ie(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Mi(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}}class It extends vn{constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new Tt(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Tt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=pl,this.normalScale=new rt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class da extends ae{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Tt(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),e}}class rg extends da{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(ae.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Tt(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const Nr=new ne,Jo=new R,Ko=new R;class ag{constructor(t){this.camera=t,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new rt(512,512),this.map=null,this.mapPass=null,this.matrix=new ne,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new na,this._frameExtents=new rt(1,1),this._viewportCount=1,this._viewports=[new ve(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;Jo.setFromMatrixPosition(t.matrixWorld),e.position.copy(Jo),Ko.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Ko),e.updateMatrixWorld(),Nr.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Nr),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Nr)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}class og extends ag{constructor(){super(new Rl(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class lg extends da{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(ae.DEFAULT_UP),this.updateMatrix(),this.target=new ae,this.shadow=new og}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}class cg extends da{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Kr}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Kr);class hg{constructor(){b(this,"lastRequestId");b(this,"isRunning",!1);b(this,"lastTimestamp",0);b(this,"accumulator",0);b(this,"DEFAULT_FPS",60);b(this,"MIN_FPS",20);b(this,"targetFps",this.DEFAULT_FPS)}get targetFrameTime(){return 1e3/this.targetFps}get maxDeltaTime(){return 1e3/this.MIN_FPS}setTargetFPS(t){this.targetFps=Math.min(Math.max(t,this.MIN_FPS),144)}start(t,e){if(this.isRunning)return;this.isRunning=!0,this.lastTimestamp=performance.now(),this.accumulator=0;const n=i=>{if(!this.isRunning)return;this.lastRequestId=requestAnimationFrame(n);let r=i-this.lastTimestamp;for(this.lastTimestamp=i,r=Math.min(r,this.maxDeltaTime),this.accumulator+=r;this.accumulator>=this.targetFrameTime;)t(this.targetFrameTime/1e3),this.accumulator-=this.targetFrameTime;e()};requestAnimationFrame(n)}stop(){this.isRunning=!1,this.lastRequestId&&(cancelAnimationFrame(this.lastRequestId),this.lastRequestId=void 0)}isActive(){return this.isRunning}}const qi=class qi{static detectMobile(){return/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)||window.innerWidth<=768||"ontouchstart"in window}static getPixelRatio(){return this.isMobile?Math.min(window.devicePixelRatio,1.5):Math.min(window.devicePixelRatio,2)}static getShadowEnabled(){return!this.isMobile}static getAntialiasEnabled(){return!this.isMobile}static getMaxEnemies(){return this.isMobile?5:10}static getParticleCount(){return this.isMobile?20:50}static getProjectilePoolSize(){return this.isMobile?100:200}static getTargetFPS(){return this.isMobile?30:60}};b(qi,"isMobile",qi.detectMobile()),b(qi,"DEBUG",!1);let an=qi;const te={PLAYER:{PITCH_SPEED:2,YAW_SPEED:1.5,ROLL_SPEED:3,BASE_SPEED:25,MAX_SPEED:50},PROJECTILE:{SPEED:100,MAX_DISTANCE:500},CAMERA:{FOV:75,NEAR:.1,FAR:2e3,OFFSET:{x:0,y:5,z:15},SMOOTH_FACTOR:.1},WORLD:{FOG_NEAR:100,FOG_FAR:1e3},POWERUP:{SPAWN_CHANCE:.4},LEVEL:{START_DELAY:2,WAVE_DELAY:5},MISSILE:{DAMAGE:100,TURN_SPEED:2,MAX_FLIGHT_DISTANCE:1200,STARTING_MISSILES:2}};class ug{constructor(){b(this,"scene");b(this,"camera");b(this,"renderer");this.scene=new Em,this.scene.fog=new ra(8900331,te.WORLD.FOG_NEAR,te.WORLD.FOG_FAR),this.camera=new qe(te.CAMERA.FOV,window.innerWidth/window.innerHeight,te.CAMERA.NEAR,te.CAMERA.FAR),this.camera.position.set(0,5,10),this.renderer=new Fl({antialias:an.getAntialiasEnabled(),powerPreference:"high-performance"}),this.renderer.setSize(window.innerWidth,window.innerHeight),this.renderer.setPixelRatio(an.getPixelRatio()),this.renderer.shadowMap.enabled=an.getShadowEnabled(),this.renderer.shadowMap.type=il,document.body.appendChild(this.renderer.domElement),this.setupLighting(),this.setupSkybox(),this.setupGround(),this.setupResizeHandler()}setupLighting(){const t=new cg(16777215,.6);this.scene.add(t);const e=new lg(16777215,1);e.position.set(100,100,50),e.castShadow=an.getShadowEnabled(),e.shadow.mapSize.width=2048,e.shadow.mapSize.height=2048,e.shadow.camera.near=.5,e.shadow.camera.far=500,this.scene.add(e);const n=new rg(8900331,4021340,.4);this.scene.add(n)}setupSkybox(){const t=document.createElement("canvas");t.width=2,t.height=512;const e=t.getContext("2d"),n=e.createLinearGradient(0,0,0,512);n.addColorStop(0,"#1e3c72"),n.addColorStop(.3,"#2a5298"),n.addColorStop(.6,"#87CEEB"),n.addColorStop(1,"#ffffff"),e.fillStyle=n,e.fillRect(0,0,2,512);const i=new ns(t);this.scene.background=i}setupGround(){const t=new Ae(2e3,2e3),e=new It({color:4021340,roughness:1,metalness:0}),n=new ot(t,e);n.rotation.x=-Math.PI/2,n.position.y=-50,n.receiveShadow=!0,this.scene.add(n)}setupResizeHandler(){window.addEventListener("resize",()=>{this.camera.aspect=window.innerWidth/window.innerHeight,this.camera.updateProjectionMatrix(),this.renderer.setSize(window.innerWidth,window.innerHeight)})}render(){this.renderer.render(this.scene,this.camera)}dispose(){this.renderer.dispose(),this.scene.traverse(t=>{t instanceof ot&&(t.geometry.dispose(),Array.isArray(t.material)?t.material.forEach(e=>e.dispose()):t.material.dispose())})}}class dg{constructor(){b(this,"keys",new Set);b(this,"joystickActive",!1);b(this,"joystickX",0);b(this,"joystickY",0);b(this,"joystickTouchId",null);b(this,"firePressed",!1);b(this,"throttlePressed",!1);b(this,"missilePressed",!1);b(this,"isMobile");this.isMobile=an.isMobile,this.setupListeners()}setupListeners(){window.addEventListener("keydown",t=>{this.keys.add(t.code)}),window.addEventListener("keyup",t=>{this.keys.delete(t.code)}),this.isMobile&&this.setupTouchControls()}setupTouchControls(){const t=document.getElementById("joystick"),e=document.getElementById("joystick-knob"),n=document.getElementById("fire-button"),i=document.getElementById("throttle-button"),r=document.getElementById("missile-button");if(!t||!e){console.warn("Joystick elements not found");return}t.addEventListener("touchstart",l=>{if(l.preventDefault(),l.stopPropagation(),l.changedTouches.length===0)return;const c=l.changedTouches[0],h=t.getBoundingClientRect();c.clientX>=h.left&&c.clientX<=h.right&&c.clientY>=h.top&&c.clientY<=h.bottom&&(this.joystickTouchId=c.identifier,this.joystickActive=!0)},{passive:!1});const a=l=>{if(!this.joystickActive||this.joystickTouchId===null)return;l.preventDefault();const c=Array.from(l.touches).find(M=>M.identifier===this.joystickTouchId);if(!c)return;const h=t.getBoundingClientRect();if(!(c.clientX>=h.left&&c.clientX<=h.right&&c.clientY>=h.top&&c.clientY<=h.bottom)){this.joystickActive=!1,this.joystickX=0,this.joystickY=0,this.joystickTouchId=null,e.style.transform="translate(-50%, -50%) translate(0px, 0px)";return}const d=h.left+h.width/2,p=h.top+h.height/2,g=h.width/2;let _=c.clientX-d,m=c.clientY-p;const f=Math.sqrt(_*_+m*m);f>g&&(_=_/f*g,m=m/f*g),e.style.transform=`translate(-50%, -50%) translate(${_}px, ${m}px)`,this.joystickX=_/g,this.joystickY=m/g};document.addEventListener("touchmove",a,{passive:!1});const o=l=>{if(this.joystickTouchId===null)return;Array.from(l.changedTouches).some(h=>h.identifier===this.joystickTouchId)&&(this.joystickActive=!1,this.joystickX=0,this.joystickY=0,this.joystickTouchId=null,e.style.transform="translate(-50%, -50%) translate(0px, 0px)")};document.addEventListener("touchend",o),document.addEventListener("touchcancel",o),n&&(n.addEventListener("touchstart",l=>{l.preventDefault(),this.firePressed=!0},{passive:!1}),n.addEventListener("touchend",()=>{this.firePressed=!1})),i&&(i.addEventListener("touchstart",l=>{l.preventDefault(),this.throttlePressed=!0},{passive:!1}),i.addEventListener("touchend",()=>{this.throttlePressed=!1})),r&&(r.addEventListener("touchstart",l=>{l.preventDefault(),this.missilePressed=!0},{passive:!1}),r.addEventListener("touchend",()=>{this.missilePressed=!1})),document.addEventListener("touchmove",l=>{l.target instanceof Element&&l.target.closest(".mobile-controls")&&l.preventDefault()},{passive:!1})}getState(){return this.isMobile?this.getMobileState():this.getDesktopState()}getMobileState(){return{pitchUp:this.joystickY<-.3,pitchDown:this.joystickY>.3,yawLeft:this.joystickX<-.3,yawRight:this.joystickX>.3,rollLeft:!1,rollRight:!1,fire:this.firePressed,missile:this.missilePressed,throttle:this.throttlePressed}}getDesktopState(){return{pitchUp:this.keys.has("KeyW")||this.keys.has("ArrowUp"),pitchDown:this.keys.has("KeyS")||this.keys.has("ArrowDown"),yawLeft:this.keys.has("KeyA"),yawRight:this.keys.has("KeyD"),rollLeft:this.keys.has("KeyQ"),rollRight:this.keys.has("KeyE"),fire:this.keys.has("Space"),missile:this.keys.has("KeyM")||this.keys.has("ShiftRight"),throttle:this.keys.has("ShiftLeft")||this.keys.has("ControlLeft")}}}class fg{constructor(t,e){b(this,"aircraft");b(this,"currentSpeed");b(this,"forward");b(this,"autoLevelSpeed",2);b(this,"flameSprite");b(this,"normalFlameSize",3);b(this,"boostFlameSize",5);b(this,"currentFlameSize",3);b(this,"normalFlameColor",new Tt(16746564));b(this,"boostFlameColor",new Tt(16755200));b(this,"flameColor",new Tt);this.aircraft=t,this.currentSpeed=te.PLAYER.BASE_SPEED,this.forward=new R;const n=this.createFlameTexture(),i=new Ji({map:n,color:16746564,transparent:!0,opacity:.8,blending:Yi,depthWrite:!1});this.flameSprite=new Bl(i),this.flameSprite.scale.set(this.normalFlameSize,this.normalFlameSize,1),this.flameSprite.position.set(0,-.2,2.8),this.aircraft.add(this.flameSprite)}createFlameTexture(){const e=document.createElement("canvas");e.width=128,e.height=128;const n=e.getContext("2d");if(!n)throw new Error("Failed to get 2D context for flame texture");const i=128/2,r=128/2,a=128/2,o=n.createRadialGradient(i,r,0,i,r,a);o.addColorStop(0,"rgba(255, 255, 255, 1)"),o.addColorStop(.15,"rgba(255, 200, 100, 0.9)"),o.addColorStop(.4,"rgba(255, 120, 0, 0.6)"),o.addColorStop(.7,"rgba(200, 50, 0, 0.3)"),o.addColorStop(1,"rgba(100, 0, 0, 0)"),n.fillStyle=o,n.fillRect(0,0,128,128);const l=new ns(e);return l.needsUpdate=!0,l}update(t,e){const n=e.pitchUp||e.pitchDown||e.yawLeft||e.yawRight||e.rollLeft||e.rollRight;if(e.throttle?this.currentSpeed=Math.min(te.PLAYER.MAX_SPEED,this.currentSpeed+20*t):this.currentSpeed=Math.max(te.PLAYER.BASE_SPEED*.5,this.currentSpeed-10*t),e.pitchUp&&this.aircraft.rotateX(te.PLAYER.PITCH_SPEED*t),e.pitchDown&&this.aircraft.rotateX(-2*t),e.yawLeft&&this.aircraft.rotateY(te.PLAYER.YAW_SPEED*t),e.yawRight&&this.aircraft.rotateY(-1.5*t),e.rollLeft&&this.aircraft.rotateZ(te.PLAYER.ROLL_SPEED*t),e.rollRight&&this.aircraft.rotateZ(-3*t),!n){const a=new R(1,0,0);a.applyQuaternion(this.aircraft.quaternion);const o=a.y;if(Math.abs(o)>.01){const l=this.autoLevelSpeed*t,c=Math.sign(o)*-Math.min(l,Math.abs(o));this.aircraft.rotateZ(c)}}this.forward.set(0,0,-1),this.forward.applyQuaternion(this.aircraft.quaternion),this.aircraft.position.addScaledVector(this.forward,this.currentSpeed*t);const i=e.throttle?this.boostFlameSize:this.normalFlameSize,r=e.throttle?this.boostFlameColor:this.normalFlameColor;this.currentFlameSize+=(i-this.currentFlameSize)*8*t,this.flameColor.lerp(r,5*t),this.flameSprite.scale.set(this.currentFlameSize,this.currentFlameSize,1),this.flameSprite.material instanceof Ji&&this.flameSprite.material.color.copy(this.flameColor)}getPosition(){return this.aircraft.position.clone()}getQuaternion(){return this.aircraft.quaternion.clone()}getSpeed(){return this.currentSpeed}getAircraft(){return this.aircraft}dispose(){this.flameSprite&&(this.aircraft.remove(this.flameSprite),this.flameSprite.material instanceof vn&&this.flameSprite.material.dispose())}}class pg{constructor(t,e,n){b(this,"camera");b(this,"target");b(this,"offset");b(this,"currentPosition");b(this,"smoothFactor");this.camera=t,this.target=e,this.offset=n||new R(te.CAMERA.OFFSET.x,te.CAMERA.OFFSET.y,te.CAMERA.OFFSET.z),this.currentPosition=new R,this.smoothFactor=te.CAMERA.SMOOTH_FACTOR}update(){const t=this.offset.clone();t.applyQuaternion(this.target.quaternion),t.add(this.target.position),this.currentPosition.lerp(t,this.smoothFactor),this.camera.position.copy(this.currentPosition),this.camera.lookAt(this.target.position)}setSmoothFactor(t){this.smoothFactor=Math.max(0,Math.min(1,t))}}class Qo{constructor(t){b(this,"pool",[]);b(this,"maxDistance");b(this,"scene");this.scene=t,this.maxDistance=te.PROJECTILE.MAX_DISTANCE;const e=an.getProjectilePoolSize(),n=new xe(.3,8,8),i=new _e({color:16776960,transparent:!0,opacity:.9});for(let r=0;r<e;r++){const a=new ot(n,i.clone());a.visible=!1,this.scene.add(a),this.pool.push({mesh:a,direction:new R,speed:te.PROJECTILE.SPEED,active:!1,startPosition:new R})}}fire(t,e){const n=this.pool.find(i=>!i.active);n&&(n.mesh.position.copy(t),n.direction.copy(e).normalize(),n.startPosition.copy(t),n.mesh.visible=!0,n.active=!0)}update(t){for(const e of this.pool){if(!e.active)continue;e.mesh.position.addScaledVector(e.direction,e.speed*t),e.mesh.position.distanceTo(e.startPosition)>this.maxDistance&&this.deactivate(e)}}checkCollisions(t,e){for(const n of this.pool)if(n.active)for(const i of t){if(!i.visible)continue;if(n.mesh.position.distanceTo(i.position)<5){e(i,n.mesh),this.deactivate(n);break}}}deactivate(t){t.mesh.visible=!1,t.active=!1}getActiveProjectiles(){return this.pool.filter(t=>t.active).map(t=>t.mesh)}}class Yl{constructor(t=100){b(this,"maxHealth");b(this,"currentHealth");b(this,"isDead",!1);b(this,"onDamage");b(this,"onDeath");this.maxHealth=t,this.currentHealth=t}takeDamage(t){this.isDead||(this.currentHealth=Math.max(0,this.currentHealth-t),this.onDamage&&this.onDamage(t,this.currentHealth),this.currentHealth<=0&&(this.isDead=!0,this.onDeath&&this.onDeath()))}heal(t){this.isDead||(this.currentHealth=Math.min(this.maxHealth,this.currentHealth+t))}getHealthPercent(){return this.currentHealth/this.maxHealth}getCurrentHealth(){return this.currentHealth}getMaxHealth(){return this.maxHealth}isEntityDead(){return this.isDead}reset(){this.currentHealth=this.maxHealth,this.isDead=!1}}class $l{constructor(t){b(this,"scene");b(this,"particles",[]);b(this,"particleMeshes");b(this,"maxParticles");b(this,"geometries",new Map);b(this,"materials",new Map);this.scene=t,this.particleMeshes=new he,this.particleMeshes.name="particles",this.scene.add(this.particleMeshes),this.maxParticles=an.isMobile?200:500,this.initAssets()}initAssets(){this.geometries.set("EXPLOSION",new xe(.5,8,8)),this.materials.set("EXPLOSION",new _e({color:16737792,transparent:!0,opacity:1})),this.geometries.set("SMOKE",new xe(1,8,8)),this.materials.set("SMOKE",new _e({color:8947848,transparent:!0,opacity:.6})),this.geometries.set("SPARK",new xe(.1,4,4)),this.materials.set("SPARK",new _e({color:16776960,transparent:!0,opacity:1})),this.geometries.set("FIRE",new xe(.3,8,8)),this.materials.set("FIRE",new _e({color:16729088,transparent:!0,opacity:.9})),this.geometries.set("DEBRIS",new $e(.3,.3,.3)),this.materials.set("DEBRIS",new _e({color:6710886}))}createExplosion(t,e=1){const n=Math.floor(30*e);for(let i=0;i<n*.4;i++)this.spawnParticle("FIRE",t.clone(),{speed:20*e,life:.3+Math.random()*.3,size:.5+Math.random()*1.5,color:new Tt().setHSL(.05+Math.random()*.1,1,.5)});for(let i=0;i<n*.3;i++)this.spawnParticle("EXPLOSION",t.clone(),{speed:30*e,life:.2+Math.random()*.4,size:.3+Math.random()*1,color:new Tt().setHSL(.08,1,.6)});for(let i=0;i<n*.2;i++)this.spawnParticle("SPARK",t.clone(),{speed:50*e,life:.5+Math.random()*.5,size:.1+Math.random()*.2,color:new Tt(16776960)});for(let i=0;i<n*.1;i++)this.spawnParticle("DEBRIS",t.clone(),{speed:15*e,life:1+Math.random()*1,size:.2+Math.random()*.3,color:new Tt(6710886),gravity:!0});setTimeout(()=>{for(let i=0;i<n*.3;i++)this.spawnParticle("SMOKE",t.clone(),{speed:5*e,life:2+Math.random()*2,size:2+Math.random()*3,color:new Tt().setHSL(0,0,.3+Math.random()*.3)})},100)}createHit(t){for(let e=0;e<10;e++)this.spawnParticle("SPARK",t.clone(),{speed:20,life:.2+Math.random()*.3,size:.1+Math.random()*.2,color:new Tt(16755200)})}createTrail(t,e){this.spawnParticle("SMOKE",t.clone(),{speed:2,life:.3,size:.3,color:e.clone()})}spawnParticle(t,e,n){if(this.particles.length>=this.maxParticles){const u=this.particles.shift();u!=null&&u.mesh&&this.particleMeshes.remove(u.mesh)}const r=new R((Math.random()-.5)*2,(Math.random()-.5)*2,(Math.random()-.5)*2).normalize().multiplyScalar(n.speed),a=this.geometries.get(t),o=this.materials.get(t);if(!a||!o)return;const l=o.clone();l.color=n.color;const c=new ot(a,l);c.position.copy(e),c.scale.setScalar(n.size),this.particleMeshes.add(c);const h={position:e.clone(),velocity:r,life:n.life,maxLife:n.life,size:n.size,color:n.color,type:t,mesh:c,active:!0};this.particles.push(h)}update(t){const e=new R(0,-9.8,0);for(let n=this.particles.length-1;n>=0;n--){const i=this.particles[n];if(i.active){if(i.life-=t,i.life<=0){i.mesh&&(this.particleMeshes.remove(i.mesh),i.mesh.geometry.dispose(),i.mesh.material.dispose()),this.particles.splice(n,1);continue}if(i.velocity.add(e.clone().multiplyScalar(t*.3)),i.position.add(i.velocity.clone().multiplyScalar(t)),i.mesh){i.mesh.position.copy(i.position);const r=i.life/i.maxLife,a=i.mesh.material;if(a.opacity=r,i.type==="SMOKE"){const o=i.size*(1+(1-r)*2);i.mesh.scale.setScalar(o)}i.type==="DEBRIS"&&(i.mesh.rotation.x+=t*5,i.mesh.rotation.y+=t*3)}}}}clear(){for(const t of this.particles)t.mesh&&(this.particleMeshes.remove(t.mesh),t.mesh.geometry.dispose(),t.mesh.material.dispose());this.particles=[]}getActiveCount(){return this.particles.length}}class mg{constructor(t,e,n,i,r=[]){b(this,"mesh");b(this,"velocity");b(this,"target");b(this,"active",!0);b(this,"lifetime",0);b(this,"maxLifetime",10);b(this,"turnSpeed",te.MISSILE.TURN_SPEED);b(this,"speed",80);b(this,"trail",null);b(this,"particleSystem");b(this,"startPosition");b(this,"maxFlightDistance",te.MISSILE.MAX_FLIGHT_DISTANCE);b(this,"enemies",[]);b(this,"hasRetargeted",!1);this.particleSystem=i,this.target=n,this.enemies=r,this.startPosition=e.clone(),this.mesh=new he;const a=new ye(.4,2.5,16),o=new It({color:16729156,emissive:16711680,emissiveIntensity:.5,metalness:.8,roughness:.2}),l=new ot(a,o);l.rotation.x=-Math.PI/2,this.mesh.add(l);const c=new ye(.25,2,16),h=new _e({color:16768256,transparent:!0,opacity:1});if(this.trail=new ot(c,h),this.trail.rotation.x=-Math.PI/2,this.trail.position.z=1.5,this.mesh.add(this.trail),this.mesh.position.copy(e),t.add(this.mesh),this.velocity=new R,this.active=!0,this.target){const u=new R().subVectors(this.target.position,e).normalize();this.velocity.copy(u).multiplyScalar(this.speed)}else this.velocity.set(0,0,-this.speed);if(this.velocity.length()>0){const u=this.mesh.position.clone().add(this.velocity);this.mesh.lookAt(u)}}update(t){if(this.lifetime+=t,this.mesh.position.distanceTo(this.startPosition)>this.maxFlightDistance){this.active=!1;return}if(this.lifetime>this.maxLifetime){if(this.target&&this.target.parent){const n=new Tt(16737792);this.particleSystem.createTrail(this.mesh.position.clone(),n)}this.active=!1;return}if((!this.target||this.target&&!this.target.parent)&&!this.hasRetargeted){const n=this.findNearestEnemy();n&&(this.target=n,this.hasRetargeted=!0,console.log("导弹重新锁定目标"))}if(this.target&&this.target.parent&&this.huntTarget(t),this.mesh.position.add(this.velocity.clone().multiplyScalar(t)),this.velocity.length()>0){const n=this.mesh.position.clone().add(this.velocity),i=new ae;i.position.copy(this.mesh.position),i.lookAt(n),this.mesh.quaternion.slerp(i.quaternion,.3)}if(this.active){const n=this.mesh.position.clone(),i=this.velocity.clone().normalize().multiplyScalar(-1.5);n.add(i);const r=new Tt().setHSL(.08+Math.random()*.03,1,.6);this.particleSystem.createTrail(n,r)}}huntTarget(t){if(!this.target)return;const e=new R().subVectors(this.target.position,this.mesh.position).normalize(),n=this.velocity.clone().normalize(),i=this.turnSpeed*t,r=Math.atan2(e.x,e.z),a=Math.atan2(n.x,n.z);let o=r-a;for(;o>Math.PI;)o-=Math.PI*2;for(;o<-Math.PI;)o+=Math.PI*2;o=Math.max(-i,Math.min(i,o));const l=a+o;this.velocity.set(Math.sin(l)*this.speed,e.y*this.speed,Math.cos(l)*this.speed)}findNearestEnemy(){let t=null,e=1/0;for(const n of this.enemies){if(!n.parent)continue;const i=this.mesh.position.distanceTo(n.position);i<e&&(e=i,t=n)}return t}setTarget(t){this.target=t}updateEnemies(t){this.enemies=t}dispose(t){t.remove(this.mesh),this.active=!1}}class gg{constructor(t,e){b(this,"scene");b(this,"particleSystem");b(this,"missiles",[]);b(this,"enemies",[]);this.scene=t,this.particleSystem=e||new $l(t)}updateEnemies(t){this.enemies=t;for(const e of this.missiles)e.updateEnemies(t)}fire(t,e,n){const i=new mg(this.scene,t,n||null,this.particleSystem,this.enemies);this.missiles.push(i)}update(t){for(const e of this.missiles)e.active&&e.update(t);this.missiles=this.missiles.filter(e=>e.active?!0:(e.dispose(this.scene),!1))}checkCollisions(t,e){for(const n of this.missiles)if(n.active)for(const i of t){if(!i.parent)continue;if(n.mesh.position.distanceTo(i.position)<2){n.active=!1,e(i);break}}}getActiveCount(){return this.missiles.filter(t=>t.active).length}dispose(){for(const t of this.missiles)t.dispose(this.scene);this.missiles=[]}}class _g{constructor(){b(this,"container");b(this,"healthBarContainer");b(this,"healthBarFill");b(this,"healthText");b(this,"scoreDisplay");b(this,"speedDisplay");b(this,"enemiesDisplay");b(this,"remainingEnemiesDisplay");b(this,"livesDisplay");b(this,"missilesDisplay");b(this,"powerUpDisplay");b(this,"gameOverDisplay");b(this,"powerUpTimer",0);b(this,"activePowerUpDuration",0);this.container=document.createElement("div"),this.container.id="hud";const t=an.isMobile,e=t?"10px":"20px",n=t?"16px":"20px";this.container.style.cssText=`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      padding: ${e};
      pointer-events: none;
      font-family: 'Arial', sans-serif;
      color: white;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      z-index: 50;
    `,this.healthBarContainer=this.createHealthBar(t),this.healthText=this.createHealthText(t),this.scoreDisplay=document.createElement("div"),this.scoreDisplay.style.cssText=`
      font-size: ${n};
      position: absolute;
      top: ${e};
      right: ${e};
    `,this.scoreDisplay.textContent="分数: 0",this.remainingEnemiesDisplay=document.createElement("div"),this.remainingEnemiesDisplay.style.cssText=`
      font-size: ${t?"14px":"18px"};
      position: absolute;
      top: ${t?"32px":"45px"};
      right: ${e};
      color: #ff4444;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
    `,this.remainingEnemiesDisplay.textContent="剩余: 0",this.container.appendChild(this.remainingEnemiesDisplay),this.speedDisplay=document.createElement("div"),this.speedDisplay.style.cssText=`
      font-size: ${t?"14px":"18px"};
      position: absolute;
      bottom: ${t?"40%":"20px"};
      left: ${e};
    `,this.speedDisplay.textContent="速度: 0 km/h",this.enemiesDisplay=document.createElement("div"),this.enemiesDisplay.style.cssText=`
      font-size: ${t?"14px":"18px"};
      position: absolute;
      top: ${t?"54px":"70px"};
      right: ${e};
    `,this.enemiesDisplay.textContent="敌人: 0",this.livesDisplay=document.createElement("div"),this.livesDisplay.style.cssText=`
      font-size: ${t?"14px":"18px"};
      position: absolute;
      top: ${t?"76px":"95px"};
      right: ${e};
    `,this.livesDisplay.textContent="生命: ❤️❤️❤️",this.missilesDisplay=document.createElement("div"),this.missilesDisplay.style.cssText=`
      font-size: ${t?"14px":"18px"};
      position: absolute;
      top: ${t?"98px":"120px"};
      right: ${e};
      color: #ff6600;
    `,this.missilesDisplay.textContent="导弹: 🚀🚀",this.powerUpDisplay=document.createElement("div"),this.powerUpDisplay.style.cssText=`
      font-size: ${t?"14px":"18px"};
      position: absolute;
      top: ${t?"120px":"145px"};
      right: ${e};
      color: #ffff00;
      text-shadow: 0 0 4px rgba(255, 255, 0, 0.5);
      font-weight: bold;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    `,this.powerUpDisplay.textContent="",this.gameOverDisplay=document.createElement("div"),this.gameOverDisplay.style.cssText=`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: rgba(0, 0, 0, 0.8);
      z-index: 100;
      opacity: 0;
      transition: opacity 0.5s;
      pointer-events: none;
    `,this.gameOverDisplay.innerHTML=`
      <div style="
        text-align: center;
        color: #ff3333;
        font-size: ${t?"48px":"72px"};
        font-weight: bold;
        text-shadow: 0 0 20px rgba(255, 0, 0, 0.8), 4px 4px 8px rgba(0, 0, 0, 1);
        margin-bottom: 30px;
        animation: pulse 1s ease-in-out infinite;
      ">GAME OVER</div>
      <div id="final-score" style="
        color: #ffdd00;
        font-size: ${t?"24px":"36px"};
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 1);
      "></div>
    `,this.container.appendChild(this.healthBarContainer),this.container.appendChild(this.healthText),this.container.appendChild(this.scoreDisplay),this.container.appendChild(this.speedDisplay),this.container.appendChild(this.enemiesDisplay),this.container.appendChild(this.livesDisplay),this.container.appendChild(this.missilesDisplay),this.container.appendChild(this.powerUpDisplay),document.body.appendChild(this.container),document.body.appendChild(this.gameOverDisplay)}createHealthText(t){const e=document.createElement("span");return e.className="health-text",e.style.cssText=`
      font-size: ${t?"18px":"24px"};
      font-weight: bold;
      color: white;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      pointer-events: none;
    `,e.textContent="100",e}createHealthBar(t){const e=document.createElement("div"),n=t?"180px":"250px",i=t?"20px":"25px";return e.style.cssText=`
      position: absolute;
      top: ${t?"10px":"15px"};
      left: 50%;
      transform: translateX(-50%);
      width: ${n};
      height: ${i};
      background: rgba(0, 0, 0, 0.6);
      border-radius: ${t?"10px":"12px"};
      overflow: hidden;
      border: 2px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    `,this.healthBarFill=document.createElement("div"),this.healthBarFill.style.cssText=`
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, #00ff66, #00ff33, #00cc00);
      transition: width 0.3s, background 0.3s;
    `,e.appendChild(this.healthBarFill),e}updateHealth(t){this.healthBarFill.style.width=`${t*100}%`,this.healthText.textContent=`${Math.ceil(t*100)}`;let e,n="#ffffff";t>.6?e="linear-gradient(90deg, #00ff66, #00ff33, #00cc00)":t>.3?(e="linear-gradient(90deg, #ffcc00, #ffdd00, #88aa00)",n="#ffdd00"):t>.15?(e="linear-gradient(90deg, #ff9900, #ffcc00, #ffaa00)",n="#ffaa00"):(e="linear-gradient(90deg, #ff3300, #cc0000, #ff0000)",n="#ff0000"),this.healthBarFill.style.background=e,this.healthText.style.color=n}updateScore(t){this.scoreDisplay.textContent=`分数: ${t}`}updateSpeed(t){const e=Math.round(t*10);this.speedDisplay.textContent=`速度: ${e} km/h`}updateEnemies(t){this.enemiesDisplay.textContent=`敌人: ${t}`}updateRemainingEnemies(t){this.remainingEnemiesDisplay.textContent=`剩余: ${t}`}updateLives(t){const e="❤️".repeat(Math.max(0,t))+"🖤".repeat(Math.max(0,3-t));this.livesDisplay.textContent=`生命: ${e}`}updateMissiles(t){const n="🚀".repeat(Math.max(0,t))+"⬜".repeat(Math.max(0,10-t));this.missilesDisplay.textContent=`导弹: ${n}`}showPowerUp(t,e,n=0){this.activePowerUpDuration=n,this.powerUpDisplay.textContent=`${e} ${t}`,this.powerUpDisplay.style.opacity="1",n>0&&(this.powerUpTimer=n)}update(t){this.activePowerUpDuration>0&&this.powerUpTimer>0&&(this.powerUpTimer-=t,this.powerUpTimer<=0&&this.hidePowerUp())}hidePowerUp(){this.powerUpDisplay.style.opacity="0",this.activePowerUpDuration=0,this.powerUpTimer=0}hide(){this.container.style.display="none"}show(){this.container.style.display="block"}showGameOver(t){const e=this.gameOverDisplay.querySelector("#final-score");e&&(e.textContent=`最终得分: ${t}`),this.gameOverDisplay.style.opacity="1",this.gameOverDisplay.style.pointerEvents="auto"}hideGameOver(){this.gameOverDisplay.style.opacity="0",this.gameOverDisplay.style.pointerEvents="none"}}class vg{constructor(){b(this,"container");b(this,"settingsContainer");b(this,"onStart");b(this,"settings",{difficulty:1,soundVolume:.7,playerLives:3});this.container=this.createContainer(),this.settingsContainer=this.createSettingsPanel(),this.container.appendChild(this.settingsContainer),document.body.appendChild(this.container)}createContainer(){const t=document.createElement("div");return t.id="start-menu",t.innerHTML=`
      <style>
        #start-menu {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          font-family: 'Arial', sans-serif;
          color: white;
        }

        .menu-title {
          font-size: 72px;
          font-weight: bold;
          margin-bottom: 10px;
          text-shadow: 0 0 20px rgba(100, 200, 255, 0.8),
                       0 0 40px rgba(100, 200, 255, 0.5);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        .menu-subtitle {
          font-size: 24px;
          opacity: 0.8;
          margin-bottom: 40px;
        }

        .settings-panel {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 15px;
          padding: 30px 40px;
          margin-bottom: 30px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          min-width: 400px;
        }

        .setting-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 15px 0;
        }

        .setting-label {
          font-size: 18px;
        }

        .setting-control {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .setting-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .setting-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }

        .setting-value {
          font-size: 20px;
          font-weight: bold;
          min-width: 60px;
          text-align: center;
        }

        .start-btn {
          padding: 20px 60px;
          font-size: 28px;
          font-weight: bold;
          border: none;
          border-radius: 50px;
          background: linear-gradient(135deg, #4CAF50, #45a049);
          color: white;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 5px 20px rgba(76, 175, 80, 0.4);
          margin-bottom: 30px;
        }

        .start-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 30px rgba(76, 175, 80, 0.6);
        }

        .controls-info {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
          padding: 20px 30px;
          text-align: left;
        }

        .controls-title {
          font-size: 20px;
          margin-bottom: 15px;
          text-align: center;
        }

        .control-row {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
          font-size: 16px;
        }

        .key {
          background: rgba(255, 255, 255, 0.2);
          padding: 3px 10px;
          border-radius: 5px;
          font-family: monospace;
        }

        .mobile-controls-info {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
        }
      </style>

      <div class="menu-title">✈️ Air Supreme</div>
      <div class="menu-subtitle">3D 空战游戏</div>
    `,t}createSettingsPanel(){const t=document.createElement("div");t.className="settings-panel";const e=this.createSettingRow("难度",this.getDifficultyText(this.settings.difficulty),()=>{this.settings.difficulty=Math.max(1,this.settings.difficulty-1),this.updateDisplay()},()=>{this.settings.difficulty=Math.min(5,this.settings.difficulty+1),this.updateDisplay()});e.id="difficulty-row";const n=this.createSettingRow("音效音量",`${Math.round(this.settings.soundVolume*100)}%`,()=>{this.settings.soundVolume=Math.max(0,this.settings.soundVolume-.1),this.updateDisplay()},()=>{this.settings.soundVolume=Math.min(1,this.settings.soundVolume+.1),this.updateDisplay()});n.id="sound-row";const i=this.createSettingRow("生命数",`${this.settings.playerLives}`,()=>{this.settings.playerLives=Math.max(1,this.settings.playerLives-1),this.updateDisplay()},()=>{this.settings.playerLives=Math.min(9,this.settings.playerLives+1),this.updateDisplay()});i.id="lives-row",t.appendChild(e),t.appendChild(n),t.appendChild(i);const r=document.createElement("button");r.className="start-btn",r.textContent="🎮 开始游戏",r.onclick=()=>this.startGame(),t.appendChild(r);const a=document.createElement("div");return a.className="controls-info",a.innerHTML=`
      <div class="controls-title">📖 控制说明</div>
      <div class="control-row">
        <span><span class="key">W</span> / <span class="key">S</span></span>
        <span>俯仰（机头上下）</span>
      </div>
      <div class="control-row">
        <span><span class="key">A</span> / <span class="key">D</span></span>
        <span>偏航（机头左右）</span>
      </div>
      <div class="control-row">
        <span><span class="key">Q</span> / <span class="key">E</span></span>
        <span>翻滚（机翼倾斜）</span>
      </div>
      <div class="control-row">
        <span><span class="key">空格</span></span>
        <span>开火</span>
      </div>
      <div class="control-row">
        <span><span class="key">Shift</span></span>
        <span>加速</span>
      </div>
      <div class="mobile-controls-info">
        📱 移动端：使用虚拟摇杆和按钮控制
      </div>
    `,t.appendChild(a),t}createSettingRow(t,e,n,i){const r=document.createElement("div");r.className="setting-row";const a=document.createElement("span");a.className="setting-label",a.textContent=t;const o=document.createElement("div");o.className="setting-control";const l=document.createElement("button");l.className="setting-btn",l.textContent="-",l.onclick=n;const c=document.createElement("span");c.className="setting-value",c.textContent=e,c.id=`${t.toLowerCase()}-value`;const h=document.createElement("button");return h.className="setting-btn",h.textContent="+",h.onclick=i,o.appendChild(l),o.appendChild(c),o.appendChild(h),r.appendChild(a),r.appendChild(o),r}getDifficultyText(t){return["简单","普通","困难","专家","地狱"][t-1]}updateDisplay(){const t=document.getElementById("难度-value")||document.querySelector("#difficulty-row .setting-value"),e=document.getElementById("音效音量-value")||document.querySelector("#sound-row .setting-value"),n=document.getElementById("生命数-value")||document.querySelector("#lives-row .setting-value");t&&(t.textContent=this.getDifficultyText(this.settings.difficulty)),e&&(e.textContent=`${Math.round(this.settings.soundVolume*100)}%`),n&&(n.textContent=`${this.settings.playerLives}`)}startGame(){var t;this.container.style.display="none",(t=this.onStart)==null||t.call(this,this.settings)}setOnStart(t){this.onStart=t}show(){this.container.style.display="flex"}hide(){this.container.style.display="none"}}class xg{constructor(){b(this,"container");b(this,"healthBars",new Map);this.container=document.createElement("div"),this.container.id="enemy-health-bars",this.container.style.cssText=`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 35;
    `,document.body.appendChild(this.container)}update(t,e,n){const i=new Set(t.map(r=>r.mesh.uuid));for(const[r]of this.healthBars)i.has(r)||this.removeHealthBar(r);for(const r of t)this.updateOrCreateHealthBar(r,e,n)}updateOrCreateHealthBar(t,e,n){const i=t.mesh.uuid;let r=this.healthBars.get(i);const a=this.worldToScreen(t.mesh.position.clone(),e);r&&(r.screenPos={x:a.x,y:a.y});const o=a.x>=0&&a.x<=1&&a.y>=0&&a.y<=1&&a.z<1;if(!r){const h=this.createHealthBar(),u=this.createBackgroundBar(60),d=this.createTargetName(),p=this.createArrowIndicator();h.appendChild(u),h.appendChild(d),this.container.appendChild(h),this.container.appendChild(p),r={bar:h,background:u,targetName:d,arrow:p,screenPos:null},this.healthBars.set(i,r)}const l=t.currentHealth/t.maxHealth,c=this.getHealthColor(l);if(o){r.bar.style.display="block",r.arrow&&(r.arrow.style.display="none");const{x:d,y:p}=this.calculateBarPosition(t.mesh,e,60,6);r.bar.style.left=`${d}px`,r.bar.style.top=`${p}px`,r.background.style.background=c,r.background.style.width=`${60*l}px`;const g=this.getEnemyName(t.mesh);r.targetName.textContent=g;const m=(60-r.targetName.offsetWidth)/2;r.targetName.style.left=`${m}px`}else if(r.bar.style.display="none",r.arrow){r.arrow.style.display="block";const h=n.distanceTo(t.mesh.position);this.updateArrowIndicator(r.arrow,a,h)}}createHealthBar(){const t=document.createElement("div");return t.className="enemy-health-bar",t.style.cssText=`
      position: absolute;
      display: none;
      pointer-events: none;
    `,t}createBackgroundBar(t){const e=document.createElement("div");return e.className="health-bar-background",e.style.cssText=`
      width: ${t}px;
      height: 6px;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 3px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      position: absolute;
      bottom: 0;
      left: 0;
      transition: width 0.2s, background 0.2s;
      box-shadow: 0 0 8px rgba(0, 0, 0, 0.8), inset 0 0 4px rgba(0, 0, 0, 0.5);
    `,e}createTargetName(){const t=document.createElement("span");return t.className="enemy-name",t.style.cssText=`
      font-size: 12px;
      font-weight: bold;
      white-space: nowrap;
      position: absolute;
      bottom: 100%; /* 在血条上方 */
      left: 0; /* 将由 JavaScript 动态计算居中 */
      margin-bottom: 4px; /* 距离血条4px */
      color: #ffffff; /* 白色字体 */
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9), /* 更强的阴影 */
                   -1px -1px 2px rgba(0, 0, 0, 0.8);
    `,t}createArrowIndicator(){const t=document.createElement("div");t.className="enemy-arrow-indicator",t.style.cssText=`
      position: absolute;
      width: 30px;
      height: 30px;
      display: none;
      pointer-events: none;
      justify-content: center;
      align-items: center;
    `;const e=document.createElement("div");e.style.cssText=`
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 16px solid #ffff00;
      filter: drop-shadow(0 0 6px rgba(255, 255, 0, 0.9));
    `,t.appendChild(e);const n=document.createElement("span");return n.className="arrow-distance-label",n.style.cssText=`
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      color: #ffff00;
      font-size: 11px;
      font-weight: bold;
      text-shadow: 0 0 3px rgba(0, 0, 0, 0.9), 0 0 2px black;
      white-space: nowrap;
      margin-top: 4px;
    `,n.textContent="",t.appendChild(n),t}updateArrowIndicator(t,e,n){const a=e.x-.5,o=e.y-.5;let l=Math.atan2(o,a)*(180/Math.PI);const c=.08;let h,u;a>=0?(h=1-c,u=Math.max(c,Math.min(1-c,.5+o))):(h=c,u=Math.max(c,Math.min(1-c,.5+o))),t.style.left=`${h*100}%`,t.style.top=`${u*100}%`,t.style.transform=`translate(-50%, -50%) rotate(${l+90}deg)`;const d=t.querySelector("div");d&&(d.style.borderBottomColor="#ffff00");const p=t.querySelector(".arrow-distance-label");p&&(p.textContent=`${Math.round(n)}m`,p.style.transform="none")}worldToScreen(t,e){const n=t.clone();return n.project(e),{x:(n.x+1)/2,y:1-(n.y+1)/2,z:n.z}}getHealthColor(t){return t>.6?"linear-gradient(90deg, #00ff66, #00ff33, #00cc00)":t>.3?"linear-gradient(90deg, #ffcc00, #ffdd00, #88aa00)":t>.15?"linear-gradient(90deg, #ff9900, #ffcc00, #ffaa00)":"linear-gradient(90deg, #ff3300, #cc0000, #ff0000)"}getEnemyName(t){const e=t.name||"";return e.includes("Scout")?"SCOUT":e.includes("Fighter")?"FIGHTER":e.includes("Heavy")?"HEAVY":e.includes("Sniper")?"SNIPER":e.includes("Ace")?"ACE":"ENEMY"}calculateBarPosition(t,e,n,i){const r=t.position.clone();r.y+=2;const a=this.worldToScreen(r,e),o=n/2,l=i+15;return{x:a.x*window.innerWidth-o,y:a.y*window.innerHeight-l}}removeHealthBar(t){const e=this.healthBars.get(t);e&&(e.bar.remove(),e.arrow&&e.arrow.remove(),this.healthBars.delete(t))}clear(){for(const t of this.healthBars.values())t.bar.remove();this.healthBars.clear(),this.container.remove()}getFirstEnemyScreenPos(){for(const t of this.healthBars.values())if(t.screenPos&&t.bar.style.display!=="none")return t.screenPos;return null}}class yg{constructor(){b(this,"container");b(this,"radarCanvas");b(this,"ctx");b(this,"size",150);b(this,"range",600);if(this.container=document.createElement("div"),this.container.id="radar-minimap",this.container.style.cssText=`
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: ${this.size}px;
      height: ${this.size}px;
      background: rgba(0, 20, 40, 0.85);
      border: 2px solid rgba(0, 255, 100, 0.6);
      border-radius: 8px;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
      z-index: 50;
      pointer-events: none;
    `,this.radarCanvas=document.createElement("canvas"),this.radarCanvas.width=this.size,this.radarCanvas.height=this.size,this.radarCanvas.style.cssText=`
      width: 100%;
      height: 100%;
      border-radius: 6px;
    `,this.ctx=this.radarCanvas.getContext("2d"),!this.ctx){console.error("Failed to get 2D context");return}this.container.appendChild(this.radarCanvas),document.body.appendChild(this.container)}update(t,e,n,i){this.ctx.clearRect(0,0,this.size,this.size),this.drawBackground(),this.drawPlayer(),this.drawEnemies(t,e,i),this.drawBalloons(t,n,i)}drawBackground(){const t=this.size/2,e=this.size/2;this.ctx.strokeStyle="rgba(0, 255, 100, 0.2)",this.ctx.lineWidth=1;for(let n=1;n<=3;n++)this.ctx.beginPath(),this.ctx.arc(t,e,(this.size/2-10)*(n/3),0,Math.PI*2),this.ctx.stroke();this.ctx.beginPath(),this.ctx.moveTo(t,0),this.ctx.lineTo(t,this.size),this.ctx.moveTo(0,e),this.ctx.lineTo(this.size,e),this.ctx.stroke(),this.ctx.font="bold 12px Arial",this.ctx.fillStyle="rgba(0, 255, 100, 0.5)",this.ctx.textAlign="center",this.ctx.fillText("↑",t,15)}drawPlayer(){const t=this.size/2,e=this.size/2;this.ctx.beginPath(),this.ctx.arc(t,e,5,0,Math.PI*2),this.ctx.fillStyle="rgba(0, 255, 0, 0.8)",this.ctx.fill(),this.ctx.beginPath(),this.ctx.arc(t,e,8,0,Math.PI*2),this.ctx.strokeStyle="rgba(0, 255, 0, 0.3)",this.ctx.lineWidth=2,this.ctx.stroke()}drawEnemies(t,e,n){const i=this.size/2,r=this.size/2,a=this.size/this.range,o=new R(0,0,-1);o.applyQuaternion(n);const l=Math.atan2(o.x,o.z);for(const c of e){const h=c.position.x-t.x,u=c.position.z-t.z,d=h*Math.cos(-l)-u*Math.sin(-l),p=h*Math.sin(-l)+u*Math.cos(-l),g=d*a,_=-p*a;c.isSpawning?(this.ctx.beginPath(),this.ctx.arc(i+g,r+_,4,0,Math.PI*2),this.ctx.fillStyle="rgba(255, 200, 0, 0.9)",this.ctx.fill(),this.ctx.beginPath(),this.ctx.arc(i+g,r+_,6,0,Math.PI*2),this.ctx.strokeStyle="rgba(255, 200, 0, 0.6)",this.ctx.lineWidth=1.5,this.ctx.stroke()):(this.ctx.beginPath(),this.ctx.arc(i+g,r+_,4,0,Math.PI*2),this.ctx.fillStyle="rgba(255, 50, 50, 0.9)",this.ctx.fill(),this.ctx.beginPath(),this.ctx.arc(i+g,r+_,6,0,Math.PI*2),this.ctx.strokeStyle="rgba(255, 0, 0, 0.6)",this.ctx.lineWidth=1.5,this.ctx.stroke())}}drawBalloons(t,e,n){const i=this.size/2,r=this.size/2,a=this.size/this.range,o=new R(0,0,-1);o.applyQuaternion(n);const l=Math.atan2(o.x,o.z);for(const c of e){const h=c.position.x-t.x,u=c.position.z-t.z,d=h*Math.cos(-l)-u*Math.sin(-l),p=h*Math.sin(-l)+u*Math.cos(-l),g=d*a,_=-p*a;this.ctx.beginPath(),this.ctx.arc(i+g,r+_,4,0,Math.PI*2),this.ctx.fillStyle="rgba(0, 255, 255, 0.9)",this.ctx.fill(),this.ctx.beginPath(),this.ctx.arc(i+g,r+_,6,0,Math.PI*2),this.ctx.strokeStyle="rgba(0, 200, 255, 0.6)",this.ctx.lineWidth=1.5,this.ctx.stroke()}}dispose(){this.container.remove()}}class Mg{constructor(){b(this,"container");b(this,"lockCircle");b(this,"lockProgress");b(this,"noMissileLabel");b(this,"isLockingOn",!1);b(this,"currentTarget",null);b(this,"lockProgressValue",0);b(this,"lockTime",.8);b(this,"lockedTarget",null);b(this,"centerX",window.innerWidth/2);b(this,"centerY",window.innerHeight/2);b(this,"lockCircleSize",0);this.container=document.createElement("div"),this.container.id="lock-on-indicator",this.container.style.cssText=`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 40;
      display: none;
    `,this.lockCircle=document.createElement("div"),this.lockCircle.style.cssText=`
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 4px solid rgba(255, 200, 0, 0.8);
      background: rgba(255, 200, 0, 0.1);
    `,this.lockProgress=document.createElement("div"),this.lockProgress.style.cssText=`
      position: absolute;
      border-radius: 50%;
      border: 3px solid rgba(255, 150, 0, 0.9);
      background: rgba(255, 150, 0, 0.2);
      transform: translate(-50%, -50%);
    `,this.noMissileLabel=document.createElement("div"),this.noMissileLabel.style.cssText=`
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #ff6600;
      font-size: 20px;
      font-weight: bold;
      font-family: 'Arial Black', monospace;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
      white-space: nowrap;
    `,this.noMissileLabel.textContent="NO MISSILE",this.container.appendChild(this.noMissileLabel),this.container.appendChild(this.lockProgress),this.container.appendChild(this.lockCircle),document.body.appendChild(this.container),this.updateLockCircleSize(),window.addEventListener("resize",()=>{this.centerX=window.innerWidth/2,this.centerY=window.innerHeight/2,this.updateLockCircleSize()})}updateLockCircleSize(){this.lockCircleSize=Math.min(window.innerWidth,window.innerHeight)*.3,this.lockCircle.style.width=`${this.lockCircleSize}px`,this.lockCircle.style.height=`${this.lockCircleSize}px`}startLockOn(){this.isLockingOn=!0,this.lockProgressValue=0,this.currentTarget=null,this.lockedTarget=null,this.container.style.display="block",this.noMissileLabel.style.display="none",this.lockCircle.style.display="block",this.lockCircle.style.borderColor="rgba(255, 200, 0, 0.8)",this.lockCircle.style.backgroundColor="rgba(255, 200, 0, 0.1)",this.lockProgress.style.display="none"}cancelLockOn(){this.isLockingOn=!1,this.currentTarget=null,this.lockedTarget=null,this.lockProgressValue=0,this.container.style.display="none"}setNoMissiles(t){t?(this.container.style.display="block",this.lockCircle.style.display="none",this.lockProgress.style.display="none",this.noMissileLabel.style.display="block",this.isLockingOn=!1):(this.noMissileLabel.style.display="none",this.isLockingOn&&(this.lockCircle.style.display="block"))}onMissileFired(){this.cancelLockOn()}update(t,e,n,i,r){if(!this.isLockingOn)return!1;const a=this.lockCircleSize/2,o=te.MISSILE.MAX_FLIGHT_DISTANCE/2;if(this.lockedTarget){if(!this.lockedTarget.parent)return this.lockedTarget=null,this.currentTarget=null,this.lockProgressValue=Math.max(0,this.lockProgressValue-i*3),this.updateLockProgress(null),!1;const h=this.worldToScreenPixels(this.lockedTarget.position,n);if(!h)return this.lockedTarget=null,this.currentTarget=null,this.lockProgressValue=Math.max(0,this.lockProgressValue-i*3),this.updateLockProgress(null),!1;if(t.distanceTo(this.lockedTarget.position)>o)return this.lockedTarget=null,this.currentTarget=null,this.lockProgressValue=Math.max(0,this.lockProgressValue-i*3),this.updateLockProgress(null),!1;const d=h.x-this.centerX,p=h.y-this.centerY;if(Math.sqrt(d*d+p*p)>a)return this.lockedTarget=null,this.currentTarget=null,this.lockProgressValue=Math.max(0,this.lockProgressValue-i*3),this.updateLockProgress(null),!1;this.lockProgressValue+=i/this.lockTime;const _={x:h.x/window.innerWidth,y:h.y/window.innerHeight};return this.updateLockProgress(_),this.lockProgressValue>=1?(this.lockProgressValue=1,this.onLockComplete(),!0):!1}let l=null,c=1/0;for(const h of e){const u=t.distanceTo(h.position);if(u>o)continue;const d=this.worldToScreenPixels(h.position,n);if(!d)continue;const p=d.x-this.centerX,g=d.y-this.centerY;Math.sqrt(p*p+g*g)>a||u<c&&(c=u,l=h)}return l?(this.lockedTarget=l,this.currentTarget=l):this.updateLockProgress(null),!1}worldToScreenPixels(t,e){const n=t.clone();return n.project(e),n.z>1?null:{x:(n.x+1)/2*window.innerWidth,y:-(n.y-1)/2*window.innerHeight}}updateLockProgress(t){if(this.lockProgressValue>=1&&t){const e=t.x*window.innerWidth,n=t.y*window.innerHeight;this.lockProgress.style.display="block",this.lockProgress.style.left=`${e}px`,this.lockProgress.style.top=`${n}px`,this.lockProgress.style.width="40px",this.lockProgress.style.height="40px",this.lockProgress.style.border="3px solid #00ff00",this.lockProgress.style.backgroundColor="rgba(0, 255, 0, 0.3)",this.lockProgress.style.boxShadow="0 0 15px #00ff00",this.lockCircle.style.borderColor="#00ff00",this.lockCircle.style.backgroundColor="rgba(0, 255, 0, 0.1)",this.lockCircle.style.boxShadow="0 0 20px #00ff00"}else if(this.lockProgressValue>0&&t){const e=this.lockProgressValue,n=this.lockCircleSize,r=n-(n-40)*e,a=t.x*window.innerWidth,o=t.y*window.innerHeight,l=this.centerX+(a-this.centerX)*e,c=this.centerY+(o-this.centerY)*e;this.lockProgress.style.display="block",this.lockProgress.style.left=`${l}px`,this.lockProgress.style.top=`${c}px`,this.lockProgress.style.width=`${r}px`,this.lockProgress.style.height=`${r}px`,this.lockProgress.style.border="3px solid rgba(255, 150, 0, 0.9)",this.lockProgress.style.backgroundColor="rgba(255, 150, 0, 0.2)",this.lockProgress.style.boxShadow="none",this.lockCircle.style.borderColor="rgba(255, 200, 0, 0.8)",this.lockCircle.style.backgroundColor="rgba(255, 200, 0, 0.1)",this.lockCircle.style.boxShadow="none"}else this.lockProgress.style.display="none",this.lockCircle.style.borderColor="rgba(255, 200, 0, 0.8)",this.lockCircle.style.backgroundColor="rgba(255, 200, 0, 0.1)",this.lockCircle.style.boxShadow="none"}onLockComplete(){}getCurrentTarget(){return this.lockProgressValue>=1?this.currentTarget:null}getLockProgress(){return this.lockProgressValue}isLocking(){return this.isLockingOn}dispose(){this.container.remove()}}var Os=(s=>(s.MENU="MENU",s.PLAYING="PLAYING",s.PAUSED="PAUSED",s.GAME_OVER="GAME_OVER",s))(Os||{});class Sg{constructor(){b(this,"status","MENU");b(this,"score",0);b(this,"enemiesDestroyed",0)}setStatus(t){this.status=t}getStatus(){return this.status}addScore(t){this.score+=t}getScore(){return this.score}incrementEnemiesDestroyed(){this.enemiesDestroyed++}getEnemiesDestroyed(){return this.enemiesDestroyed}start(){this.status="PLAYING"}isPlaying(){return this.status==="PLAYING"}reset(){this.score=0,this.enemiesDestroyed=0,this.status="MENU"}}var gi=(s=>(s.LAKE="LAKE",s.DESERT="DESERT",s.MOUNTAINS="MOUNTAINS",s.OCEAN="OCEAN",s.CITY="CITY",s))(gi||{});const Eg=[{id:1,name:"湖畔晨曦",description:"在宁静的湖面上空进行首次战斗",terrain:"LAKE",groundColor:2969622,waterColor:2003199,fogColor:11393254,skyColors:["#1e3c72","#2a5298","#87ceeb","#ffffff"],totalWaves:5,enemiesPerWave:[2,3,3,4,4],enemyTypes:[{type:"SCOUT",minWave:1,maxCount:2},{type:"FIGHTER",minWave:2,maxCount:2}],waveInterval:15,powerUpFrequency:.3,powerUpTypes:["HEALTH","SPEED","SHIELD"],difficulty:2},{id:2,name:"沙漠风暴",description:"在炎热的沙漠上空迎战敌人",terrain:"DESERT",groundColor:12759680,fogColor:16032864,skyColors:["#ff6b35","#ff8c42","#ffd166","#fff8dc"],totalWaves:6,enemiesPerWave:[3,3,4,4,5,5],enemyTypes:[{type:"SCOUT",minWave:1,maxCount:2},{type:"FIGHTER",minWave:1,maxCount:3},{type:"SNIPER",minWave:3,maxCount:1}],waveInterval:12,powerUpFrequency:.25,powerUpTypes:["HEALTH","DAMAGE","SPEED"],difficulty:4},{id:3,name:"雪山之巅",description:"在高耸的雪山上空进行艰苦战斗",terrain:"MOUNTAINS",groundColor:16777215,fogColor:14474460,skyColors:["#2c3e50","#4ca1af","#c4e0e5","#ffffff"],totalWaves:7,enemiesPerWave:[3,4,4,5,5,6,6],enemyTypes:[{type:"FIGHTER",minWave:1,maxCount:3},{type:"HEAVY",minWave:2,maxCount:2},{type:"SNIPER",minWave:3,maxCount:2}],waveInterval:10,powerUpFrequency:.35,powerUpTypes:["HEALTH","SHIELD","DAMAGE","SPEED"],difficulty:6},{id:4,name:"深海决战",description:"在广阔的海洋上空进行最终决战",terrain:"OCEAN",groundColor:139,waterColor:27028,fogColor:8900331,skyColors:["#0f0c29","#302b63","#24243e","#0f0c29"],totalWaves:8,enemiesPerWave:[4,4,5,5,6,6,7,8],enemyTypes:[{type:"FIGHTER",minWave:1,maxCount:4},{type:"HEAVY",minWave:2,maxCount:2},{type:"SNIPER",minWave:3,maxCount:2},{type:"ACE",minWave:5,maxCount:1}],waveInterval:8,powerUpFrequency:.4,powerUpTypes:["HEALTH","SHIELD","DAMAGE","SPEED","MULTISHOT"],difficulty:8},{id:5,name:"城市废墟",description:"在废弃的城市上空进行终极挑战",terrain:"CITY",groundColor:4013373,fogColor:6908265,skyColors:["#1a1a2e","#16213e","#0f3460","#533483"],totalWaves:10,enemiesPerWave:[4,5,5,6,6,7,7,8,8,10],enemyTypes:[{type:"SCOUT",minWave:1,maxCount:3},{type:"FIGHTER",minWave:1,maxCount:4},{type:"HEAVY",minWave:2,maxCount:3},{type:"SNIPER",minWave:3,maxCount:2},{type:"ACE",minWave:6,maxCount:2}],waveInterval:6,powerUpFrequency:.5,powerUpTypes:["HEALTH","SHIELD","DAMAGE","SPEED","MULTISHOT","BOMB"],difficulty:10}];function wg(s){return Eg.find(t=>t.id===s)}var Ve=(s=>(s.SCOUT="SCOUT",s.FIGHTER="FIGHTER",s.HEAVY="HEAVY",s.SNIPER="SNIPER",s.ACE="ACE",s))(Ve||{}),en=(s=>(s.CHASE="chase",s.FIXED_DIRECTION="fixed_direction",s.CIRCLE="circle",s))(en||{});const Zl={SCOUT:{type:"SCOUT",name:"侦察机",health:30,speed:40,damage:10,detectionRange:120,attackRange:25,attackCooldown:.4,evasionChance:.3,accuracy:.4,turnSpeed:1.5,maxRollAngle:Math.PI/4,wanderRadius:80,stateProbabilities:{chase:.25,fixed_direction:.5,circle:.25},stateDurationRange:[4,8],circleRadius:150,circleHeight:30,scoreValue:50,color:4521796,scale:.7},FIGHTER:{type:"FIGHTER",name:"战斗机",health:50,speed:55,damage:15,detectionRange:100,attackRange:30,attackCooldown:.5,evasionChance:.15,accuracy:.5,turnSpeed:2,maxRollAngle:Math.PI/4,wanderRadius:60,stateProbabilities:{chase:.325,fixed_direction:.475,circle:.2},stateDurationRange:[4,8],circleRadius:120,circleHeight:40,scoreValue:100,color:16729156,scale:1},HEAVY:{type:"HEAVY",name:"重型轰炸机",health:150,speed:35,damage:30,detectionRange:80,attackRange:40,attackCooldown:.8,evasionChance:.02,accuracy:.6,turnSpeed:.8,maxRollAngle:Math.PI/10,wanderRadius:40,stateProbabilities:{chase:.35,fixed_direction:.45,circle:.2},stateDurationRange:[5,9],circleRadius:100,circleHeight:20,scoreValue:200,color:8930304,scale:1.8},SNIPER:{type:"SNIPER",name:"狙击机",health:40,speed:45,damage:40,detectionRange:200,attackRange:80,attackCooldown:1,evasionChance:.2,accuracy:.7,turnSpeed:1.2,maxRollAngle:Math.PI/8,wanderRadius:100,stateProbabilities:{chase:.3,fixed_direction:.5,circle:.2},stateDurationRange:[4,8],circleRadius:180,circleHeight:50,scoreValue:150,color:8913151,scale:.9},ACE:{type:"ACE",name:"王牌飞行员",health:80,speed:70,damage:25,detectionRange:150,attackRange:35,attackCooldown:.4,evasionChance:.4,accuracy:.6,turnSpeed:2.4,maxRollAngle:Math.PI/3,wanderRadius:60,stateProbabilities:{chase:.4,fixed_direction:.45,circle:.15},stateDurationRange:[3,7],circleRadius:100,circleHeight:50,scoreValue:500,color:16768256,scale:1.2}};function Tg(s,t){const e=[];return s===1?t<=2?e.push("SCOUT"):e.push("SCOUT","FIGHTER"):s===2?(e.push("FIGHTER"),t>=2&&e.push("SNIPER"),t>=3&&e.push("SCOUT")):s===3?(e.push("FIGHTER","SNIPER"),t>=2&&e.push("HEAVY")):(e.push("FIGHTER","HEAVY"),t>=2&&e.push("ACE"),t>=3&&e.push("SNIPER")),e}function bg(s){const t=s.map(i=>1e3/Zl[i].scoreValue),e=t.reduce((i,r)=>i+r,0);let n=Math.random()*e;for(let i=0;i<s.length;i++)if(n-=t[i],n<=0)return s[i];return s[0]}class Ag{constructor(t,e,n=65535){b(this,"scene");b(this,"particles",[]);b(this,"maxParticles",50);b(this,"spawnInterval",.1);b(this,"spawnTimer",0);b(this,"material");this.scene=t;const i=this.createParticleTexture();this.material=new Ji({map:i,color:n,transparent:!0,opacity:.8,blending:Gn,depthWrite:!1})}createParticleTexture(){const e=document.createElement("canvas");e.width=64,e.height=64;const n=e.getContext("2d");if(!n)throw new Error("Failed to get 2D context");const i=n.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);i.addColorStop(0,"rgba(255, 255, 255, 1)"),i.addColorStop(.3,"rgba(255, 255, 255, 0.8)"),i.addColorStop(.5,"rgba(255, 255, 255, 0.4)"),i.addColorStop(1,"rgba(255, 255, 255, 0)"),n.fillStyle=i,n.fillRect(0,0,64,64);const r=new ns(e);return r.needsUpdate=!0,r}addPoint(t,e){if(this.spawnTimer+=.016,this.spawnTimer>=this.spawnInterval){this.spawnTimer=0;const n=e?t.clone().add(e):t;this.spawnParticle(n)}}spawnParticle(t){if(this.particles.length>=this.maxParticles){const a=this.particles.shift();a&&(this.scene.remove(a.sprite),a.sprite.material.dispose())}const e=new Bl(this.material.clone());e.position.copy(t);const n=2.5,i=.8+Math.random()*.2;e.scale.set(n*i,n*i,1),this.scene.add(e);const r={sprite:e,life:1,decay:.008+Math.random()*.004,initialScale:n*i};this.particles.push(r)}update(t){for(let e=this.particles.length-1;e>=0;e--){const n=this.particles[e];n.life-=n.decay*t*60,n.sprite.material instanceof Ji&&(n.sprite.material.opacity=Math.max(0,n.life*.8));const i=n.initialScale*n.life;n.sprite.scale.set(i,i,1),n.life<=0&&(this.scene.remove(n.sprite),n.sprite.material.dispose(),this.particles.splice(e,1))}}dispose(){for(const t of this.particles)this.scene.remove(t.sprite),t.sprite.material.dispose();this.particles=[],this.material.dispose()}}class Cg{constructor(t,e,n){b(this,"mesh");b(this,"config");b(this,"health");b(this,"trail");b(this,"velocity");b(this,"targetPosition");b(this,"currentState",en.CHASE);b(this,"stateTimer",0);b(this,"fixedDirection");b(this,"circleAngle",0);b(this,"attackCooldown",0);b(this,"onFire");b(this,"onDestroy");this.mesh=t,this.config=e,this.health=new Yl(e.health),this.targetPosition=null,this.velocity=new R(0,0,-e.speed),this.fixedDirection=this.randomDirection();const i=this.getTrailColor(e.type);this.trail=new Ag(n,t,i),this.selectNewState(),this.stateTimer=this.randomStateDuration(),this.health.onDeath=()=>{var r;(r=this.onDestroy)==null||r.call(this,this.mesh.position.clone())}}getTrailColor(t){return 16777215}update(t,e){const n=this.mesh.position;if(!isFinite(n.x)||!isFinite(n.y)||!isFinite(n.z)){console.error("Enemy position is NaN or Infinity, resetting to origin",{position:{x:n.x,y:n.y,z:n.z}}),this.mesh.position.set(0,0,0);return}switch(this.targetPosition=e,this.stateTimer-=t,this.stateTimer<=0&&(this.selectNewState(),this.stateTimer=this.randomStateDuration()),this.currentState){case en.CHASE:this.updateChase(t);break;case en.FIXED_DIRECTION:this.updateFixedDirection(t);break;case en.CIRCLE:this.updateCircle(t);break}if(this.mesh.position.add(this.velocity.clone().multiplyScalar(t)),this.velocity.length()>0){const a=this.mesh.position.clone().add(this.velocity),o=new ae;o.position.copy(this.mesh.position),o.lookAt(a),this.mesh.quaternion.slerp(o.quaternion,.3)}const r=new R(0,0,2).applyMatrix4(this.mesh.matrixWorld);this.trail.addPoint(r),this.attackCooldown=Math.max(0,this.attackCooldown-t),this.trail.update(t)}updateChase(t){if(!this.targetPosition)return;const e=new R().subVectors(this.targetPosition,this.mesh.position).normalize(),n=this.velocity.clone().normalize(),i=this.config.turnSpeed*t,r=Math.atan2(e.x,e.z),a=Math.atan2(n.x,n.z);let o=r-a;for(;o>Math.PI;)o-=Math.PI*2;for(;o<-Math.PI;)o+=Math.PI*2;o=Math.max(-i,Math.min(i,o));const l=a+o;if(this.velocity.set(Math.sin(l)*this.config.speed,e.y*this.config.speed,Math.cos(l)*this.config.speed),this.attackCooldown<=0&&this.targetPosition){const c=new R().subVectors(this.targetPosition,this.mesh.position).normalize(),h=this.velocity.clone().normalize(),u=c.dot(h),d=Math.cos(30*Math.PI/180);u>d&&(this.fire(this.targetPosition),this.attackCooldown=this.config.attackCooldown)}}updateFixedDirection(t){}updateCircle(t){if(!this.targetPosition)return;const e=this.config.speed/this.config.circleRadius;this.circleAngle+=e*t;const n=this.targetPosition,i=n.x+Math.cos(this.circleAngle)*this.config.circleRadius,r=n.z+Math.sin(this.circleAngle)*this.config.circleRadius,a=n.y+this.config.circleHeight,o=new R(i,a,r),l=new R().subVectors(o,this.mesh.position).normalize(),c=this.velocity.clone().normalize(),h=this.config.turnSpeed*t,u=Math.atan2(l.x,l.z),d=Math.atan2(c.x,c.z);let p=u-d;for(;p>Math.PI;)p-=Math.PI*2;for(;p<-Math.PI;)p+=Math.PI*2;p=Math.max(-h,Math.min(h,p));const g=d+p;this.velocity.set(Math.sin(g)*this.config.speed,l.y*this.config.speed,Math.cos(g)*this.config.speed),this.attackCooldown<=0&&this.config.type==="HEAVY"&&(this.fire(this.targetPosition),this.attackCooldown=this.config.attackCooldown*1.5)}selectNewState(){const t=Math.random(),e=this.config.stateProbabilities;let n=0;if(n+=e[en.CHASE],t<n){this.currentState=en.CHASE;return}if(n+=e[en.FIXED_DIRECTION],t<n){this.currentState=en.FIXED_DIRECTION,this.fixedDirection=this.randomDirection(),this.velocity.copy(this.fixedDirection).multiplyScalar(this.config.speed);return}this.currentState=en.CIRCLE,this.circleAngle=0}randomDirection(){const t=Math.random()*Math.PI*2;return new R(Math.cos(t),0,Math.sin(t)).normalize()}randomStateDuration(){const[t,e]=this.config.stateDurationRange;return t+Math.random()*(e-t)}fire(t){var a;const e=new R().subVectors(t,this.mesh.position);e.normalize();const n=(1-this.config.accuracy)*.4,i=(Math.random()-.5)*n,r=new Ci;r.setFromAxisAngle(new R(0,1,0),i),e.applyQuaternion(r),e.normalize(),(a=this.onFire)==null||a.call(this,this.mesh.position.clone(),e,this.config.damage)}getHealth(){return{current:this.health.getCurrentHealth(),max:this.health.getMaxHealth()}}getHealthSystem(){return this.health}getConfig(){return this.config}getMesh(){return this.mesh}isAlive(){return this.health.getCurrentHealth()>0}takeDamage(t){this.health.takeDamage(t)}getPosition(){return this.mesh.position.clone()}getVelocity(){return this.velocity.clone()}reset(t){this.mesh.position.copy(t),this.mesh.visible=!1,this.health.reset(),this.velocity=new R(0,0,-this.config.speed),this.selectNewState(),this.stateTimer=this.randomStateDuration()}dispose(){for(this.mesh.visible=!1,this.mesh.parent&&this.mesh.parent.remove(this.mesh),this.trail.dispose();this.mesh.children.length>0;){const t=this.mesh.children[0];this.mesh.remove(t),t instanceof ot&&(t.geometry.dispose(),t.material instanceof vn&&t.material.dispose())}}}class Rg{constructor(t){b(this,"scene");b(this,"terrainGroup");b(this,"waterMesh");b(this,"trees",[]);b(this,"clouds",[]);b(this,"grass",null);b(this,"rocks",[]);b(this,"time",0);this.scene=t,this.terrainGroup=new he,this.terrainGroup.name="terrain",this.scene.add(this.terrainGroup)}generateTerrain(t){switch(this.clearTerrain(),this.createSky(t.skyColors),t.terrain){case gi.LAKE:this.generateLakeTerrain(t);break;case gi.DESERT:this.generateDesertTerrain(t);break;case gi.MOUNTAINS:this.generateMountainTerrain(t);break;case gi.OCEAN:this.generateOceanTerrain(t);break;case gi.CITY:this.generateCityTerrain(t);break}this.createClouds(),this.scene.fog=new sa(t.fogColor,8e-4)}generateLakeTerrain(t){const e=new Ae(2e3,2e3,200,200),n=e.attributes.position;for(let a=0;a<n.count;a++){const o=n.getX(a),l=n.getY(a),c=Math.sin(o*.01)*Math.cos(l*.01)*8,h=Math.sin(o*.03+1)*Math.cos(l*.03)*3,u=Math.sin(o*.005)*Math.cos(l*.005)*15;n.setZ(a,c+h+u)}e.computeVertexNormals();const i=new It({color:t.groundColor,roughness:.9,metalness:0,flatShading:!1}),r=new ot(e,i);r.rotation.x=-Math.PI/2,r.position.y=-50,r.receiveShadow=!0,this.terrainGroup.add(r),this.createBeautifulLake(t),this.createForest(80,-49,1e3,200),this.createGrassField(500,1e5),this.createFlowers(300,2e4),this.createRocks(30)}createBeautifulLake(t){const e=new Ki,n=64;for(let u=0;u<=n;u++){const d=u/n*Math.PI*2,p=180+Math.sin(d*3)*20+Math.cos(d*5)*15,g=Math.cos(d)*p,_=Math.sin(d)*p;u===0?e.moveTo(g,_):e.lineTo(g,_)}const i=new qs(e,32),r=new It({color:t.waterColor||2003199,transparent:!0,opacity:.85,roughness:.1,metalness:.3}),a=new ot(i,r);a.rotation.x=-Math.PI/2,a.position.y=-48.5,this.terrainGroup.add(a),this.waterMesh=a;const o=new Ki;for(let u=0;u<=n;u++){const d=u/n*Math.PI*2,p=200+Math.sin(d*3)*20+Math.cos(d*5)*15,g=Math.cos(d)*p,_=Math.sin(d)*p;u===0?o.moveTo(g,_):o.lineTo(g,_)}o.holes.push(e);const l=new qs(o),c=new It({color:16049340,roughness:1,metalness:0}),h=new ot(l,c);h.rotation.x=-Math.PI/2,h.position.y=-48.8,h.receiveShadow=!0,this.terrainGroup.add(h)}createForest(t,e,n,i){const r=[{color:2263842,height:12,width:6},{color:3050327,height:18,width:5},{color:3329330,height:8,width:4},{color:25600,height:15,width:7}];for(let a=0;a<t;a++){const o=Math.random()*Math.PI*2,l=i+Math.random()*(n-i),c=Math.cos(o)*l,h=Math.sin(o)*l,u=r[Math.floor(Math.random()*r.length)],d=this.createBeautifulTree(u.color,u.height,u.width);d.position.set(c,e,h),d.scale.setScalar(.8+Math.random()*.6),d.rotation.y=Math.random()*Math.PI*2,this.terrainGroup.add(d),this.trees.push(d)}}createBeautifulTree(t,e,n){const i=new he,r=new Ce(n*.08,n*.15,e*.4,8),a=new It({color:4863784,roughness:.9}),o=new ot(r,a);o.position.y=e*.2,o.castShadow=!0,i.add(o);const l=new It({color:t,roughness:.8}),c=new ot(new ye(n*.8,e*.4,8),l);c.position.y=e*.5,c.castShadow=!0,i.add(c);const h=new ot(new ye(n*.6,e*.35,8),l);h.position.y=e*.7,h.castShadow=!0,i.add(h);const u=new ot(new ye(n*.4,e*.3,8),l);return u.position.y=e*.9,u.castShadow=!0,i.add(u),i}createGrassField(t,e){const n=new ye(.1,.5,4),i=new It({color:8190976,roughness:.9});this.grass=new Vo(n,i,e);const r=new ae;for(let a=0;a<e;a++){const o=Math.random()*Math.PI*2,l=Math.random()*t;r.position.set(Math.cos(o)*l,-49.5,Math.sin(o)*l),r.rotation.set((Math.random()-.5)*.2,Math.random()*Math.PI*2,(Math.random()-.5)*.2),r.scale.setScalar(.5+Math.random()*1),r.updateMatrix(),this.grass.setMatrixAt(a,r.matrix)}this.grass.instanceMatrix.needsUpdate=!0,this.terrainGroup.add(this.grass)}createFlowers(t,e){const n=[16738740,16766720,16737095,9662683,52945],i=new xe(.15,8,8);n.forEach(r=>{const a=new It({color:r,emissive:r,emissiveIntensity:.1}),o=new Vo(i,a,Math.floor(e/n.length)),l=new ae;for(let c=0;c<Math.floor(e/n.length);c++){const h=Math.random()*Math.PI*2,u=Math.random()*t;l.position.set(Math.cos(h)*u,-49.3,Math.sin(h)*u),l.scale.setScalar(.8+Math.random()*.4),l.updateMatrix(),o.setMatrixAt(c,l.matrix)}o.instanceMatrix.needsUpdate=!0,this.terrainGroup.add(o)})}createRocks(t){for(let e=0;e<t;e++){const n=new ha(1+Math.random()*2,0),i=n.attributes.position;for(let o=0;o<i.count;o++)i.setX(o,i.getX(o)*(.8+Math.random()*.4)),i.setY(o,i.getY(o)*(.6+Math.random()*.8)),i.setZ(o,i.getZ(o)*(.8+Math.random()*.4));n.computeVertexNormals();const r=new It({color:new Tt().setHSL(0,0,.3+Math.random()*.2),roughness:.9,metalness:.1}),a=new ot(n,r);a.position.set((Math.random()-.5)*1500,-49,(Math.random()-.5)*1500),a.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI),a.castShadow=!0,a.receiveShadow=!0,this.terrainGroup.add(a),this.rocks.push(a)}}generateDesertTerrain(t){const e=new Ae(2e3,2e3,150,150),n=e.attributes.position;for(let a=0;a<n.count;a++){const o=n.getX(a),l=n.getY(a),c=Math.sin(o*.008+l*.003)*8,h=Math.sin(o*.015)*Math.cos(l*.012)*5,u=Math.sin(o*.004+l*.006)*12;n.setZ(a,Math.max(0,c+h+u))}e.computeVertexNormals();const i=new It({color:t.groundColor,roughness:1,metalness:0}),r=new ot(e,i);r.rotation.x=-Math.PI/2,r.position.y=-50,r.receiveShadow=!0,this.terrainGroup.add(r),this.createCacti(50),this.createRocks(20),this.createDeadTrees(15)}createCacti(t){for(let e=0;e<t;e++){const n=(Math.random()-.5)*1500,i=(Math.random()-.5)*1500,r=this.createBeautifulCactus();r.position.set(n,-50,i),r.scale.setScalar(.5+Math.random()*1),r.rotation.y=Math.random()*Math.PI*2,this.terrainGroup.add(r)}}createBeautifulCactus(){const t=new he,e=new It({color:2972199,roughness:.8}),n=6+Math.random()*4,i=new ot(new Ce(.8,1.2,n,8),e);i.position.y=n/2,i.castShadow=!0,t.add(i);const r=Math.floor(Math.random()*3)+1;for(let a=0;a<r;a++){const o=Math.random()>.5?1:-1,l=n*(.3+Math.random()*.4),c=new ot(new Ce(.4,.5,2+Math.random()*2,8),e);c.rotation.z=Math.PI/2*o,c.position.set(o*1.5,l,0),c.castShadow=!0,t.add(c);const h=new ot(new Ce(.3,.4,2+Math.random()*2,8),e);h.position.set(o*2.5,l+1,0),h.castShadow=!0,t.add(h)}if(Math.random()>.6){const a=new ot(new xe(.3,8,8),new It({color:16738740,emissive:16738740,emissiveIntensity:.2}));a.position.y=n+.3,t.add(a)}return t}createDeadTrees(t){for(let e=0;e<t;e++){const n=(Math.random()-.5)*1500,i=(Math.random()-.5)*1500,r=new he,a=new It({color:4865066,roughness:1}),o=new ot(new Ce(.3,.5,5+Math.random()*3,6),a);o.position.y=2.5,o.rotation.set((Math.random()-.5)*.3,0,(Math.random()-.5)*.3),o.castShadow=!0,r.add(o);for(let l=0;l<3;l++){const c=new ot(new Ce(.1,.15,2+Math.random(),6),a);c.position.set((Math.random()-.5)*.5,3+l*1.2,(Math.random()-.5)*.5),c.rotation.set((Math.random()-.5)*1,Math.random()*Math.PI*2,(Math.random()-.5)*1),c.castShadow=!0,r.add(c)}r.position.set(n,-50,i),r.scale.setScalar(.5+Math.random()*.5),this.terrainGroup.add(r)}}generateMountainTerrain(t){const e=new Ae(2e3,2e3,150,150),n=e.attributes.position;for(let a=0;a<n.count;a++){const o=n.getX(a),l=n.getY(a),c=Math.sin(o*.02)*Math.cos(l*.02)*40,h=Math.sin(o*.035)*Math.cos(l*.03)*20,u=Math.sin(o*.1)*Math.cos(l*.1)*5;n.setZ(a,Math.max(0,c+h+u))}e.computeVertexNormals();const i=new It({color:t.groundColor,roughness:.8,metalness:0}),r=new ot(e,i);r.rotation.x=-Math.PI/2,r.position.y=-50,r.receiveShadow=!0,this.terrainGroup.add(r),this.createBeautifulMountains(20),this.createPineForest(60,-50,800,200)}createBeautifulMountains(t){for(let e=0;e<t;e++){const n=e/t*Math.PI*2+Math.random()*.5,i=400+Math.random()*400,r=Math.cos(n)*i,a=Math.sin(n)*i,o=new he,l=60+Math.random()*60,c=30+Math.random()*20,h=new It({color:6908265,roughness:.9,flatShading:!0}),u=new ot(new ye(c,l,6+Math.floor(Math.random()*3)),h);u.position.y=l/2,u.castShadow=!0,o.add(u);const d=new It({color:16777215,roughness:.5}),p=new ot(new ye(c*.5,l*.35,6),d);p.position.y=l*.7,o.add(p),o.position.set(r,-50,a),o.rotation.y=Math.random()*Math.PI*2,this.terrainGroup.add(o)}}createPineForest(t,e,n,i){for(let r=0;r<t;r++){const a=Math.random()*Math.PI*2,o=i+Math.random()*(n-i),l=Math.cos(a)*o,c=Math.sin(a)*o,h=this.createPineTree();h.position.set(l,e,c),h.scale.setScalar(.6+Math.random()*.8),this.terrainGroup.add(h),this.trees.push(h)}}createPineTree(){const t=new he,e=new ot(new Ce(.2,.4,3,8),new It({color:4863784}));e.position.y=1.5,e.castShadow=!0,t.add(e);const n=new It({color:1722154,roughness:.8});for(let i=0;i<5;i++){const r=new ot(new ye(2-i*.3,2.5-i*.3,8),n);r.position.y=3+i*1.5,r.castShadow=!0,t.add(r)}if(Math.random()>.5){const i=new ot(new ye(.3,1,8),new It({color:16777215}));i.position.y=10,t.add(i)}return t}generateOceanTerrain(t){const e=new Ae(3e3,3e3,200,200),n=e.attributes.position;for(let a=0;a<n.count;a++){const o=n.getX(a),l=n.getY(a),c=Math.sin(o*.05)*Math.cos(l*.05)*2;n.setZ(a,c)}e.computeVertexNormals();const i=new It({color:t.waterColor||27028,transparent:!0,opacity:.9,roughness:.1,metalness:.3}),r=new ot(e,i);r.rotation.x=-Math.PI/2,r.position.y=-50,this.terrainGroup.add(r),this.waterMesh=r,this.createTropicalIslands(10),this.createPalmTrees(40)}createTropicalIslands(t){for(let e=0;e<t;e++){const n=(Math.random()-.5)*2e3,i=(Math.random()-.5)*2e3,r=new he,a=15+Math.random()*25,o=new ot(new ye(a,a*.5,8),new It({color:12759680,roughness:1}));o.position.y=-47,r.add(o);const l=new ot(new Ce(a*1.3,a*1.5,2,16),new It({color:16049340,roughness:1}));l.position.y=-48,r.add(l);const c=new ot(new ye(a*.8,a*.4,8),new It({color:2263842}));c.position.y=-46,r.add(c),r.position.set(n,0,i),this.terrainGroup.add(r)}}createPalmTrees(t){for(let e=0;e<t;e++){const n=(Math.random()-.5)*1800,i=(Math.random()-.5)*1800,r=this.createBeautifulPalmTree();r.position.set(n,-48,i),r.scale.setScalar(.5+Math.random()*.5),r.rotation.y=Math.random()*Math.PI*2,this.terrainGroup.add(r),this.trees.push(r)}}createBeautifulPalmTree(){const t=new he,e=new It({color:9127187,roughness:.9}),n=new ot(new Ce(.2,.4,8,8),e);n.rotation.set((Math.random()-.5)*.3,0,(Math.random()-.5)*.3),n.position.y=4,n.castShadow=!0,t.add(n);const i=new It({color:2263842,side:Ne});for(let r=0;r<8;r++){const a=new ot(new Ae(.8,6),i);a.position.set(0,8,0),a.rotation.set(Math.PI/4,r/8*Math.PI*2,0),t.add(a)}for(let r=0;r<3;r++){const a=new ot(new xe(.3,8,8),new It({color:6636321}));a.position.set((Math.random()-.5)*.5,7.5,(Math.random()-.5)*.5),t.add(a)}return t}generateCityTerrain(t){const e=new Ae(2e3,2e3),n=new It({color:t.groundColor,roughness:.7,metalness:0}),i=new ot(e,n);i.rotation.x=-Math.PI/2,i.position.y=-50,i.receiveShadow=!0,this.terrainGroup.add(i),this.createRoads(),this.createBuildings(120)}createRoads(){const t=new It({color:3355443,roughness:.9});for(let e=-3;e<=3;e++){const n=new ot(new Ae(2e3,20),t);n.rotation.x=-Math.PI/2,n.position.set(0,-49.9,e*250),this.terrainGroup.add(n);const i=new It({color:16777215});for(let r=-20;r<=20;r++){const a=new ot(new Ae(15,1),i);a.rotation.x=-Math.PI/2,a.position.set(r*50,-49.8,e*250),this.terrainGroup.add(a)}}for(let e=-3;e<=3;e++){const n=new ot(new Ae(20,2e3),t);n.rotation.x=-Math.PI/2,n.position.set(e*250,-49.9,0),this.terrainGroup.add(n)}}createBuildings(t){for(let e=0;e<t;e++){const n=Math.floor((Math.random()-.5)*6),i=Math.floor((Math.random()-.5)*6),r=n*250+(Math.random()-.5)*200,a=i*250+(Math.random()-.5)*200,o=this.createBeautifulBuilding();o.position.set(r,-50,a),this.terrainGroup.add(o)}}createBeautifulBuilding(){const t=new he,e=15+Math.random()*60,n=8+Math.random()*15,i=8+Math.random()*15,r=new It({color:new Tt().setHSL(Math.random()*.1+.55,.1+Math.random()*.1,.2+Math.random()*.3),roughness:.5,metalness:.3}),a=new ot(new $e(n,e,i),r);a.position.y=e/2,a.castShadow=!0,a.receiveShadow=!0,t.add(a);const o=new It({color:16777113,emissive:16776960,emissiveIntensity:.3}),l=1.5,c=4;for(let h=3;h<e-3;h+=c)for(let u=0;u<4;u++){const d=new ot(new Ae(l,l*1.5),o),p=u/4*Math.PI*2,g=(u%2===0?n:i)/2+.1;d.position.set(Math.cos(p)*g*.7,h,Math.sin(p)*g*.7),d.rotation.y=-p+Math.PI/2,t.add(d)}if(Math.random()>.5){const h=new ot(new $e(n*.3,3,i*.3),r);h.position.y=e+1.5,t.add(h)}if(Math.random()>.7){const h=new ot(new Ce(.1,.1,5,8),new It({color:8947848}));h.position.y=e+2.5,t.add(h)}return t}createSky(t){const e=document.createElement("canvas");e.width=2,e.height=512;const n=e.getContext("2d"),i=n.createLinearGradient(0,0,0,512);i.addColorStop(0,t[0]),i.addColorStop(.3,t[1]),i.addColorStop(.6,t[2]),i.addColorStop(1,t[3]),n.fillStyle=i,n.fillRect(0,0,2,512);const r=new ns(e);this.scene.background=r}createClouds(){for(let t=0;t<30;t++){const e=this.createFluffyCloud();e.position.set((Math.random()-.5)*2e3,80+Math.random()*150,(Math.random()-.5)*2e3),e.scale.setScalar(8+Math.random()*15),this.terrainGroup.add(e),this.clouds.push(e)}}createFluffyCloud(){const t=new he,e=new It({color:16777215,transparent:!0,opacity:.9}),n=5+Math.floor(Math.random()*4);for(let i=0;i<n;i++){const r=.5+Math.random()*.5,a=new ot(new xe(r,12,12),e);a.position.set((Math.random()-.5)*2,(Math.random()-.5)*.5,(Math.random()-.5)*1.5),t.add(a)}return t}update(t){if(this.time+=t,this.waterMesh){const e=this.waterMesh.geometry.attributes.position;for(let n=0;n<e.count;n++){const i=e.getX(n),r=e.getY(n),a=Math.sin(i*.05+this.time)*Math.cos(r*.05+this.time*.7)*2;e.setZ(n,a)}e.needsUpdate=!0}for(const e of this.clouds)e.position.x+=t*3,e.position.x>1200&&(e.position.x=-1200)}clearTerrain(){for(;this.terrainGroup.children.length>0;){const t=this.terrainGroup.children[0];this.terrainGroup.remove(t),t instanceof ot&&(t.geometry.dispose(),Array.isArray(t.material)?t.material.forEach(e=>e.dispose()):t.material.dispose())}this.trees=[],this.clouds=[],this.waterMesh=void 0,this.grass=null,this.rocks=[]}}class Pg{constructor(t,e){b(this,"group");b(this,"ring1");b(this,"ring2");b(this,"ring3");b(this,"coreSphere");b(this,"outerGlow");b(this,"particleSystem");b(this,"particleCount",100);b(this,"particleSpeeds",[]);b(this,"lifetime",0);b(this,"maxLifetime",5);b(this,"isComplete",!1);b(this,"onComplete");this.onComplete=e,this.group=new he,this.group.position.copy(t),this.createPortalEffect(),this.createParticles()}createPortalEffect(){const t=new _e({color:65535,transparent:!0,opacity:.8}),e=new _e({color:16711935,transparent:!0,opacity:.6,side:Ne}),n=new _e({color:43775,transparent:!0,opacity:.3}),i=new xe(2,32,32);this.coreSphere=new ot(i,t),this.coreSphere.scale.set(0,0,0),this.group.add(this.coreSphere);const r=new Mi(4,.5,16,100);this.ring1=new ot(r,e),this.ring1.rotation.x=Math.PI/2,this.ring1.scale.set(0,0,0),this.group.add(this.ring1);const a=new Mi(6,.8,16,100);this.ring2=new ot(a,e),this.ring2.rotation.x=Math.PI/2,this.ring2.scale.set(0,0,0),this.group.add(this.ring2);const o=new Mi(8,1,16,100);this.ring3=new ot(o,e),this.ring3.rotation.x=Math.PI/2,this.ring3.scale.set(0,0,0),this.group.add(this.ring3);const l=new xe(12,32,32);this.outerGlow=new ot(l,n),this.outerGlow.scale.set(0,0,0),this.group.add(this.outerGlow)}createParticles(){const t=new Ee,e=new Float32Array(this.particleCount*3),n=new Float32Array(this.particleCount*3),i=new Tt(65535),r=new Tt(16711935);for(let o=0;o<this.particleCount;o++){const l=o*3,c=o/this.particleCount*Math.PI*2*5,h=3+o/this.particleCount*8,u=(o/this.particleCount-.5)*10;e[l]=Math.cos(c)*h,e[l+1]=u,e[l+2]=Math.sin(c)*h;const d=o/this.particleCount,p=i.clone().lerp(r,d);n[l]=p.r,n[l+1]=p.g,n[l+2]=p.b,this.particleSpeeds[o]=5+Math.random()*10}t.setAttribute("position",new Re(e,3)),t.setAttribute("color",new Re(n,3));const a=new aa({size:.8,vertexColors:!0,transparent:!0,opacity:.9,blending:Yi});this.particleSystem=new zl(t,a),this.particleSystem.visible=!1,this.group.add(this.particleSystem)}update(t){var o;if(this.isComplete)return;this.lifetime+=t;const e=this.lifetime/this.maxLifetime;if(e<.4){const l=e/.4,c=this.easeOutBack(l);this.coreSphere.scale.set(c*1.5,c*1.5,c*1.5),this.ring1.scale.set(c,c,c),this.ring2.scale.set(c*.9,c*.9,c*.9),this.ring3.scale.set(c*.8,c*.8,c*.8),this.outerGlow.scale.set(c*2,c*2,c*2)}const n=2;this.ring1.rotation.z+=n*t,this.ring2.rotation.z-=n*1.5*t,this.ring3.rotation.z+=n*2*t;const i=1+Math.sin(this.lifetime*4)*.1;this.coreSphere.scale.multiplyScalar(i);const r=this.lifetime*.5%1,a=new Tt().setHSL(r,1,.5);if(this.ring1.material.color=a,this.ring2.material.color=a,this.ring3.material.color=a,e>.2&&e<.8){this.particleSystem.visible=!0;const l=this.particleSystem.geometry.attributes.position.array;for(let c=0;c<this.particleCount;c++){const h=c*3,u=this.particleSpeeds[c]*t,d=l[h],p=l[h+1],g=l[h+2],_=Math.sqrt(d*d+p*p+g*g);_>0&&(l[h]+=d/_*u,l[h+1]+=p/_*u*.5,l[h+2]+=g/_*u)}this.particleSystem.geometry.attributes.position.needsUpdate=!0}else this.particleSystem.visible=!1;if(e>.8){const l=(e-.8)/.2,c=1-l;this.coreSphere.scale.multiplyScalar(c),this.ring1.scale.multiplyScalar(c),this.ring2.scale.multiplyScalar(c),this.ring3.scale.multiplyScalar(c),this.outerGlow.scale.multiplyScalar(c);const h=1-l;this.coreSphere.material.opacity=h*.8,this.ring1.material.opacity=h*.6,this.ring2.material.opacity=h*.6,this.ring3.material.opacity=h*.6,this.outerGlow.material.opacity=h*.3}this.lifetime>=this.maxLifetime&&(this.isComplete=!0,(o=this.onComplete)==null||o.call(this))}easeOutBack(t){return 1+2.70158*Math.pow(t-1,3)+1.70158*Math.pow(t-1,2)}getMesh(){return this.group}isFinished(){return this.isComplete}dispose(){this.group.removeFromParent(),this.coreSphere.geometry.dispose(),this.coreSphere.material.dispose(),this.ring1.geometry.dispose(),this.ring1.material.dispose(),this.ring2.geometry.dispose(),this.ring2.material.dispose(),this.ring3.geometry.dispose(),this.ring3.material.dispose(),this.outerGlow.geometry.dispose(),this.outerGlow.material.dispose(),this.particleSystem.geometry.dispose(),this.particleSystem.material.dispose()}}class Lg{constructor(t){b(this,"scene");b(this,"terrainGenerator");b(this,"combatBounds",{maxHeight:150,minHeight:-20,horizontalDistance:300});b(this,"currentLevel",null);b(this,"currentWave",0);b(this,"state","IDLE");b(this,"enemies",[]);b(this,"enemyPool",[]);b(this,"enemiesSpawnedThisWave",0);b(this,"totalEnemiesSpawned",0);b(this,"activePortals",[]);b(this,"spawnTimer",0);b(this,"spawnInterval",3);b(this,"waveDelayTimer",0);b(this,"onWaveStart");b(this,"onWaveComplete");b(this,"onLevelComplete");b(this,"onEnemySpawned");b(this,"onEnemyKilled");this.scene=t,this.terrainGenerator=new Rg(t)}loadLevel(t){const e=wg(t);if(!e){console.error(`Level ${t} not found`);return}this.currentLevel=e,this.currentWave=0,this.state="IDLE",this.terrainGenerator.generateTerrain(e),this.startWave(),console.log(`Loaded level ${t}: ${e.name}`)}startWave(){var t;!this.currentLevel||this.state!=="IDLE"||(this.state="WAVE_ACTIVE",this.enemiesSpawnedThisWave=0,(t=this.onWaveStart)==null||t.call(this,this.currentWave),this.enemies=this.enemies.filter(e=>e.isAlive()))}spawnEnemy(t){if(!this.currentLevel)return;const e=Tg(this.currentLevel.id,this.currentWave);e.length===0&&e.push(Ve.SCOUT);const n=bg(e),i=this.getSpawnPosition(t),r=new Pg(i,()=>{var o;const a=this.getOrCreateEnemy(n);a.reset(i),a.getMesh().visible=!1,setTimeout(()=>{a.getMesh().visible=!0},100),this.enemiesSpawnedThisWave++,this.totalEnemiesSpawned++,(o=this.onEnemySpawned)==null||o.call(this,a)});this.scene.add(r.getMesh()),this.activePortals.push(r)}update(t,e){var n;for(let i=this.activePortals.length-1;i>=0;i--){const r=this.activePortals[i];r.update(t),r.isFinished()&&(r.dispose(),this.activePortals.splice(i,1))}if(this.waveDelayTimer>0&&(this.waveDelayTimer-=t,this.waveDelayTimer<=0&&this.startNextWave()),this.state==="WAVE_ACTIVE"&&this.currentLevel){const i=this.currentLevel.enemiesPerWave[this.currentWave]||0,r=this.enemies.filter(a=>a.isAlive()).length;this.enemiesSpawnedThisWave<i&&r<i?(this.spawnTimer+=t,this.spawnTimer>=this.spawnInterval&&(this.spawnTimer=0,this.spawnEnemy(e))):r===0&&this.enemiesSpawnedThisWave>=i&&(this.state="WAVE_COMPLETE",this.enemiesSpawnedThisWave=0,this.waveDelayTimer=3,(n=this.onWaveComplete)==null||n.call(this,this.currentWave))}for(const i of this.enemies)i.update(t,e);this.enemies=this.enemies.filter(i=>i.isAlive())}getEnemies(){return this.enemies}isEnemySpawning(t){const e=t.getPosition(),n=this.activePortals.some(a=>a.getMesh().position.distanceTo(e)<1),i=t.getMesh(),r=i&&!i.visible;return n||r}getAliveEnemyCount(){return this.enemies.filter(t=>t.isAlive()).length}getSpawnedEnemyCount(){return this.totalEnemiesSpawned}getTotalEnemyCount(){return this.currentLevel?this.currentLevel.enemiesPerWave.reduce((t,e)=>t+e,0):0}clear(){for(const t of this.enemyPool)t.getMesh().removeFromParent();this.enemies=[],this.enemyPool=[];for(const t of this.activePortals)t.dispose();this.activePortals=[],this.enemiesSpawnedThisWave=0}startNextWave(){var t;this.currentLevel&&(this.currentWave++,this.state="WAVE_ACTIVE",(t=this.onWaveStart)==null||t.call(this,this.currentWave))}getSpawnPosition(t){const r=this.combatBounds.maxHeight,a=this.combatBounds.minHeight,o=this.combatBounds.horizontalDistance;let l=null,c=0;const h=20;for(let u=0;u<h;u++){const d=this.enemiesSpawnedThisWave*137.5%360,p=(Math.random()-.5)*60,g=mh.degToRad(d+p),_=120+Math.random()*130,m=Math.max(a,Math.min(r,t.y+(Math.random()-.5)*30)),f=t.x+Math.cos(g)*_,M=t.z+Math.sin(g)*_,v=new R(f,m,M),S=Math.sqrt(Math.pow(f-t.x,2)+Math.pow(M-t.z,2));if(S>o){const A=o/S,C=t.x+(f-t.x)*A,B=t.z+(M-t.z)*A;return new R(C,m,B)}let L=1/0;for(const A of this.enemies)if(A.isAlive()){const C=v.distanceTo(A.getPosition());L=Math.min(L,C)}if((L===1/0||L>c)&&(c=L,l=v),L>=40)break}if(!l){const u=Math.max(a,Math.min(r,t.y));l=new R(t.x+(Math.random()-.5)*200,u,t.z+(Math.random()-.5)*200)}return l}getOrCreateEnemy(t){const e=this.enemyPool.findIndex(a=>a.getConfig().type===t);if(e!==-1){const a=this.enemyPool.splice(e,1)[0];return this.enemies.push(a),a}const n=Zl[t],i=this.createEnemyMesh(n);this.scene.add(i);const r=new Cg(i,n,this.scene);return this.enemies.push(r),r}dispose(t){for(const e of this.enemies)e.dispose();this.enemies=[]}createEnemyMesh(t){const e=new he;let n,i,r,a=1.6,o=6,l=3,c=.8,h=1;switch(t.type){case Ve.SCOUT:n=4871556,i=7043982,r=4020871,a=1.2,o=5,l=2.2,h=.85;break;case Ve.FIGHTER:n=13382400,i=15087872,r=9118976,a=1.8,o=7,l=3.5,h=1.1;break;case Ve.HEAVY:n=2894892,i=3815994,r=1710618,a=2.2,o=8,l=4.2,h=1.3;break;case Ve.SNIPER:n=4858714,i=7031930,r=8141549,a=1.6,o=7.5,l=2.8,h=.95;break;case Ve.ACE:n=9109504,i=16766720,r=16729344,a=1.9,o=7,l=3.3,h=1.15;break;default:n=t.color,i=t.color,r=t.color}e.scale.set(h,h,h);const u=new Ce(a*.4,a*.3,o,8),d=new It({color:n,metalness:.7,roughness:.3}),p=new ot(u,d);p.rotation.x=Math.PI/2,p.rotation.z=Math.PI/2,p.castShadow=!0,e.add(p);const g=new ye(a*.3,o*.25,8),_=new It({color:r,metalness:.8,roughness:.2}),m=new ot(g,_);m.rotation.x=Math.PI/2,m.rotation.z=Math.PI/2,m.position.set(0,0,o/2+.5),m.castShadow=!0,e.add(m);const f=new $e(l,.15,1.2),M=new It({color:i,metalness:.6,roughness:.4}),v=new ot(f,M);v.position.set(0,0,-.8),v.castShadow=!0,e.add(v);const S=new xe(a*.35,8,8),L=new It({color:r,metalness:.9,roughness:.1,emissive:r,emissiveIntensity:.3}),A=new ot(S,L);A.position.set(0,a*.25,.5),A.castShadow=!0,e.add(A);const C=new $e(c,.12,1),B=new It({color:i,metalness:.6,roughness:.4}),y=new ot(C,B);y.position.set(0,0,-o/2-.3),y.castShadow=!0,e.add(y);const T=new $e(.15,1.2,.8),F=new ot(T,B);F.position.set(0,.6,-o/2+.1),F.castShadow=!0,e.add(F);const V=new Ce(a*.2,a*.15,.5,8),nt=new _e({color:16737792,transparent:!0,opacity:.8}),I=new ot(V,nt);switch(I.rotation.x=Math.PI/2,I.position.set(0,0,-o/2-.8),e.add(I),t.type){case Ve.SCOUT:e.name="Scout";break;case Ve.FIGHTER:e.name="Fighter";break;case Ve.HEAVY:e.name="Heavy";break;case Ve.SNIPER:e.name="Sniper";break;case Ve.ACE:e.name="Ace";break}return e}}class Dg{constructor(){b(this,"context",null);b(this,"masterVolume",null);b(this,"engineOscillator",null);b(this,"engineGain",null);b(this,"isEnginePlaying",!1);b(this,"masterVolumeValue",.5);b(this,"sfxVolume",.7)}initContext(){if(!this.context)try{this.context=new(window.AudioContext||window.webkitAudioContext),this.masterVolume=this.context.createGain(),this.masterVolume.gain.value=this.masterVolumeValue,this.masterVolume.connect(this.context.destination)}catch{console.warn("Web Audio API not supported")}}resume(){var t;this.initContext(),((t=this.context)==null?void 0:t.state)==="suspended"&&this.context.resume()}startEngine(){if(this.initContext(),!(!this.context||!this.masterVolume||this.isEnginePlaying))try{this.engineOscillator=this.context.createOscillator(),this.engineGain=this.context.createGain(),this.engineOscillator.type="sawtooth",this.engineOscillator.frequency.value=80,this.engineGain.gain.value=.05*this.sfxVolume;const t=this.context.createBiquadFilter();t.type="lowpass",t.frequency.value=500,this.engineOscillator.connect(t),t.connect(this.engineGain),this.engineGain.connect(this.masterVolume),this.engineOscillator.start(),this.isEnginePlaying=!0}catch{console.warn("Failed to start engine sound")}}updateEngine(t){var o,l;if(!this.engineOscillator||!this.engineGain)return;const e=60,n=150,i=Math.min(t/100,1),r=e+(n-e)*i;this.engineOscillator.frequency.setValueAtTime(r,((o=this.context)==null?void 0:o.currentTime)||0);const a=.03+i*.04;this.engineGain.gain.setValueAtTime(a*this.sfxVolume,((l=this.context)==null?void 0:l.currentTime)||0)}stopEngine(){this.engineOscillator&&(this.engineOscillator.stop(),this.engineOscillator=null),this.isEnginePlaying=!1}playShoot(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="square",e.frequency.setValueAtTime(800,t),e.frequency.exponentialRampToValueAtTime(200,t+.1),n.gain.setValueAtTime(.2*this.sfxVolume,t),n.gain.exponentialRampToValueAtTime(.01,t+.1),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.1),this.playNoise(.05,.1,.1*this.sfxVolume)}catch{}}playExplosion(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="sine",e.frequency.setValueAtTime(150,t),e.frequency.exponentialRampToValueAtTime(20,t+.5),n.gain.setValueAtTime(.5*this.sfxVolume,t),n.gain.exponentialRampToValueAtTime(.01,t+.5),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.5),this.playNoise(.3,.5,.3*this.sfxVolume)}catch{}}playHit(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="triangle",e.frequency.setValueAtTime(400,t),e.frequency.exponentialRampToValueAtTime(100,t+.1),n.gain.setValueAtTime(.15*this.sfxVolume,t),n.gain.exponentialRampToValueAtTime(.01,t+.1),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.1)}catch{}}playPowerUp(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime;[523.25,659.25,783.99,1046.5].forEach((n,i)=>{const r=this.context.createOscillator(),a=this.context.createGain();r.type="sine",r.frequency.value=n;const o=t+i*.08;a.gain.setValueAtTime(0,o),a.gain.linearRampToValueAtTime(.15*this.sfxVolume,o+.02),a.gain.exponentialRampToValueAtTime(.01,o+.15),r.connect(a),a.connect(this.masterVolume),r.start(o),r.stop(o+.15)})}catch{}}playLevelUp(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime;[392,523.25,659.25,783.99].forEach((n,i)=>{const r=this.context.createOscillator(),a=this.context.createGain();r.type="triangle",r.frequency.value=n;const o=t+i*.1;a.gain.setValueAtTime(0,o),a.gain.linearRampToValueAtTime(.2*this.sfxVolume,o+.05),a.gain.exponentialRampToValueAtTime(.01,o+.3),r.connect(a),a.connect(this.masterVolume),r.start(o),r.stop(o+.3)})}catch{}}playWaveStart(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime;for(let e=0;e<3;e++){const n=this.context.createOscillator(),i=this.context.createGain();n.type="square",n.frequency.value=440;const r=t+e*.15;i.gain.setValueAtTime(.1*this.sfxVolume,r),i.gain.setValueAtTime(0,r+.1),n.connect(i),i.connect(this.masterVolume),n.start(r),n.stop(r+.1)}}catch{}}playGameOver(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime;[392,349.23,329.63,293.66].forEach((n,i)=>{const r=this.context.createOscillator(),a=this.context.createGain();r.type="triangle",r.frequency.value=n;const o=t+i*.2;a.gain.setValueAtTime(.15*this.sfxVolume,o),a.gain.exponentialRampToValueAtTime(.01,o+.4),r.connect(a),a.connect(this.masterVolume),r.start(o),r.stop(o+.4)})}catch{}}playNoise(t,e,n){if(!(!this.context||!this.masterVolume))try{const i=this.context.sampleRate*t,r=this.context.createBuffer(1,i,this.context.sampleRate),a=r.getChannelData(0);for(let h=0;h<i;h++)a[h]=Math.random()*2-1;const o=this.context.createBufferSource();o.buffer=r;const l=this.context.createGain(),c=this.context.currentTime;l.gain.setValueAtTime(0,c),l.gain.linearRampToValueAtTime(n,c+e),l.gain.exponentialRampToValueAtTime(.01,c+t),o.connect(l),l.connect(this.masterVolume),o.start(c)}catch{}}setMasterVolume(t){this.masterVolumeValue=Math.max(0,Math.min(1,t)),this.masterVolume&&(this.masterVolume.gain.value=this.masterVolumeValue)}playBalloonPop(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="sine",e.frequency.setValueAtTime(880,t),e.frequency.exponentialRampToValueAtTime(220,t+.1),n.gain.setValueAtTime(0,t),n.gain.linearRampToValueAtTime(.3*this.sfxVolume,t+.01),n.gain.exponentialRampToValueAtTime(.01,t+.15),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.15);const i=this.context.createOscillator(),r=this.context.createGain();i.type="square",i.frequency.setValueAtTime(1200,t+.05),r.gain.setValueAtTime(0,t+.05),r.gain.linearRampToValueAtTime(.15*this.sfxVolume,t+.05),r.gain.exponentialRampToValueAtTime(.01,t+.1),i.connect(r),r.connect(this.masterVolume),i.start(t+.05),i.stop(t+.1)}catch{}}playMissileLock(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="sine",e.frequency.setValueAtTime(1200,t),e.frequency.exponentialRampToValueAtTime(1800,t+.1),n.gain.setValueAtTime(0,t),n.gain.linearRampToValueAtTime(.25*this.sfxVolume,t+.01),n.gain.exponentialRampToValueAtTime(.01,t+.15),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.15)}catch{}}playMissileFire(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="sawtooth",e.frequency.setValueAtTime(300,t),e.frequency.exponentialRampToValueAtTime(150,t+.3),n.gain.setValueAtTime(0,t),n.gain.linearRampToValueAtTime(.3*this.sfxVolume,t+.02),n.gain.exponentialRampToValueAtTime(.01,t+.3),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.3)}catch{}}playMissileExplosion(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="sawtooth",e.frequency.setValueAtTime(100,t),e.frequency.exponentialRampToValueAtTime(30,t+.5),n.gain.setValueAtTime(0,t),n.gain.linearRampToValueAtTime(.6*this.sfxVolume,t+.02),n.gain.exponentialRampToValueAtTime(.01,t+.5),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.5),this.playNoise(.6,.1,.8*this.sfxVolume)}catch{}}setSFXVolume(t){this.sfxVolume=Math.max(0,Math.min(1,t))}playMissileLaunch(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="sawtooth",e.frequency.setValueAtTime(400,t),e.frequency.exponentialRampToValueAtTime(600,t+.1),n.gain.setValueAtTime(0,t),n.gain.linearRampToValueAtTime(.2*this.sfxVolume,t+.01),n.gain.exponentialRampToValueAtTime(.01,t+.2),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.15)}catch{}}mute(){this.masterVolume&&(this.masterVolume.gain.value=0)}unmute(){this.masterVolume&&(this.masterVolume.gain.value=this.masterVolumeValue)}}class Ig{constructor(t,e,n){b(this,"mesh");b(this,"config");b(this,"balloon");b(this,"string");b(this,"baseY");b(this,"time",0);b(this,"floatAmount",.8);b(this,"bobSpeed",2);b(this,"spawnInvincibleTimer",.5);this.config={type:e,icon:n||(n?Si[e].icon:"?"),isRandom:!n},this.baseY=t.y,this.mesh=new he,this.mesh.position.copy(t),this.createBalloon()}createBalloon(){const t=this.config,e=new xe(3,16,16),n=new It({color:16777215,emissive:4474111,emissiveIntensity:.3,metalness:.3,roughness:.7});this.balloon=new ot(e,n),this.balloon.scale.set(1,1.2,1);const i=new Ce(.1,.1,2),r=new It({color:13421772});this.string=new ot(i,r),this.string.position.y=-2.5;const a=document.createElement("canvas");a.width=64,a.height=64;const o=a.getContext("2d");o.fillStyle="#ffffff",o.beginPath(),o.arc(32,32,28,0,Math.PI*2),o.fill(),o.fillStyle="#333333",o.font="bold 32px Arial",o.textAlign="center",o.textBaseline="middle",o.fillText(t.icon,32,32);const l=new ns(a),c=new Ae(2.5,2.5),h=new _e({map:l,transparent:!0,side:Ne}),u=new ot(c,h);u.position.y=3.5,this.mesh.add(this.string),this.mesh.add(this.balloon),this.mesh.add(u)}update(t){this.time+=t,this.spawnInvincibleTimer>0&&(this.spawnInvincibleTimer-=t);const e=Math.sin(this.time*this.bobSpeed)*this.floatAmount;this.mesh.position.y=this.baseY+e,this.mesh.rotation.y+=t*.5;const n=this.time*.5%1,i=new Tt().setHSL(n,1,.5),r=this.balloon.material;r.emissive=i,r.emissiveIntensity=.4+Math.sin(this.time*4)*.2,r.color.setHex(16777215)}getMesh(){return this.mesh}getConfig(){return this.config}getBalloonHeight(){return 5}canBeHit(){return this.spawnInvincibleTimer<=0}dispose(t){var n;t.remove(this.mesh),this.balloon.geometry.dispose(),this.balloon.material.dispose(),this.string.geometry.dispose(),this.string.material.dispose();const e=this.mesh.children.find(i=>i instanceof ot&&i.geometry instanceof Ae);e&&(e.geometry.dispose(),e.material.dispose(),(n=e.material.map)==null||n.dispose())}}class Ug{constructor(t,e){b(this,"group");b(this,"glowSphere");b(this,"ring");b(this,"starParticles");b(this,"lifetime",0);b(this,"maxLifetime",2);b(this,"isComplete",!1);b(this,"isCancelled",!1);b(this,"onComplete");this.onComplete=e,this.group=new he,this.group.position.copy(t),this.createSpawnEffect()}createSpawnEffect(){const t=new _e({color:65535,transparent:!0,opacity:.6}),e=new _e({color:16776960,transparent:!0,opacity:.5,side:Ne}),n=new xe(3,32,32);this.glowSphere=new ot(n,t),this.glowSphere.scale.set(0,0,0),this.group.add(this.glowSphere);const i=new Mi(4,.3,16,100);this.ring=new ot(i,e),this.ring.rotation.x=Math.PI/2,this.ring.scale.set(0,0,0),this.group.add(this.ring),this.createStarParticles()}createStarParticles(){const e=new Ee,n=new Float32Array(30*3),i=new Float32Array(30*3);for(let a=0;a<30;a++){const o=a*3,l=Math.random()*Math.PI*2,c=Math.random()*Math.PI,h=5;n[o]=h*Math.sin(c)*Math.cos(l),n[o+1]=h*Math.cos(c),n[o+2]=h*Math.sin(c)*Math.sin(l),i[o]=1,i[o+1]=.84,i[o+2]=0}e.setAttribute("position",new Re(n,3)),e.setAttribute("color",new Re(i,3));const r=new aa({size:.6,vertexColors:!0,transparent:!0,opacity:.9,blending:Yi});this.starParticles=new zl(e,r),this.starParticles.visible=!1,this.group.add(this.starParticles)}update(t){var r;if(this.isComplete||this.isCancelled)return;this.lifetime+=t;const e=this.lifetime/this.maxLifetime;if(e<.25){const a=e/.25,o=this.easeOutBack(a);this.glowSphere.scale.set(o,o,o),this.ring.scale.set(o*1.5,o*1.5,o*1.5)}const n=3;this.ring.rotation.z+=n*t;const i=1+Math.sin(this.lifetime*6)*.15;if(e>=.25&&this.glowSphere.scale.multiplyScalar(i),e>.15&&e<.75){this.starParticles.visible=!0;const a=this.starParticles.geometry.attributes.position.array;for(let o=0;o<a.length;o+=3){const l=8*t,c=a[o],h=a[o+1],u=a[o+2],d=Math.sqrt(c*c+h*h+u*u);d>0&&(a[o]+=c/d*l,a[o+1]+=h/d*l,a[o+2]+=u/d*l)}this.starParticles.geometry.attributes.position.needsUpdate=!0}else this.starParticles.visible=!1;if(e>.75){const a=(e-.75)/.25,o=1-a;this.glowSphere.scale.multiplyScalar(o),this.ring.scale.multiplyScalar(o);const l=1-a;this.glowSphere.material.opacity=l*.6,this.ring.material.opacity=l*.5}this.lifetime>=this.maxLifetime&&!this.isCancelled&&(this.isComplete=!0,(r=this.onComplete)==null||r.call(this))}cancel(){this.isCancelled=!0,this.isComplete=!0}easeOutBack(t){return 1+2.70158*Math.pow(t-1,3)+1.70158*Math.pow(t-1,2)}getMesh(){return this.group}isFinished(){return this.isComplete||this.isCancelled}isCancelledState(){return this.isCancelled}dispose(){this.group.removeFromParent(),this.glowSphere.geometry.dispose(),this.glowSphere.material.dispose(),this.ring.geometry.dispose(),this.ring.material.dispose(),this.starParticles.geometry.dispose(),this.starParticles.material.dispose()}}var nn=(s=>(s.HEALTH="HEALTH",s.SHIELD="SHIELD",s.SPEED="SPEED",s.DAMAGE="DAMAGE",s.MULTISHOT="MULTISHOT",s.BOMB="BOMB",s))(nn||{});const Si={HEALTH:{type:"HEALTH",name:"生命恢复",description:"恢复 30 点生命值",color:65280,duration:0,value:30,icon:"❤️"},SHIELD:{type:"SHIELD",name:"能量护盾",description:"获得 10 秒无敌护盾",color:65535,duration:10,value:1,icon:"🛡️"},SPEED:{type:"SPEED",name:"速度提升",description:"速度提升 50%，持续 15 秒",color:16776960,duration:15,value:1.5,icon:"⚡"},DAMAGE:{type:"DAMAGE",name:"伤害提升",description:"伤害提升 100%，持续 20 秒",color:16729156,duration:20,value:2,icon:"🔥"},MULTISHOT:{type:"MULTISHOT",name:"多重射击",description:"同时发射 3 发子弹，持续 12 秒",color:16711935,duration:12,value:3,icon:"🎯"},BOMB:{type:"BOMB",name:"清屏炸弹",description:"消灭屏幕上所有敌人",color:16746496,duration:0,value:1,icon:"💣"}};class Ng{constructor(t,e){b(this,"scene");b(this,"balloons",[]);b(this,"activePowerUps",[]);b(this,"particleSystem");b(this,"spawnEffects",[]);b(this,"spawningPositions",new Set);b(this,"onPowerUpCollected");b(this,"onPowerUpExpired");b(this,"onBombUsed");b(this,"onBalloonDestroyed");this.scene=t,this.particleSystem=e}spawn(t,e,n){const i=`${Math.floor(t.x)},${Math.floor(t.z)}`;if(this.spawningPositions.has(i))return;this.spawningPositions.add(i);const r=e||this.getRandomPowerUpType(),a=n||(Math.random()>.5?"?":Si[r].icon),o=new Ug(t.clone(),()=>{const l=new Ig(t.clone(),r,a);this.balloons.push(l),this.scene.add(l.getMesh()),this.spawningPositions.delete(i);const c=this.spawnEffects.indexOf(o);c!==-1&&this.spawnEffects.splice(c,1),o.dispose()});this.spawnEffects.push(o),this.scene.add(o.getMesh())}getRandomPowerUpType(){const t=Object.values(nn),e=[25,20,20,20,10,5],n=e.reduce((r,a)=>r+a,0);let i=Math.random()*n;for(let r=0;r<t.length;r++)if(i-=e[r],i<=0)return t[r];return"HEALTH"}update(t){for(const e of this.balloons)e.update(t);for(let e=this.spawnEffects.length-1;e>=0;e--){const n=this.spawnEffects[e];n.update(t),n.isFinished()&&(this.spawnEffects.splice(e,1),n.dispose())}this.updateActivePowerUps(t)}checkProjectileCollisions(t,e){for(let n=this.balloons.length-1;n>=0;n--){const i=this.balloons[n];if(i.canBeHit()){for(const r of t)if(i.getMesh().position.distanceTo(r)<3){const a=i.getConfig().type;e(i,a),this.createExplosion(i.getMesh().position.clone(),a),i.dispose(this.scene),this.balloons.splice(n,1);break}}}}checkPlayerCollisions(t,e){for(let n=this.balloons.length-1;n>=0;n--){const i=this.balloons[n];if(i.getMesh().position.distanceTo(t)<3){const r=i.getConfig().type,a=Si[r];e(r,a),i.dispose(this.scene),this.balloons.splice(n,1);break}}}createExplosion(t,e){this.particleSystem.createExplosion(t,.5)}hasEffect(t){return this.activePowerUps.some(e=>e.type===t)}getBalloons(){return this.balloons}clear(){for(const t of this.balloons)t.dispose(this.scene);this.balloons=[],this.activePowerUps=[];for(const t of this.spawnEffects)t.dispose();this.spawnEffects=[],this.spawningPositions.clear()}getActiveEffects(){return this.activePowerUps}removeBalloon(t){const e=this.balloons.indexOf(t);e!==-1&&(t.dispose(this.scene),this.balloons.splice(e,1))}addActivePowerUp(t,e){var r;const n=Date.now();if(this.activePowerUps.some(a=>a.type===t)){const a=this.activePowerUps.find(o=>o.type===t);a&&e.duration>0&&(a.remainingTime=e.duration,a.startTime=n,console.log(`刷新道具效果: ${e.name}`));return}const i={type:t,config:e,remainingTime:e.duration,startTime:n};this.activePowerUps.push(i),console.log(`激活道具效果: ${e.name}, 持续时间: ${e.duration}秒`),(r=this.onPowerUpCollected)==null||r.call(this,t,e)}updateActivePowerUps(t){var e;for(let n=this.activePowerUps.length-1;n>=0;n--){const i=this.activePowerUps[n];i.config.duration>0&&(i.remainingTime-=t,i.remainingTime<=0&&(console.log(`道具效果过期: ${i.config.name}`),(e=this.onPowerUpExpired)==null||e.call(this,i.type),this.activePowerUps.splice(n,1)))}}}var Jr=(s=>(s.MAX_HEALTH="MAX_HEALTH",s.DAMAGE="DAMAGE",s.FIRE_RATE="FIRE_RATE",s.SPEED="SPEED",s.SHIELD_DURATION="SHIELD_DURATION",s))(Jr||{});const Fr={MAX_HEALTH:{type:"MAX_HEALTH",name:"最大生命值",description:"增加最大生命值",maxLevel:10,baseCost:100,costMultiplier:1.5,effectPerLevel:20},DAMAGE:{type:"DAMAGE",name:"武器伤害",description:"增加子弹伤害",maxLevel:10,baseCost:150,costMultiplier:1.6,effectPerLevel:5},FIRE_RATE:{type:"FIRE_RATE",name:"射速",description:"提高射击速度",maxLevel:8,baseCost:200,costMultiplier:1.7,effectPerLevel:.02},SPEED:{type:"SPEED",name:"飞行速度",description:"提高最大飞行速度",maxLevel:8,baseCost:120,costMultiplier:1.5,effectPerLevel:5},SHIELD_DURATION:{type:"SHIELD_DURATION",name:"护盾持续时间",description:"增加护盾持续时间",maxLevel:5,baseCost:250,costMultiplier:2,effectPerLevel:2}};class Fg{constructor(){b(this,"upgradeLevels",new Map);b(this,"totalScore",0);b(this,"availablePoints",0);Object.values(Jr).forEach(t=>{this.upgradeLevels.set(t,0)})}addScore(t){this.totalScore+=t;const e=Math.floor(this.totalScore/500)-this.availablePoints;e>0&&(this.availablePoints+=e)}getLevel(t){return this.upgradeLevels.get(t)||0}upgrade(t){const e=this.getLevel(t),n=Fr[t];if(e>=n.maxLevel)return!1;const i=this.getUpgradeCost(t);return this.availablePoints<i?!1:(this.availablePoints-=i,this.upgradeLevels.set(t,e+1),!0)}getUpgradeCost(t){const e=this.getLevel(t),n=Fr[t];return Math.floor(n.baseCost*Math.pow(n.costMultiplier,e))}getEffectValue(t){const e=this.getLevel(t),n=Fr[t];return e*n.effectPerLevel}getTotalScore(){return this.totalScore}getAvailablePoints(){return this.availablePoints}reset(){Object.values(Jr).forEach(t=>{this.upgradeLevels.set(t,0)}),this.totalScore=0,this.availablePoints=0}export(){const t={totalScore:this.totalScore,availablePoints:this.availablePoints,upgrades:{}};return this.upgradeLevels.forEach((e,n)=>{t.upgrades[n]=e}),t}import(t){this.totalScore=t.totalScore||0,this.availablePoints=t.availablePoints||0,t.upgrades&&Object.entries(t.upgrades).forEach(([e,n])=>{this.upgradeLevels.set(e,n)})}}class Og{constructor(){b(this,"upgrades");b(this,"baseHealth",100);b(this,"baseDamage",25);b(this,"baseFireRate",.15);b(this,"baseSpeed",100);b(this,"baseShieldDuration",10);this.upgrades=new Fg}getMaxHealth(){return this.baseHealth+this.upgrades.getEffectValue("MAX_HEALTH")}getDamage(t=1){return(this.baseDamage+this.upgrades.getEffectValue("DAMAGE"))*t}getFireRate(){const t=this.upgrades.getEffectValue("FIRE_RATE");return Math.max(.05,this.baseFireRate-t)}getMaxSpeed(){return this.baseSpeed+this.upgrades.getEffectValue("SPEED")}getShieldDuration(){return this.baseShieldDuration+this.upgrades.getEffectValue("SHIELD_DURATION")}getAccuracy(){return .9}getUpgrades(){return this.upgrades}addScore(t){this.upgrades.addScore(t)}reset(){this.upgrades.reset()}}class Bg{constructor(){b(this,"gameLoop");b(this,"gameScene");b(this,"inputHandler");b(this,"gameState");b(this,"playerAircraft");b(this,"playerController");b(this,"playerHealth");b(this,"playerStats");b(this,"thirdPersonCamera");b(this,"playerProjectilePool");b(this,"enemyProjectilePool");b(this,"levelManager");b(this,"particleSystem");b(this,"audioManager");b(this,"powerUpManager");b(this,"hud");b(this,"startMenu");b(this,"radarMinimap");b(this,"lockOnIndicator");b(this,"enemyHealthBars");b(this,"fireCooldown",0);b(this,"missileSystem");b(this,"missileCount",2);b(this,"maxMissiles",10);b(this,"missileFiringScheduled",!1);b(this,"currentLevelId",1);b(this,"waveDelayTimer",0);b(this,"shieldMesh");b(this,"shieldActive",!1);b(this,"lives",3);b(this,"isRespawning",!1);b(this,"respawnTimer",0);b(this,"respawnDelay",2);b(this,"deathPosition");b(this,"audioInitialized",!1);this.gameLoop=new hg,this.gameScene=new ug,this.inputHandler=new dg,this.gameState=new Sg,this.playerStats=new Og,this.playerAircraft=this.createPlayerAircraft(),this.playerController=new fg(this.playerAircraft,this.gameScene.scene),this.playerHealth=new Yl(this.playerStats.getMaxHealth()),this.thirdPersonCamera=new pg(this.gameScene.camera,this.playerAircraft),this.playerProjectilePool=new Qo(this.gameScene.scene),this.enemyProjectilePool=new Qo(this.gameScene.scene),this.levelManager=new Lg(this.gameScene.scene),this.particleSystem=new $l(this.gameScene.scene),this.audioManager=new Dg,this.powerUpManager=new Ng(this.gameScene.scene,this.particleSystem),this.hud=new _g,this.lockOnIndicator=new Mg,this.missileSystem=new gg(this.gameScene.scene,this.particleSystem),this.enemyHealthBars=new xg,this.radarMinimap=new yg,this.startMenu=new vg,this.setupCallbacks(),this.startMenu.setOnStart(t=>{this.lives=t.playerLives,this.audioManager.setSFXVolume(t.soundVolume),this.start()}),this.startMenu.setOnStart(t=>{this.lives=t.playerLives,this.audioManager.setSFXVolume(t.soundVolume),this.gameState.start(),this.start()})}setupCallbacks(){this.playerHealth.onDamage=()=>{!this.shieldActive&&!this.isRespawning&&(this.audioManager.playHit(),this.particleSystem.createHit(this.playerAircraft.position))},this.playerHealth.onDeath=()=>{this.onPlayerDeath()},this.levelManager.onWaveStart=t=>{this.audioManager.playWaveStart(),console.log(`第 ${t} 波开始！`)},this.levelManager.onWaveComplete=t=>{console.log(`第 ${t} 波完成！`),this.waveDelayTimer=te.LEVEL.WAVE_DELAY},this.levelManager.onLevelComplete=t=>{this.audioManager.playLevelUp(),console.log(`关卡 ${t} 完成！`)},this.levelManager.onEnemySpawned=t=>{t.onFire=(e,n)=>{this.enemyProjectilePool.fire(e,n)},t.onDestroy=()=>{const e=t.getConfig(),n=t.getPosition().clone();this.gameState.addScore(e.scoreValue),this.playerStats.addScore(e.scoreValue),this.audioManager.playExplosion(),this.particleSystem.createExplosion(n,e.scale),Math.random()<te.POWERUP.SPAWN_CHANCE&&this.powerUpManager.spawn(n),this.missileCount<this.maxMissiles&&(this.missileCount++,this.hud.updateMissiles(this.missileCount)),t.dispose()}},this.powerUpManager.onPowerUpCollected=(t,e)=>{this.audioManager.playPowerUp(),console.log(`获得道具: ${e.name}`),this.hud.showPowerUp(e.name,e.icon,e.duration),t===nn.HEALTH?this.playerHealth.heal(e.value):t===nn.SHIELD&&this.activateShield()},this.powerUpManager.onPowerUpExpired=t=>{t===nn.SHIELD&&this.deactivateShield()},this.powerUpManager.onBombUsed=()=>{const t=this.levelManager.getEnemies();for(const e of t)e.isAlive()&&e.takeDamage(9999);console.log("炸弹清屏！")}}onBalloonDestroyed(t,e,n){console.log(`气球被打破: ${n.name}`),this.audioManager.playBalloonPop()}onPlayerDeath(){this.lives--,this.deathPosition=this.playerAircraft.position.clone(),this.audioManager.stopEngine(),this.audioManager.playExplosion(),this.particleSystem.createExplosion(this.playerAircraft.position.clone(),2),this.lockOnIndicator.cancelLockOn(),this.playerAircraft.visible=!1,this.lives<=0?(this.gameState.setStatus(Os.GAME_OVER),this.audioManager.playGameOver(),this.hud.showGameOver(this.gameState.getScore()),console.log("游戏结束！最终得分:",this.gameState.getScore())):(this.isRespawning=!0,this.respawnTimer=this.respawnDelay,console.log(`剩余生命: ${this.lives}`))}respawnPlayer(){this.playerHealth.reset(),this.deathPosition&&this.playerAircraft.position.copy(this.deathPosition),this.playerAircraft.rotation.set(0,0,0),this.playerAircraft.quaternion.set(0,0,0,1),this.particleSystem.createExplosion(this.playerAircraft.position.clone(),1.5),this.playerAircraft.visible=!0,this.missileCount=te.MISSILE.STARTING_MISSILES,this.hud.updateMissiles(this.missileCount),this.powerUpManager.addActivePowerUp(nn.SHIELD,Si[nn.SHIELD]),this.audioManager.startEngine(),this.isRespawning=!1,console.log("原地复活成功！")}activateShield(){if(this.shieldActive=!0,!this.shieldMesh){const t=new xe(3,16,16),e=new _e({color:65535,transparent:!0,opacity:.3,side:Ne});this.shieldMesh=new ot(t,e),this.gameScene.scene.add(this.shieldMesh)}this.shieldMesh.visible=!0}deactivateShield(){this.shieldActive=!1,this.shieldMesh&&(this.shieldMesh.visible=!1)}createPlayerAircraft(){const t=new he,e=new It({color:4491519,metalness:.7,roughness:.2}),n=new ye(.5,3.5,12),i=new ot(n,e);i.rotation.x=Math.PI/2,t.add(i);const r=new It({color:1118515,metalness:.9,roughness:.1}),a=new xe(.3,12,12),o=new ot(a,r);o.position.set(0,.3,-.5),o.scale.set(1,.6,1.5),t.add(o);const l=new It({color:3368669,metalness:.6,roughness:.3}),c=new Ki;c.moveTo(0,0),c.lineTo(2,.8),c.lineTo(.3,1),c.lineTo(0,0);const h={depth:.05,bevelEnabled:!1},u=new ua(c,h),d=new ot(u,l);d.rotation.x=Math.PI/2,d.rotation.z=Math.PI,d.position.set(-.3,0,.3),t.add(d);const p=new ot(u,l);p.rotation.x=Math.PI/2,p.position.set(.3,0,.3),t.add(p);const g=new $e(.05,.8,.6),_=new ot(g,l);_.position.set(0,.5,1.5),t.add(_);const m=new ye(.2,.8,8),f=new _e({color:16729088,transparent:!0,opacity:.8}),M=new ot(m,f);return M.rotation.x=-Math.PI/2,M.position.set(0,0,2),M.name="engineGlow",t.add(M),t.traverse(v=>{v instanceof ot&&v.name!=="engineGlow"&&(v.castShadow=!0,v.receiveShadow=!0)}),this.gameScene.scene.add(t),t}update(t){if(this.gameState.getStatus()!==Os.PLAYING)return;this.isRespawning&&(this.respawnTimer-=t,this.respawnTimer<=0&&this.respawnPlayer());const e=this.levelManager.getEnemies().filter(h=>h.isAlive()).map(h=>h.getMesh());this.updateRadarMinimap(),this.updateEnemyHealthBars(e);const n=this.inputHandler.getState();if(!this.isRespawning){this.playerController.update(t,n);const h=this.playerController.getPosition();h.y<-45&&this.gameState.isPlaying()&&(this.playerHealth.takeDamage(1e3),this.audioManager.playExplosion(),this.particleSystem.createExplosion(h.clone(),3));const d=this.playerStats.getFireRate();this.fireCooldown=Math.max(0,this.fireCooldown-t),n.fire&&this.fireCooldown<=0&&(this.playerFire(),this.fireCooldown=d),this.handleMissileInput(n,e)}this.playerProjectilePool.update(t),this.enemyProjectilePool.update(t),this.missileSystem.update(t),this.levelManager.update(t,this.playerController.getPosition()),this.waveDelayTimer>0&&(this.waveDelayTimer-=t,this.waveDelayTimer<=0&&this.levelManager.startWave());const i=this.levelManager.getEnemies().filter(h=>h.isAlive()).map(h=>h.getMesh()),r=this.powerUpManager.hasEffect(nn.DAMAGE)?Si[nn.DAMAGE].value:1;this.playerProjectilePool.checkCollisions(i,h=>{const u=this.levelManager.getEnemies().find(d=>d.getMesh()===h);if(u){const d=this.playerStats.getDamage(r);u.takeDamage(d)}}),this.missileSystem.checkCollisions(i,h=>{const u=this.levelManager.getEnemies().find(d=>d.getMesh()===h);u&&(u.takeDamage(te.MISSILE.DAMAGE),this.audioManager.playMissileExplosion(),this.particleSystem.createExplosion(h.position.clone(),2))}),this.shieldActive||this.enemyProjectilePool.checkCollisions([this.playerAircraft],()=>{this.playerHealth.takeDamage(10)}),this.powerUpManager.update(t);const o=this.playerProjectilePool.getActiveProjectiles().map(h=>h.position);this.powerUpManager.checkProjectileCollisions(o,(h,u)=>{const d=Si[u];this.onBalloonDestroyed(h,u,d)}),this.powerUpManager.checkPlayerCollisions(this.playerController.getPosition(),(h,u)=>{console.log(`收集到道具: ${u.name}`)}),this.particleSystem.update(t),this.shieldMesh&&this.shieldActive&&this.shieldMesh.position.copy(this.playerAircraft.position),this.audioManager.updateEngine(this.playerController.getSpeed());const l=this.playerAircraft.getObjectByName("engineGlow");if(l){const h=.5+this.playerController.getSpeed()/100*1;l.scale.setScalar(h)}this.thirdPersonCamera.update(),this.updateEnemyHealthBars(e),this.hud.updateHealth(this.playerHealth.getHealthPercent()/(this.playerStats.getMaxHealth()/100)),this.hud.updateSpeed(this.playerController.getSpeed()),this.hud.updateScore(this.gameState.getScore()),this.hud.updateEnemies(this.levelManager.getAliveEnemyCount());const c=this.levelManager.getTotalEnemyCount()-this.levelManager.getSpawnedEnemyCount();this.hud.updateRemainingEnemies(c),this.hud.updateLives(this.lives)}updateRadarMinimap(){const t=this.playerController.getPosition(),i=this.levelManager.getEnemies().filter(o=>o.isAlive()).map(o=>({position:o.getPosition(),isSpawning:this.levelManager.isEnemySpawning(o)})),a=this.powerUpManager.getBalloons().map(o=>({position:o.getMesh().position}));this.radarMinimap.update(t,i,a,this.playerController.getQuaternion())}updateEnemyHealthBars(t){const i=this.levelManager.getEnemies().filter(r=>r.isAlive()).map(r=>{const a=r.getHealth(),o=r.getConfig();return{mesh:r.getMesh(),currentHealth:a.current,maxHealth:o.health}});this.enemyHealthBars.update(i,this.gameScene.camera,this.playerController.getPosition())}handleMissileInput(t,e){const n=this.enemyHealthBars.getFirstEnemyScreenPos();if(this.missileCount<=0)if(t.missile){this.lockOnIndicator.setNoMissiles(!0);return}else this.lockOnIndicator.setNoMissiles(!1);else this.lockOnIndicator.setNoMissiles(!1);if(this.lockOnIndicator.isLocking()){if(this.lockOnIndicator.update(this.playerController.getPosition(),e,this.gameScene.camera,.016,n)){const r=this.lockOnIndicator.getCurrentTarget();r&&this.missileCount>0&&!this.missileFiringScheduled&&(this.missileFiringScheduled=!0,setTimeout(()=>{this.fireMissile(r),this.lockOnIndicator.onMissileFired(),this.missileFiringScheduled=!1},200))}}else t.missile?(this.audioManager.playMissileLock(),this.lockOnIndicator.setNoMissiles(!1),this.lockOnIndicator.startLockOn()):this.lockOnIndicator.cancelLockOn()}fireMissile(t){if(this.missileCount<=0)return;const e=this.playerController.getPosition().clone(),n=this.playerController.getQuaternion(),i=new R(0,.3,-.5);i.applyQuaternion(n),e.add(i);const r=new R(0,0,-1);r.applyQuaternion(n),this.missileSystem.fire(e,r,t),this.audioManager.playMissileLaunch(),this.missileCount--,this.hud.updateMissiles(this.missileCount),this.lockOnIndicator.onMissileFired()}playerFire(){const t=this.playerController.getPosition().clone(),e=this.playerController.getQuaternion(),n=new R(0,0,-1);n.applyQuaternion(e),t.add(n.clone().multiplyScalar(2)),this.audioManager.playShoot();const r=(1-this.playerStats.getAccuracy())*.12,a=(Math.random()-.5)*r;if(n.applyAxisAngle(new R(0,1,0),a),this.powerUpManager.hasEffect(nn.MULTISHOT))for(let l=-1;l<=1;l++){const c=n.clone();c.applyAxisAngle(new R(0,1,0),l*.15),this.playerProjectilePool.fire(t.clone(),c.normalize())}else this.playerProjectilePool.fire(t,n)}render(){this.gameScene.render()}start(){this.gameState.setStatus(Os.PLAYING),this.audioInitialized||(this.audioManager.resume(),this.audioInitialized=!0),this.levelManager.loadLevel(this.currentLevelId),setTimeout(()=>{this.levelManager.startWave()},te.LEVEL.START_DELAY*1e3),this.missileCount=te.MISSILE.STARTING_MISSILES,this.hud.updateMissiles(this.missileCount),this.gameLoop.start(t=>this.update(t),()=>this.render()),this.audioManager.startEngine(),console.log("游戏开始！")}stop(){this.gameLoop.stop(),this.audioManager.stopEngine()}dispose(){this.stop(),this.levelManager.clear(),this.particleSystem.clear(),this.powerUpManager.clear(),this.radarMinimap.dispose(),this.gameScene.dispose()}}function zg(){const s=document.getElementById("loading-screen");s&&s.classList.add("hidden")}function tl(s){const t=document.getElementById("loading-screen");t&&(t.innerHTML=`
      <div style="text-align: center; color: white;">
        <h1 style="font-size: 32px; margin-bottom: 20px;">⚠️ 加载失败</h1>
        <p style="font-size: 16px; opacity: 0.8;">${s}</p>
        <p style="font-size: 14px; margin-top: 20px; opacity: 0.6;">
          请尝试刷新页面或使用其他浏览器
        </p>
      </div>
    `)}function Hg(){try{const s=document.createElement("canvas");return(s.getContext("webgl")||s.getContext("experimental-webgl"))!==null}catch{return!1}}async function el(){if(!Hg()){tl("您的浏览器不支持 WebGL");return}try{const s=new Bg;zg(),console.log("🎮 Air Supreme - 3D 空战游戏"),console.log("📖 控制说明:"),console.log("  W/S - 俯仰（机头上下）"),console.log("  A/D - 偏航（机头左右）"),console.log("  Q/E - 翻滚（机翼倾斜）"),console.log("  空格 - 开火"),console.log("  Shift - 加速"),console.log(""),console.log("📱 移动端: 使用虚拟摇杆和按钮控制"),s.start(),window.addEventListener("beforeunload",()=>{s.dispose()})}catch(s){console.error("游戏初始化失败:",s),tl("游戏初始化失败，请查看控制台了解详情")}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>el()):el();
