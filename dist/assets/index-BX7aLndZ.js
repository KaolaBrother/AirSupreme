var Rc=Object.defineProperty;var Cc=(s,t,e)=>t in s?Rc(s,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):s[t]=e;var I=(s,t,e)=>Cc(s,typeof t!="symbol"?t+"":t,e);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function e(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(i){if(i.ep)return;i.ep=!0;const r=e(i);fetch(i.href,r)}})();/**
 * @license
 * Copyright 2010-2023 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Lr="160",Pc=0,jr=1,Lc=2,Io=1,Uo=2,hn=3,wn=0,Ie=1,Ze=2,yn=0,fi=1,Qr=2,ta=3,ea=4,Dc=5,Nn=100,Ic=101,Uc=102,na=103,ia=104,Nc=200,Oc=201,Fc=202,Bc=203,vr=204,xr=205,zc=206,Gc=207,Hc=208,Vc=209,kc=210,Wc=211,Xc=212,qc=213,Yc=214,$c=0,Kc=1,Zc=2,Ms=3,Jc=4,jc=5,Qc=6,tl=7,No=0,el=1,nl=2,En=0,il=1,sl=2,rl=3,al=4,ol=5,cl=6,Oo=300,mi=301,gi=302,Mr=303,Sr=304,Rs=306,yr=1e3,Je=1001,Er=1002,Re=1003,sa=1004,Bs=1005,Ve=1006,ll=1007,Ni=1008,Tn=1009,hl=1010,ul=1011,Dr=1012,Fo=1013,Mn=1014,Sn=1015,Oi=1016,Bo=1017,zo=1018,Fn=1020,dl=1021,je=1023,fl=1024,pl=1025,Bn=1026,_i=1027,ml=1028,Go=1029,gl=1030,Ho=1031,Vo=1033,zs=33776,Gs=33777,Hs=33778,Vs=33779,ra=35840,aa=35841,oa=35842,ca=35843,ko=36196,la=37492,ha=37496,ua=37808,da=37809,fa=37810,pa=37811,ma=37812,ga=37813,_a=37814,va=37815,xa=37816,Ma=37817,Sa=37818,ya=37819,Ea=37820,Ta=37821,ks=36492,Aa=36494,wa=36495,_l=36283,ba=36284,Ra=36285,Ca=36286,Wo=3e3,zn=3001,vl=3200,xl=3201,Xo=0,Ml=1,We="",ve="srgb",dn="srgb-linear",Ir="display-p3",Cs="display-p3-linear",Ss="linear",Qt="srgb",ys="rec709",Es="p3",Xn=7680,Pa=519,Sl=512,yl=513,El=514,qo=515,Tl=516,Al=517,wl=518,bl=519,La=35044,Da="300 es",Tr=1035,un=2e3,Ts=2001;class xi{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const i=this._listeners[t];if(i!==void 0){const r=i.indexOf(e);r!==-1&&i.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const n=this._listeners[t.type];if(n!==void 0){t.target=this;const i=n.slice(0);for(let r=0,a=i.length;r<a;r++)i[r].call(this,t);t.target=null}}}const Se=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let Ia=1234567;const Ci=Math.PI/180,Fi=180/Math.PI;function kn(){const s=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Se[s&255]+Se[s>>8&255]+Se[s>>16&255]+Se[s>>24&255]+"-"+Se[t&255]+Se[t>>8&255]+"-"+Se[t>>16&15|64]+Se[t>>24&255]+"-"+Se[e&63|128]+Se[e>>8&255]+"-"+Se[e>>16&255]+Se[e>>24&255]+Se[n&255]+Se[n>>8&255]+Se[n>>16&255]+Se[n>>24&255]).toLowerCase()}function xe(s,t,e){return Math.max(t,Math.min(e,s))}function Ur(s,t){return(s%t+t)%t}function Rl(s,t,e,n,i){return n+(s-t)*(i-n)/(e-t)}function Cl(s,t,e){return s!==t?(e-s)/(t-s):0}function Pi(s,t,e){return(1-e)*s+e*t}function Pl(s,t,e,n){return Pi(s,t,1-Math.exp(-e*n))}function Ll(s,t=1){return t-Math.abs(Ur(s,t*2)-t)}function Dl(s,t,e){return s<=t?0:s>=e?1:(s=(s-t)/(e-t),s*s*(3-2*s))}function Il(s,t,e){return s<=t?0:s>=e?1:(s=(s-t)/(e-t),s*s*s*(s*(s*6-15)+10))}function Ul(s,t){return s+Math.floor(Math.random()*(t-s+1))}function Nl(s,t){return s+Math.random()*(t-s)}function Ol(s){return s*(.5-Math.random())}function Fl(s){s!==void 0&&(Ia=s);let t=Ia+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function Bl(s){return s*Ci}function zl(s){return s*Fi}function Ar(s){return(s&s-1)===0&&s!==0}function Gl(s){return Math.pow(2,Math.ceil(Math.log(s)/Math.LN2))}function As(s){return Math.pow(2,Math.floor(Math.log(s)/Math.LN2))}function Hl(s,t,e,n,i){const r=Math.cos,a=Math.sin,o=r(e/2),c=a(e/2),l=r((t+n)/2),h=a((t+n)/2),u=r((t-n)/2),d=a((t-n)/2),m=r((n-t)/2),g=a((n-t)/2);switch(i){case"XYX":s.set(o*h,c*u,c*d,o*l);break;case"YZY":s.set(c*d,o*h,c*u,o*l);break;case"ZXZ":s.set(c*u,c*d,o*h,o*l);break;case"XZX":s.set(o*h,c*g,c*m,o*l);break;case"YXY":s.set(c*m,o*h,c*g,o*l);break;case"ZYZ":s.set(c*g,c*m,o*h,o*l);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+i)}}function ci(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("Invalid component type.")}}function Ae(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("Invalid component type.")}}const Vl={DEG2RAD:Ci,RAD2DEG:Fi,generateUUID:kn,clamp:xe,euclideanModulo:Ur,mapLinear:Rl,inverseLerp:Cl,lerp:Pi,damp:Pl,pingpong:Ll,smoothstep:Dl,smootherstep:Il,randInt:Ul,randFloat:Nl,randFloatSpread:Ol,seededRandom:Fl,degToRad:Bl,radToDeg:zl,isPowerOfTwo:Ar,ceilPowerOfTwo:Gl,floorPowerOfTwo:As,setQuaternionFromProperEuler:Hl,normalize:Ae,denormalize:ci};class lt{constructor(t=0,e=0){lt.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,i=t.elements;return this.x=i[0]*e+i[3]*n+i[6],this.y=i[1]*e+i[4]*n+i[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(xe(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),i=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*n-a*i+t.x,this.y=r*i+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Xt{constructor(t,e,n,i,r,a,o,c,l){Xt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,i,r,a,o,c,l)}set(t,e,n,i,r,a,o,c,l){const h=this.elements;return h[0]=t,h[1]=i,h[2]=o,h[3]=e,h[4]=r,h[5]=c,h[6]=n,h[7]=a,h[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,r=this.elements,a=n[0],o=n[3],c=n[6],l=n[1],h=n[4],u=n[7],d=n[2],m=n[5],g=n[8],_=i[0],p=i[3],f=i[6],y=i[1],v=i[4],S=i[7],D=i[2],w=i[5],b=i[8];return r[0]=a*_+o*y+c*D,r[3]=a*p+o*v+c*w,r[6]=a*f+o*S+c*b,r[1]=l*_+h*y+u*D,r[4]=l*p+h*v+u*w,r[7]=l*f+h*S+u*b,r[2]=d*_+m*y+g*D,r[5]=d*p+m*v+g*w,r[8]=d*f+m*S+g*b,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],c=t[6],l=t[7],h=t[8];return e*a*h-e*o*l-n*r*h+n*o*c+i*r*l-i*a*c}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],c=t[6],l=t[7],h=t[8],u=h*a-o*l,d=o*c-h*r,m=l*r-a*c,g=e*u+n*d+i*m;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const _=1/g;return t[0]=u*_,t[1]=(i*l-h*n)*_,t[2]=(o*n-i*a)*_,t[3]=d*_,t[4]=(h*e-i*c)*_,t[5]=(i*r-o*e)*_,t[6]=m*_,t[7]=(n*c-l*e)*_,t[8]=(a*e-n*r)*_,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,i,r,a,o){const c=Math.cos(r),l=Math.sin(r);return this.set(n*c,n*l,-n*(c*a+l*o)+a+t,-i*l,i*c,-i*(-l*a+c*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(Ws.makeScale(t,e)),this}rotate(t){return this.premultiply(Ws.makeRotation(-t)),this}translate(t,e){return this.premultiply(Ws.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<9;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const Ws=new Xt;function Yo(s){for(let t=s.length-1;t>=0;--t)if(s[t]>=65535)return!0;return!1}function ws(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function kl(){const s=ws("canvas");return s.style.display="block",s}const Ua={};function Li(s){s in Ua||(Ua[s]=!0,console.warn(s))}const Na=new Xt().set(.8224621,.177538,0,.0331941,.9668058,0,.0170827,.0723974,.9105199),Oa=new Xt().set(1.2249401,-.2249404,0,-.0420569,1.0420571,0,-.0196376,-.0786361,1.0982735),qi={[dn]:{transfer:Ss,primaries:ys,toReference:s=>s,fromReference:s=>s},[ve]:{transfer:Qt,primaries:ys,toReference:s=>s.convertSRGBToLinear(),fromReference:s=>s.convertLinearToSRGB()},[Cs]:{transfer:Ss,primaries:Es,toReference:s=>s.applyMatrix3(Oa),fromReference:s=>s.applyMatrix3(Na)},[Ir]:{transfer:Qt,primaries:Es,toReference:s=>s.convertSRGBToLinear().applyMatrix3(Oa),fromReference:s=>s.applyMatrix3(Na).convertLinearToSRGB()}},Wl=new Set([dn,Cs]),Kt={enabled:!0,_workingColorSpace:dn,get workingColorSpace(){return this._workingColorSpace},set workingColorSpace(s){if(!Wl.has(s))throw new Error(`Unsupported working color space, "${s}".`);this._workingColorSpace=s},convert:function(s,t,e){if(this.enabled===!1||t===e||!t||!e)return s;const n=qi[t].toReference,i=qi[e].fromReference;return i(n(s))},fromWorkingColorSpace:function(s,t){return this.convert(s,this._workingColorSpace,t)},toWorkingColorSpace:function(s,t){return this.convert(s,t,this._workingColorSpace)},getPrimaries:function(s){return qi[s].primaries},getTransfer:function(s){return s===We?Ss:qi[s].transfer}};function pi(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function Xs(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}let qn;class $o{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{qn===void 0&&(qn=ws("canvas")),qn.width=t.width,qn.height=t.height;const n=qn.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=qn}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=ws("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const i=n.getImageData(0,0,t.width,t.height),r=i.data;for(let a=0;a<r.length;a++)r[a]=pi(r[a]/255)*255;return n.putImageData(i,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(pi(e[n]/255)*255):e[n]=pi(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let Xl=0;class Ko{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Xl++}),this.uuid=kn(),this.data=t,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let a=0,o=i.length;a<o;a++)i[a].isDataTexture?r.push(qs(i[a].image)):r.push(qs(i[a]))}else r=qs(i);n.url=r}return e||(t.images[this.uuid]=n),n}}function qs(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?$o.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let ql=0;class Ue extends xi{constructor(t=Ue.DEFAULT_IMAGE,e=Ue.DEFAULT_MAPPING,n=Je,i=Je,r=Ve,a=Ni,o=je,c=Tn,l=Ue.DEFAULT_ANISOTROPY,h=We){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:ql++}),this.uuid=kn(),this.name="",this.source=new Ko(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=a,this.anisotropy=l,this.format=o,this.internalFormat=null,this.type=c,this.offset=new lt(0,0),this.repeat=new lt(1,1),this.center=new lt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Xt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,typeof h=="string"?this.colorSpace=h:(Li("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=h===zn?ve:We),this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.needsPMREMUpdate=!1}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Oo)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case yr:t.x=t.x-Math.floor(t.x);break;case Je:t.x=t.x<0?0:1;break;case Er:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case yr:t.y=t.y-Math.floor(t.y);break;case Je:t.y=t.y<0?0:1;break;case Er:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}get encoding(){return Li("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace===ve?zn:Wo}set encoding(t){Li("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=t===zn?ve:We}}Ue.DEFAULT_IMAGE=null;Ue.DEFAULT_MAPPING=Oo;Ue.DEFAULT_ANISOTROPY=1;class _e{constructor(t=0,e=0,n=0,i=1){_e.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=i}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,i){return this.x=t,this.y=e,this.z=n,this.w=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*i+a[12]*r,this.y=a[1]*e+a[5]*n+a[9]*i+a[13]*r,this.z=a[2]*e+a[6]*n+a[10]*i+a[14]*r,this.w=a[3]*e+a[7]*n+a[11]*i+a[15]*r,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,i,r;const c=t.elements,l=c[0],h=c[4],u=c[8],d=c[1],m=c[5],g=c[9],_=c[2],p=c[6],f=c[10];if(Math.abs(h-d)<.01&&Math.abs(u-_)<.01&&Math.abs(g-p)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+_)<.1&&Math.abs(g+p)<.1&&Math.abs(l+m+f-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const v=(l+1)/2,S=(m+1)/2,D=(f+1)/2,w=(h+d)/4,b=(u+_)/4,G=(g+p)/4;return v>S&&v>D?v<.01?(n=0,i=.707106781,r=.707106781):(n=Math.sqrt(v),i=w/n,r=b/n):S>D?S<.01?(n=.707106781,i=0,r=.707106781):(i=Math.sqrt(S),n=w/i,r=G/i):D<.01?(n=.707106781,i=.707106781,r=0):(r=Math.sqrt(D),n=b/r,i=G/r),this.set(n,i,r,e),this}let y=Math.sqrt((p-g)*(p-g)+(u-_)*(u-_)+(d-h)*(d-h));return Math.abs(y)<.001&&(y=1),this.x=(p-g)/y,this.y=(u-_)/y,this.z=(d-h)/y,this.w=Math.acos((l+m+f-1)/2),this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Yl extends xi{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new _e(0,0,t,e),this.scissorTest=!1,this.viewport=new _e(0,0,t,e);const i={width:t,height:e,depth:1};n.encoding!==void 0&&(Li("THREE.WebGLRenderTarget: option.encoding has been replaced by option.colorSpace."),n.colorSpace=n.encoding===zn?ve:We),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Ve,depthBuffer:!0,stencilBuffer:!1,depthTexture:null,samples:0},n),this.texture=new Ue(i,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.flipY=!1,this.texture.generateMipmaps=n.generateMipmaps,this.texture.internalFormat=n.internalFormat,this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}setSize(t,e,n=1){(this.width!==t||this.height!==e||this.depth!==n)&&(this.width=t,this.height=e,this.depth=n,this.texture.image.width=t,this.texture.image.height=e,this.texture.image.depth=n,this.dispose()),this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.texture=t.texture.clone(),this.texture.isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new Ko(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Gn extends Yl{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class Zo extends Ue{constructor(t=null,e=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=Re,this.minFilter=Re,this.wrapR=Je,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class $l extends Ue{constructor(t=null,e=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=Re,this.minFilter=Re,this.wrapR=Je,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Mi{constructor(t=0,e=0,n=0,i=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=i}static slerpFlat(t,e,n,i,r,a,o){let c=n[i+0],l=n[i+1],h=n[i+2],u=n[i+3];const d=r[a+0],m=r[a+1],g=r[a+2],_=r[a+3];if(o===0){t[e+0]=c,t[e+1]=l,t[e+2]=h,t[e+3]=u;return}if(o===1){t[e+0]=d,t[e+1]=m,t[e+2]=g,t[e+3]=_;return}if(u!==_||c!==d||l!==m||h!==g){let p=1-o;const f=c*d+l*m+h*g+u*_,y=f>=0?1:-1,v=1-f*f;if(v>Number.EPSILON){const D=Math.sqrt(v),w=Math.atan2(D,f*y);p=Math.sin(p*w)/D,o=Math.sin(o*w)/D}const S=o*y;if(c=c*p+d*S,l=l*p+m*S,h=h*p+g*S,u=u*p+_*S,p===1-o){const D=1/Math.sqrt(c*c+l*l+h*h+u*u);c*=D,l*=D,h*=D,u*=D}}t[e]=c,t[e+1]=l,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,i,r,a){const o=n[i],c=n[i+1],l=n[i+2],h=n[i+3],u=r[a],d=r[a+1],m=r[a+2],g=r[a+3];return t[e]=o*g+h*u+c*m-l*d,t[e+1]=c*g+h*d+l*u-o*m,t[e+2]=l*g+h*m+o*d-c*u,t[e+3]=h*g-o*u-c*d-l*m,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,i){return this._x=t,this._y=e,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,i=t._y,r=t._z,a=t._order,o=Math.cos,c=Math.sin,l=o(n/2),h=o(i/2),u=o(r/2),d=c(n/2),m=c(i/2),g=c(r/2);switch(a){case"XYZ":this._x=d*h*u+l*m*g,this._y=l*m*u-d*h*g,this._z=l*h*g+d*m*u,this._w=l*h*u-d*m*g;break;case"YXZ":this._x=d*h*u+l*m*g,this._y=l*m*u-d*h*g,this._z=l*h*g-d*m*u,this._w=l*h*u+d*m*g;break;case"ZXY":this._x=d*h*u-l*m*g,this._y=l*m*u+d*h*g,this._z=l*h*g+d*m*u,this._w=l*h*u-d*m*g;break;case"ZYX":this._x=d*h*u-l*m*g,this._y=l*m*u+d*h*g,this._z=l*h*g-d*m*u,this._w=l*h*u+d*m*g;break;case"YZX":this._x=d*h*u+l*m*g,this._y=l*m*u+d*h*g,this._z=l*h*g-d*m*u,this._w=l*h*u-d*m*g;break;case"XZY":this._x=d*h*u-l*m*g,this._y=l*m*u-d*h*g,this._z=l*h*g+d*m*u,this._w=l*h*u+d*m*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,i=Math.sin(n);return this._x=t.x*i,this._y=t.y*i,this._z=t.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],i=e[4],r=e[8],a=e[1],o=e[5],c=e[9],l=e[2],h=e[6],u=e[10],d=n+o+u;if(d>0){const m=.5/Math.sqrt(d+1);this._w=.25/m,this._x=(h-c)*m,this._y=(r-l)*m,this._z=(a-i)*m}else if(n>o&&n>u){const m=2*Math.sqrt(1+n-o-u);this._w=(h-c)/m,this._x=.25*m,this._y=(i+a)/m,this._z=(r+l)/m}else if(o>u){const m=2*Math.sqrt(1+o-n-u);this._w=(r-l)/m,this._x=(i+a)/m,this._y=.25*m,this._z=(c+h)/m}else{const m=2*Math.sqrt(1+u-n-o);this._w=(a-i)/m,this._x=(r+l)/m,this._y=(c+h)/m,this._z=.25*m}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(xe(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const i=Math.min(1,e/n);return this.slerp(t,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,i=t._y,r=t._z,a=t._w,o=e._x,c=e._y,l=e._z,h=e._w;return this._x=n*h+a*o+i*l-r*c,this._y=i*h+a*c+r*o-n*l,this._z=r*h+a*l+n*c-i*o,this._w=a*h-n*o-i*c-r*l,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,i=this._y,r=this._z,a=this._w;let o=a*t._w+n*t._x+i*t._y+r*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=a,this._x=n,this._y=i,this._z=r,this;const c=1-o*o;if(c<=Number.EPSILON){const m=1-e;return this._w=m*a+e*this._w,this._x=m*n+e*this._x,this._y=m*i+e*this._y,this._z=m*r+e*this._z,this.normalize(),this}const l=Math.sqrt(c),h=Math.atan2(l,o),u=Math.sin((1-e)*h)/l,d=Math.sin(e*h)/l;return this._w=a*u+this._w*d,this._x=n*u+this._x*d,this._y=i*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=Math.random(),e=Math.sqrt(1-t),n=Math.sqrt(t),i=2*Math.PI*Math.random(),r=2*Math.PI*Math.random();return this.set(e*Math.cos(i),n*Math.sin(r),n*Math.cos(r),e*Math.sin(i))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class C{constructor(t=0,e=0,n=0){C.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(Fa.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(Fa.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,i=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*i,this.y=r[1]*e+r[4]*n+r[7]*i,this.z=r[2]*e+r[5]*n+r[8]*i,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,r=t.elements,a=1/(r[3]*e+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*i+r[12])*a,this.y=(r[1]*e+r[5]*n+r[9]*i+r[13])*a,this.z=(r[2]*e+r[6]*n+r[10]*i+r[14])*a,this}applyQuaternion(t){const e=this.x,n=this.y,i=this.z,r=t.x,a=t.y,o=t.z,c=t.w,l=2*(a*i-o*n),h=2*(o*e-r*i),u=2*(r*n-a*e);return this.x=e+c*l+a*u-o*h,this.y=n+c*h+o*l-r*u,this.z=i+c*u+r*h-a*l,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,i=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*i,this.y=r[1]*e+r[5]*n+r[9]*i,this.z=r[2]*e+r[6]*n+r[10]*i,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,i=t.y,r=t.z,a=e.x,o=e.y,c=e.z;return this.x=i*c-r*o,this.y=r*a-n*c,this.z=n*o-i*a,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return Ys.copy(this).projectOnVector(t),this.sub(Ys)}reflect(t){return this.sub(Ys.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(xe(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,i=this.z-t.z;return e*e+n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const i=Math.sin(e)*t;return this.x=i*Math.sin(n),this.y=Math.cos(e)*t,this.z=i*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),i=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=i,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=(Math.random()-.5)*2,e=Math.random()*Math.PI*2,n=Math.sqrt(1-t**2);return this.x=n*Math.cos(e),this.y=n*Math.sin(e),this.z=t,this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Ys=new C,Fa=new Mi;class Wn{constructor(t=new C(1/0,1/0,1/0),e=new C(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(qe.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(qe.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=qe.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,qe):qe.fromBufferAttribute(r,a),qe.applyMatrix4(t.matrixWorld),this.expandByPoint(qe);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Yi.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Yi.copy(n.boundingBox)),Yi.applyMatrix4(t.matrixWorld),this.union(Yi)}const i=t.children;for(let r=0,a=i.length;r<a;r++)this.expandByObject(i[r],e);return this}containsPoint(t){return!(t.x<this.min.x||t.x>this.max.x||t.y<this.min.y||t.y>this.max.y||t.z<this.min.z||t.z>this.max.z)}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return!(t.max.x<this.min.x||t.min.x>this.max.x||t.max.y<this.min.y||t.min.y>this.max.y||t.max.z<this.min.z||t.min.z>this.max.z)}intersectsSphere(t){return this.clampPoint(t.center,qe),qe.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Ei),$i.subVectors(this.max,Ei),Yn.subVectors(t.a,Ei),$n.subVectors(t.b,Ei),Kn.subVectors(t.c,Ei),fn.subVectors($n,Yn),pn.subVectors(Kn,$n),Cn.subVectors(Yn,Kn);let e=[0,-fn.z,fn.y,0,-pn.z,pn.y,0,-Cn.z,Cn.y,fn.z,0,-fn.x,pn.z,0,-pn.x,Cn.z,0,-Cn.x,-fn.y,fn.x,0,-pn.y,pn.x,0,-Cn.y,Cn.x,0];return!$s(e,Yn,$n,Kn,$i)||(e=[1,0,0,0,1,0,0,0,1],!$s(e,Yn,$n,Kn,$i))?!1:(Ki.crossVectors(fn,pn),e=[Ki.x,Ki.y,Ki.z],$s(e,Yn,$n,Kn,$i))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,qe).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(qe).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(rn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),rn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),rn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),rn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),rn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),rn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),rn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),rn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(rn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const rn=[new C,new C,new C,new C,new C,new C,new C,new C],qe=new C,Yi=new Wn,Yn=new C,$n=new C,Kn=new C,fn=new C,pn=new C,Cn=new C,Ei=new C,$i=new C,Ki=new C,Pn=new C;function $s(s,t,e,n,i){for(let r=0,a=s.length-3;r<=a;r+=3){Pn.fromArray(s,r);const o=i.x*Math.abs(Pn.x)+i.y*Math.abs(Pn.y)+i.z*Math.abs(Pn.z),c=t.dot(Pn),l=e.dot(Pn),h=n.dot(Pn);if(Math.max(-Math.max(c,l,h),Math.min(c,l,h))>o)return!1}return!0}const Kl=new Wn,Ti=new C,Ks=new C;class Vi{constructor(t=new C,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):Kl.setFromPoints(t).getCenter(n);let i=0;for(let r=0,a=t.length;r<a;r++)i=Math.max(i,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(i),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Ti.subVectors(t,this.center);const e=Ti.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),i=(n-this.radius)*.5;this.center.addScaledVector(Ti,i/n),this.radius+=i}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Ks.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Ti.copy(t.center).add(Ks)),this.expandByPoint(Ti.copy(t.center).sub(Ks))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const an=new C,Zs=new C,Zi=new C,mn=new C,Js=new C,Ji=new C,js=new C;class Zl{constructor(t=new C,e=new C(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,an)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=an.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(an.copy(this.origin).addScaledVector(this.direction,e),an.distanceToSquared(t))}distanceSqToSegment(t,e,n,i){Zs.copy(t).add(e).multiplyScalar(.5),Zi.copy(e).sub(t).normalize(),mn.copy(this.origin).sub(Zs);const r=t.distanceTo(e)*.5,a=-this.direction.dot(Zi),o=mn.dot(this.direction),c=-mn.dot(Zi),l=mn.lengthSq(),h=Math.abs(1-a*a);let u,d,m,g;if(h>0)if(u=a*c-o,d=a*o-c,g=r*h,u>=0)if(d>=-g)if(d<=g){const _=1/h;u*=_,d*=_,m=u*(u+a*d+2*o)+d*(a*u+d+2*c)+l}else d=r,u=Math.max(0,-(a*d+o)),m=-u*u+d*(d+2*c)+l;else d=-r,u=Math.max(0,-(a*d+o)),m=-u*u+d*(d+2*c)+l;else d<=-g?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-c),r),m=-u*u+d*(d+2*c)+l):d<=g?(u=0,d=Math.min(Math.max(-r,-c),r),m=d*(d+2*c)+l):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-c),r),m=-u*u+d*(d+2*c)+l);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),m=-u*u+d*(d+2*c)+l;return n&&n.copy(this.origin).addScaledVector(this.direction,u),i&&i.copy(Zs).addScaledVector(Zi,d),m}intersectSphere(t,e){an.subVectors(t.center,this.origin);const n=an.dot(this.direction),i=an.dot(an)-n*n,r=t.radius*t.radius;if(i>r)return null;const a=Math.sqrt(r-i),o=n-a,c=n+a;return c<0?null:o<0?this.at(c,e):this.at(o,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,i,r,a,o,c;const l=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return l>=0?(n=(t.min.x-d.x)*l,i=(t.max.x-d.x)*l):(n=(t.max.x-d.x)*l,i=(t.min.x-d.x)*l),h>=0?(r=(t.min.y-d.y)*h,a=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,a=(t.min.y-d.y)*h),n>a||r>i||((r>n||isNaN(n))&&(n=r),(a<i||isNaN(i))&&(i=a),u>=0?(o=(t.min.z-d.z)*u,c=(t.max.z-d.z)*u):(o=(t.max.z-d.z)*u,c=(t.min.z-d.z)*u),n>c||o>i)||((o>n||n!==n)&&(n=o),(c<i||i!==i)&&(i=c),i<0)?null:this.at(n>=0?n:i,e)}intersectsBox(t){return this.intersectBox(t,an)!==null}intersectTriangle(t,e,n,i,r){Js.subVectors(e,t),Ji.subVectors(n,t),js.crossVectors(Js,Ji);let a=this.direction.dot(js),o;if(a>0){if(i)return null;o=1}else if(a<0)o=-1,a=-a;else return null;mn.subVectors(this.origin,t);const c=o*this.direction.dot(Ji.crossVectors(mn,Ji));if(c<0)return null;const l=o*this.direction.dot(Js.cross(mn));if(l<0||c+l>a)return null;const h=-o*mn.dot(js);return h<0?null:this.at(h/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class ee{constructor(t,e,n,i,r,a,o,c,l,h,u,d,m,g,_,p){ee.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,i,r,a,o,c,l,h,u,d,m,g,_,p)}set(t,e,n,i,r,a,o,c,l,h,u,d,m,g,_,p){const f=this.elements;return f[0]=t,f[4]=e,f[8]=n,f[12]=i,f[1]=r,f[5]=a,f[9]=o,f[13]=c,f[2]=l,f[6]=h,f[10]=u,f[14]=d,f[3]=m,f[7]=g,f[11]=_,f[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ee().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,i=1/Zn.setFromMatrixColumn(t,0).length(),r=1/Zn.setFromMatrixColumn(t,1).length(),a=1/Zn.setFromMatrixColumn(t,2).length();return e[0]=n[0]*i,e[1]=n[1]*i,e[2]=n[2]*i,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,i=t.y,r=t.z,a=Math.cos(n),o=Math.sin(n),c=Math.cos(i),l=Math.sin(i),h=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){const d=a*h,m=a*u,g=o*h,_=o*u;e[0]=c*h,e[4]=-c*u,e[8]=l,e[1]=m+g*l,e[5]=d-_*l,e[9]=-o*c,e[2]=_-d*l,e[6]=g+m*l,e[10]=a*c}else if(t.order==="YXZ"){const d=c*h,m=c*u,g=l*h,_=l*u;e[0]=d+_*o,e[4]=g*o-m,e[8]=a*l,e[1]=a*u,e[5]=a*h,e[9]=-o,e[2]=m*o-g,e[6]=_+d*o,e[10]=a*c}else if(t.order==="ZXY"){const d=c*h,m=c*u,g=l*h,_=l*u;e[0]=d-_*o,e[4]=-a*u,e[8]=g+m*o,e[1]=m+g*o,e[5]=a*h,e[9]=_-d*o,e[2]=-a*l,e[6]=o,e[10]=a*c}else if(t.order==="ZYX"){const d=a*h,m=a*u,g=o*h,_=o*u;e[0]=c*h,e[4]=g*l-m,e[8]=d*l+_,e[1]=c*u,e[5]=_*l+d,e[9]=m*l-g,e[2]=-l,e[6]=o*c,e[10]=a*c}else if(t.order==="YZX"){const d=a*c,m=a*l,g=o*c,_=o*l;e[0]=c*h,e[4]=_-d*u,e[8]=g*u+m,e[1]=u,e[5]=a*h,e[9]=-o*h,e[2]=-l*h,e[6]=m*u+g,e[10]=d-_*u}else if(t.order==="XZY"){const d=a*c,m=a*l,g=o*c,_=o*l;e[0]=c*h,e[4]=-u,e[8]=l*h,e[1]=d*u+_,e[5]=a*h,e[9]=m*u-g,e[2]=g*u-m,e[6]=o*h,e[10]=_*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(Jl,t,jl)}lookAt(t,e,n){const i=this.elements;return Fe.subVectors(t,e),Fe.lengthSq()===0&&(Fe.z=1),Fe.normalize(),gn.crossVectors(n,Fe),gn.lengthSq()===0&&(Math.abs(n.z)===1?Fe.x+=1e-4:Fe.z+=1e-4,Fe.normalize(),gn.crossVectors(n,Fe)),gn.normalize(),ji.crossVectors(Fe,gn),i[0]=gn.x,i[4]=ji.x,i[8]=Fe.x,i[1]=gn.y,i[5]=ji.y,i[9]=Fe.y,i[2]=gn.z,i[6]=ji.z,i[10]=Fe.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,r=this.elements,a=n[0],o=n[4],c=n[8],l=n[12],h=n[1],u=n[5],d=n[9],m=n[13],g=n[2],_=n[6],p=n[10],f=n[14],y=n[3],v=n[7],S=n[11],D=n[15],w=i[0],b=i[4],G=i[8],M=i[12],A=i[1],O=i[5],k=i[9],nt=i[13],L=i[2],F=i[6],V=i[10],K=i[14],Y=i[3],$=i[7],Z=i[11],it=i[15];return r[0]=a*w+o*A+c*L+l*Y,r[4]=a*b+o*O+c*F+l*$,r[8]=a*G+o*k+c*V+l*Z,r[12]=a*M+o*nt+c*K+l*it,r[1]=h*w+u*A+d*L+m*Y,r[5]=h*b+u*O+d*F+m*$,r[9]=h*G+u*k+d*V+m*Z,r[13]=h*M+u*nt+d*K+m*it,r[2]=g*w+_*A+p*L+f*Y,r[6]=g*b+_*O+p*F+f*$,r[10]=g*G+_*k+p*V+f*Z,r[14]=g*M+_*nt+p*K+f*it,r[3]=y*w+v*A+S*L+D*Y,r[7]=y*b+v*O+S*F+D*$,r[11]=y*G+v*k+S*V+D*Z,r[15]=y*M+v*nt+S*K+D*it,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],i=t[8],r=t[12],a=t[1],o=t[5],c=t[9],l=t[13],h=t[2],u=t[6],d=t[10],m=t[14],g=t[3],_=t[7],p=t[11],f=t[15];return g*(+r*c*u-i*l*u-r*o*d+n*l*d+i*o*m-n*c*m)+_*(+e*c*m-e*l*d+r*a*d-i*a*m+i*l*h-r*c*h)+p*(+e*l*u-e*o*m-r*a*u+n*a*m+r*o*h-n*l*h)+f*(-i*o*h-e*c*u+e*o*d+i*a*u-n*a*d+n*c*h)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const i=this.elements;return t.isVector3?(i[12]=t.x,i[13]=t.y,i[14]=t.z):(i[12]=t,i[13]=e,i[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],c=t[6],l=t[7],h=t[8],u=t[9],d=t[10],m=t[11],g=t[12],_=t[13],p=t[14],f=t[15],y=u*p*l-_*d*l+_*c*m-o*p*m-u*c*f+o*d*f,v=g*d*l-h*p*l-g*c*m+a*p*m+h*c*f-a*d*f,S=h*_*l-g*u*l+g*o*m-a*_*m-h*o*f+a*u*f,D=g*u*c-h*_*c-g*o*d+a*_*d+h*o*p-a*u*p,w=e*y+n*v+i*S+r*D;if(w===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const b=1/w;return t[0]=y*b,t[1]=(_*d*r-u*p*r-_*i*m+n*p*m+u*i*f-n*d*f)*b,t[2]=(o*p*r-_*c*r+_*i*l-n*p*l-o*i*f+n*c*f)*b,t[3]=(u*c*r-o*d*r-u*i*l+n*d*l+o*i*m-n*c*m)*b,t[4]=v*b,t[5]=(h*p*r-g*d*r+g*i*m-e*p*m-h*i*f+e*d*f)*b,t[6]=(g*c*r-a*p*r-g*i*l+e*p*l+a*i*f-e*c*f)*b,t[7]=(a*d*r-h*c*r+h*i*l-e*d*l-a*i*m+e*c*m)*b,t[8]=S*b,t[9]=(g*u*r-h*_*r-g*n*m+e*_*m+h*n*f-e*u*f)*b,t[10]=(a*_*r-g*o*r+g*n*l-e*_*l-a*n*f+e*o*f)*b,t[11]=(h*o*r-a*u*r-h*n*l+e*u*l+a*n*m-e*o*m)*b,t[12]=D*b,t[13]=(h*_*i-g*u*i+g*n*d-e*_*d-h*n*p+e*u*p)*b,t[14]=(g*o*i-a*_*i-g*n*c+e*_*c+a*n*p-e*o*p)*b,t[15]=(a*u*i-h*o*i+h*n*c-e*u*c-a*n*d+e*o*d)*b,this}scale(t){const e=this.elements,n=t.x,i=t.y,r=t.z;return e[0]*=n,e[4]*=i,e[8]*=r,e[1]*=n,e[5]*=i,e[9]*=r,e[2]*=n,e[6]*=i,e[10]*=r,e[3]*=n,e[7]*=i,e[11]*=r,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],i=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,i))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),i=Math.sin(e),r=1-n,a=t.x,o=t.y,c=t.z,l=r*a,h=r*o;return this.set(l*a+n,l*o-i*c,l*c+i*o,0,l*o+i*c,h*o+n,h*c-i*a,0,l*c-i*o,h*c+i*a,r*c*c+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,i,r,a){return this.set(1,n,r,0,t,1,a,0,e,i,1,0,0,0,0,1),this}compose(t,e,n){const i=this.elements,r=e._x,a=e._y,o=e._z,c=e._w,l=r+r,h=a+a,u=o+o,d=r*l,m=r*h,g=r*u,_=a*h,p=a*u,f=o*u,y=c*l,v=c*h,S=c*u,D=n.x,w=n.y,b=n.z;return i[0]=(1-(_+f))*D,i[1]=(m+S)*D,i[2]=(g-v)*D,i[3]=0,i[4]=(m-S)*w,i[5]=(1-(d+f))*w,i[6]=(p+y)*w,i[7]=0,i[8]=(g+v)*b,i[9]=(p-y)*b,i[10]=(1-(d+_))*b,i[11]=0,i[12]=t.x,i[13]=t.y,i[14]=t.z,i[15]=1,this}decompose(t,e,n){const i=this.elements;let r=Zn.set(i[0],i[1],i[2]).length();const a=Zn.set(i[4],i[5],i[6]).length(),o=Zn.set(i[8],i[9],i[10]).length();this.determinant()<0&&(r=-r),t.x=i[12],t.y=i[13],t.z=i[14],Ye.copy(this);const l=1/r,h=1/a,u=1/o;return Ye.elements[0]*=l,Ye.elements[1]*=l,Ye.elements[2]*=l,Ye.elements[4]*=h,Ye.elements[5]*=h,Ye.elements[6]*=h,Ye.elements[8]*=u,Ye.elements[9]*=u,Ye.elements[10]*=u,e.setFromRotationMatrix(Ye),n.x=r,n.y=a,n.z=o,this}makePerspective(t,e,n,i,r,a,o=un){const c=this.elements,l=2*r/(e-t),h=2*r/(n-i),u=(e+t)/(e-t),d=(n+i)/(n-i);let m,g;if(o===un)m=-(a+r)/(a-r),g=-2*a*r/(a-r);else if(o===Ts)m=-a/(a-r),g=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=l,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=h,c[9]=d,c[13]=0,c[2]=0,c[6]=0,c[10]=m,c[14]=g,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,n,i,r,a,o=un){const c=this.elements,l=1/(e-t),h=1/(n-i),u=1/(a-r),d=(e+t)*l,m=(n+i)*h;let g,_;if(o===un)g=(a+r)*u,_=-2*u;else if(o===Ts)g=r*u,_=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=2*l,c[4]=0,c[8]=0,c[12]=-d,c[1]=0,c[5]=2*h,c[9]=0,c[13]=-m,c[2]=0,c[6]=0,c[10]=_,c[14]=-g,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<16;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const Zn=new C,Ye=new ee,Jl=new C(0,0,0),jl=new C(1,1,1),gn=new C,ji=new C,Fe=new C,Ba=new ee,za=new Mi;class Ps{constructor(t=0,e=0,n=0,i=Ps.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=i}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,i=this._order){return this._x=t,this._y=e,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const i=t.elements,r=i[0],a=i[4],o=i[8],c=i[1],l=i[5],h=i[9],u=i[2],d=i[6],m=i[10];switch(e){case"XYZ":this._y=Math.asin(xe(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,m),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,l),this._z=0);break;case"YXZ":this._x=Math.asin(-xe(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,m),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(xe(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,m),this._z=Math.atan2(-a,l)):(this._y=0,this._z=Math.atan2(c,r));break;case"ZYX":this._y=Math.asin(-xe(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,m),this._z=Math.atan2(c,r)):(this._x=0,this._z=Math.atan2(-a,l));break;case"YZX":this._z=Math.asin(xe(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-h,l),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,m));break;case"XZY":this._z=Math.asin(-xe(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,l),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,m),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return Ba.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Ba,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return za.setFromEuler(this),this.setFromQuaternion(za,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Ps.DEFAULT_ORDER="XYZ";class Jo{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let Ql=0;const Ga=new C,Jn=new Mi,on=new ee,Qi=new C,Ai=new C,th=new C,eh=new Mi,Ha=new C(1,0,0),Va=new C(0,1,0),ka=new C(0,0,1),nh={type:"added"},ih={type:"removed"};class he extends xi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Ql++}),this.uuid=kn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=he.DEFAULT_UP.clone();const t=new C,e=new Ps,n=new Mi,i=new C(1,1,1);function r(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new ee},normalMatrix:{value:new Xt}}),this.matrix=new ee,this.matrixWorld=new ee,this.matrixAutoUpdate=he.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=he.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Jo,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return Jn.setFromAxisAngle(t,e),this.quaternion.multiply(Jn),this}rotateOnWorldAxis(t,e){return Jn.setFromAxisAngle(t,e),this.quaternion.premultiply(Jn),this}rotateX(t){return this.rotateOnAxis(Ha,t)}rotateY(t){return this.rotateOnAxis(Va,t)}rotateZ(t){return this.rotateOnAxis(ka,t)}translateOnAxis(t,e){return Ga.copy(t).applyQuaternion(this.quaternion),this.position.add(Ga.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(Ha,t)}translateY(t){return this.translateOnAxis(Va,t)}translateZ(t){return this.translateOnAxis(ka,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(on.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?Qi.copy(t):Qi.set(t,e,n);const i=this.parent;this.updateWorldMatrix(!0,!1),Ai.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?on.lookAt(Ai,Qi,this.up):on.lookAt(Qi,Ai,this.up),this.quaternion.setFromRotationMatrix(on),i&&(on.extractRotation(i.matrixWorld),Jn.setFromRotationMatrix(on),this.quaternion.premultiply(Jn.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.parent!==null&&t.parent.remove(t),t.parent=this,this.children.push(t),t.dispatchEvent(nh)):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(ih)),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),on.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),on.multiply(t.parent.matrixWorld)),t.applyMatrix4(on),this.add(t),t.updateWorldMatrix(!1,!0),this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,i=this.children.length;n<i;n++){const a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const i=this.children;for(let r=0,a=i.length;r<a;r++)i[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ai,t,th),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ai,eh,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,i=e.length;n<i;n++){const r=e[n];(r.matrixWorldAutoUpdate===!0||t===!0)&&r.updateMatrixWorld(t)}}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.matrixWorldAutoUpdate===!0&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),e===!0){const i=this.children;for(let r=0,a=i.length;r<a;r++){const o=i[r];o.matrixWorldAutoUpdate===!0&&o.updateWorldMatrix(!1,!0)}}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.visibility=this._visibility,i.active=this._active,i.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),i.maxGeometryCount=this._maxGeometryCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.geometryCount=this._geometryCount,i.matricesTexture=this._matricesTexture.toJSON(t),this.boundingSphere!==null&&(i.boundingSphere={center:i.boundingSphere.center.toArray(),radius:i.boundingSphere.radius}),this.boundingBox!==null&&(i.boundingBox={min:i.boundingBox.min.toArray(),max:i.boundingBox.max.toArray()}));function r(o,c){return o[c.uuid]===void 0&&(o[c.uuid]=c.toJSON(t)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(t.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const c=o.shapes;if(Array.isArray(c))for(let l=0,h=c.length;l<h;l++){const u=c[l];r(t.shapes,u)}else r(t.shapes,c)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let c=0,l=this.material.length;c<l;c++)o.push(r(t.materials,this.material[c]));i.material=o}else i.material=r(t.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){const c=this.animations[o];i.animations.push(r(t.animations,c))}}if(e){const o=a(t.geometries),c=a(t.materials),l=a(t.textures),h=a(t.images),u=a(t.shapes),d=a(t.skeletons),m=a(t.animations),g=a(t.nodes);o.length>0&&(n.geometries=o),c.length>0&&(n.materials=c),l.length>0&&(n.textures=l),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),m.length>0&&(n.animations=m),g.length>0&&(n.nodes=g)}return n.object=i,n;function a(o){const c=[];for(const l in o){const h=o[l];delete h.metadata,c.push(h)}return c}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const i=t.children[n];this.add(i.clone())}return this}}he.DEFAULT_UP=new C(0,1,0);he.DEFAULT_MATRIX_AUTO_UPDATE=!0;he.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const $e=new C,cn=new C,Qs=new C,ln=new C,jn=new C,Qn=new C,Wa=new C,tr=new C,er=new C,nr=new C;let ts=!1;class Ke{constructor(t=new C,e=new C,n=new C){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,i){i.subVectors(n,e),$e.subVectors(t,e),i.cross($e);const r=i.lengthSq();return r>0?i.multiplyScalar(1/Math.sqrt(r)):i.set(0,0,0)}static getBarycoord(t,e,n,i,r){$e.subVectors(i,e),cn.subVectors(n,e),Qs.subVectors(t,e);const a=$e.dot($e),o=$e.dot(cn),c=$e.dot(Qs),l=cn.dot(cn),h=cn.dot(Qs),u=a*l-o*o;if(u===0)return r.set(0,0,0),null;const d=1/u,m=(l*c-o*h)*d,g=(a*h-o*c)*d;return r.set(1-m-g,g,m)}static containsPoint(t,e,n,i){return this.getBarycoord(t,e,n,i,ln)===null?!1:ln.x>=0&&ln.y>=0&&ln.x+ln.y<=1}static getUV(t,e,n,i,r,a,o,c){return ts===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),ts=!0),this.getInterpolation(t,e,n,i,r,a,o,c)}static getInterpolation(t,e,n,i,r,a,o,c){return this.getBarycoord(t,e,n,i,ln)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(r,ln.x),c.addScaledVector(a,ln.y),c.addScaledVector(o,ln.z),c)}static isFrontFacing(t,e,n,i){return $e.subVectors(n,e),cn.subVectors(t,e),$e.cross(cn).dot(i)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,i){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[i]),this}setFromAttributeAndIndices(t,e,n,i){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,i),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return $e.subVectors(this.c,this.b),cn.subVectors(this.a,this.b),$e.cross(cn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Ke.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return Ke.getBarycoord(t,this.a,this.b,this.c,e)}getUV(t,e,n,i,r){return ts===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),ts=!0),Ke.getInterpolation(t,this.a,this.b,this.c,e,n,i,r)}getInterpolation(t,e,n,i,r){return Ke.getInterpolation(t,this.a,this.b,this.c,e,n,i,r)}containsPoint(t){return Ke.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Ke.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,i=this.b,r=this.c;let a,o;jn.subVectors(i,n),Qn.subVectors(r,n),tr.subVectors(t,n);const c=jn.dot(tr),l=Qn.dot(tr);if(c<=0&&l<=0)return e.copy(n);er.subVectors(t,i);const h=jn.dot(er),u=Qn.dot(er);if(h>=0&&u<=h)return e.copy(i);const d=c*u-h*l;if(d<=0&&c>=0&&h<=0)return a=c/(c-h),e.copy(n).addScaledVector(jn,a);nr.subVectors(t,r);const m=jn.dot(nr),g=Qn.dot(nr);if(g>=0&&m<=g)return e.copy(r);const _=m*l-c*g;if(_<=0&&l>=0&&g<=0)return o=l/(l-g),e.copy(n).addScaledVector(Qn,o);const p=h*g-m*u;if(p<=0&&u-h>=0&&m-g>=0)return Wa.subVectors(r,i),o=(u-h)/(u-h+(m-g)),e.copy(i).addScaledVector(Wa,o);const f=1/(p+_+d);return a=_*f,o=d*f,e.copy(n).addScaledVector(jn,a).addScaledVector(Qn,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const jo={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},_n={h:0,s:0,l:0},es={h:0,s:0,l:0};function ir(s,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?s+(t-s)*6*e:e<1/2?t:e<2/3?s+(t-s)*6*(2/3-e):s}class Ft{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const i=t;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=ve){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Kt.toWorkingColorSpace(this,e),this}setRGB(t,e,n,i=Kt.workingColorSpace){return this.r=t,this.g=e,this.b=n,Kt.toWorkingColorSpace(this,i),this}setHSL(t,e,n,i=Kt.workingColorSpace){if(t=Ur(t,1),e=xe(e,0,1),n=xe(n,0,1),e===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+e):n+e-n*e,a=2*n-r;this.r=ir(a,r,t+1/3),this.g=ir(a,r,t),this.b=ir(a,r,t-1/3)}return Kt.toWorkingColorSpace(this,i),this}setStyle(t,e=ve){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(t)){let r;const a=i[1],o=i[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=i[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=ve){const n=jo[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=pi(t.r),this.g=pi(t.g),this.b=pi(t.b),this}copyLinearToSRGB(t){return this.r=Xs(t.r),this.g=Xs(t.g),this.b=Xs(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=ve){return Kt.fromWorkingColorSpace(ye.copy(this),t),Math.round(xe(ye.r*255,0,255))*65536+Math.round(xe(ye.g*255,0,255))*256+Math.round(xe(ye.b*255,0,255))}getHexString(t=ve){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Kt.workingColorSpace){Kt.fromWorkingColorSpace(ye.copy(this),e);const n=ye.r,i=ye.g,r=ye.b,a=Math.max(n,i,r),o=Math.min(n,i,r);let c,l;const h=(o+a)/2;if(o===a)c=0,l=0;else{const u=a-o;switch(l=h<=.5?u/(a+o):u/(2-a-o),a){case n:c=(i-r)/u+(i<r?6:0);break;case i:c=(r-n)/u+2;break;case r:c=(n-i)/u+4;break}c/=6}return t.h=c,t.s=l,t.l=h,t}getRGB(t,e=Kt.workingColorSpace){return Kt.fromWorkingColorSpace(ye.copy(this),e),t.r=ye.r,t.g=ye.g,t.b=ye.b,t}getStyle(t=ve){Kt.fromWorkingColorSpace(ye.copy(this),t);const e=ye.r,n=ye.g,i=ye.b;return t!==ve?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(t,e,n){return this.getHSL(_n),this.setHSL(_n.h+t,_n.s+e,_n.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(_n),t.getHSL(es);const n=Pi(_n.h,es.h,e),i=Pi(_n.s,es.s,e),r=Pi(_n.l,es.l,e);return this.setHSL(n,i,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,i=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*i,this.g=r[1]*e+r[4]*n+r[7]*i,this.b=r[2]*e+r[5]*n+r[8]*i,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const ye=new Ft;Ft.NAMES=jo;let sh=0;class ki extends xi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:sh++}),this.uuid=kn(),this.name="",this.type="Material",this.blending=fi,this.side=wn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=vr,this.blendDst=xr,this.blendEquation=Nn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ft(0,0,0),this.blendAlpha=0,this.depthFunc=Ms,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Pa,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Xn,this.stencilZFail=Xn,this.stencilZPass=Xn,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBuild(){}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const i=this[e];if(i===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==fi&&(n.blending=this.blending),this.side!==wn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==vr&&(n.blendSrc=this.blendSrc),this.blendDst!==xr&&(n.blendDst=this.blendDst),this.blendEquation!==Nn&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Ms&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Pa&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Xn&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Xn&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Xn&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(r){const a=[];for(const o in r){const c=r[o];delete c.metadata,a.push(c)}return a}if(e){const r=i(t.textures),a=i(t.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const i=e.length;n=new Array(i);for(let r=0;r!==i;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}}class ze extends ki{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ft(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=No,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const ce=new C,ns=new lt;class Xe{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=La,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.gpuType=Sn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}get updateRange(){return console.warn("THREE.BufferAttribute: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[t+i]=e.array[n+i];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)ns.fromBufferAttribute(this,e),ns.applyMatrix3(t),this.setXY(e,ns.x,ns.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)ce.fromBufferAttribute(this,e),ce.applyMatrix3(t),this.setXYZ(e,ce.x,ce.y,ce.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)ce.fromBufferAttribute(this,e),ce.applyMatrix4(t),this.setXYZ(e,ce.x,ce.y,ce.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)ce.fromBufferAttribute(this,e),ce.applyNormalMatrix(t),this.setXYZ(e,ce.x,ce.y,ce.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)ce.fromBufferAttribute(this,e),ce.transformDirection(t),this.setXYZ(e,ce.x,ce.y,ce.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=ci(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Ae(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=ci(e,this.array)),e}setX(t,e){return this.normalized&&(e=Ae(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=ci(e,this.array)),e}setY(t,e){return this.normalized&&(e=Ae(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=ci(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Ae(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=ci(e,this.array)),e}setW(t,e){return this.normalized&&(e=Ae(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Ae(e,this.array),n=Ae(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,i){return t*=this.itemSize,this.normalized&&(e=Ae(e,this.array),n=Ae(n,this.array),i=Ae(i,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this}setXYZW(t,e,n,i,r){return t*=this.itemSize,this.normalized&&(e=Ae(e,this.array),n=Ae(n,this.array),i=Ae(i,this.array),r=Ae(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==La&&(t.usage=this.usage),t}}class Qo extends Xe{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class tc extends Xe{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class ne extends Xe{constructor(t,e,n){super(new Float32Array(t),e,n)}}let rh=0;const He=new ee,sr=new he,ti=new C,Be=new Wn,wi=new Wn,me=new C;class Ne extends xi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:rh++}),this.uuid=kn(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(Yo(t)?tc:Qo)(t,1):this.index=t,this}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Xt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}const i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(t),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return He.makeRotationFromQuaternion(t),this.applyMatrix4(He),this}rotateX(t){return He.makeRotationX(t),this.applyMatrix4(He),this}rotateY(t){return He.makeRotationY(t),this.applyMatrix4(He),this}rotateZ(t){return He.makeRotationZ(t),this.applyMatrix4(He),this}translate(t,e,n){return He.makeTranslation(t,e,n),this.applyMatrix4(He),this}scale(t,e,n){return He.makeScale(t,e,n),this.applyMatrix4(He),this}lookAt(t){return sr.lookAt(t),sr.updateMatrix(),this.applyMatrix4(sr.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ti).negate(),this.translate(ti.x,ti.y,ti.z),this}setFromPoints(t){const e=[];for(let n=0,i=t.length;n<i;n++){const r=t[n];e.push(r.x,r.y,r.z||0)}return this.setAttribute("position",new ne(e,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Wn);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingBox.set(new C(-1/0,-1/0,-1/0),new C(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,i=e.length;n<i;n++){const r=e[n];Be.setFromBufferAttribute(r),this.morphTargetsRelative?(me.addVectors(this.boundingBox.min,Be.min),this.boundingBox.expandByPoint(me),me.addVectors(this.boundingBox.max,Be.max),this.boundingBox.expandByPoint(me)):(this.boundingBox.expandByPoint(Be.min),this.boundingBox.expandByPoint(Be.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Vi);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingSphere.set(new C,1/0);return}if(t){const n=this.boundingSphere.center;if(Be.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){const o=e[r];wi.setFromBufferAttribute(o),this.morphTargetsRelative?(me.addVectors(Be.min,wi.min),Be.expandByPoint(me),me.addVectors(Be.max,wi.max),Be.expandByPoint(me)):(Be.expandByPoint(wi.min),Be.expandByPoint(wi.max))}Be.getCenter(n);let i=0;for(let r=0,a=t.count;r<a;r++)me.fromBufferAttribute(t,r),i=Math.max(i,n.distanceToSquared(me));if(e)for(let r=0,a=e.length;r<a;r++){const o=e[r],c=this.morphTargetsRelative;for(let l=0,h=o.count;l<h;l++)me.fromBufferAttribute(o,l),c&&(ti.fromBufferAttribute(t,l),me.add(ti)),i=Math.max(i,n.distanceToSquared(me))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.array,i=e.position.array,r=e.normal.array,a=e.uv.array,o=i.length/3;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Xe(new Float32Array(4*o),4));const c=this.getAttribute("tangent").array,l=[],h=[];for(let A=0;A<o;A++)l[A]=new C,h[A]=new C;const u=new C,d=new C,m=new C,g=new lt,_=new lt,p=new lt,f=new C,y=new C;function v(A,O,k){u.fromArray(i,A*3),d.fromArray(i,O*3),m.fromArray(i,k*3),g.fromArray(a,A*2),_.fromArray(a,O*2),p.fromArray(a,k*2),d.sub(u),m.sub(u),_.sub(g),p.sub(g);const nt=1/(_.x*p.y-p.x*_.y);isFinite(nt)&&(f.copy(d).multiplyScalar(p.y).addScaledVector(m,-_.y).multiplyScalar(nt),y.copy(m).multiplyScalar(_.x).addScaledVector(d,-p.x).multiplyScalar(nt),l[A].add(f),l[O].add(f),l[k].add(f),h[A].add(y),h[O].add(y),h[k].add(y))}let S=this.groups;S.length===0&&(S=[{start:0,count:n.length}]);for(let A=0,O=S.length;A<O;++A){const k=S[A],nt=k.start,L=k.count;for(let F=nt,V=nt+L;F<V;F+=3)v(n[F+0],n[F+1],n[F+2])}const D=new C,w=new C,b=new C,G=new C;function M(A){b.fromArray(r,A*3),G.copy(b);const O=l[A];D.copy(O),D.sub(b.multiplyScalar(b.dot(O))).normalize(),w.crossVectors(G,O);const nt=w.dot(h[A])<0?-1:1;c[A*4]=D.x,c[A*4+1]=D.y,c[A*4+2]=D.z,c[A*4+3]=nt}for(let A=0,O=S.length;A<O;++A){const k=S[A],nt=k.start,L=k.count;for(let F=nt,V=nt+L;F<V;F+=3)M(n[F+0]),M(n[F+1]),M(n[F+2])}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Xe(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,m=n.count;d<m;d++)n.setXYZ(d,0,0,0);const i=new C,r=new C,a=new C,o=new C,c=new C,l=new C,h=new C,u=new C;if(t)for(let d=0,m=t.count;d<m;d+=3){const g=t.getX(d+0),_=t.getX(d+1),p=t.getX(d+2);i.fromBufferAttribute(e,g),r.fromBufferAttribute(e,_),a.fromBufferAttribute(e,p),h.subVectors(a,r),u.subVectors(i,r),h.cross(u),o.fromBufferAttribute(n,g),c.fromBufferAttribute(n,_),l.fromBufferAttribute(n,p),o.add(h),c.add(h),l.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(_,c.x,c.y,c.z),n.setXYZ(p,l.x,l.y,l.z)}else for(let d=0,m=e.count;d<m;d+=3)i.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),a.fromBufferAttribute(e,d+2),h.subVectors(a,r),u.subVectors(i,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)me.fromBufferAttribute(t,e),me.normalize(),t.setXYZ(e,me.x,me.y,me.z)}toNonIndexed(){function t(o,c){const l=o.array,h=o.itemSize,u=o.normalized,d=new l.constructor(c.length*h);let m=0,g=0;for(let _=0,p=c.length;_<p;_++){o.isInterleavedBufferAttribute?m=c[_]*o.data.stride+o.offset:m=c[_]*h;for(let f=0;f<h;f++)d[g++]=l[m++]}return new Xe(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new Ne,n=this.index.array,i=this.attributes;for(const o in i){const c=i[o],l=t(c,n);e.setAttribute(o,l)}const r=this.morphAttributes;for(const o in r){const c=[],l=r[o];for(let h=0,u=l.length;h<u;h++){const d=l[h],m=t(d,n);c.push(m)}e.morphAttributes[o]=c}e.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,c=a.length;o<c;o++){const l=a[o];e.addGroup(l.start,l.count,l.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const c=this.parameters;for(const l in c)c[l]!==void 0&&(t[l]=c[l]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const c in n){const l=n[c];t.data.attributes[c]=l.toJSON(t.data)}const i={};let r=!1;for(const c in this.morphAttributes){const l=this.morphAttributes[c],h=[];for(let u=0,d=l.length;u<d;u++){const m=l[u];h.push(m.toJSON(t.data))}h.length>0&&(i[c]=h,r=!0)}r&&(t.data.morphAttributes=i,t.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(t.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone(e));const i=t.attributes;for(const l in i){const h=i[l];this.setAttribute(l,h.clone(e))}const r=t.morphAttributes;for(const l in r){const h=[],u=r[l];for(let d=0,m=u.length;d<m;d++)h.push(u[d].clone(e));this.morphAttributes[l]=h}this.morphTargetsRelative=t.morphTargetsRelative;const a=t.groups;for(let l=0,h=a.length;l<h;l++){const u=a[l];this.addGroup(u.start,u.count,u.materialIndex)}const o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());const c=t.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Xa=new ee,Ln=new Zl,is=new Vi,qa=new C,ei=new C,ni=new C,ii=new C,rr=new C,ss=new C,rs=new lt,as=new lt,os=new lt,Ya=new C,$a=new C,Ka=new C,cs=new C,ls=new C;class ht extends he{constructor(t=new Ne,e=new ze){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){const n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(i,t);const o=this.morphTargetInfluences;if(r&&o){ss.set(0,0,0);for(let c=0,l=r.length;c<l;c++){const h=o[c],u=r[c];h!==0&&(rr.fromBufferAttribute(u,t),a?ss.addScaledVector(rr,h):ss.addScaledVector(rr.sub(e),h))}e.add(ss)}return e}raycast(t,e){const n=this.geometry,i=this.material,r=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),is.copy(n.boundingSphere),is.applyMatrix4(r),Ln.copy(t.ray).recast(t.near),!(is.containsPoint(Ln.origin)===!1&&(Ln.intersectSphere(is,qa)===null||Ln.origin.distanceToSquared(qa)>(t.far-t.near)**2))&&(Xa.copy(r).invert(),Ln.copy(t.ray).applyMatrix4(Xa),!(n.boundingBox!==null&&Ln.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Ln)))}_computeIntersections(t,e,n){let i;const r=this.geometry,a=this.material,o=r.index,c=r.attributes.position,l=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,m=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,_=d.length;g<_;g++){const p=d[g],f=a[p.materialIndex],y=Math.max(p.start,m.start),v=Math.min(o.count,Math.min(p.start+p.count,m.start+m.count));for(let S=y,D=v;S<D;S+=3){const w=o.getX(S),b=o.getX(S+1),G=o.getX(S+2);i=hs(this,f,t,n,l,h,u,w,b,G),i&&(i.faceIndex=Math.floor(S/3),i.face.materialIndex=p.materialIndex,e.push(i))}}else{const g=Math.max(0,m.start),_=Math.min(o.count,m.start+m.count);for(let p=g,f=_;p<f;p+=3){const y=o.getX(p),v=o.getX(p+1),S=o.getX(p+2);i=hs(this,a,t,n,l,h,u,y,v,S),i&&(i.faceIndex=Math.floor(p/3),e.push(i))}}else if(c!==void 0)if(Array.isArray(a))for(let g=0,_=d.length;g<_;g++){const p=d[g],f=a[p.materialIndex],y=Math.max(p.start,m.start),v=Math.min(c.count,Math.min(p.start+p.count,m.start+m.count));for(let S=y,D=v;S<D;S+=3){const w=S,b=S+1,G=S+2;i=hs(this,f,t,n,l,h,u,w,b,G),i&&(i.faceIndex=Math.floor(S/3),i.face.materialIndex=p.materialIndex,e.push(i))}}else{const g=Math.max(0,m.start),_=Math.min(c.count,m.start+m.count);for(let p=g,f=_;p<f;p+=3){const y=p,v=p+1,S=p+2;i=hs(this,a,t,n,l,h,u,y,v,S),i&&(i.faceIndex=Math.floor(p/3),e.push(i))}}}}function ah(s,t,e,n,i,r,a,o){let c;if(t.side===Ie?c=n.intersectTriangle(a,r,i,!0,o):c=n.intersectTriangle(i,r,a,t.side===wn,o),c===null)return null;ls.copy(o),ls.applyMatrix4(s.matrixWorld);const l=e.ray.origin.distanceTo(ls);return l<e.near||l>e.far?null:{distance:l,point:ls.clone(),object:s}}function hs(s,t,e,n,i,r,a,o,c,l){s.getVertexPosition(o,ei),s.getVertexPosition(c,ni),s.getVertexPosition(l,ii);const h=ah(s,t,e,n,ei,ni,ii,cs);if(h){i&&(rs.fromBufferAttribute(i,o),as.fromBufferAttribute(i,c),os.fromBufferAttribute(i,l),h.uv=Ke.getInterpolation(cs,ei,ni,ii,rs,as,os,new lt)),r&&(rs.fromBufferAttribute(r,o),as.fromBufferAttribute(r,c),os.fromBufferAttribute(r,l),h.uv1=Ke.getInterpolation(cs,ei,ni,ii,rs,as,os,new lt),h.uv2=h.uv1),a&&(Ya.fromBufferAttribute(a,o),$a.fromBufferAttribute(a,c),Ka.fromBufferAttribute(a,l),h.normal=Ke.getInterpolation(cs,ei,ni,ii,Ya,$a,Ka,new C),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const u={a:o,b:c,c:l,normal:new C,materialIndex:0};Ke.getNormal(ei,ni,ii,u.normal),h.face=u}return h}class Ce extends Ne{constructor(t=1,e=1,n=1,i=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:i,heightSegments:r,depthSegments:a};const o=this;i=Math.floor(i),r=Math.floor(r),a=Math.floor(a);const c=[],l=[],h=[],u=[];let d=0,m=0;g("z","y","x",-1,-1,n,e,t,a,r,0),g("z","y","x",1,-1,n,e,-t,a,r,1),g("x","z","y",1,1,t,n,e,i,a,2),g("x","z","y",1,-1,t,n,-e,i,a,3),g("x","y","z",1,-1,t,e,n,i,r,4),g("x","y","z",-1,-1,t,e,-n,i,r,5),this.setIndex(c),this.setAttribute("position",new ne(l,3)),this.setAttribute("normal",new ne(h,3)),this.setAttribute("uv",new ne(u,2));function g(_,p,f,y,v,S,D,w,b,G,M){const A=S/b,O=D/G,k=S/2,nt=D/2,L=w/2,F=b+1,V=G+1;let K=0,Y=0;const $=new C;for(let Z=0;Z<V;Z++){const it=Z*O-nt;for(let rt=0;rt<F;rt++){const W=rt*A-k;$[_]=W*y,$[p]=it*v,$[f]=L,l.push($.x,$.y,$.z),$[_]=0,$[p]=0,$[f]=w>0?1:-1,h.push($.x,$.y,$.z),u.push(rt/b),u.push(1-Z/G),K+=1}}for(let Z=0;Z<G;Z++)for(let it=0;it<b;it++){const rt=d+it+F*Z,W=d+it+F*(Z+1),j=d+(it+1)+F*(Z+1),pt=d+(it+1)+F*Z;c.push(rt,W,pt),c.push(W,j,pt),Y+=6}o.addGroup(m,Y,M),m+=Y,d+=K}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ce(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function vi(s){const t={};for(const e in s){t[e]={};for(const n in s[e]){const i=s[e][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=i.clone():Array.isArray(i)?t[e][n]=i.slice():t[e][n]=i}}return t}function we(s){const t={};for(let e=0;e<s.length;e++){const n=vi(s[e]);for(const i in n)t[i]=n[i]}return t}function oh(s){const t=[];for(let e=0;e<s.length;e++)t.push(s[e].clone());return t}function ec(s){return s.getRenderTarget()===null?s.outputColorSpace:Kt.workingColorSpace}const ch={clone:vi,merge:we};var lh=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,hh=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Hn extends ki{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=lh,this.fragmentShader=hh,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1,clipCullDistance:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=vi(t.uniforms),this.uniformsGroups=oh(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const i in this.uniforms){const a=this.uniforms[i].value;a&&a.isTexture?e.uniforms[i]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[i]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[i]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[i]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[i]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[i]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[i]={type:"m4",value:a.toArray()}:e.uniforms[i]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class nc extends he{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ee,this.projectionMatrix=new ee,this.projectionMatrixInverse=new ee,this.coordinateSystem=un}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}class ke extends nc{constructor(t=50,e=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=Fi*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(Ci*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Fi*2*Math.atan(Math.tan(Ci*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}setViewOffset(t,e,n,i,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(Ci*.5*this.fov)/this.zoom,n=2*e,i=this.aspect*n,r=-.5*i;const a=this.view;if(this.view!==null&&this.view.enabled){const c=a.fullWidth,l=a.fullHeight;r+=a.offsetX*i/c,e-=a.offsetY*n/l,i*=a.width/c,n*=a.height/l}const o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const si=-90,ri=1;class uh extends he{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const i=new ke(si,ri,t,e);i.layers=this.layers,this.add(i);const r=new ke(si,ri,t,e);r.layers=this.layers,this.add(r);const a=new ke(si,ri,t,e);a.layers=this.layers,this.add(a);const o=new ke(si,ri,t,e);o.layers=this.layers,this.add(o);const c=new ke(si,ri,t,e);c.layers=this.layers,this.add(c);const l=new ke(si,ri,t,e);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,i,r,a,o,c]=e;for(const l of e)this.remove(l);if(t===un)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(t===Ts)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const l of e)this.add(l),l.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,c,l,h]=this.children,u=t.getRenderTarget(),d=t.getActiveCubeFace(),m=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;const _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,i),t.render(e,r),t.setRenderTarget(n,1,i),t.render(e,a),t.setRenderTarget(n,2,i),t.render(e,o),t.setRenderTarget(n,3,i),t.render(e,c),t.setRenderTarget(n,4,i),t.render(e,l),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,i),t.render(e,h),t.setRenderTarget(u,d,m),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class ic extends Ue{constructor(t,e,n,i,r,a,o,c,l,h){t=t!==void 0?t:[],e=e!==void 0?e:mi,super(t,e,n,i,r,a,o,c,l,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class dh extends Gn{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},i=[n,n,n,n,n,n];e.encoding!==void 0&&(Li("THREE.WebGLCubeRenderTarget: option.encoding has been replaced by option.colorSpace."),e.colorSpace=e.encoding===zn?ve:We),this.texture=new ic(i,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:Ve}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},i=new Ce(5,5,5),r=new Hn({name:"CubemapFromEquirect",uniforms:vi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Ie,blending:yn});r.uniforms.tEquirect.value=e;const a=new ht(i,r),o=e.minFilter;return e.minFilter===Ni&&(e.minFilter=Ve),new uh(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e,n,i){const r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,i);t.setRenderTarget(r)}}const ar=new C,fh=new C,ph=new Xt;class In{constructor(t=new C(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,i){return this.normal.set(t,e,n),this.constant=i,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const i=ar.subVectors(n,e).cross(fh.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(i,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta(ar),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const r=-(t.start.dot(this.normal)+this.constant)/i;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||ph.getNormalMatrix(t),i=this.coplanarPoint(ar).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Dn=new Vi,us=new C;class Nr{constructor(t=new In,e=new In,n=new In,i=new In,r=new In,a=new In){this.planes=[t,e,n,i,r,a]}set(t,e,n,i,r,a){const o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(i),o[4].copy(r),o[5].copy(a),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=un){const n=this.planes,i=t.elements,r=i[0],a=i[1],o=i[2],c=i[3],l=i[4],h=i[5],u=i[6],d=i[7],m=i[8],g=i[9],_=i[10],p=i[11],f=i[12],y=i[13],v=i[14],S=i[15];if(n[0].setComponents(c-r,d-l,p-m,S-f).normalize(),n[1].setComponents(c+r,d+l,p+m,S+f).normalize(),n[2].setComponents(c+a,d+h,p+g,S+y).normalize(),n[3].setComponents(c-a,d-h,p-g,S-y).normalize(),n[4].setComponents(c-o,d-u,p-_,S-v).normalize(),e===un)n[5].setComponents(c+o,d+u,p+_,S+v).normalize();else if(e===Ts)n[5].setComponents(o,u,_,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Dn.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Dn.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Dn)}intersectsSprite(t){return Dn.center.set(0,0,0),Dn.radius=.7071067811865476,Dn.applyMatrix4(t.matrixWorld),this.intersectsSphere(Dn)}intersectsSphere(t){const e=this.planes,n=t.center,i=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const i=e[n];if(us.x=i.normal.x>0?t.max.x:t.min.x,us.y=i.normal.y>0?t.max.y:t.min.y,us.z=i.normal.z>0?t.max.z:t.min.z,i.distanceToPoint(us)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function sc(){let s=null,t=!1,e=null,n=null;function i(r,a){e(r,a),n=s.requestAnimationFrame(i)}return{start:function(){t!==!0&&e!==null&&(n=s.requestAnimationFrame(i),t=!0)},stop:function(){s.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){s=r}}}function mh(s,t){const e=t.isWebGL2,n=new WeakMap;function i(l,h){const u=l.array,d=l.usage,m=u.byteLength,g=s.createBuffer();s.bindBuffer(h,g),s.bufferData(h,u,d),l.onUploadCallback();let _;if(u instanceof Float32Array)_=s.FLOAT;else if(u instanceof Uint16Array)if(l.isFloat16BufferAttribute)if(e)_=s.HALF_FLOAT;else throw new Error("THREE.WebGLAttributes: Usage of Float16BufferAttribute requires WebGL2.");else _=s.UNSIGNED_SHORT;else if(u instanceof Int16Array)_=s.SHORT;else if(u instanceof Uint32Array)_=s.UNSIGNED_INT;else if(u instanceof Int32Array)_=s.INT;else if(u instanceof Int8Array)_=s.BYTE;else if(u instanceof Uint8Array)_=s.UNSIGNED_BYTE;else if(u instanceof Uint8ClampedArray)_=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+u);return{buffer:g,type:_,bytesPerElement:u.BYTES_PER_ELEMENT,version:l.version,size:m}}function r(l,h,u){const d=h.array,m=h._updateRange,g=h.updateRanges;if(s.bindBuffer(u,l),m.count===-1&&g.length===0&&s.bufferSubData(u,0,d),g.length!==0){for(let _=0,p=g.length;_<p;_++){const f=g[_];e?s.bufferSubData(u,f.start*d.BYTES_PER_ELEMENT,d,f.start,f.count):s.bufferSubData(u,f.start*d.BYTES_PER_ELEMENT,d.subarray(f.start,f.start+f.count))}h.clearUpdateRanges()}m.count!==-1&&(e?s.bufferSubData(u,m.offset*d.BYTES_PER_ELEMENT,d,m.offset,m.count):s.bufferSubData(u,m.offset*d.BYTES_PER_ELEMENT,d.subarray(m.offset,m.offset+m.count)),m.count=-1),h.onUploadCallback()}function a(l){return l.isInterleavedBufferAttribute&&(l=l.data),n.get(l)}function o(l){l.isInterleavedBufferAttribute&&(l=l.data);const h=n.get(l);h&&(s.deleteBuffer(h.buffer),n.delete(l))}function c(l,h){if(l.isGLBufferAttribute){const d=n.get(l);(!d||d.version<l.version)&&n.set(l,{buffer:l.buffer,type:l.type,bytesPerElement:l.elementSize,version:l.version});return}l.isInterleavedBufferAttribute&&(l=l.data);const u=n.get(l);if(u===void 0)n.set(l,i(l,h));else if(u.version<l.version){if(u.size!==l.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");r(u.buffer,l,h),u.version=l.version}}return{get:a,remove:o,update:c}}class Le extends Ne{constructor(t=1,e=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:i};const r=t/2,a=e/2,o=Math.floor(n),c=Math.floor(i),l=o+1,h=c+1,u=t/o,d=e/c,m=[],g=[],_=[],p=[];for(let f=0;f<h;f++){const y=f*d-a;for(let v=0;v<l;v++){const S=v*u-r;g.push(S,-y,0),_.push(0,0,1),p.push(v/o),p.push(1-f/c)}}for(let f=0;f<c;f++)for(let y=0;y<o;y++){const v=y+l*f,S=y+l*(f+1),D=y+1+l*(f+1),w=y+1+l*f;m.push(v,S,w),m.push(S,D,w)}this.setIndex(m),this.setAttribute("position",new ne(g,3)),this.setAttribute("normal",new ne(_,3)),this.setAttribute("uv",new ne(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Le(t.width,t.height,t.widthSegments,t.heightSegments)}}var gh=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,_h=`#ifdef USE_ALPHAHASH
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
#endif`,vh=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,xh=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Mh=`#ifdef USE_ALPHATEST
	if ( diffuseColor.a < alphaTest ) discard;
#endif`,Sh=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,yh=`#ifdef USE_AOMAP
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
#endif`,Eh=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Th=`#ifdef USE_BATCHING
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
#endif`,Ah=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( batchId );
#endif`,wh=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,bh=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Rh=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Ch=`#ifdef USE_IRIDESCENCE
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
#endif`,Ph=`#ifdef USE_BUMPMAP
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
#endif`,Lh=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Dh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Ih=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Uh=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Nh=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Oh=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Fh=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,Bh=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,zh=`#define PI 3.141592653589793
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
} // validated`,Gh=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Hh=`vec3 transformedNormal = objectNormal;
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
#endif`,Vh=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,kh=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Wh=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Xh=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,qh="gl_FragColor = linearToOutputTexel( gl_FragColor );",Yh=`
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
}`,$h=`#ifdef USE_ENVMAP
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
#endif`,Kh=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Zh=`#ifdef USE_ENVMAP
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
#endif`,Jh=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,jh=`#ifdef USE_ENVMAP
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
#endif`,Qh=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,tu=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,eu=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,nu=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,iu=`#ifdef USE_GRADIENTMAP
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
}`,su=`#ifdef USE_LIGHTMAP
	vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
	vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
	reflectedLight.indirectDiffuse += lightMapIrradiance;
#endif`,ru=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,au=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,ou=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,cu=`uniform bool receiveShadow;
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
#endif`,lu=`#ifdef USE_ENVMAP
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
#endif`,hu=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,uu=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,du=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,fu=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,pu=`PhysicalMaterial material;
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
#endif`,mu=`struct PhysicalMaterial {
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
}`,gu=`
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
#endif`,_u=`#if defined( RE_IndirectDiffuse )
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
#endif`,vu=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,xu=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Mu=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Su=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
		varying float vIsPerspective;
	#else
		uniform float logDepthBufFC;
	#endif
#endif`,yu=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
	#else
		if ( isPerspectiveMatrix( projectionMatrix ) ) {
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		}
	#endif
#endif`,Eu=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
	
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Tu=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Au=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,wu=`#if defined( USE_POINTS_UV )
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
#endif`,bu=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Ru=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Cu=`#if defined( USE_MORPHCOLORS ) && defined( MORPHTARGETS_TEXTURE )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Pu=`#ifdef USE_MORPHNORMALS
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
#endif`,Lu=`#ifdef USE_MORPHTARGETS
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
#endif`,Du=`#ifdef USE_MORPHTARGETS
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
#endif`,Iu=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,Uu=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,Nu=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Ou=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Fu=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Bu=`#ifdef USE_NORMALMAP
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
#endif`,zu=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Gu=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Hu=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Vu=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,ku=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Wu=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,Xu=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,qu=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Yu=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,$u=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Ku=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Zu=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Ju=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,ju=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Qu=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,td=`float getShadowMask() {
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
}`,ed=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,nd=`#ifdef USE_SKINNING
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
#endif`,id=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,sd=`#ifdef USE_SKINNING
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
#endif`,rd=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,ad=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,od=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,cd=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,ld=`#ifdef USE_TRANSMISSION
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
#endif`,hd=`#ifdef USE_TRANSMISSION
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
#endif`,ud=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,dd=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,fd=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,pd=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const md=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,gd=`uniform sampler2D t2D;
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
}`,_d=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,vd=`#ifdef ENVMAP_TYPE_CUBE
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
}`,xd=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Md=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Sd=`#include <common>
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
}`,yd=`#if DEPTH_PACKING == 3200
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
}`,Ed=`#define DISTANCE
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
}`,Td=`#define DISTANCE
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
}`,Ad=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,wd=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,bd=`uniform float scale;
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
}`,Rd=`uniform vec3 diffuse;
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
}`,Cd=`#include <common>
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
}`,Pd=`uniform vec3 diffuse;
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
}`,Ld=`#define LAMBERT
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
}`,Dd=`#define LAMBERT
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
}`,Id=`#define MATCAP
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
}`,Ud=`#define MATCAP
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
}`,Nd=`#define NORMAL
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
}`,Od=`#define NORMAL
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
}`,Fd=`#define PHONG
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
}`,Bd=`#define PHONG
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
}`,zd=`#define STANDARD
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
}`,Gd=`#define STANDARD
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
}`,Hd=`#define TOON
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
}`,Vd=`#define TOON
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
}`,kd=`uniform float size;
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
}`,Wd=`uniform vec3 diffuse;
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
}`,Xd=`#include <common>
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
}`,qd=`uniform vec3 color;
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
}`,Yd=`uniform float rotation;
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
}`,$d=`uniform vec3 diffuse;
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
}`,Ht={alphahash_fragment:gh,alphahash_pars_fragment:_h,alphamap_fragment:vh,alphamap_pars_fragment:xh,alphatest_fragment:Mh,alphatest_pars_fragment:Sh,aomap_fragment:yh,aomap_pars_fragment:Eh,batching_pars_vertex:Th,batching_vertex:Ah,begin_vertex:wh,beginnormal_vertex:bh,bsdfs:Rh,iridescence_fragment:Ch,bumpmap_pars_fragment:Ph,clipping_planes_fragment:Lh,clipping_planes_pars_fragment:Dh,clipping_planes_pars_vertex:Ih,clipping_planes_vertex:Uh,color_fragment:Nh,color_pars_fragment:Oh,color_pars_vertex:Fh,color_vertex:Bh,common:zh,cube_uv_reflection_fragment:Gh,defaultnormal_vertex:Hh,displacementmap_pars_vertex:Vh,displacementmap_vertex:kh,emissivemap_fragment:Wh,emissivemap_pars_fragment:Xh,colorspace_fragment:qh,colorspace_pars_fragment:Yh,envmap_fragment:$h,envmap_common_pars_fragment:Kh,envmap_pars_fragment:Zh,envmap_pars_vertex:Jh,envmap_physical_pars_fragment:lu,envmap_vertex:jh,fog_vertex:Qh,fog_pars_vertex:tu,fog_fragment:eu,fog_pars_fragment:nu,gradientmap_pars_fragment:iu,lightmap_fragment:su,lightmap_pars_fragment:ru,lights_lambert_fragment:au,lights_lambert_pars_fragment:ou,lights_pars_begin:cu,lights_toon_fragment:hu,lights_toon_pars_fragment:uu,lights_phong_fragment:du,lights_phong_pars_fragment:fu,lights_physical_fragment:pu,lights_physical_pars_fragment:mu,lights_fragment_begin:gu,lights_fragment_maps:_u,lights_fragment_end:vu,logdepthbuf_fragment:xu,logdepthbuf_pars_fragment:Mu,logdepthbuf_pars_vertex:Su,logdepthbuf_vertex:yu,map_fragment:Eu,map_pars_fragment:Tu,map_particle_fragment:Au,map_particle_pars_fragment:wu,metalnessmap_fragment:bu,metalnessmap_pars_fragment:Ru,morphcolor_vertex:Cu,morphnormal_vertex:Pu,morphtarget_pars_vertex:Lu,morphtarget_vertex:Du,normal_fragment_begin:Iu,normal_fragment_maps:Uu,normal_pars_fragment:Nu,normal_pars_vertex:Ou,normal_vertex:Fu,normalmap_pars_fragment:Bu,clearcoat_normal_fragment_begin:zu,clearcoat_normal_fragment_maps:Gu,clearcoat_pars_fragment:Hu,iridescence_pars_fragment:Vu,opaque_fragment:ku,packing:Wu,premultiplied_alpha_fragment:Xu,project_vertex:qu,dithering_fragment:Yu,dithering_pars_fragment:$u,roughnessmap_fragment:Ku,roughnessmap_pars_fragment:Zu,shadowmap_pars_fragment:Ju,shadowmap_pars_vertex:ju,shadowmap_vertex:Qu,shadowmask_pars_fragment:td,skinbase_vertex:ed,skinning_pars_vertex:nd,skinning_vertex:id,skinnormal_vertex:sd,specularmap_fragment:rd,specularmap_pars_fragment:ad,tonemapping_fragment:od,tonemapping_pars_fragment:cd,transmission_fragment:ld,transmission_pars_fragment:hd,uv_pars_fragment:ud,uv_pars_vertex:dd,uv_vertex:fd,worldpos_vertex:pd,background_vert:md,background_frag:gd,backgroundCube_vert:_d,backgroundCube_frag:vd,cube_vert:xd,cube_frag:Md,depth_vert:Sd,depth_frag:yd,distanceRGBA_vert:Ed,distanceRGBA_frag:Td,equirect_vert:Ad,equirect_frag:wd,linedashed_vert:bd,linedashed_frag:Rd,meshbasic_vert:Cd,meshbasic_frag:Pd,meshlambert_vert:Ld,meshlambert_frag:Dd,meshmatcap_vert:Id,meshmatcap_frag:Ud,meshnormal_vert:Nd,meshnormal_frag:Od,meshphong_vert:Fd,meshphong_frag:Bd,meshphysical_vert:zd,meshphysical_frag:Gd,meshtoon_vert:Hd,meshtoon_frag:Vd,points_vert:kd,points_frag:Wd,shadow_vert:Xd,shadow_frag:qd,sprite_vert:Yd,sprite_frag:$d},ct={common:{diffuse:{value:new Ft(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Xt},alphaMap:{value:null},alphaMapTransform:{value:new Xt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Xt}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Xt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Xt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Xt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Xt},normalScale:{value:new lt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Xt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Xt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Xt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Xt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ft(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Ft(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Xt},alphaTest:{value:0},uvTransform:{value:new Xt}},sprite:{diffuse:{value:new Ft(16777215)},opacity:{value:1},center:{value:new lt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Xt},alphaMap:{value:null},alphaMapTransform:{value:new Xt},alphaTest:{value:0}}},tn={basic:{uniforms:we([ct.common,ct.specularmap,ct.envmap,ct.aomap,ct.lightmap,ct.fog]),vertexShader:Ht.meshbasic_vert,fragmentShader:Ht.meshbasic_frag},lambert:{uniforms:we([ct.common,ct.specularmap,ct.envmap,ct.aomap,ct.lightmap,ct.emissivemap,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.fog,ct.lights,{emissive:{value:new Ft(0)}}]),vertexShader:Ht.meshlambert_vert,fragmentShader:Ht.meshlambert_frag},phong:{uniforms:we([ct.common,ct.specularmap,ct.envmap,ct.aomap,ct.lightmap,ct.emissivemap,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.fog,ct.lights,{emissive:{value:new Ft(0)},specular:{value:new Ft(1118481)},shininess:{value:30}}]),vertexShader:Ht.meshphong_vert,fragmentShader:Ht.meshphong_frag},standard:{uniforms:we([ct.common,ct.envmap,ct.aomap,ct.lightmap,ct.emissivemap,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.roughnessmap,ct.metalnessmap,ct.fog,ct.lights,{emissive:{value:new Ft(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ht.meshphysical_vert,fragmentShader:Ht.meshphysical_frag},toon:{uniforms:we([ct.common,ct.aomap,ct.lightmap,ct.emissivemap,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.gradientmap,ct.fog,ct.lights,{emissive:{value:new Ft(0)}}]),vertexShader:Ht.meshtoon_vert,fragmentShader:Ht.meshtoon_frag},matcap:{uniforms:we([ct.common,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.fog,{matcap:{value:null}}]),vertexShader:Ht.meshmatcap_vert,fragmentShader:Ht.meshmatcap_frag},points:{uniforms:we([ct.points,ct.fog]),vertexShader:Ht.points_vert,fragmentShader:Ht.points_frag},dashed:{uniforms:we([ct.common,ct.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ht.linedashed_vert,fragmentShader:Ht.linedashed_frag},depth:{uniforms:we([ct.common,ct.displacementmap]),vertexShader:Ht.depth_vert,fragmentShader:Ht.depth_frag},normal:{uniforms:we([ct.common,ct.bumpmap,ct.normalmap,ct.displacementmap,{opacity:{value:1}}]),vertexShader:Ht.meshnormal_vert,fragmentShader:Ht.meshnormal_frag},sprite:{uniforms:we([ct.sprite,ct.fog]),vertexShader:Ht.sprite_vert,fragmentShader:Ht.sprite_frag},background:{uniforms:{uvTransform:{value:new Xt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ht.background_vert,fragmentShader:Ht.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1}},vertexShader:Ht.backgroundCube_vert,fragmentShader:Ht.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ht.cube_vert,fragmentShader:Ht.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ht.equirect_vert,fragmentShader:Ht.equirect_frag},distanceRGBA:{uniforms:we([ct.common,ct.displacementmap,{referencePosition:{value:new C},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ht.distanceRGBA_vert,fragmentShader:Ht.distanceRGBA_frag},shadow:{uniforms:we([ct.lights,ct.fog,{color:{value:new Ft(0)},opacity:{value:1}}]),vertexShader:Ht.shadow_vert,fragmentShader:Ht.shadow_frag}};tn.physical={uniforms:we([tn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Xt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Xt},clearcoatNormalScale:{value:new lt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Xt},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Xt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Xt},sheen:{value:0},sheenColor:{value:new Ft(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Xt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Xt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Xt},transmissionSamplerSize:{value:new lt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Xt},attenuationDistance:{value:0},attenuationColor:{value:new Ft(0)},specularColor:{value:new Ft(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Xt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Xt},anisotropyVector:{value:new lt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Xt}}]),vertexShader:Ht.meshphysical_vert,fragmentShader:Ht.meshphysical_frag};const ds={r:0,b:0,g:0};function Kd(s,t,e,n,i,r,a){const o=new Ft(0);let c=r===!0?0:1,l,h,u=null,d=0,m=null;function g(p,f){let y=!1,v=f.isScene===!0?f.background:null;v&&v.isTexture&&(v=(f.backgroundBlurriness>0?e:t).get(v)),v===null?_(o,c):v&&v.isColor&&(_(v,1),y=!0);const S=s.xr.getEnvironmentBlendMode();S==="additive"?n.buffers.color.setClear(0,0,0,1,a):S==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(s.autoClear||y)&&s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil),v&&(v.isCubeTexture||v.mapping===Rs)?(h===void 0&&(h=new ht(new Ce(1,1,1),new Hn({name:"BackgroundCubeMaterial",uniforms:vi(tn.backgroundCube.uniforms),vertexShader:tn.backgroundCube.vertexShader,fragmentShader:tn.backgroundCube.fragmentShader,side:Ie,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(D,w,b){this.matrixWorld.copyPosition(b.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(h)),h.material.uniforms.envMap.value=v,h.material.uniforms.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=f.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,h.material.toneMapped=Kt.getTransfer(v.colorSpace)!==Qt,(u!==v||d!==v.version||m!==s.toneMapping)&&(h.material.needsUpdate=!0,u=v,d=v.version,m=s.toneMapping),h.layers.enableAll(),p.unshift(h,h.geometry,h.material,0,0,null)):v&&v.isTexture&&(l===void 0&&(l=new ht(new Le(2,2),new Hn({name:"BackgroundMaterial",uniforms:vi(tn.background.uniforms),vertexShader:tn.background.vertexShader,fragmentShader:tn.background.fragmentShader,side:wn,depthTest:!1,depthWrite:!1,fog:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=v,l.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,l.material.toneMapped=Kt.getTransfer(v.colorSpace)!==Qt,v.matrixAutoUpdate===!0&&v.updateMatrix(),l.material.uniforms.uvTransform.value.copy(v.matrix),(u!==v||d!==v.version||m!==s.toneMapping)&&(l.material.needsUpdate=!0,u=v,d=v.version,m=s.toneMapping),l.layers.enableAll(),p.unshift(l,l.geometry,l.material,0,0,null))}function _(p,f){p.getRGB(ds,ec(s)),n.buffers.color.setClear(ds.r,ds.g,ds.b,f,a)}return{getClearColor:function(){return o},setClearColor:function(p,f=1){o.set(p),c=f,_(o,c)},getClearAlpha:function(){return c},setClearAlpha:function(p){c=p,_(o,c)},render:g}}function Zd(s,t,e,n){const i=s.getParameter(s.MAX_VERTEX_ATTRIBS),r=n.isWebGL2?null:t.get("OES_vertex_array_object"),a=n.isWebGL2||r!==null,o={},c=p(null);let l=c,h=!1;function u(L,F,V,K,Y){let $=!1;if(a){const Z=_(K,V,F);l!==Z&&(l=Z,m(l.object)),$=f(L,K,V,Y),$&&y(L,K,V,Y)}else{const Z=F.wireframe===!0;(l.geometry!==K.id||l.program!==V.id||l.wireframe!==Z)&&(l.geometry=K.id,l.program=V.id,l.wireframe=Z,$=!0)}Y!==null&&e.update(Y,s.ELEMENT_ARRAY_BUFFER),($||h)&&(h=!1,G(L,F,V,K),Y!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,e.get(Y).buffer))}function d(){return n.isWebGL2?s.createVertexArray():r.createVertexArrayOES()}function m(L){return n.isWebGL2?s.bindVertexArray(L):r.bindVertexArrayOES(L)}function g(L){return n.isWebGL2?s.deleteVertexArray(L):r.deleteVertexArrayOES(L)}function _(L,F,V){const K=V.wireframe===!0;let Y=o[L.id];Y===void 0&&(Y={},o[L.id]=Y);let $=Y[F.id];$===void 0&&($={},Y[F.id]=$);let Z=$[K];return Z===void 0&&(Z=p(d()),$[K]=Z),Z}function p(L){const F=[],V=[],K=[];for(let Y=0;Y<i;Y++)F[Y]=0,V[Y]=0,K[Y]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:F,enabledAttributes:V,attributeDivisors:K,object:L,attributes:{},index:null}}function f(L,F,V,K){const Y=l.attributes,$=F.attributes;let Z=0;const it=V.getAttributes();for(const rt in it)if(it[rt].location>=0){const j=Y[rt];let pt=$[rt];if(pt===void 0&&(rt==="instanceMatrix"&&L.instanceMatrix&&(pt=L.instanceMatrix),rt==="instanceColor"&&L.instanceColor&&(pt=L.instanceColor)),j===void 0||j.attribute!==pt||pt&&j.data!==pt.data)return!0;Z++}return l.attributesNum!==Z||l.index!==K}function y(L,F,V,K){const Y={},$=F.attributes;let Z=0;const it=V.getAttributes();for(const rt in it)if(it[rt].location>=0){let j=$[rt];j===void 0&&(rt==="instanceMatrix"&&L.instanceMatrix&&(j=L.instanceMatrix),rt==="instanceColor"&&L.instanceColor&&(j=L.instanceColor));const pt={};pt.attribute=j,j&&j.data&&(pt.data=j.data),Y[rt]=pt,Z++}l.attributes=Y,l.attributesNum=Z,l.index=K}function v(){const L=l.newAttributes;for(let F=0,V=L.length;F<V;F++)L[F]=0}function S(L){D(L,0)}function D(L,F){const V=l.newAttributes,K=l.enabledAttributes,Y=l.attributeDivisors;V[L]=1,K[L]===0&&(s.enableVertexAttribArray(L),K[L]=1),Y[L]!==F&&((n.isWebGL2?s:t.get("ANGLE_instanced_arrays"))[n.isWebGL2?"vertexAttribDivisor":"vertexAttribDivisorANGLE"](L,F),Y[L]=F)}function w(){const L=l.newAttributes,F=l.enabledAttributes;for(let V=0,K=F.length;V<K;V++)F[V]!==L[V]&&(s.disableVertexAttribArray(V),F[V]=0)}function b(L,F,V,K,Y,$,Z){Z===!0?s.vertexAttribIPointer(L,F,V,Y,$):s.vertexAttribPointer(L,F,V,K,Y,$)}function G(L,F,V,K){if(n.isWebGL2===!1&&(L.isInstancedMesh||K.isInstancedBufferGeometry)&&t.get("ANGLE_instanced_arrays")===null)return;v();const Y=K.attributes,$=V.getAttributes(),Z=F.defaultAttributeValues;for(const it in $){const rt=$[it];if(rt.location>=0){let W=Y[it];if(W===void 0&&(it==="instanceMatrix"&&L.instanceMatrix&&(W=L.instanceMatrix),it==="instanceColor"&&L.instanceColor&&(W=L.instanceColor)),W!==void 0){const j=W.normalized,pt=W.itemSize,St=e.get(W);if(St===void 0)continue;const _t=St.buffer,Ct=St.type,Nt=St.bytesPerElement,yt=n.isWebGL2===!0&&(Ct===s.INT||Ct===s.UNSIGNED_INT||W.gpuType===Fo);if(W.isInterleavedBufferAttribute){const Dt=W.data,R=Dt.stride,at=W.offset;if(Dt.isInstancedInterleavedBuffer){for(let q=0;q<rt.locationSize;q++)D(rt.location+q,Dt.meshPerAttribute);L.isInstancedMesh!==!0&&K._maxInstanceCount===void 0&&(K._maxInstanceCount=Dt.meshPerAttribute*Dt.count)}else for(let q=0;q<rt.locationSize;q++)S(rt.location+q);s.bindBuffer(s.ARRAY_BUFFER,_t);for(let q=0;q<rt.locationSize;q++)b(rt.location+q,pt/rt.locationSize,Ct,j,R*Nt,(at+pt/rt.locationSize*q)*Nt,yt)}else{if(W.isInstancedBufferAttribute){for(let Dt=0;Dt<rt.locationSize;Dt++)D(rt.location+Dt,W.meshPerAttribute);L.isInstancedMesh!==!0&&K._maxInstanceCount===void 0&&(K._maxInstanceCount=W.meshPerAttribute*W.count)}else for(let Dt=0;Dt<rt.locationSize;Dt++)S(rt.location+Dt);s.bindBuffer(s.ARRAY_BUFFER,_t);for(let Dt=0;Dt<rt.locationSize;Dt++)b(rt.location+Dt,pt/rt.locationSize,Ct,j,pt*Nt,pt/rt.locationSize*Dt*Nt,yt)}}else if(Z!==void 0){const j=Z[it];if(j!==void 0)switch(j.length){case 2:s.vertexAttrib2fv(rt.location,j);break;case 3:s.vertexAttrib3fv(rt.location,j);break;case 4:s.vertexAttrib4fv(rt.location,j);break;default:s.vertexAttrib1fv(rt.location,j)}}}}w()}function M(){k();for(const L in o){const F=o[L];for(const V in F){const K=F[V];for(const Y in K)g(K[Y].object),delete K[Y];delete F[V]}delete o[L]}}function A(L){if(o[L.id]===void 0)return;const F=o[L.id];for(const V in F){const K=F[V];for(const Y in K)g(K[Y].object),delete K[Y];delete F[V]}delete o[L.id]}function O(L){for(const F in o){const V=o[F];if(V[L.id]===void 0)continue;const K=V[L.id];for(const Y in K)g(K[Y].object),delete K[Y];delete V[L.id]}}function k(){nt(),h=!0,l!==c&&(l=c,m(l.object))}function nt(){c.geometry=null,c.program=null,c.wireframe=!1}return{setup:u,reset:k,resetDefaultState:nt,dispose:M,releaseStatesOfGeometry:A,releaseStatesOfProgram:O,initAttributes:v,enableAttribute:S,disableUnusedAttributes:w}}function Jd(s,t,e,n){const i=n.isWebGL2;let r;function a(h){r=h}function o(h,u){s.drawArrays(r,h,u),e.update(u,r,1)}function c(h,u,d){if(d===0)return;let m,g;if(i)m=s,g="drawArraysInstanced";else if(m=t.get("ANGLE_instanced_arrays"),g="drawArraysInstancedANGLE",m===null){console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}m[g](r,h,u,d),e.update(u,r,d)}function l(h,u,d){if(d===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let g=0;g<d;g++)this.render(h[g],u[g]);else{m.multiDrawArraysWEBGL(r,h,0,u,0,d);let g=0;for(let _=0;_<d;_++)g+=u[_];e.update(g,r,1)}}this.setMode=a,this.render=o,this.renderInstances=c,this.renderMultiDraw=l}function jd(s,t,e){let n;function i(){if(n!==void 0)return n;if(t.has("EXT_texture_filter_anisotropic")===!0){const b=t.get("EXT_texture_filter_anisotropic");n=s.getParameter(b.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n}function r(b){if(b==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";b="mediump"}return b==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}const a=typeof WebGL2RenderingContext<"u"&&s.constructor.name==="WebGL2RenderingContext";let o=e.precision!==void 0?e.precision:"highp";const c=r(o);c!==o&&(console.warn("THREE.WebGLRenderer:",o,"not supported, using",c,"instead."),o=c);const l=a||t.has("WEBGL_draw_buffers"),h=e.logarithmicDepthBuffer===!0,u=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),d=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),m=s.getParameter(s.MAX_TEXTURE_SIZE),g=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),_=s.getParameter(s.MAX_VERTEX_ATTRIBS),p=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),f=s.getParameter(s.MAX_VARYING_VECTORS),y=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),v=d>0,S=a||t.has("OES_texture_float"),D=v&&S,w=a?s.getParameter(s.MAX_SAMPLES):0;return{isWebGL2:a,drawBuffers:l,getMaxAnisotropy:i,getMaxPrecision:r,precision:o,logarithmicDepthBuffer:h,maxTextures:u,maxVertexTextures:d,maxTextureSize:m,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:p,maxVaryings:f,maxFragmentUniforms:y,vertexTextures:v,floatFragmentTextures:S,floatVertexTextures:D,maxSamples:w}}function Qd(s){const t=this;let e=null,n=0,i=!1,r=!1;const a=new In,o=new Xt,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){const m=u.length!==0||d||n!==0||i;return i=d,n=u.length,m},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){e=h(u,d,0)},this.setState=function(u,d,m){const g=u.clippingPlanes,_=u.clipIntersection,p=u.clipShadows,f=s.get(u);if(!i||g===null||g.length===0||r&&!p)r?h(null):l();else{const y=r?0:n,v=y*4;let S=f.clippingState||null;c.value=S,S=h(g,d,v,m);for(let D=0;D!==v;++D)S[D]=e[D];f.clippingState=S,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=y}};function l(){c.value!==e&&(c.value=e,c.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(u,d,m,g){const _=u!==null?u.length:0;let p=null;if(_!==0){if(p=c.value,g!==!0||p===null){const f=m+_*4,y=d.matrixWorldInverse;o.getNormalMatrix(y),(p===null||p.length<f)&&(p=new Float32Array(f));for(let v=0,S=m;v!==_;++v,S+=4)a.copy(u[v]).applyMatrix4(y,o),a.normal.toArray(p,S),p[S+3]=a.constant}c.value=p,c.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,p}}function tf(s){let t=new WeakMap;function e(a,o){return o===Mr?a.mapping=mi:o===Sr&&(a.mapping=gi),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===Mr||o===Sr)if(t.has(a)){const c=t.get(a).texture;return e(c,a.mapping)}else{const c=a.image;if(c&&c.height>0){const l=new dh(c.height/2);return l.fromEquirectangularTexture(s,a),t.set(a,l),a.addEventListener("dispose",i),e(l.texture,a.mapping)}else return null}}return a}function i(a){const o=a.target;o.removeEventListener("dispose",i);const c=t.get(o);c!==void 0&&(t.delete(o),c.dispose())}function r(){t=new WeakMap}return{get:n,dispose:r}}class rc extends nc{constructor(t=-1,e=1,n=1,i=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=i,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,i,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2;let r=n-t,a=n+t,o=i+e,c=i-e;if(this.view!==null&&this.view.enabled){const l=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,a=r+l*this.view.width,o-=h*this.view.offsetY,c=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,c,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const hi=4,Za=[.125,.215,.35,.446,.526,.582],On=20,or=new rc,Ja=new Ft;let cr=null,lr=0,hr=0;const Un=(1+Math.sqrt(5))/2,ai=1/Un,ja=[new C(1,1,1),new C(-1,1,1),new C(1,1,-1),new C(-1,1,-1),new C(0,Un,ai),new C(0,Un,-ai),new C(ai,0,Un),new C(-ai,0,Un),new C(Un,ai,0),new C(-Un,ai,0)];class Qa{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,i=100){cr=this._renderer.getRenderTarget(),lr=this._renderer.getActiveCubeFace(),hr=this._renderer.getActiveMipmapLevel(),this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,n,i,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=no(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=eo(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(cr,lr,hr),t.scissorTest=!1,fs(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===mi||t.mapping===gi?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),cr=this._renderer.getRenderTarget(),lr=this._renderer.getActiveCubeFace(),hr=this._renderer.getActiveMipmapLevel();const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:Ve,minFilter:Ve,generateMipmaps:!1,type:Oi,format:je,colorSpace:dn,depthBuffer:!1},i=to(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=to(t,e,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=ef(r)),this._blurMaterial=nf(r,t,e)}return i}_compileMaterial(t){const e=new ht(this._lodPlanes[0],t);this._renderer.compile(e,or)}_sceneToCubeUV(t,e,n,i){const o=new ke(90,1,e,n),c=[1,-1,1,1,1,1],l=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(Ja),h.toneMapping=En,h.autoClear=!1;const m=new ze({name:"PMREM.Background",side:Ie,depthWrite:!1,depthTest:!1}),g=new ht(new Ce,m);let _=!1;const p=t.background;p?p.isColor&&(m.color.copy(p),t.background=null,_=!0):(m.color.copy(Ja),_=!0);for(let f=0;f<6;f++){const y=f%3;y===0?(o.up.set(0,c[f],0),o.lookAt(l[f],0,0)):y===1?(o.up.set(0,0,c[f]),o.lookAt(0,l[f],0)):(o.up.set(0,c[f],0),o.lookAt(0,0,l[f]));const v=this._cubeSize;fs(i,y*v,f>2?v:0,v,v),h.setRenderTarget(i),_&&h.render(g,o),h.render(t,o)}g.geometry.dispose(),g.material.dispose(),h.toneMapping=d,h.autoClear=u,t.background=p}_textureToCubeUV(t,e){const n=this._renderer,i=t.mapping===mi||t.mapping===gi;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=no()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=eo());const r=i?this._cubemapMaterial:this._equirectMaterial,a=new ht(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=t;const c=this._cubeSize;fs(e,0,0,3*c,2*c),n.setRenderTarget(e),n.render(a,or)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;for(let i=1;i<this._lodPlanes.length;i++){const r=Math.sqrt(this._sigmas[i]*this._sigmas[i]-this._sigmas[i-1]*this._sigmas[i-1]),a=ja[(i-1)%ja.length];this._blur(t,i-1,i,r,a)}e.autoClear=n}_blur(t,e,n,i,r){const a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,i,"latitudinal",r),this._halfBlur(a,t,n,n,i,"longitudinal",r)}_halfBlur(t,e,n,i,r,a,o){const c=this._renderer,l=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,u=new ht(this._lodPlanes[i],l),d=l.uniforms,m=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*m):2*Math.PI/(2*On-1),_=r/g,p=isFinite(r)?1+Math.floor(h*_):On;p>On&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${p} samples when the maximum is set to ${On}`);const f=[];let y=0;for(let b=0;b<On;++b){const G=b/_,M=Math.exp(-G*G/2);f.push(M),b===0?y+=M:b<p&&(y+=2*M)}for(let b=0;b<f.length;b++)f[b]=f[b]/y;d.envMap.value=t.texture,d.samples.value=p,d.weights.value=f,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:v}=this;d.dTheta.value=g,d.mipInt.value=v-n;const S=this._sizeLods[i],D=3*S*(i>v-hi?i-v+hi:0),w=4*(this._cubeSize-S);fs(e,D,w,3*S,2*S),c.setRenderTarget(e),c.render(u,or)}}function ef(s){const t=[],e=[],n=[];let i=s;const r=s-hi+1+Za.length;for(let a=0;a<r;a++){const o=Math.pow(2,i);e.push(o);let c=1/o;a>s-hi?c=Za[a-s+hi-1]:a===0&&(c=0),n.push(c);const l=1/(o-2),h=-l,u=1+l,d=[h,h,u,h,u,u,h,h,u,u,h,u],m=6,g=6,_=3,p=2,f=1,y=new Float32Array(_*g*m),v=new Float32Array(p*g*m),S=new Float32Array(f*g*m);for(let w=0;w<m;w++){const b=w%3*2/3-1,G=w>2?0:-1,M=[b,G,0,b+2/3,G,0,b+2/3,G+1,0,b,G,0,b+2/3,G+1,0,b,G+1,0];y.set(M,_*g*w),v.set(d,p*g*w);const A=[w,w,w,w,w,w];S.set(A,f*g*w)}const D=new Ne;D.setAttribute("position",new Xe(y,_)),D.setAttribute("uv",new Xe(v,p)),D.setAttribute("faceIndex",new Xe(S,f)),t.push(D),i>hi&&i--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function to(s,t,e){const n=new Gn(s,t,e);return n.texture.mapping=Rs,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function fs(s,t,e,n,i){s.viewport.set(t,e,n,i),s.scissor.set(t,e,n,i)}function nf(s,t,e){const n=new Float32Array(On),i=new C(0,1,0);return new Hn({name:"SphericalGaussianBlur",defines:{n:On,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:Or(),fragmentShader:`

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
		`,blending:yn,depthTest:!1,depthWrite:!1})}function eo(){return new Hn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Or(),fragmentShader:`

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
		`,blending:yn,depthTest:!1,depthWrite:!1})}function no(){return new Hn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Or(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:yn,depthTest:!1,depthWrite:!1})}function Or(){return`

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
	`}function sf(s){let t=new WeakMap,e=null;function n(o){if(o&&o.isTexture){const c=o.mapping,l=c===Mr||c===Sr,h=c===mi||c===gi;if(l||h)if(o.isRenderTargetTexture&&o.needsPMREMUpdate===!0){o.needsPMREMUpdate=!1;let u=t.get(o);return e===null&&(e=new Qa(s)),u=l?e.fromEquirectangular(o,u):e.fromCubemap(o,u),t.set(o,u),u.texture}else{if(t.has(o))return t.get(o).texture;{const u=o.image;if(l&&u&&u.height>0||h&&u&&i(u)){e===null&&(e=new Qa(s));const d=l?e.fromEquirectangular(o):e.fromCubemap(o);return t.set(o,d),o.addEventListener("dispose",r),d.texture}else return null}}}return o}function i(o){let c=0;const l=6;for(let h=0;h<l;h++)o[h]!==void 0&&c++;return c===l}function r(o){const c=o.target;c.removeEventListener("dispose",r);const l=t.get(c);l!==void 0&&(t.delete(c),l.dispose())}function a(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:a}}function rf(s){const t={};function e(n){if(t[n]!==void 0)return t[n];let i;switch(n){case"WEBGL_depth_texture":i=s.getExtension("WEBGL_depth_texture")||s.getExtension("MOZ_WEBGL_depth_texture")||s.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=s.getExtension("EXT_texture_filter_anisotropic")||s.getExtension("MOZ_EXT_texture_filter_anisotropic")||s.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=s.getExtension("WEBGL_compressed_texture_s3tc")||s.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=s.getExtension("WEBGL_compressed_texture_pvrtc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=s.getExtension(n)}return t[n]=i,i}return{has:function(n){return e(n)!==null},init:function(n){n.isWebGL2?(e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance")):(e("WEBGL_depth_texture"),e("OES_texture_float"),e("OES_texture_half_float"),e("OES_texture_half_float_linear"),e("OES_standard_derivatives"),e("OES_element_index_uint"),e("OES_vertex_array_object"),e("ANGLE_instanced_arrays")),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture")},get:function(n){const i=e(n);return i===null&&console.warn("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function af(s,t,e,n){const i={},r=new WeakMap;function a(u){const d=u.target;d.index!==null&&t.remove(d.index);for(const g in d.attributes)t.remove(d.attributes[g]);for(const g in d.morphAttributes){const _=d.morphAttributes[g];for(let p=0,f=_.length;p<f;p++)t.remove(_[p])}d.removeEventListener("dispose",a),delete i[d.id];const m=r.get(d);m&&(t.remove(m),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function o(u,d){return i[d.id]===!0||(d.addEventListener("dispose",a),i[d.id]=!0,e.memory.geometries++),d}function c(u){const d=u.attributes;for(const g in d)t.update(d[g],s.ARRAY_BUFFER);const m=u.morphAttributes;for(const g in m){const _=m[g];for(let p=0,f=_.length;p<f;p++)t.update(_[p],s.ARRAY_BUFFER)}}function l(u){const d=[],m=u.index,g=u.attributes.position;let _=0;if(m!==null){const y=m.array;_=m.version;for(let v=0,S=y.length;v<S;v+=3){const D=y[v+0],w=y[v+1],b=y[v+2];d.push(D,w,w,b,b,D)}}else if(g!==void 0){const y=g.array;_=g.version;for(let v=0,S=y.length/3-1;v<S;v+=3){const D=v+0,w=v+1,b=v+2;d.push(D,w,w,b,b,D)}}else return;const p=new(Yo(d)?tc:Qo)(d,1);p.version=_;const f=r.get(u);f&&t.remove(f),r.set(u,p)}function h(u){const d=r.get(u);if(d){const m=u.index;m!==null&&d.version<m.version&&l(u)}else l(u);return r.get(u)}return{get:o,update:c,getWireframeAttribute:h}}function of(s,t,e,n){const i=n.isWebGL2;let r;function a(m){r=m}let o,c;function l(m){o=m.type,c=m.bytesPerElement}function h(m,g){s.drawElements(r,g,o,m*c),e.update(g,r,1)}function u(m,g,_){if(_===0)return;let p,f;if(i)p=s,f="drawElementsInstanced";else if(p=t.get("ANGLE_instanced_arrays"),f="drawElementsInstancedANGLE",p===null){console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}p[f](r,g,o,m*c,_),e.update(g,r,_)}function d(m,g,_){if(_===0)return;const p=t.get("WEBGL_multi_draw");if(p===null)for(let f=0;f<_;f++)this.render(m[f]/c,g[f]);else{p.multiDrawElementsWEBGL(r,g,0,o,m,0,_);let f=0;for(let y=0;y<_;y++)f+=g[y];e.update(f,r,1)}}this.setMode=a,this.setIndex=l,this.render=h,this.renderInstances=u,this.renderMultiDraw=d}function cf(s){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(e.calls++,a){case s.TRIANGLES:e.triangles+=o*(r/3);break;case s.LINES:e.lines+=o*(r/2);break;case s.LINE_STRIP:e.lines+=o*(r-1);break;case s.LINE_LOOP:e.lines+=o*r;break;case s.POINTS:e.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function i(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:i,update:n}}function lf(s,t){return s[0]-t[0]}function hf(s,t){return Math.abs(t[1])-Math.abs(s[1])}function uf(s,t,e){const n={},i=new Float32Array(8),r=new WeakMap,a=new _e,o=[];for(let l=0;l<8;l++)o[l]=[l,0];function c(l,h,u){const d=l.morphTargetInfluences;if(t.isWebGL2===!0){const g=h.morphAttributes.position||h.morphAttributes.normal||h.morphAttributes.color,_=g!==void 0?g.length:0;let p=r.get(h);if(p===void 0||p.count!==_){let F=function(){nt.dispose(),r.delete(h),h.removeEventListener("dispose",F)};var m=F;p!==void 0&&p.texture.dispose();const v=h.morphAttributes.position!==void 0,S=h.morphAttributes.normal!==void 0,D=h.morphAttributes.color!==void 0,w=h.morphAttributes.position||[],b=h.morphAttributes.normal||[],G=h.morphAttributes.color||[];let M=0;v===!0&&(M=1),S===!0&&(M=2),D===!0&&(M=3);let A=h.attributes.position.count*M,O=1;A>t.maxTextureSize&&(O=Math.ceil(A/t.maxTextureSize),A=t.maxTextureSize);const k=new Float32Array(A*O*4*_),nt=new Zo(k,A,O,_);nt.type=Sn,nt.needsUpdate=!0;const L=M*4;for(let V=0;V<_;V++){const K=w[V],Y=b[V],$=G[V],Z=A*O*4*V;for(let it=0;it<K.count;it++){const rt=it*L;v===!0&&(a.fromBufferAttribute(K,it),k[Z+rt+0]=a.x,k[Z+rt+1]=a.y,k[Z+rt+2]=a.z,k[Z+rt+3]=0),S===!0&&(a.fromBufferAttribute(Y,it),k[Z+rt+4]=a.x,k[Z+rt+5]=a.y,k[Z+rt+6]=a.z,k[Z+rt+7]=0),D===!0&&(a.fromBufferAttribute($,it),k[Z+rt+8]=a.x,k[Z+rt+9]=a.y,k[Z+rt+10]=a.z,k[Z+rt+11]=$.itemSize===4?a.w:1)}}p={count:_,texture:nt,size:new lt(A,O)},r.set(h,p),h.addEventListener("dispose",F)}let f=0;for(let v=0;v<d.length;v++)f+=d[v];const y=h.morphTargetsRelative?1:1-f;u.getUniforms().setValue(s,"morphTargetBaseInfluence",y),u.getUniforms().setValue(s,"morphTargetInfluences",d),u.getUniforms().setValue(s,"morphTargetsTexture",p.texture,e),u.getUniforms().setValue(s,"morphTargetsTextureSize",p.size)}else{const g=d===void 0?0:d.length;let _=n[h.id];if(_===void 0||_.length!==g){_=[];for(let S=0;S<g;S++)_[S]=[S,0];n[h.id]=_}for(let S=0;S<g;S++){const D=_[S];D[0]=S,D[1]=d[S]}_.sort(hf);for(let S=0;S<8;S++)S<g&&_[S][1]?(o[S][0]=_[S][0],o[S][1]=_[S][1]):(o[S][0]=Number.MAX_SAFE_INTEGER,o[S][1]=0);o.sort(lf);const p=h.morphAttributes.position,f=h.morphAttributes.normal;let y=0;for(let S=0;S<8;S++){const D=o[S],w=D[0],b=D[1];w!==Number.MAX_SAFE_INTEGER&&b?(p&&h.getAttribute("morphTarget"+S)!==p[w]&&h.setAttribute("morphTarget"+S,p[w]),f&&h.getAttribute("morphNormal"+S)!==f[w]&&h.setAttribute("morphNormal"+S,f[w]),i[S]=b,y+=b):(p&&h.hasAttribute("morphTarget"+S)===!0&&h.deleteAttribute("morphTarget"+S),f&&h.hasAttribute("morphNormal"+S)===!0&&h.deleteAttribute("morphNormal"+S),i[S]=0)}const v=h.morphTargetsRelative?1:1-y;u.getUniforms().setValue(s,"morphTargetBaseInfluence",v),u.getUniforms().setValue(s,"morphTargetInfluences",i)}}return{update:c}}function df(s,t,e,n){let i=new WeakMap;function r(c){const l=n.render.frame,h=c.geometry,u=t.get(c,h);if(i.get(u)!==l&&(t.update(u),i.set(u,l)),c.isInstancedMesh&&(c.hasEventListener("dispose",o)===!1&&c.addEventListener("dispose",o),i.get(c)!==l&&(e.update(c.instanceMatrix,s.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,s.ARRAY_BUFFER),i.set(c,l))),c.isSkinnedMesh){const d=c.skeleton;i.get(d)!==l&&(d.update(),i.set(d,l))}return u}function a(){i=new WeakMap}function o(c){const l=c.target;l.removeEventListener("dispose",o),e.remove(l.instanceMatrix),l.instanceColor!==null&&e.remove(l.instanceColor)}return{update:r,dispose:a}}class ac extends Ue{constructor(t,e,n,i,r,a,o,c,l,h){if(h=h!==void 0?h:Bn,h!==Bn&&h!==_i)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===Bn&&(n=Mn),n===void 0&&h===_i&&(n=Fn),super(null,i,r,a,o,c,h,n,l),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=o!==void 0?o:Re,this.minFilter=c!==void 0?c:Re,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const oc=new Ue,cc=new ac(1,1);cc.compareFunction=qo;const lc=new Zo,hc=new $l,uc=new ic,io=[],so=[],ro=new Float32Array(16),ao=new Float32Array(9),oo=new Float32Array(4);function Si(s,t,e){const n=s[0];if(n<=0||n>0)return s;const i=t*e;let r=io[i];if(r===void 0&&(r=new Float32Array(i),io[i]=r),t!==0){n.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,s[a].toArray(r,o)}return r}function ue(s,t){if(s.length!==t.length)return!1;for(let e=0,n=s.length;e<n;e++)if(s[e]!==t[e])return!1;return!0}function de(s,t){for(let e=0,n=t.length;e<n;e++)s[e]=t[e]}function Ls(s,t){let e=so[t];e===void 0&&(e=new Int32Array(t),so[t]=e);for(let n=0;n!==t;++n)e[n]=s.allocateTextureUnit();return e}function ff(s,t){const e=this.cache;e[0]!==t&&(s.uniform1f(this.addr,t),e[0]=t)}function pf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ue(e,t))return;s.uniform2fv(this.addr,t),de(e,t)}}function mf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(s.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(ue(e,t))return;s.uniform3fv(this.addr,t),de(e,t)}}function gf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ue(e,t))return;s.uniform4fv(this.addr,t),de(e,t)}}function _f(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(ue(e,t))return;s.uniformMatrix2fv(this.addr,!1,t),de(e,t)}else{if(ue(e,n))return;oo.set(n),s.uniformMatrix2fv(this.addr,!1,oo),de(e,n)}}function vf(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(ue(e,t))return;s.uniformMatrix3fv(this.addr,!1,t),de(e,t)}else{if(ue(e,n))return;ao.set(n),s.uniformMatrix3fv(this.addr,!1,ao),de(e,n)}}function xf(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(ue(e,t))return;s.uniformMatrix4fv(this.addr,!1,t),de(e,t)}else{if(ue(e,n))return;ro.set(n),s.uniformMatrix4fv(this.addr,!1,ro),de(e,n)}}function Mf(s,t){const e=this.cache;e[0]!==t&&(s.uniform1i(this.addr,t),e[0]=t)}function Sf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ue(e,t))return;s.uniform2iv(this.addr,t),de(e,t)}}function yf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(ue(e,t))return;s.uniform3iv(this.addr,t),de(e,t)}}function Ef(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ue(e,t))return;s.uniform4iv(this.addr,t),de(e,t)}}function Tf(s,t){const e=this.cache;e[0]!==t&&(s.uniform1ui(this.addr,t),e[0]=t)}function Af(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ue(e,t))return;s.uniform2uiv(this.addr,t),de(e,t)}}function wf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(ue(e,t))return;s.uniform3uiv(this.addr,t),de(e,t)}}function bf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ue(e,t))return;s.uniform4uiv(this.addr,t),de(e,t)}}function Rf(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i);const r=this.type===s.SAMPLER_2D_SHADOW?cc:oc;e.setTexture2D(t||r,i)}function Cf(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTexture3D(t||hc,i)}function Pf(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTextureCube(t||uc,i)}function Lf(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTexture2DArray(t||lc,i)}function Df(s){switch(s){case 5126:return ff;case 35664:return pf;case 35665:return mf;case 35666:return gf;case 35674:return _f;case 35675:return vf;case 35676:return xf;case 5124:case 35670:return Mf;case 35667:case 35671:return Sf;case 35668:case 35672:return yf;case 35669:case 35673:return Ef;case 5125:return Tf;case 36294:return Af;case 36295:return wf;case 36296:return bf;case 35678:case 36198:case 36298:case 36306:case 35682:return Rf;case 35679:case 36299:case 36307:return Cf;case 35680:case 36300:case 36308:case 36293:return Pf;case 36289:case 36303:case 36311:case 36292:return Lf}}function If(s,t){s.uniform1fv(this.addr,t)}function Uf(s,t){const e=Si(t,this.size,2);s.uniform2fv(this.addr,e)}function Nf(s,t){const e=Si(t,this.size,3);s.uniform3fv(this.addr,e)}function Of(s,t){const e=Si(t,this.size,4);s.uniform4fv(this.addr,e)}function Ff(s,t){const e=Si(t,this.size,4);s.uniformMatrix2fv(this.addr,!1,e)}function Bf(s,t){const e=Si(t,this.size,9);s.uniformMatrix3fv(this.addr,!1,e)}function zf(s,t){const e=Si(t,this.size,16);s.uniformMatrix4fv(this.addr,!1,e)}function Gf(s,t){s.uniform1iv(this.addr,t)}function Hf(s,t){s.uniform2iv(this.addr,t)}function Vf(s,t){s.uniform3iv(this.addr,t)}function kf(s,t){s.uniform4iv(this.addr,t)}function Wf(s,t){s.uniform1uiv(this.addr,t)}function Xf(s,t){s.uniform2uiv(this.addr,t)}function qf(s,t){s.uniform3uiv(this.addr,t)}function Yf(s,t){s.uniform4uiv(this.addr,t)}function $f(s,t,e){const n=this.cache,i=t.length,r=Ls(e,i);ue(n,r)||(s.uniform1iv(this.addr,r),de(n,r));for(let a=0;a!==i;++a)e.setTexture2D(t[a]||oc,r[a])}function Kf(s,t,e){const n=this.cache,i=t.length,r=Ls(e,i);ue(n,r)||(s.uniform1iv(this.addr,r),de(n,r));for(let a=0;a!==i;++a)e.setTexture3D(t[a]||hc,r[a])}function Zf(s,t,e){const n=this.cache,i=t.length,r=Ls(e,i);ue(n,r)||(s.uniform1iv(this.addr,r),de(n,r));for(let a=0;a!==i;++a)e.setTextureCube(t[a]||uc,r[a])}function Jf(s,t,e){const n=this.cache,i=t.length,r=Ls(e,i);ue(n,r)||(s.uniform1iv(this.addr,r),de(n,r));for(let a=0;a!==i;++a)e.setTexture2DArray(t[a]||lc,r[a])}function jf(s){switch(s){case 5126:return If;case 35664:return Uf;case 35665:return Nf;case 35666:return Of;case 35674:return Ff;case 35675:return Bf;case 35676:return zf;case 5124:case 35670:return Gf;case 35667:case 35671:return Hf;case 35668:case 35672:return Vf;case 35669:case 35673:return kf;case 5125:return Wf;case 36294:return Xf;case 36295:return qf;case 36296:return Yf;case 35678:case 36198:case 36298:case 36306:case 35682:return $f;case 35679:case 36299:case 36307:return Kf;case 35680:case 36300:case 36308:case 36293:return Zf;case 36289:case 36303:case 36311:case 36292:return Jf}}class Qf{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=Df(e.type)}}class tp{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=jf(e.type)}}class ep{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const i=this.seq;for(let r=0,a=i.length;r!==a;++r){const o=i[r];o.setValue(t,e[o.id],n)}}}const ur=/(\w+)(\])?(\[|\.)?/g;function co(s,t){s.seq.push(t),s.map[t.id]=t}function np(s,t,e){const n=s.name,i=n.length;for(ur.lastIndex=0;;){const r=ur.exec(n),a=ur.lastIndex;let o=r[1];const c=r[2]==="]",l=r[3];if(c&&(o=o|0),l===void 0||l==="["&&a+2===i){co(e,l===void 0?new Qf(o,s,t):new tp(o,s,t));break}else{let u=e.map[o];u===void 0&&(u=new ep(o),co(e,u)),e=u}}}class vs{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let i=0;i<n;++i){const r=t.getActiveUniform(e,i),a=t.getUniformLocation(e,r.name);np(r,a,this)}}setValue(t,e,n,i){const r=this.map[e];r!==void 0&&r.setValue(t,n,i)}setOptional(t,e,n){const i=e[n];i!==void 0&&this.setValue(t,n,i)}static upload(t,e,n,i){for(let r=0,a=e.length;r!==a;++r){const o=e[r],c=n[o.id];c.needsUpdate!==!1&&o.setValue(t,c.value,i)}}static seqWithValue(t,e){const n=[];for(let i=0,r=t.length;i!==r;++i){const a=t[i];a.id in e&&n.push(a)}return n}}function lo(s,t,e){const n=s.createShader(t);return s.shaderSource(n,e),s.compileShader(n),n}const ip=37297;let sp=0;function rp(s,t){const e=s.split(`
`),n=[],i=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=i;a<r;a++){const o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}function ap(s){const t=Kt.getPrimaries(Kt.workingColorSpace),e=Kt.getPrimaries(s);let n;switch(t===e?n="":t===Es&&e===ys?n="LinearDisplayP3ToLinearSRGB":t===ys&&e===Es&&(n="LinearSRGBToLinearDisplayP3"),s){case dn:case Cs:return[n,"LinearTransferOETF"];case ve:case Ir:return[n,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space:",s),[n,"LinearTransferOETF"]}}function ho(s,t,e){const n=s.getShaderParameter(t,s.COMPILE_STATUS),i=s.getShaderInfoLog(t).trim();if(n&&i==="")return"";const r=/ERROR: 0:(\d+)/.exec(i);if(r){const a=parseInt(r[1]);return e.toUpperCase()+`

`+i+`

`+rp(s.getShaderSource(t),a)}else return i}function op(s,t){const e=ap(t);return`vec4 ${s}( vec4 value ) { return ${e[0]}( ${e[1]}( value ) ); }`}function cp(s,t){let e;switch(t){case il:e="Linear";break;case sl:e="Reinhard";break;case rl:e="OptimizedCineon";break;case al:e="ACESFilmic";break;case cl:e="AgX";break;case ol:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+s+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}function lp(s){return[s.extensionDerivatives||s.envMapCubeUVHeight||s.bumpMap||s.normalMapTangentSpace||s.clearcoatNormalMap||s.flatShading||s.shaderID==="physical"?"#extension GL_OES_standard_derivatives : enable":"",(s.extensionFragDepth||s.logarithmicDepthBuffer)&&s.rendererExtensionFragDepth?"#extension GL_EXT_frag_depth : enable":"",s.extensionDrawBuffers&&s.rendererExtensionDrawBuffers?"#extension GL_EXT_draw_buffers : require":"",(s.extensionShaderTextureLOD||s.envMap||s.transmission)&&s.rendererExtensionShaderTextureLod?"#extension GL_EXT_shader_texture_lod : enable":""].filter(ui).join(`
`)}function hp(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":""].filter(ui).join(`
`)}function up(s){const t=[];for(const e in s){const n=s[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function dp(s,t){const e={},n=s.getProgramParameter(t,s.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){const r=s.getActiveAttrib(t,i),a=r.name;let o=1;r.type===s.FLOAT_MAT2&&(o=2),r.type===s.FLOAT_MAT3&&(o=3),r.type===s.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:s.getAttribLocation(t,a),locationSize:o}}return e}function ui(s){return s!==""}function uo(s,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return s.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function fo(s,t){return s.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const fp=/^[ \t]*#include +<([\w\d./]+)>/gm;function wr(s){return s.replace(fp,mp)}const pp=new Map([["encodings_fragment","colorspace_fragment"],["encodings_pars_fragment","colorspace_pars_fragment"],["output_fragment","opaque_fragment"]]);function mp(s,t){let e=Ht[t];if(e===void 0){const n=pp.get(t);if(n!==void 0)e=Ht[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return wr(e)}const gp=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function po(s){return s.replace(gp,_p)}function _p(s,t,e,n){let i="";for(let r=parseInt(t);r<parseInt(e);r++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return i}function mo(s){let t="precision "+s.precision+` float;
precision `+s.precision+" int;";return s.precision==="highp"?t+=`
#define HIGH_PRECISION`:s.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function vp(s){let t="SHADOWMAP_TYPE_BASIC";return s.shadowMapType===Io?t="SHADOWMAP_TYPE_PCF":s.shadowMapType===Uo?t="SHADOWMAP_TYPE_PCF_SOFT":s.shadowMapType===hn&&(t="SHADOWMAP_TYPE_VSM"),t}function xp(s){let t="ENVMAP_TYPE_CUBE";if(s.envMap)switch(s.envMapMode){case mi:case gi:t="ENVMAP_TYPE_CUBE";break;case Rs:t="ENVMAP_TYPE_CUBE_UV";break}return t}function Mp(s){let t="ENVMAP_MODE_REFLECTION";if(s.envMap)switch(s.envMapMode){case gi:t="ENVMAP_MODE_REFRACTION";break}return t}function Sp(s){let t="ENVMAP_BLENDING_NONE";if(s.envMap)switch(s.combine){case No:t="ENVMAP_BLENDING_MULTIPLY";break;case el:t="ENVMAP_BLENDING_MIX";break;case nl:t="ENVMAP_BLENDING_ADD";break}return t}function yp(s){const t=s.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),7*16)),texelHeight:n,maxMip:e}}function Ep(s,t,e,n){const i=s.getContext(),r=e.defines;let a=e.vertexShader,o=e.fragmentShader;const c=vp(e),l=xp(e),h=Mp(e),u=Sp(e),d=yp(e),m=e.isWebGL2?"":lp(e),g=hp(e),_=up(r),p=i.createProgram();let f,y,v=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(f=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_].filter(ui).join(`
`),f.length>0&&(f+=`
`),y=[m,"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_].filter(ui).join(`
`),y.length>0&&(y+=`
`)):(f=[mo(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors&&e.isWebGL2?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0&&e.isWebGL2?"#define MORPHTARGETS_TEXTURE":"",e.morphTargetsCount>0&&e.isWebGL2?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0&&e.isWebGL2?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+c:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.useLegacyLights?"#define LEGACY_LIGHTS":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.logarithmicDepthBuffer&&e.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#if ( defined( USE_MORPHTARGETS ) && ! defined( MORPHTARGETS_TEXTURE ) )","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ui).join(`
`),y=[m,mo(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+l:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+c:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.useLegacyLights?"#define LEGACY_LIGHTS":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.logarithmicDepthBuffer&&e.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==En?"#define TONE_MAPPING":"",e.toneMapping!==En?Ht.tonemapping_pars_fragment:"",e.toneMapping!==En?cp("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Ht.colorspace_pars_fragment,op("linearToOutputTexel",e.outputColorSpace),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(ui).join(`
`)),a=wr(a),a=uo(a,e),a=fo(a,e),o=wr(o),o=uo(o,e),o=fo(o,e),a=po(a),o=po(o),e.isWebGL2&&e.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,f=[g,"precision mediump sampler2DArray;","#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+f,y=["precision mediump sampler2DArray;","#define varying in",e.glslVersion===Da?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===Da?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+y);const S=v+f+a,D=v+y+o,w=lo(i,i.VERTEX_SHADER,S),b=lo(i,i.FRAGMENT_SHADER,D);i.attachShader(p,w),i.attachShader(p,b),e.index0AttributeName!==void 0?i.bindAttribLocation(p,0,e.index0AttributeName):e.morphTargets===!0&&i.bindAttribLocation(p,0,"position"),i.linkProgram(p);function G(k){if(s.debug.checkShaderErrors){const nt=i.getProgramInfoLog(p).trim(),L=i.getShaderInfoLog(w).trim(),F=i.getShaderInfoLog(b).trim();let V=!0,K=!0;if(i.getProgramParameter(p,i.LINK_STATUS)===!1)if(V=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(i,p,w,b);else{const Y=ho(i,w,"vertex"),$=ho(i,b,"fragment");console.error("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(p,i.VALIDATE_STATUS)+`

Program Info Log: `+nt+`
`+Y+`
`+$)}else nt!==""?console.warn("THREE.WebGLProgram: Program Info Log:",nt):(L===""||F==="")&&(K=!1);K&&(k.diagnostics={runnable:V,programLog:nt,vertexShader:{log:L,prefix:f},fragmentShader:{log:F,prefix:y}})}i.deleteShader(w),i.deleteShader(b),M=new vs(i,p),A=dp(i,p)}let M;this.getUniforms=function(){return M===void 0&&G(this),M};let A;this.getAttributes=function(){return A===void 0&&G(this),A};let O=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return O===!1&&(O=i.getProgramParameter(p,ip)),O},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(p),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=sp++,this.cacheKey=t,this.usedTimes=1,this.program=p,this.vertexShader=w,this.fragmentShader=b,this}let Tp=0;class Ap{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,i=this._getShaderStage(e),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(t);return a.has(i)===!1&&(a.add(i),i.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new wp(t),e.set(t,n)),n}}class wp{constructor(t){this.id=Tp++,this.code=t,this.usedTimes=0}}function bp(s,t,e,n,i,r,a){const o=new Jo,c=new Ap,l=[],h=i.isWebGL2,u=i.logarithmicDepthBuffer,d=i.vertexTextures;let m=i.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(M){return M===0?"uv":`uv${M}`}function p(M,A,O,k,nt){const L=k.fog,F=nt.geometry,V=M.isMeshStandardMaterial?k.environment:null,K=(M.isMeshStandardMaterial?e:t).get(M.envMap||V),Y=K&&K.mapping===Rs?K.image.height:null,$=g[M.type];M.precision!==null&&(m=i.getMaxPrecision(M.precision),m!==M.precision&&console.warn("THREE.WebGLProgram.getParameters:",M.precision,"not supported, using",m,"instead."));const Z=F.morphAttributes.position||F.morphAttributes.normal||F.morphAttributes.color,it=Z!==void 0?Z.length:0;let rt=0;F.morphAttributes.position!==void 0&&(rt=1),F.morphAttributes.normal!==void 0&&(rt=2),F.morphAttributes.color!==void 0&&(rt=3);let W,j,pt,St;if($){const Ee=tn[$];W=Ee.vertexShader,j=Ee.fragmentShader}else W=M.vertexShader,j=M.fragmentShader,c.update(M),pt=c.getVertexShaderID(M),St=c.getFragmentShaderID(M);const _t=s.getRenderTarget(),Ct=nt.isInstancedMesh===!0,Nt=nt.isBatchedMesh===!0,yt=!!M.map,Dt=!!M.matcap,R=!!K,at=!!M.aoMap,q=!!M.lightMap,st=!!M.bumpMap,X=!!M.normalMap,Tt=!!M.displacementMap,mt=!!M.emissiveMap,E=!!M.metalnessMap,x=!!M.roughnessMap,N=M.anisotropy>0,et=M.clearcoat>0,Q=M.iridescence>0,J=M.sheen>0,Mt=M.transmission>0,ut=N&&!!M.anisotropyMap,vt=et&&!!M.clearcoatMap,wt=et&&!!M.clearcoatNormalMap,Bt=et&&!!M.clearcoatRoughnessMap,tt=Q&&!!M.iridescenceMap,Yt=Q&&!!M.iridescenceThicknessMap,qt=J&&!!M.sheenColorMap,It=J&&!!M.sheenRoughnessMap,At=!!M.specularMap,xt=!!M.specularColorMap,Gt=!!M.specularIntensityMap,$t=Mt&&!!M.transmissionMap,re=Mt&&!!M.thicknessMap,kt=!!M.gradientMap,ot=!!M.alphaMap,P=M.alphaTest>0,dt=!!M.alphaHash,ft=!!M.extensions,Pt=!!F.attributes.uv1,bt=!!F.attributes.uv2,Zt=!!F.attributes.uv3;let Jt=En;return M.toneMapped&&(_t===null||_t.isXRRenderTarget===!0)&&(Jt=s.toneMapping),{isWebGL2:h,shaderID:$,shaderType:M.type,shaderName:M.name,vertexShader:W,fragmentShader:j,defines:M.defines,customVertexShaderID:pt,customFragmentShaderID:St,isRawShaderMaterial:M.isRawShaderMaterial===!0,glslVersion:M.glslVersion,precision:m,batching:Nt,instancing:Ct,instancingColor:Ct&&nt.instanceColor!==null,supportsVertexTextures:d,outputColorSpace:_t===null?s.outputColorSpace:_t.isXRRenderTarget===!0?_t.texture.colorSpace:dn,map:yt,matcap:Dt,envMap:R,envMapMode:R&&K.mapping,envMapCubeUVHeight:Y,aoMap:at,lightMap:q,bumpMap:st,normalMap:X,displacementMap:d&&Tt,emissiveMap:mt,normalMapObjectSpace:X&&M.normalMapType===Ml,normalMapTangentSpace:X&&M.normalMapType===Xo,metalnessMap:E,roughnessMap:x,anisotropy:N,anisotropyMap:ut,clearcoat:et,clearcoatMap:vt,clearcoatNormalMap:wt,clearcoatRoughnessMap:Bt,iridescence:Q,iridescenceMap:tt,iridescenceThicknessMap:Yt,sheen:J,sheenColorMap:qt,sheenRoughnessMap:It,specularMap:At,specularColorMap:xt,specularIntensityMap:Gt,transmission:Mt,transmissionMap:$t,thicknessMap:re,gradientMap:kt,opaque:M.transparent===!1&&M.blending===fi,alphaMap:ot,alphaTest:P,alphaHash:dt,combine:M.combine,mapUv:yt&&_(M.map.channel),aoMapUv:at&&_(M.aoMap.channel),lightMapUv:q&&_(M.lightMap.channel),bumpMapUv:st&&_(M.bumpMap.channel),normalMapUv:X&&_(M.normalMap.channel),displacementMapUv:Tt&&_(M.displacementMap.channel),emissiveMapUv:mt&&_(M.emissiveMap.channel),metalnessMapUv:E&&_(M.metalnessMap.channel),roughnessMapUv:x&&_(M.roughnessMap.channel),anisotropyMapUv:ut&&_(M.anisotropyMap.channel),clearcoatMapUv:vt&&_(M.clearcoatMap.channel),clearcoatNormalMapUv:wt&&_(M.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Bt&&_(M.clearcoatRoughnessMap.channel),iridescenceMapUv:tt&&_(M.iridescenceMap.channel),iridescenceThicknessMapUv:Yt&&_(M.iridescenceThicknessMap.channel),sheenColorMapUv:qt&&_(M.sheenColorMap.channel),sheenRoughnessMapUv:It&&_(M.sheenRoughnessMap.channel),specularMapUv:At&&_(M.specularMap.channel),specularColorMapUv:xt&&_(M.specularColorMap.channel),specularIntensityMapUv:Gt&&_(M.specularIntensityMap.channel),transmissionMapUv:$t&&_(M.transmissionMap.channel),thicknessMapUv:re&&_(M.thicknessMap.channel),alphaMapUv:ot&&_(M.alphaMap.channel),vertexTangents:!!F.attributes.tangent&&(X||N),vertexColors:M.vertexColors,vertexAlphas:M.vertexColors===!0&&!!F.attributes.color&&F.attributes.color.itemSize===4,vertexUv1s:Pt,vertexUv2s:bt,vertexUv3s:Zt,pointsUvs:nt.isPoints===!0&&!!F.attributes.uv&&(yt||ot),fog:!!L,useFog:M.fog===!0,fogExp2:L&&L.isFogExp2,flatShading:M.flatShading===!0,sizeAttenuation:M.sizeAttenuation===!0,logarithmicDepthBuffer:u,skinning:nt.isSkinnedMesh===!0,morphTargets:F.morphAttributes.position!==void 0,morphNormals:F.morphAttributes.normal!==void 0,morphColors:F.morphAttributes.color!==void 0,morphTargetsCount:it,morphTextureStride:rt,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:M.dithering,shadowMapEnabled:s.shadowMap.enabled&&O.length>0,shadowMapType:s.shadowMap.type,toneMapping:Jt,useLegacyLights:s._useLegacyLights,decodeVideoTexture:yt&&M.map.isVideoTexture===!0&&Kt.getTransfer(M.map.colorSpace)===Qt,premultipliedAlpha:M.premultipliedAlpha,doubleSided:M.side===Ze,flipSided:M.side===Ie,useDepthPacking:M.depthPacking>=0,depthPacking:M.depthPacking||0,index0AttributeName:M.index0AttributeName,extensionDerivatives:ft&&M.extensions.derivatives===!0,extensionFragDepth:ft&&M.extensions.fragDepth===!0,extensionDrawBuffers:ft&&M.extensions.drawBuffers===!0,extensionShaderTextureLOD:ft&&M.extensions.shaderTextureLOD===!0,extensionClipCullDistance:ft&&M.extensions.clipCullDistance&&n.has("WEBGL_clip_cull_distance"),rendererExtensionFragDepth:h||n.has("EXT_frag_depth"),rendererExtensionDrawBuffers:h||n.has("WEBGL_draw_buffers"),rendererExtensionShaderTextureLod:h||n.has("EXT_shader_texture_lod"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:M.customProgramCacheKey()}}function f(M){const A=[];if(M.shaderID?A.push(M.shaderID):(A.push(M.customVertexShaderID),A.push(M.customFragmentShaderID)),M.defines!==void 0)for(const O in M.defines)A.push(O),A.push(M.defines[O]);return M.isRawShaderMaterial===!1&&(y(A,M),v(A,M),A.push(s.outputColorSpace)),A.push(M.customProgramCacheKey),A.join()}function y(M,A){M.push(A.precision),M.push(A.outputColorSpace),M.push(A.envMapMode),M.push(A.envMapCubeUVHeight),M.push(A.mapUv),M.push(A.alphaMapUv),M.push(A.lightMapUv),M.push(A.aoMapUv),M.push(A.bumpMapUv),M.push(A.normalMapUv),M.push(A.displacementMapUv),M.push(A.emissiveMapUv),M.push(A.metalnessMapUv),M.push(A.roughnessMapUv),M.push(A.anisotropyMapUv),M.push(A.clearcoatMapUv),M.push(A.clearcoatNormalMapUv),M.push(A.clearcoatRoughnessMapUv),M.push(A.iridescenceMapUv),M.push(A.iridescenceThicknessMapUv),M.push(A.sheenColorMapUv),M.push(A.sheenRoughnessMapUv),M.push(A.specularMapUv),M.push(A.specularColorMapUv),M.push(A.specularIntensityMapUv),M.push(A.transmissionMapUv),M.push(A.thicknessMapUv),M.push(A.combine),M.push(A.fogExp2),M.push(A.sizeAttenuation),M.push(A.morphTargetsCount),M.push(A.morphAttributeCount),M.push(A.numDirLights),M.push(A.numPointLights),M.push(A.numSpotLights),M.push(A.numSpotLightMaps),M.push(A.numHemiLights),M.push(A.numRectAreaLights),M.push(A.numDirLightShadows),M.push(A.numPointLightShadows),M.push(A.numSpotLightShadows),M.push(A.numSpotLightShadowsWithMaps),M.push(A.numLightProbes),M.push(A.shadowMapType),M.push(A.toneMapping),M.push(A.numClippingPlanes),M.push(A.numClipIntersection),M.push(A.depthPacking)}function v(M,A){o.disableAll(),A.isWebGL2&&o.enable(0),A.supportsVertexTextures&&o.enable(1),A.instancing&&o.enable(2),A.instancingColor&&o.enable(3),A.matcap&&o.enable(4),A.envMap&&o.enable(5),A.normalMapObjectSpace&&o.enable(6),A.normalMapTangentSpace&&o.enable(7),A.clearcoat&&o.enable(8),A.iridescence&&o.enable(9),A.alphaTest&&o.enable(10),A.vertexColors&&o.enable(11),A.vertexAlphas&&o.enable(12),A.vertexUv1s&&o.enable(13),A.vertexUv2s&&o.enable(14),A.vertexUv3s&&o.enable(15),A.vertexTangents&&o.enable(16),A.anisotropy&&o.enable(17),A.alphaHash&&o.enable(18),A.batching&&o.enable(19),M.push(o.mask),o.disableAll(),A.fog&&o.enable(0),A.useFog&&o.enable(1),A.flatShading&&o.enable(2),A.logarithmicDepthBuffer&&o.enable(3),A.skinning&&o.enable(4),A.morphTargets&&o.enable(5),A.morphNormals&&o.enable(6),A.morphColors&&o.enable(7),A.premultipliedAlpha&&o.enable(8),A.shadowMapEnabled&&o.enable(9),A.useLegacyLights&&o.enable(10),A.doubleSided&&o.enable(11),A.flipSided&&o.enable(12),A.useDepthPacking&&o.enable(13),A.dithering&&o.enable(14),A.transmission&&o.enable(15),A.sheen&&o.enable(16),A.opaque&&o.enable(17),A.pointsUvs&&o.enable(18),A.decodeVideoTexture&&o.enable(19),M.push(o.mask)}function S(M){const A=g[M.type];let O;if(A){const k=tn[A];O=ch.clone(k.uniforms)}else O=M.uniforms;return O}function D(M,A){let O;for(let k=0,nt=l.length;k<nt;k++){const L=l[k];if(L.cacheKey===A){O=L,++O.usedTimes;break}}return O===void 0&&(O=new Ep(s,A,M,r),l.push(O)),O}function w(M){if(--M.usedTimes===0){const A=l.indexOf(M);l[A]=l[l.length-1],l.pop(),M.destroy()}}function b(M){c.remove(M)}function G(){c.dispose()}return{getParameters:p,getProgramCacheKey:f,getUniforms:S,acquireProgram:D,releaseProgram:w,releaseShaderCache:b,programs:l,dispose:G}}function Rp(){let s=new WeakMap;function t(r){let a=s.get(r);return a===void 0&&(a={},s.set(r,a)),a}function e(r){s.delete(r)}function n(r,a,o){s.get(r)[a]=o}function i(){s=new WeakMap}return{get:t,remove:e,update:n,dispose:i}}function Cp(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.material.id!==t.material.id?s.material.id-t.material.id:s.z!==t.z?s.z-t.z:s.id-t.id}function go(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.z!==t.z?t.z-s.z:s.id-t.id}function _o(){const s=[];let t=0;const e=[],n=[],i=[];function r(){t=0,e.length=0,n.length=0,i.length=0}function a(u,d,m,g,_,p){let f=s[t];return f===void 0?(f={id:u.id,object:u,geometry:d,material:m,groupOrder:g,renderOrder:u.renderOrder,z:_,group:p},s[t]=f):(f.id=u.id,f.object=u,f.geometry=d,f.material=m,f.groupOrder=g,f.renderOrder=u.renderOrder,f.z=_,f.group=p),t++,f}function o(u,d,m,g,_,p){const f=a(u,d,m,g,_,p);m.transmission>0?n.push(f):m.transparent===!0?i.push(f):e.push(f)}function c(u,d,m,g,_,p){const f=a(u,d,m,g,_,p);m.transmission>0?n.unshift(f):m.transparent===!0?i.unshift(f):e.unshift(f)}function l(u,d){e.length>1&&e.sort(u||Cp),n.length>1&&n.sort(d||go),i.length>1&&i.sort(d||go)}function h(){for(let u=t,d=s.length;u<d;u++){const m=s[u];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:e,transmissive:n,transparent:i,init:r,push:o,unshift:c,finish:h,sort:l}}function Pp(){let s=new WeakMap;function t(n,i){const r=s.get(n);let a;return r===void 0?(a=new _o,s.set(n,[a])):i>=r.length?(a=new _o,r.push(a)):a=r[i],a}function e(){s=new WeakMap}return{get:t,dispose:e}}function Lp(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new C,color:new Ft};break;case"SpotLight":e={position:new C,direction:new C,color:new Ft,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new C,color:new Ft,distance:0,decay:0};break;case"HemisphereLight":e={direction:new C,skyColor:new Ft,groundColor:new Ft};break;case"RectAreaLight":e={color:new Ft,position:new C,halfWidth:new C,halfHeight:new C};break}return s[t.id]=e,e}}}function Dp(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new lt};break;case"SpotLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new lt};break;case"PointLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new lt,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[t.id]=e,e}}}let Ip=0;function Up(s,t){return(t.castShadow?2:0)-(s.castShadow?2:0)+(t.map?1:0)-(s.map?1:0)}function Np(s,t){const e=new Lp,n=Dp(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let h=0;h<9;h++)i.probe.push(new C);const r=new C,a=new ee,o=new ee;function c(h,u){let d=0,m=0,g=0;for(let k=0;k<9;k++)i.probe[k].set(0,0,0);let _=0,p=0,f=0,y=0,v=0,S=0,D=0,w=0,b=0,G=0,M=0;h.sort(Up);const A=u===!0?Math.PI:1;for(let k=0,nt=h.length;k<nt;k++){const L=h[k],F=L.color,V=L.intensity,K=L.distance,Y=L.shadow&&L.shadow.map?L.shadow.map.texture:null;if(L.isAmbientLight)d+=F.r*V*A,m+=F.g*V*A,g+=F.b*V*A;else if(L.isLightProbe){for(let $=0;$<9;$++)i.probe[$].addScaledVector(L.sh.coefficients[$],V);M++}else if(L.isDirectionalLight){const $=e.get(L);if($.color.copy(L.color).multiplyScalar(L.intensity*A),L.castShadow){const Z=L.shadow,it=n.get(L);it.shadowBias=Z.bias,it.shadowNormalBias=Z.normalBias,it.shadowRadius=Z.radius,it.shadowMapSize=Z.mapSize,i.directionalShadow[_]=it,i.directionalShadowMap[_]=Y,i.directionalShadowMatrix[_]=L.shadow.matrix,S++}i.directional[_]=$,_++}else if(L.isSpotLight){const $=e.get(L);$.position.setFromMatrixPosition(L.matrixWorld),$.color.copy(F).multiplyScalar(V*A),$.distance=K,$.coneCos=Math.cos(L.angle),$.penumbraCos=Math.cos(L.angle*(1-L.penumbra)),$.decay=L.decay,i.spot[f]=$;const Z=L.shadow;if(L.map&&(i.spotLightMap[b]=L.map,b++,Z.updateMatrices(L),L.castShadow&&G++),i.spotLightMatrix[f]=Z.matrix,L.castShadow){const it=n.get(L);it.shadowBias=Z.bias,it.shadowNormalBias=Z.normalBias,it.shadowRadius=Z.radius,it.shadowMapSize=Z.mapSize,i.spotShadow[f]=it,i.spotShadowMap[f]=Y,w++}f++}else if(L.isRectAreaLight){const $=e.get(L);$.color.copy(F).multiplyScalar(V),$.halfWidth.set(L.width*.5,0,0),$.halfHeight.set(0,L.height*.5,0),i.rectArea[y]=$,y++}else if(L.isPointLight){const $=e.get(L);if($.color.copy(L.color).multiplyScalar(L.intensity*A),$.distance=L.distance,$.decay=L.decay,L.castShadow){const Z=L.shadow,it=n.get(L);it.shadowBias=Z.bias,it.shadowNormalBias=Z.normalBias,it.shadowRadius=Z.radius,it.shadowMapSize=Z.mapSize,it.shadowCameraNear=Z.camera.near,it.shadowCameraFar=Z.camera.far,i.pointShadow[p]=it,i.pointShadowMap[p]=Y,i.pointShadowMatrix[p]=L.shadow.matrix,D++}i.point[p]=$,p++}else if(L.isHemisphereLight){const $=e.get(L);$.skyColor.copy(L.color).multiplyScalar(V*A),$.groundColor.copy(L.groundColor).multiplyScalar(V*A),i.hemi[v]=$,v++}}y>0&&(t.isWebGL2?s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ct.LTC_FLOAT_1,i.rectAreaLTC2=ct.LTC_FLOAT_2):(i.rectAreaLTC1=ct.LTC_HALF_1,i.rectAreaLTC2=ct.LTC_HALF_2):s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ct.LTC_FLOAT_1,i.rectAreaLTC2=ct.LTC_FLOAT_2):s.has("OES_texture_half_float_linear")===!0?(i.rectAreaLTC1=ct.LTC_HALF_1,i.rectAreaLTC2=ct.LTC_HALF_2):console.error("THREE.WebGLRenderer: Unable to use RectAreaLight. Missing WebGL extensions.")),i.ambient[0]=d,i.ambient[1]=m,i.ambient[2]=g;const O=i.hash;(O.directionalLength!==_||O.pointLength!==p||O.spotLength!==f||O.rectAreaLength!==y||O.hemiLength!==v||O.numDirectionalShadows!==S||O.numPointShadows!==D||O.numSpotShadows!==w||O.numSpotMaps!==b||O.numLightProbes!==M)&&(i.directional.length=_,i.spot.length=f,i.rectArea.length=y,i.point.length=p,i.hemi.length=v,i.directionalShadow.length=S,i.directionalShadowMap.length=S,i.pointShadow.length=D,i.pointShadowMap.length=D,i.spotShadow.length=w,i.spotShadowMap.length=w,i.directionalShadowMatrix.length=S,i.pointShadowMatrix.length=D,i.spotLightMatrix.length=w+b-G,i.spotLightMap.length=b,i.numSpotLightShadowsWithMaps=G,i.numLightProbes=M,O.directionalLength=_,O.pointLength=p,O.spotLength=f,O.rectAreaLength=y,O.hemiLength=v,O.numDirectionalShadows=S,O.numPointShadows=D,O.numSpotShadows=w,O.numSpotMaps=b,O.numLightProbes=M,i.version=Ip++)}function l(h,u){let d=0,m=0,g=0,_=0,p=0;const f=u.matrixWorldInverse;for(let y=0,v=h.length;y<v;y++){const S=h[y];if(S.isDirectionalLight){const D=i.directional[d];D.direction.setFromMatrixPosition(S.matrixWorld),r.setFromMatrixPosition(S.target.matrixWorld),D.direction.sub(r),D.direction.transformDirection(f),d++}else if(S.isSpotLight){const D=i.spot[g];D.position.setFromMatrixPosition(S.matrixWorld),D.position.applyMatrix4(f),D.direction.setFromMatrixPosition(S.matrixWorld),r.setFromMatrixPosition(S.target.matrixWorld),D.direction.sub(r),D.direction.transformDirection(f),g++}else if(S.isRectAreaLight){const D=i.rectArea[_];D.position.setFromMatrixPosition(S.matrixWorld),D.position.applyMatrix4(f),o.identity(),a.copy(S.matrixWorld),a.premultiply(f),o.extractRotation(a),D.halfWidth.set(S.width*.5,0,0),D.halfHeight.set(0,S.height*.5,0),D.halfWidth.applyMatrix4(o),D.halfHeight.applyMatrix4(o),_++}else if(S.isPointLight){const D=i.point[m];D.position.setFromMatrixPosition(S.matrixWorld),D.position.applyMatrix4(f),m++}else if(S.isHemisphereLight){const D=i.hemi[p];D.direction.setFromMatrixPosition(S.matrixWorld),D.direction.transformDirection(f),p++}}}return{setup:c,setupView:l,state:i}}function vo(s,t){const e=new Np(s,t),n=[],i=[];function r(){n.length=0,i.length=0}function a(u){n.push(u)}function o(u){i.push(u)}function c(u){e.setup(n,u)}function l(u){e.setupView(n,u)}return{init:r,state:{lightsArray:n,shadowsArray:i,lights:e},setupLights:c,setupLightsView:l,pushLight:a,pushShadow:o}}function Op(s,t){let e=new WeakMap;function n(r,a=0){const o=e.get(r);let c;return o===void 0?(c=new vo(s,t),e.set(r,[c])):a>=o.length?(c=new vo(s,t),o.push(c)):c=o[a],c}function i(){e=new WeakMap}return{get:n,dispose:i}}class Fp extends ki{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=vl,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class Bp extends ki{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const zp=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Gp=`uniform sampler2D shadow_pass;
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
}`;function Hp(s,t,e){let n=new Nr;const i=new lt,r=new lt,a=new _e,o=new Fp({depthPacking:xl}),c=new Bp,l={},h=e.maxTextureSize,u={[wn]:Ie,[Ie]:wn,[Ze]:Ze},d=new Hn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new lt},radius:{value:4}},vertexShader:zp,fragmentShader:Gp}),m=d.clone();m.defines.HORIZONTAL_PASS=1;const g=new Ne;g.setAttribute("position",new Xe(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const _=new ht(g,d),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Io;let f=this.type;this.render=function(w,b,G){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||w.length===0)return;const M=s.getRenderTarget(),A=s.getActiveCubeFace(),O=s.getActiveMipmapLevel(),k=s.state;k.setBlending(yn),k.buffers.color.setClear(1,1,1,1),k.buffers.depth.setTest(!0),k.setScissorTest(!1);const nt=f!==hn&&this.type===hn,L=f===hn&&this.type!==hn;for(let F=0,V=w.length;F<V;F++){const K=w[F],Y=K.shadow;if(Y===void 0){console.warn("THREE.WebGLShadowMap:",K,"has no shadow.");continue}if(Y.autoUpdate===!1&&Y.needsUpdate===!1)continue;i.copy(Y.mapSize);const $=Y.getFrameExtents();if(i.multiply($),r.copy(Y.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(r.x=Math.floor(h/$.x),i.x=r.x*$.x,Y.mapSize.x=r.x),i.y>h&&(r.y=Math.floor(h/$.y),i.y=r.y*$.y,Y.mapSize.y=r.y)),Y.map===null||nt===!0||L===!0){const it=this.type!==hn?{minFilter:Re,magFilter:Re}:{};Y.map!==null&&Y.map.dispose(),Y.map=new Gn(i.x,i.y,it),Y.map.texture.name=K.name+".shadowMap",Y.camera.updateProjectionMatrix()}s.setRenderTarget(Y.map),s.clear();const Z=Y.getViewportCount();for(let it=0;it<Z;it++){const rt=Y.getViewport(it);a.set(r.x*rt.x,r.y*rt.y,r.x*rt.z,r.y*rt.w),k.viewport(a),Y.updateMatrices(K,it),n=Y.getFrustum(),S(b,G,Y.camera,K,this.type)}Y.isPointLightShadow!==!0&&this.type===hn&&y(Y,G),Y.needsUpdate=!1}f=this.type,p.needsUpdate=!1,s.setRenderTarget(M,A,O)};function y(w,b){const G=t.update(_);d.defines.VSM_SAMPLES!==w.blurSamples&&(d.defines.VSM_SAMPLES=w.blurSamples,m.defines.VSM_SAMPLES=w.blurSamples,d.needsUpdate=!0,m.needsUpdate=!0),w.mapPass===null&&(w.mapPass=new Gn(i.x,i.y)),d.uniforms.shadow_pass.value=w.map.texture,d.uniforms.resolution.value=w.mapSize,d.uniforms.radius.value=w.radius,s.setRenderTarget(w.mapPass),s.clear(),s.renderBufferDirect(b,null,G,d,_,null),m.uniforms.shadow_pass.value=w.mapPass.texture,m.uniforms.resolution.value=w.mapSize,m.uniforms.radius.value=w.radius,s.setRenderTarget(w.map),s.clear(),s.renderBufferDirect(b,null,G,m,_,null)}function v(w,b,G,M){let A=null;const O=G.isPointLight===!0?w.customDistanceMaterial:w.customDepthMaterial;if(O!==void 0)A=O;else if(A=G.isPointLight===!0?c:o,s.localClippingEnabled&&b.clipShadows===!0&&Array.isArray(b.clippingPlanes)&&b.clippingPlanes.length!==0||b.displacementMap&&b.displacementScale!==0||b.alphaMap&&b.alphaTest>0||b.map&&b.alphaTest>0){const k=A.uuid,nt=b.uuid;let L=l[k];L===void 0&&(L={},l[k]=L);let F=L[nt];F===void 0&&(F=A.clone(),L[nt]=F,b.addEventListener("dispose",D)),A=F}if(A.visible=b.visible,A.wireframe=b.wireframe,M===hn?A.side=b.shadowSide!==null?b.shadowSide:b.side:A.side=b.shadowSide!==null?b.shadowSide:u[b.side],A.alphaMap=b.alphaMap,A.alphaTest=b.alphaTest,A.map=b.map,A.clipShadows=b.clipShadows,A.clippingPlanes=b.clippingPlanes,A.clipIntersection=b.clipIntersection,A.displacementMap=b.displacementMap,A.displacementScale=b.displacementScale,A.displacementBias=b.displacementBias,A.wireframeLinewidth=b.wireframeLinewidth,A.linewidth=b.linewidth,G.isPointLight===!0&&A.isMeshDistanceMaterial===!0){const k=s.properties.get(A);k.light=G}return A}function S(w,b,G,M,A){if(w.visible===!1)return;if(w.layers.test(b.layers)&&(w.isMesh||w.isLine||w.isPoints)&&(w.castShadow||w.receiveShadow&&A===hn)&&(!w.frustumCulled||n.intersectsObject(w))){w.modelViewMatrix.multiplyMatrices(G.matrixWorldInverse,w.matrixWorld);const nt=t.update(w),L=w.material;if(Array.isArray(L)){const F=nt.groups;for(let V=0,K=F.length;V<K;V++){const Y=F[V],$=L[Y.materialIndex];if($&&$.visible){const Z=v(w,$,M,A);w.onBeforeShadow(s,w,b,G,nt,Z,Y),s.renderBufferDirect(G,null,nt,Z,w,Y),w.onAfterShadow(s,w,b,G,nt,Z,Y)}}}else if(L.visible){const F=v(w,L,M,A);w.onBeforeShadow(s,w,b,G,nt,F,null),s.renderBufferDirect(G,null,nt,F,w,null),w.onAfterShadow(s,w,b,G,nt,F,null)}}const k=w.children;for(let nt=0,L=k.length;nt<L;nt++)S(k[nt],b,G,M,A)}function D(w){w.target.removeEventListener("dispose",D);for(const G in l){const M=l[G],A=w.target.uuid;A in M&&(M[A].dispose(),delete M[A])}}}function Vp(s,t,e){const n=e.isWebGL2;function i(){let P=!1;const dt=new _e;let ft=null;const Pt=new _e(0,0,0,0);return{setMask:function(bt){ft!==bt&&!P&&(s.colorMask(bt,bt,bt,bt),ft=bt)},setLocked:function(bt){P=bt},setClear:function(bt,Zt,Jt,fe,Ee){Ee===!0&&(bt*=fe,Zt*=fe,Jt*=fe),dt.set(bt,Zt,Jt,fe),Pt.equals(dt)===!1&&(s.clearColor(bt,Zt,Jt,fe),Pt.copy(dt))},reset:function(){P=!1,ft=null,Pt.set(-1,0,0,0)}}}function r(){let P=!1,dt=null,ft=null,Pt=null;return{setTest:function(bt){bt?Nt(s.DEPTH_TEST):yt(s.DEPTH_TEST)},setMask:function(bt){dt!==bt&&!P&&(s.depthMask(bt),dt=bt)},setFunc:function(bt){if(ft!==bt){switch(bt){case $c:s.depthFunc(s.NEVER);break;case Kc:s.depthFunc(s.ALWAYS);break;case Zc:s.depthFunc(s.LESS);break;case Ms:s.depthFunc(s.LEQUAL);break;case Jc:s.depthFunc(s.EQUAL);break;case jc:s.depthFunc(s.GEQUAL);break;case Qc:s.depthFunc(s.GREATER);break;case tl:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}ft=bt}},setLocked:function(bt){P=bt},setClear:function(bt){Pt!==bt&&(s.clearDepth(bt),Pt=bt)},reset:function(){P=!1,dt=null,ft=null,Pt=null}}}function a(){let P=!1,dt=null,ft=null,Pt=null,bt=null,Zt=null,Jt=null,fe=null,Ee=null;return{setTest:function(jt){P||(jt?Nt(s.STENCIL_TEST):yt(s.STENCIL_TEST))},setMask:function(jt){dt!==jt&&!P&&(s.stencilMask(jt),dt=jt)},setFunc:function(jt,Te,Qe){(ft!==jt||Pt!==Te||bt!==Qe)&&(s.stencilFunc(jt,Te,Qe),ft=jt,Pt=Te,bt=Qe)},setOp:function(jt,Te,Qe){(Zt!==jt||Jt!==Te||fe!==Qe)&&(s.stencilOp(jt,Te,Qe),Zt=jt,Jt=Te,fe=Qe)},setLocked:function(jt){P=jt},setClear:function(jt){Ee!==jt&&(s.clearStencil(jt),Ee=jt)},reset:function(){P=!1,dt=null,ft=null,Pt=null,bt=null,Zt=null,Jt=null,fe=null,Ee=null}}}const o=new i,c=new r,l=new a,h=new WeakMap,u=new WeakMap;let d={},m={},g=new WeakMap,_=[],p=null,f=!1,y=null,v=null,S=null,D=null,w=null,b=null,G=null,M=new Ft(0,0,0),A=0,O=!1,k=null,nt=null,L=null,F=null,V=null;const K=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let Y=!1,$=0;const Z=s.getParameter(s.VERSION);Z.indexOf("WebGL")!==-1?($=parseFloat(/^WebGL (\d)/.exec(Z)[1]),Y=$>=1):Z.indexOf("OpenGL ES")!==-1&&($=parseFloat(/^OpenGL ES (\d)/.exec(Z)[1]),Y=$>=2);let it=null,rt={};const W=s.getParameter(s.SCISSOR_BOX),j=s.getParameter(s.VIEWPORT),pt=new _e().fromArray(W),St=new _e().fromArray(j);function _t(P,dt,ft,Pt){const bt=new Uint8Array(4),Zt=s.createTexture();s.bindTexture(P,Zt),s.texParameteri(P,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(P,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let Jt=0;Jt<ft;Jt++)n&&(P===s.TEXTURE_3D||P===s.TEXTURE_2D_ARRAY)?s.texImage3D(dt,0,s.RGBA,1,1,Pt,0,s.RGBA,s.UNSIGNED_BYTE,bt):s.texImage2D(dt+Jt,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,bt);return Zt}const Ct={};Ct[s.TEXTURE_2D]=_t(s.TEXTURE_2D,s.TEXTURE_2D,1),Ct[s.TEXTURE_CUBE_MAP]=_t(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),n&&(Ct[s.TEXTURE_2D_ARRAY]=_t(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),Ct[s.TEXTURE_3D]=_t(s.TEXTURE_3D,s.TEXTURE_3D,1,1)),o.setClear(0,0,0,1),c.setClear(1),l.setClear(0),Nt(s.DEPTH_TEST),c.setFunc(Ms),mt(!1),E(jr),Nt(s.CULL_FACE),X(yn);function Nt(P){d[P]!==!0&&(s.enable(P),d[P]=!0)}function yt(P){d[P]!==!1&&(s.disable(P),d[P]=!1)}function Dt(P,dt){return m[P]!==dt?(s.bindFramebuffer(P,dt),m[P]=dt,n&&(P===s.DRAW_FRAMEBUFFER&&(m[s.FRAMEBUFFER]=dt),P===s.FRAMEBUFFER&&(m[s.DRAW_FRAMEBUFFER]=dt)),!0):!1}function R(P,dt){let ft=_,Pt=!1;if(P)if(ft=g.get(dt),ft===void 0&&(ft=[],g.set(dt,ft)),P.isWebGLMultipleRenderTargets){const bt=P.texture;if(ft.length!==bt.length||ft[0]!==s.COLOR_ATTACHMENT0){for(let Zt=0,Jt=bt.length;Zt<Jt;Zt++)ft[Zt]=s.COLOR_ATTACHMENT0+Zt;ft.length=bt.length,Pt=!0}}else ft[0]!==s.COLOR_ATTACHMENT0&&(ft[0]=s.COLOR_ATTACHMENT0,Pt=!0);else ft[0]!==s.BACK&&(ft[0]=s.BACK,Pt=!0);Pt&&(e.isWebGL2?s.drawBuffers(ft):t.get("WEBGL_draw_buffers").drawBuffersWEBGL(ft))}function at(P){return p!==P?(s.useProgram(P),p=P,!0):!1}const q={[Nn]:s.FUNC_ADD,[Ic]:s.FUNC_SUBTRACT,[Uc]:s.FUNC_REVERSE_SUBTRACT};if(n)q[na]=s.MIN,q[ia]=s.MAX;else{const P=t.get("EXT_blend_minmax");P!==null&&(q[na]=P.MIN_EXT,q[ia]=P.MAX_EXT)}const st={[Nc]:s.ZERO,[Oc]:s.ONE,[Fc]:s.SRC_COLOR,[vr]:s.SRC_ALPHA,[kc]:s.SRC_ALPHA_SATURATE,[Hc]:s.DST_COLOR,[zc]:s.DST_ALPHA,[Bc]:s.ONE_MINUS_SRC_COLOR,[xr]:s.ONE_MINUS_SRC_ALPHA,[Vc]:s.ONE_MINUS_DST_COLOR,[Gc]:s.ONE_MINUS_DST_ALPHA,[Wc]:s.CONSTANT_COLOR,[Xc]:s.ONE_MINUS_CONSTANT_COLOR,[qc]:s.CONSTANT_ALPHA,[Yc]:s.ONE_MINUS_CONSTANT_ALPHA};function X(P,dt,ft,Pt,bt,Zt,Jt,fe,Ee,jt){if(P===yn){f===!0&&(yt(s.BLEND),f=!1);return}if(f===!1&&(Nt(s.BLEND),f=!0),P!==Dc){if(P!==y||jt!==O){if((v!==Nn||w!==Nn)&&(s.blendEquation(s.FUNC_ADD),v=Nn,w=Nn),jt)switch(P){case fi:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case Qr:s.blendFunc(s.ONE,s.ONE);break;case ta:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case ea:s.blendFuncSeparate(s.ZERO,s.SRC_COLOR,s.ZERO,s.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",P);break}else switch(P){case fi:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case Qr:s.blendFunc(s.SRC_ALPHA,s.ONE);break;case ta:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case ea:s.blendFunc(s.ZERO,s.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",P);break}S=null,D=null,b=null,G=null,M.set(0,0,0),A=0,y=P,O=jt}return}bt=bt||dt,Zt=Zt||ft,Jt=Jt||Pt,(dt!==v||bt!==w)&&(s.blendEquationSeparate(q[dt],q[bt]),v=dt,w=bt),(ft!==S||Pt!==D||Zt!==b||Jt!==G)&&(s.blendFuncSeparate(st[ft],st[Pt],st[Zt],st[Jt]),S=ft,D=Pt,b=Zt,G=Jt),(fe.equals(M)===!1||Ee!==A)&&(s.blendColor(fe.r,fe.g,fe.b,Ee),M.copy(fe),A=Ee),y=P,O=!1}function Tt(P,dt){P.side===Ze?yt(s.CULL_FACE):Nt(s.CULL_FACE);let ft=P.side===Ie;dt&&(ft=!ft),mt(ft),P.blending===fi&&P.transparent===!1?X(yn):X(P.blending,P.blendEquation,P.blendSrc,P.blendDst,P.blendEquationAlpha,P.blendSrcAlpha,P.blendDstAlpha,P.blendColor,P.blendAlpha,P.premultipliedAlpha),c.setFunc(P.depthFunc),c.setTest(P.depthTest),c.setMask(P.depthWrite),o.setMask(P.colorWrite);const Pt=P.stencilWrite;l.setTest(Pt),Pt&&(l.setMask(P.stencilWriteMask),l.setFunc(P.stencilFunc,P.stencilRef,P.stencilFuncMask),l.setOp(P.stencilFail,P.stencilZFail,P.stencilZPass)),N(P.polygonOffset,P.polygonOffsetFactor,P.polygonOffsetUnits),P.alphaToCoverage===!0?Nt(s.SAMPLE_ALPHA_TO_COVERAGE):yt(s.SAMPLE_ALPHA_TO_COVERAGE)}function mt(P){k!==P&&(P?s.frontFace(s.CW):s.frontFace(s.CCW),k=P)}function E(P){P!==Pc?(Nt(s.CULL_FACE),P!==nt&&(P===jr?s.cullFace(s.BACK):P===Lc?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):yt(s.CULL_FACE),nt=P}function x(P){P!==L&&(Y&&s.lineWidth(P),L=P)}function N(P,dt,ft){P?(Nt(s.POLYGON_OFFSET_FILL),(F!==dt||V!==ft)&&(s.polygonOffset(dt,ft),F=dt,V=ft)):yt(s.POLYGON_OFFSET_FILL)}function et(P){P?Nt(s.SCISSOR_TEST):yt(s.SCISSOR_TEST)}function Q(P){P===void 0&&(P=s.TEXTURE0+K-1),it!==P&&(s.activeTexture(P),it=P)}function J(P,dt,ft){ft===void 0&&(it===null?ft=s.TEXTURE0+K-1:ft=it);let Pt=rt[ft];Pt===void 0&&(Pt={type:void 0,texture:void 0},rt[ft]=Pt),(Pt.type!==P||Pt.texture!==dt)&&(it!==ft&&(s.activeTexture(ft),it=ft),s.bindTexture(P,dt||Ct[P]),Pt.type=P,Pt.texture=dt)}function Mt(){const P=rt[it];P!==void 0&&P.type!==void 0&&(s.bindTexture(P.type,null),P.type=void 0,P.texture=void 0)}function ut(){try{s.compressedTexImage2D.apply(s,arguments)}catch(P){console.error("THREE.WebGLState:",P)}}function vt(){try{s.compressedTexImage3D.apply(s,arguments)}catch(P){console.error("THREE.WebGLState:",P)}}function wt(){try{s.texSubImage2D.apply(s,arguments)}catch(P){console.error("THREE.WebGLState:",P)}}function Bt(){try{s.texSubImage3D.apply(s,arguments)}catch(P){console.error("THREE.WebGLState:",P)}}function tt(){try{s.compressedTexSubImage2D.apply(s,arguments)}catch(P){console.error("THREE.WebGLState:",P)}}function Yt(){try{s.compressedTexSubImage3D.apply(s,arguments)}catch(P){console.error("THREE.WebGLState:",P)}}function qt(){try{s.texStorage2D.apply(s,arguments)}catch(P){console.error("THREE.WebGLState:",P)}}function It(){try{s.texStorage3D.apply(s,arguments)}catch(P){console.error("THREE.WebGLState:",P)}}function At(){try{s.texImage2D.apply(s,arguments)}catch(P){console.error("THREE.WebGLState:",P)}}function xt(){try{s.texImage3D.apply(s,arguments)}catch(P){console.error("THREE.WebGLState:",P)}}function Gt(P){pt.equals(P)===!1&&(s.scissor(P.x,P.y,P.z,P.w),pt.copy(P))}function $t(P){St.equals(P)===!1&&(s.viewport(P.x,P.y,P.z,P.w),St.copy(P))}function re(P,dt){let ft=u.get(dt);ft===void 0&&(ft=new WeakMap,u.set(dt,ft));let Pt=ft.get(P);Pt===void 0&&(Pt=s.getUniformBlockIndex(dt,P.name),ft.set(P,Pt))}function kt(P,dt){const Pt=u.get(dt).get(P);h.get(dt)!==Pt&&(s.uniformBlockBinding(dt,Pt,P.__bindingPointIndex),h.set(dt,Pt))}function ot(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),n===!0&&(s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null)),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),d={},it=null,rt={},m={},g=new WeakMap,_=[],p=null,f=!1,y=null,v=null,S=null,D=null,w=null,b=null,G=null,M=new Ft(0,0,0),A=0,O=!1,k=null,nt=null,L=null,F=null,V=null,pt.set(0,0,s.canvas.width,s.canvas.height),St.set(0,0,s.canvas.width,s.canvas.height),o.reset(),c.reset(),l.reset()}return{buffers:{color:o,depth:c,stencil:l},enable:Nt,disable:yt,bindFramebuffer:Dt,drawBuffers:R,useProgram:at,setBlending:X,setMaterial:Tt,setFlipSided:mt,setCullFace:E,setLineWidth:x,setPolygonOffset:N,setScissorTest:et,activeTexture:Q,bindTexture:J,unbindTexture:Mt,compressedTexImage2D:ut,compressedTexImage3D:vt,texImage2D:At,texImage3D:xt,updateUBOMapping:re,uniformBlockBinding:kt,texStorage2D:qt,texStorage3D:It,texSubImage2D:wt,texSubImage3D:Bt,compressedTexSubImage2D:tt,compressedTexSubImage3D:Yt,scissor:Gt,viewport:$t,reset:ot}}function kp(s,t,e,n,i,r,a){const o=i.isWebGL2,c=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),h=new WeakMap;let u;const d=new WeakMap;let m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(E,x){return m?new OffscreenCanvas(E,x):ws("canvas")}function _(E,x,N,et){let Q=1;if((E.width>et||E.height>et)&&(Q=et/Math.max(E.width,E.height)),Q<1||x===!0)if(typeof HTMLImageElement<"u"&&E instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&E instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&E instanceof ImageBitmap){const J=x?As:Math.floor,Mt=J(Q*E.width),ut=J(Q*E.height);u===void 0&&(u=g(Mt,ut));const vt=N?g(Mt,ut):u;return vt.width=Mt,vt.height=ut,vt.getContext("2d").drawImage(E,0,0,Mt,ut),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+E.width+"x"+E.height+") to ("+Mt+"x"+ut+")."),vt}else return"data"in E&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+E.width+"x"+E.height+")."),E;return E}function p(E){return Ar(E.width)&&Ar(E.height)}function f(E){return o?!1:E.wrapS!==Je||E.wrapT!==Je||E.minFilter!==Re&&E.minFilter!==Ve}function y(E,x){return E.generateMipmaps&&x&&E.minFilter!==Re&&E.minFilter!==Ve}function v(E){s.generateMipmap(E)}function S(E,x,N,et,Q=!1){if(o===!1)return x;if(E!==null){if(s[E]!==void 0)return s[E];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+E+"'")}let J=x;if(x===s.RED&&(N===s.FLOAT&&(J=s.R32F),N===s.HALF_FLOAT&&(J=s.R16F),N===s.UNSIGNED_BYTE&&(J=s.R8)),x===s.RED_INTEGER&&(N===s.UNSIGNED_BYTE&&(J=s.R8UI),N===s.UNSIGNED_SHORT&&(J=s.R16UI),N===s.UNSIGNED_INT&&(J=s.R32UI),N===s.BYTE&&(J=s.R8I),N===s.SHORT&&(J=s.R16I),N===s.INT&&(J=s.R32I)),x===s.RG&&(N===s.FLOAT&&(J=s.RG32F),N===s.HALF_FLOAT&&(J=s.RG16F),N===s.UNSIGNED_BYTE&&(J=s.RG8)),x===s.RGBA){const Mt=Q?Ss:Kt.getTransfer(et);N===s.FLOAT&&(J=s.RGBA32F),N===s.HALF_FLOAT&&(J=s.RGBA16F),N===s.UNSIGNED_BYTE&&(J=Mt===Qt?s.SRGB8_ALPHA8:s.RGBA8),N===s.UNSIGNED_SHORT_4_4_4_4&&(J=s.RGBA4),N===s.UNSIGNED_SHORT_5_5_5_1&&(J=s.RGB5_A1)}return(J===s.R16F||J===s.R32F||J===s.RG16F||J===s.RG32F||J===s.RGBA16F||J===s.RGBA32F)&&t.get("EXT_color_buffer_float"),J}function D(E,x,N){return y(E,N)===!0||E.isFramebufferTexture&&E.minFilter!==Re&&E.minFilter!==Ve?Math.log2(Math.max(x.width,x.height))+1:E.mipmaps!==void 0&&E.mipmaps.length>0?E.mipmaps.length:E.isCompressedTexture&&Array.isArray(E.image)?x.mipmaps.length:1}function w(E){return E===Re||E===sa||E===Bs?s.NEAREST:s.LINEAR}function b(E){const x=E.target;x.removeEventListener("dispose",b),M(x),x.isVideoTexture&&h.delete(x)}function G(E){const x=E.target;x.removeEventListener("dispose",G),O(x)}function M(E){const x=n.get(E);if(x.__webglInit===void 0)return;const N=E.source,et=d.get(N);if(et){const Q=et[x.__cacheKey];Q.usedTimes--,Q.usedTimes===0&&A(E),Object.keys(et).length===0&&d.delete(N)}n.remove(E)}function A(E){const x=n.get(E);s.deleteTexture(x.__webglTexture);const N=E.source,et=d.get(N);delete et[x.__cacheKey],a.memory.textures--}function O(E){const x=E.texture,N=n.get(E),et=n.get(x);if(et.__webglTexture!==void 0&&(s.deleteTexture(et.__webglTexture),a.memory.textures--),E.depthTexture&&E.depthTexture.dispose(),E.isWebGLCubeRenderTarget)for(let Q=0;Q<6;Q++){if(Array.isArray(N.__webglFramebuffer[Q]))for(let J=0;J<N.__webglFramebuffer[Q].length;J++)s.deleteFramebuffer(N.__webglFramebuffer[Q][J]);else s.deleteFramebuffer(N.__webglFramebuffer[Q]);N.__webglDepthbuffer&&s.deleteRenderbuffer(N.__webglDepthbuffer[Q])}else{if(Array.isArray(N.__webglFramebuffer))for(let Q=0;Q<N.__webglFramebuffer.length;Q++)s.deleteFramebuffer(N.__webglFramebuffer[Q]);else s.deleteFramebuffer(N.__webglFramebuffer);if(N.__webglDepthbuffer&&s.deleteRenderbuffer(N.__webglDepthbuffer),N.__webglMultisampledFramebuffer&&s.deleteFramebuffer(N.__webglMultisampledFramebuffer),N.__webglColorRenderbuffer)for(let Q=0;Q<N.__webglColorRenderbuffer.length;Q++)N.__webglColorRenderbuffer[Q]&&s.deleteRenderbuffer(N.__webglColorRenderbuffer[Q]);N.__webglDepthRenderbuffer&&s.deleteRenderbuffer(N.__webglDepthRenderbuffer)}if(E.isWebGLMultipleRenderTargets)for(let Q=0,J=x.length;Q<J;Q++){const Mt=n.get(x[Q]);Mt.__webglTexture&&(s.deleteTexture(Mt.__webglTexture),a.memory.textures--),n.remove(x[Q])}n.remove(x),n.remove(E)}let k=0;function nt(){k=0}function L(){const E=k;return E>=i.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+E+" texture units while this GPU supports only "+i.maxTextures),k+=1,E}function F(E){const x=[];return x.push(E.wrapS),x.push(E.wrapT),x.push(E.wrapR||0),x.push(E.magFilter),x.push(E.minFilter),x.push(E.anisotropy),x.push(E.internalFormat),x.push(E.format),x.push(E.type),x.push(E.generateMipmaps),x.push(E.premultiplyAlpha),x.push(E.flipY),x.push(E.unpackAlignment),x.push(E.colorSpace),x.join()}function V(E,x){const N=n.get(E);if(E.isVideoTexture&&Tt(E),E.isRenderTargetTexture===!1&&E.version>0&&N.__version!==E.version){const et=E.image;if(et===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(et.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{pt(N,E,x);return}}e.bindTexture(s.TEXTURE_2D,N.__webglTexture,s.TEXTURE0+x)}function K(E,x){const N=n.get(E);if(E.version>0&&N.__version!==E.version){pt(N,E,x);return}e.bindTexture(s.TEXTURE_2D_ARRAY,N.__webglTexture,s.TEXTURE0+x)}function Y(E,x){const N=n.get(E);if(E.version>0&&N.__version!==E.version){pt(N,E,x);return}e.bindTexture(s.TEXTURE_3D,N.__webglTexture,s.TEXTURE0+x)}function $(E,x){const N=n.get(E);if(E.version>0&&N.__version!==E.version){St(N,E,x);return}e.bindTexture(s.TEXTURE_CUBE_MAP,N.__webglTexture,s.TEXTURE0+x)}const Z={[yr]:s.REPEAT,[Je]:s.CLAMP_TO_EDGE,[Er]:s.MIRRORED_REPEAT},it={[Re]:s.NEAREST,[sa]:s.NEAREST_MIPMAP_NEAREST,[Bs]:s.NEAREST_MIPMAP_LINEAR,[Ve]:s.LINEAR,[ll]:s.LINEAR_MIPMAP_NEAREST,[Ni]:s.LINEAR_MIPMAP_LINEAR},rt={[Sl]:s.NEVER,[bl]:s.ALWAYS,[yl]:s.LESS,[qo]:s.LEQUAL,[El]:s.EQUAL,[wl]:s.GEQUAL,[Tl]:s.GREATER,[Al]:s.NOTEQUAL};function W(E,x,N){if(N?(s.texParameteri(E,s.TEXTURE_WRAP_S,Z[x.wrapS]),s.texParameteri(E,s.TEXTURE_WRAP_T,Z[x.wrapT]),(E===s.TEXTURE_3D||E===s.TEXTURE_2D_ARRAY)&&s.texParameteri(E,s.TEXTURE_WRAP_R,Z[x.wrapR]),s.texParameteri(E,s.TEXTURE_MAG_FILTER,it[x.magFilter]),s.texParameteri(E,s.TEXTURE_MIN_FILTER,it[x.minFilter])):(s.texParameteri(E,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(E,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),(E===s.TEXTURE_3D||E===s.TEXTURE_2D_ARRAY)&&s.texParameteri(E,s.TEXTURE_WRAP_R,s.CLAMP_TO_EDGE),(x.wrapS!==Je||x.wrapT!==Je)&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping."),s.texParameteri(E,s.TEXTURE_MAG_FILTER,w(x.magFilter)),s.texParameteri(E,s.TEXTURE_MIN_FILTER,w(x.minFilter)),x.minFilter!==Re&&x.minFilter!==Ve&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.")),x.compareFunction&&(s.texParameteri(E,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(E,s.TEXTURE_COMPARE_FUNC,rt[x.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){const et=t.get("EXT_texture_filter_anisotropic");if(x.magFilter===Re||x.minFilter!==Bs&&x.minFilter!==Ni||x.type===Sn&&t.has("OES_texture_float_linear")===!1||o===!1&&x.type===Oi&&t.has("OES_texture_half_float_linear")===!1)return;(x.anisotropy>1||n.get(x).__currentAnisotropy)&&(s.texParameterf(E,et.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,i.getMaxAnisotropy())),n.get(x).__currentAnisotropy=x.anisotropy)}}function j(E,x){let N=!1;E.__webglInit===void 0&&(E.__webglInit=!0,x.addEventListener("dispose",b));const et=x.source;let Q=d.get(et);Q===void 0&&(Q={},d.set(et,Q));const J=F(x);if(J!==E.__cacheKey){Q[J]===void 0&&(Q[J]={texture:s.createTexture(),usedTimes:0},a.memory.textures++,N=!0),Q[J].usedTimes++;const Mt=Q[E.__cacheKey];Mt!==void 0&&(Q[E.__cacheKey].usedTimes--,Mt.usedTimes===0&&A(x)),E.__cacheKey=J,E.__webglTexture=Q[J].texture}return N}function pt(E,x,N){let et=s.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&(et=s.TEXTURE_2D_ARRAY),x.isData3DTexture&&(et=s.TEXTURE_3D);const Q=j(E,x),J=x.source;e.bindTexture(et,E.__webglTexture,s.TEXTURE0+N);const Mt=n.get(J);if(J.version!==Mt.__version||Q===!0){e.activeTexture(s.TEXTURE0+N);const ut=Kt.getPrimaries(Kt.workingColorSpace),vt=x.colorSpace===We?null:Kt.getPrimaries(x.colorSpace),wt=x.colorSpace===We||ut===vt?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,x.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,x.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,wt);const Bt=f(x)&&p(x.image)===!1;let tt=_(x.image,Bt,!1,i.maxTextureSize);tt=mt(x,tt);const Yt=p(tt)||o,qt=r.convert(x.format,x.colorSpace);let It=r.convert(x.type),At=S(x.internalFormat,qt,It,x.colorSpace,x.isVideoTexture);W(et,x,Yt);let xt;const Gt=x.mipmaps,$t=o&&x.isVideoTexture!==!0&&At!==ko,re=Mt.__version===void 0||Q===!0,kt=D(x,tt,Yt);if(x.isDepthTexture)At=s.DEPTH_COMPONENT,o?x.type===Sn?At=s.DEPTH_COMPONENT32F:x.type===Mn?At=s.DEPTH_COMPONENT24:x.type===Fn?At=s.DEPTH24_STENCIL8:At=s.DEPTH_COMPONENT16:x.type===Sn&&console.error("WebGLRenderer: Floating point depth texture requires WebGL2."),x.format===Bn&&At===s.DEPTH_COMPONENT&&x.type!==Dr&&x.type!==Mn&&(console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture."),x.type=Mn,It=r.convert(x.type)),x.format===_i&&At===s.DEPTH_COMPONENT&&(At=s.DEPTH_STENCIL,x.type!==Fn&&(console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture."),x.type=Fn,It=r.convert(x.type))),re&&($t?e.texStorage2D(s.TEXTURE_2D,1,At,tt.width,tt.height):e.texImage2D(s.TEXTURE_2D,0,At,tt.width,tt.height,0,qt,It,null));else if(x.isDataTexture)if(Gt.length>0&&Yt){$t&&re&&e.texStorage2D(s.TEXTURE_2D,kt,At,Gt[0].width,Gt[0].height);for(let ot=0,P=Gt.length;ot<P;ot++)xt=Gt[ot],$t?e.texSubImage2D(s.TEXTURE_2D,ot,0,0,xt.width,xt.height,qt,It,xt.data):e.texImage2D(s.TEXTURE_2D,ot,At,xt.width,xt.height,0,qt,It,xt.data);x.generateMipmaps=!1}else $t?(re&&e.texStorage2D(s.TEXTURE_2D,kt,At,tt.width,tt.height),e.texSubImage2D(s.TEXTURE_2D,0,0,0,tt.width,tt.height,qt,It,tt.data)):e.texImage2D(s.TEXTURE_2D,0,At,tt.width,tt.height,0,qt,It,tt.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){$t&&re&&e.texStorage3D(s.TEXTURE_2D_ARRAY,kt,At,Gt[0].width,Gt[0].height,tt.depth);for(let ot=0,P=Gt.length;ot<P;ot++)xt=Gt[ot],x.format!==je?qt!==null?$t?e.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,ot,0,0,0,xt.width,xt.height,tt.depth,qt,xt.data,0,0):e.compressedTexImage3D(s.TEXTURE_2D_ARRAY,ot,At,xt.width,xt.height,tt.depth,0,xt.data,0,0):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):$t?e.texSubImage3D(s.TEXTURE_2D_ARRAY,ot,0,0,0,xt.width,xt.height,tt.depth,qt,It,xt.data):e.texImage3D(s.TEXTURE_2D_ARRAY,ot,At,xt.width,xt.height,tt.depth,0,qt,It,xt.data)}else{$t&&re&&e.texStorage2D(s.TEXTURE_2D,kt,At,Gt[0].width,Gt[0].height);for(let ot=0,P=Gt.length;ot<P;ot++)xt=Gt[ot],x.format!==je?qt!==null?$t?e.compressedTexSubImage2D(s.TEXTURE_2D,ot,0,0,xt.width,xt.height,qt,xt.data):e.compressedTexImage2D(s.TEXTURE_2D,ot,At,xt.width,xt.height,0,xt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):$t?e.texSubImage2D(s.TEXTURE_2D,ot,0,0,xt.width,xt.height,qt,It,xt.data):e.texImage2D(s.TEXTURE_2D,ot,At,xt.width,xt.height,0,qt,It,xt.data)}else if(x.isDataArrayTexture)$t?(re&&e.texStorage3D(s.TEXTURE_2D_ARRAY,kt,At,tt.width,tt.height,tt.depth),e.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,tt.width,tt.height,tt.depth,qt,It,tt.data)):e.texImage3D(s.TEXTURE_2D_ARRAY,0,At,tt.width,tt.height,tt.depth,0,qt,It,tt.data);else if(x.isData3DTexture)$t?(re&&e.texStorage3D(s.TEXTURE_3D,kt,At,tt.width,tt.height,tt.depth),e.texSubImage3D(s.TEXTURE_3D,0,0,0,0,tt.width,tt.height,tt.depth,qt,It,tt.data)):e.texImage3D(s.TEXTURE_3D,0,At,tt.width,tt.height,tt.depth,0,qt,It,tt.data);else if(x.isFramebufferTexture){if(re)if($t)e.texStorage2D(s.TEXTURE_2D,kt,At,tt.width,tt.height);else{let ot=tt.width,P=tt.height;for(let dt=0;dt<kt;dt++)e.texImage2D(s.TEXTURE_2D,dt,At,ot,P,0,qt,It,null),ot>>=1,P>>=1}}else if(Gt.length>0&&Yt){$t&&re&&e.texStorage2D(s.TEXTURE_2D,kt,At,Gt[0].width,Gt[0].height);for(let ot=0,P=Gt.length;ot<P;ot++)xt=Gt[ot],$t?e.texSubImage2D(s.TEXTURE_2D,ot,0,0,qt,It,xt):e.texImage2D(s.TEXTURE_2D,ot,At,qt,It,xt);x.generateMipmaps=!1}else $t?(re&&e.texStorage2D(s.TEXTURE_2D,kt,At,tt.width,tt.height),e.texSubImage2D(s.TEXTURE_2D,0,0,0,qt,It,tt)):e.texImage2D(s.TEXTURE_2D,0,At,qt,It,tt);y(x,Yt)&&v(et),Mt.__version=J.version,x.onUpdate&&x.onUpdate(x)}E.__version=x.version}function St(E,x,N){if(x.image.length!==6)return;const et=j(E,x),Q=x.source;e.bindTexture(s.TEXTURE_CUBE_MAP,E.__webglTexture,s.TEXTURE0+N);const J=n.get(Q);if(Q.version!==J.__version||et===!0){e.activeTexture(s.TEXTURE0+N);const Mt=Kt.getPrimaries(Kt.workingColorSpace),ut=x.colorSpace===We?null:Kt.getPrimaries(x.colorSpace),vt=x.colorSpace===We||Mt===ut?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,x.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,x.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,vt);const wt=x.isCompressedTexture||x.image[0].isCompressedTexture,Bt=x.image[0]&&x.image[0].isDataTexture,tt=[];for(let ot=0;ot<6;ot++)!wt&&!Bt?tt[ot]=_(x.image[ot],!1,!0,i.maxCubemapSize):tt[ot]=Bt?x.image[ot].image:x.image[ot],tt[ot]=mt(x,tt[ot]);const Yt=tt[0],qt=p(Yt)||o,It=r.convert(x.format,x.colorSpace),At=r.convert(x.type),xt=S(x.internalFormat,It,At,x.colorSpace),Gt=o&&x.isVideoTexture!==!0,$t=J.__version===void 0||et===!0;let re=D(x,Yt,qt);W(s.TEXTURE_CUBE_MAP,x,qt);let kt;if(wt){Gt&&$t&&e.texStorage2D(s.TEXTURE_CUBE_MAP,re,xt,Yt.width,Yt.height);for(let ot=0;ot<6;ot++){kt=tt[ot].mipmaps;for(let P=0;P<kt.length;P++){const dt=kt[P];x.format!==je?It!==null?Gt?e.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ot,P,0,0,dt.width,dt.height,It,dt.data):e.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ot,P,xt,dt.width,dt.height,0,dt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Gt?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ot,P,0,0,dt.width,dt.height,It,At,dt.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ot,P,xt,dt.width,dt.height,0,It,At,dt.data)}}}else{kt=x.mipmaps,Gt&&$t&&(kt.length>0&&re++,e.texStorage2D(s.TEXTURE_CUBE_MAP,re,xt,tt[0].width,tt[0].height));for(let ot=0;ot<6;ot++)if(Bt){Gt?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ot,0,0,0,tt[ot].width,tt[ot].height,It,At,tt[ot].data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ot,0,xt,tt[ot].width,tt[ot].height,0,It,At,tt[ot].data);for(let P=0;P<kt.length;P++){const ft=kt[P].image[ot].image;Gt?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ot,P+1,0,0,ft.width,ft.height,It,At,ft.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ot,P+1,xt,ft.width,ft.height,0,It,At,ft.data)}}else{Gt?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ot,0,0,0,It,At,tt[ot]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ot,0,xt,It,At,tt[ot]);for(let P=0;P<kt.length;P++){const dt=kt[P];Gt?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ot,P+1,0,0,It,At,dt.image[ot]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ot,P+1,xt,It,At,dt.image[ot])}}}y(x,qt)&&v(s.TEXTURE_CUBE_MAP),J.__version=Q.version,x.onUpdate&&x.onUpdate(x)}E.__version=x.version}function _t(E,x,N,et,Q,J){const Mt=r.convert(N.format,N.colorSpace),ut=r.convert(N.type),vt=S(N.internalFormat,Mt,ut,N.colorSpace);if(!n.get(x).__hasExternalTextures){const Bt=Math.max(1,x.width>>J),tt=Math.max(1,x.height>>J);Q===s.TEXTURE_3D||Q===s.TEXTURE_2D_ARRAY?e.texImage3D(Q,J,vt,Bt,tt,x.depth,0,Mt,ut,null):e.texImage2D(Q,J,vt,Bt,tt,0,Mt,ut,null)}e.bindFramebuffer(s.FRAMEBUFFER,E),X(x)?c.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,et,Q,n.get(N).__webglTexture,0,st(x)):(Q===s.TEXTURE_2D||Q>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&Q<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,et,Q,n.get(N).__webglTexture,J),e.bindFramebuffer(s.FRAMEBUFFER,null)}function Ct(E,x,N){if(s.bindRenderbuffer(s.RENDERBUFFER,E),x.depthBuffer&&!x.stencilBuffer){let et=o===!0?s.DEPTH_COMPONENT24:s.DEPTH_COMPONENT16;if(N||X(x)){const Q=x.depthTexture;Q&&Q.isDepthTexture&&(Q.type===Sn?et=s.DEPTH_COMPONENT32F:Q.type===Mn&&(et=s.DEPTH_COMPONENT24));const J=st(x);X(x)?c.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,J,et,x.width,x.height):s.renderbufferStorageMultisample(s.RENDERBUFFER,J,et,x.width,x.height)}else s.renderbufferStorage(s.RENDERBUFFER,et,x.width,x.height);s.framebufferRenderbuffer(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.RENDERBUFFER,E)}else if(x.depthBuffer&&x.stencilBuffer){const et=st(x);N&&X(x)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,et,s.DEPTH24_STENCIL8,x.width,x.height):X(x)?c.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,et,s.DEPTH24_STENCIL8,x.width,x.height):s.renderbufferStorage(s.RENDERBUFFER,s.DEPTH_STENCIL,x.width,x.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.RENDERBUFFER,E)}else{const et=x.isWebGLMultipleRenderTargets===!0?x.texture:[x.texture];for(let Q=0;Q<et.length;Q++){const J=et[Q],Mt=r.convert(J.format,J.colorSpace),ut=r.convert(J.type),vt=S(J.internalFormat,Mt,ut,J.colorSpace),wt=st(x);N&&X(x)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,wt,vt,x.width,x.height):X(x)?c.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,wt,vt,x.width,x.height):s.renderbufferStorage(s.RENDERBUFFER,vt,x.width,x.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function Nt(E,x){if(x&&x.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(s.FRAMEBUFFER,E),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!n.get(x.depthTexture).__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),V(x.depthTexture,0);const et=n.get(x.depthTexture).__webglTexture,Q=st(x);if(x.depthTexture.format===Bn)X(x)?c.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,et,0,Q):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,et,0);else if(x.depthTexture.format===_i)X(x)?c.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,et,0,Q):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,et,0);else throw new Error("Unknown depthTexture format")}function yt(E){const x=n.get(E),N=E.isWebGLCubeRenderTarget===!0;if(E.depthTexture&&!x.__autoAllocateDepthBuffer){if(N)throw new Error("target.depthTexture not supported in Cube render targets");Nt(x.__webglFramebuffer,E)}else if(N){x.__webglDepthbuffer=[];for(let et=0;et<6;et++)e.bindFramebuffer(s.FRAMEBUFFER,x.__webglFramebuffer[et]),x.__webglDepthbuffer[et]=s.createRenderbuffer(),Ct(x.__webglDepthbuffer[et],E,!1)}else e.bindFramebuffer(s.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer=s.createRenderbuffer(),Ct(x.__webglDepthbuffer,E,!1);e.bindFramebuffer(s.FRAMEBUFFER,null)}function Dt(E,x,N){const et=n.get(E);x!==void 0&&_t(et.__webglFramebuffer,E,E.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),N!==void 0&&yt(E)}function R(E){const x=E.texture,N=n.get(E),et=n.get(x);E.addEventListener("dispose",G),E.isWebGLMultipleRenderTargets!==!0&&(et.__webglTexture===void 0&&(et.__webglTexture=s.createTexture()),et.__version=x.version,a.memory.textures++);const Q=E.isWebGLCubeRenderTarget===!0,J=E.isWebGLMultipleRenderTargets===!0,Mt=p(E)||o;if(Q){N.__webglFramebuffer=[];for(let ut=0;ut<6;ut++)if(o&&x.mipmaps&&x.mipmaps.length>0){N.__webglFramebuffer[ut]=[];for(let vt=0;vt<x.mipmaps.length;vt++)N.__webglFramebuffer[ut][vt]=s.createFramebuffer()}else N.__webglFramebuffer[ut]=s.createFramebuffer()}else{if(o&&x.mipmaps&&x.mipmaps.length>0){N.__webglFramebuffer=[];for(let ut=0;ut<x.mipmaps.length;ut++)N.__webglFramebuffer[ut]=s.createFramebuffer()}else N.__webglFramebuffer=s.createFramebuffer();if(J)if(i.drawBuffers){const ut=E.texture;for(let vt=0,wt=ut.length;vt<wt;vt++){const Bt=n.get(ut[vt]);Bt.__webglTexture===void 0&&(Bt.__webglTexture=s.createTexture(),a.memory.textures++)}}else console.warn("THREE.WebGLRenderer: WebGLMultipleRenderTargets can only be used with WebGL2 or WEBGL_draw_buffers extension.");if(o&&E.samples>0&&X(E)===!1){const ut=J?x:[x];N.__webglMultisampledFramebuffer=s.createFramebuffer(),N.__webglColorRenderbuffer=[],e.bindFramebuffer(s.FRAMEBUFFER,N.__webglMultisampledFramebuffer);for(let vt=0;vt<ut.length;vt++){const wt=ut[vt];N.__webglColorRenderbuffer[vt]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,N.__webglColorRenderbuffer[vt]);const Bt=r.convert(wt.format,wt.colorSpace),tt=r.convert(wt.type),Yt=S(wt.internalFormat,Bt,tt,wt.colorSpace,E.isXRRenderTarget===!0),qt=st(E);s.renderbufferStorageMultisample(s.RENDERBUFFER,qt,Yt,E.width,E.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+vt,s.RENDERBUFFER,N.__webglColorRenderbuffer[vt])}s.bindRenderbuffer(s.RENDERBUFFER,null),E.depthBuffer&&(N.__webglDepthRenderbuffer=s.createRenderbuffer(),Ct(N.__webglDepthRenderbuffer,E,!0)),e.bindFramebuffer(s.FRAMEBUFFER,null)}}if(Q){e.bindTexture(s.TEXTURE_CUBE_MAP,et.__webglTexture),W(s.TEXTURE_CUBE_MAP,x,Mt);for(let ut=0;ut<6;ut++)if(o&&x.mipmaps&&x.mipmaps.length>0)for(let vt=0;vt<x.mipmaps.length;vt++)_t(N.__webglFramebuffer[ut][vt],E,x,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ut,vt);else _t(N.__webglFramebuffer[ut],E,x,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ut,0);y(x,Mt)&&v(s.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(J){const ut=E.texture;for(let vt=0,wt=ut.length;vt<wt;vt++){const Bt=ut[vt],tt=n.get(Bt);e.bindTexture(s.TEXTURE_2D,tt.__webglTexture),W(s.TEXTURE_2D,Bt,Mt),_t(N.__webglFramebuffer,E,Bt,s.COLOR_ATTACHMENT0+vt,s.TEXTURE_2D,0),y(Bt,Mt)&&v(s.TEXTURE_2D)}e.unbindTexture()}else{let ut=s.TEXTURE_2D;if((E.isWebGL3DRenderTarget||E.isWebGLArrayRenderTarget)&&(o?ut=E.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY:console.error("THREE.WebGLTextures: THREE.Data3DTexture and THREE.DataArrayTexture only supported with WebGL2.")),e.bindTexture(ut,et.__webglTexture),W(ut,x,Mt),o&&x.mipmaps&&x.mipmaps.length>0)for(let vt=0;vt<x.mipmaps.length;vt++)_t(N.__webglFramebuffer[vt],E,x,s.COLOR_ATTACHMENT0,ut,vt);else _t(N.__webglFramebuffer,E,x,s.COLOR_ATTACHMENT0,ut,0);y(x,Mt)&&v(ut),e.unbindTexture()}E.depthBuffer&&yt(E)}function at(E){const x=p(E)||o,N=E.isWebGLMultipleRenderTargets===!0?E.texture:[E.texture];for(let et=0,Q=N.length;et<Q;et++){const J=N[et];if(y(J,x)){const Mt=E.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:s.TEXTURE_2D,ut=n.get(J).__webglTexture;e.bindTexture(Mt,ut),v(Mt),e.unbindTexture()}}}function q(E){if(o&&E.samples>0&&X(E)===!1){const x=E.isWebGLMultipleRenderTargets?E.texture:[E.texture],N=E.width,et=E.height;let Q=s.COLOR_BUFFER_BIT;const J=[],Mt=E.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ut=n.get(E),vt=E.isWebGLMultipleRenderTargets===!0;if(vt)for(let wt=0;wt<x.length;wt++)e.bindFramebuffer(s.FRAMEBUFFER,ut.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+wt,s.RENDERBUFFER,null),e.bindFramebuffer(s.FRAMEBUFFER,ut.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+wt,s.TEXTURE_2D,null,0);e.bindFramebuffer(s.READ_FRAMEBUFFER,ut.__webglMultisampledFramebuffer),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,ut.__webglFramebuffer);for(let wt=0;wt<x.length;wt++){J.push(s.COLOR_ATTACHMENT0+wt),E.depthBuffer&&J.push(Mt);const Bt=ut.__ignoreDepthValues!==void 0?ut.__ignoreDepthValues:!1;if(Bt===!1&&(E.depthBuffer&&(Q|=s.DEPTH_BUFFER_BIT),E.stencilBuffer&&(Q|=s.STENCIL_BUFFER_BIT)),vt&&s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,ut.__webglColorRenderbuffer[wt]),Bt===!0&&(s.invalidateFramebuffer(s.READ_FRAMEBUFFER,[Mt]),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[Mt])),vt){const tt=n.get(x[wt]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,tt,0)}s.blitFramebuffer(0,0,N,et,0,0,N,et,Q,s.NEAREST),l&&s.invalidateFramebuffer(s.READ_FRAMEBUFFER,J)}if(e.bindFramebuffer(s.READ_FRAMEBUFFER,null),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),vt)for(let wt=0;wt<x.length;wt++){e.bindFramebuffer(s.FRAMEBUFFER,ut.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+wt,s.RENDERBUFFER,ut.__webglColorRenderbuffer[wt]);const Bt=n.get(x[wt]).__webglTexture;e.bindFramebuffer(s.FRAMEBUFFER,ut.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+wt,s.TEXTURE_2D,Bt,0)}e.bindFramebuffer(s.DRAW_FRAMEBUFFER,ut.__webglMultisampledFramebuffer)}}function st(E){return Math.min(i.maxSamples,E.samples)}function X(E){const x=n.get(E);return o&&E.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function Tt(E){const x=a.render.frame;h.get(E)!==x&&(h.set(E,x),E.update())}function mt(E,x){const N=E.colorSpace,et=E.format,Q=E.type;return E.isCompressedTexture===!0||E.isVideoTexture===!0||E.format===Tr||N!==dn&&N!==We&&(Kt.getTransfer(N)===Qt?o===!1?t.has("EXT_sRGB")===!0&&et===je?(E.format=Tr,E.minFilter=Ve,E.generateMipmaps=!1):x=$o.sRGBToLinear(x):(et!==je||Q!==Tn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",N)),x}this.allocateTextureUnit=L,this.resetTextureUnits=nt,this.setTexture2D=V,this.setTexture2DArray=K,this.setTexture3D=Y,this.setTextureCube=$,this.rebindTextures=Dt,this.setupRenderTarget=R,this.updateRenderTargetMipmap=at,this.updateMultisampleRenderTarget=q,this.setupDepthRenderbuffer=yt,this.setupFrameBufferTexture=_t,this.useMultisampledRTT=X}function Wp(s,t,e){const n=e.isWebGL2;function i(r,a=We){let o;const c=Kt.getTransfer(a);if(r===Tn)return s.UNSIGNED_BYTE;if(r===Bo)return s.UNSIGNED_SHORT_4_4_4_4;if(r===zo)return s.UNSIGNED_SHORT_5_5_5_1;if(r===hl)return s.BYTE;if(r===ul)return s.SHORT;if(r===Dr)return s.UNSIGNED_SHORT;if(r===Fo)return s.INT;if(r===Mn)return s.UNSIGNED_INT;if(r===Sn)return s.FLOAT;if(r===Oi)return n?s.HALF_FLOAT:(o=t.get("OES_texture_half_float"),o!==null?o.HALF_FLOAT_OES:null);if(r===dl)return s.ALPHA;if(r===je)return s.RGBA;if(r===fl)return s.LUMINANCE;if(r===pl)return s.LUMINANCE_ALPHA;if(r===Bn)return s.DEPTH_COMPONENT;if(r===_i)return s.DEPTH_STENCIL;if(r===Tr)return o=t.get("EXT_sRGB"),o!==null?o.SRGB_ALPHA_EXT:null;if(r===ml)return s.RED;if(r===Go)return s.RED_INTEGER;if(r===gl)return s.RG;if(r===Ho)return s.RG_INTEGER;if(r===Vo)return s.RGBA_INTEGER;if(r===zs||r===Gs||r===Hs||r===Vs)if(c===Qt)if(o=t.get("WEBGL_compressed_texture_s3tc_srgb"),o!==null){if(r===zs)return o.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(r===Gs)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(r===Hs)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(r===Vs)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(o=t.get("WEBGL_compressed_texture_s3tc"),o!==null){if(r===zs)return o.COMPRESSED_RGB_S3TC_DXT1_EXT;if(r===Gs)return o.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(r===Hs)return o.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(r===Vs)return o.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(r===ra||r===aa||r===oa||r===ca)if(o=t.get("WEBGL_compressed_texture_pvrtc"),o!==null){if(r===ra)return o.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(r===aa)return o.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(r===oa)return o.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(r===ca)return o.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(r===ko)return o=t.get("WEBGL_compressed_texture_etc1"),o!==null?o.COMPRESSED_RGB_ETC1_WEBGL:null;if(r===la||r===ha)if(o=t.get("WEBGL_compressed_texture_etc"),o!==null){if(r===la)return c===Qt?o.COMPRESSED_SRGB8_ETC2:o.COMPRESSED_RGB8_ETC2;if(r===ha)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:o.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(r===ua||r===da||r===fa||r===pa||r===ma||r===ga||r===_a||r===va||r===xa||r===Ma||r===Sa||r===ya||r===Ea||r===Ta)if(o=t.get("WEBGL_compressed_texture_astc"),o!==null){if(r===ua)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:o.COMPRESSED_RGBA_ASTC_4x4_KHR;if(r===da)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:o.COMPRESSED_RGBA_ASTC_5x4_KHR;if(r===fa)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:o.COMPRESSED_RGBA_ASTC_5x5_KHR;if(r===pa)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:o.COMPRESSED_RGBA_ASTC_6x5_KHR;if(r===ma)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:o.COMPRESSED_RGBA_ASTC_6x6_KHR;if(r===ga)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:o.COMPRESSED_RGBA_ASTC_8x5_KHR;if(r===_a)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:o.COMPRESSED_RGBA_ASTC_8x6_KHR;if(r===va)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:o.COMPRESSED_RGBA_ASTC_8x8_KHR;if(r===xa)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:o.COMPRESSED_RGBA_ASTC_10x5_KHR;if(r===Ma)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:o.COMPRESSED_RGBA_ASTC_10x6_KHR;if(r===Sa)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:o.COMPRESSED_RGBA_ASTC_10x8_KHR;if(r===ya)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:o.COMPRESSED_RGBA_ASTC_10x10_KHR;if(r===Ea)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:o.COMPRESSED_RGBA_ASTC_12x10_KHR;if(r===Ta)return c===Qt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:o.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(r===ks||r===Aa||r===wa)if(o=t.get("EXT_texture_compression_bptc"),o!==null){if(r===ks)return c===Qt?o.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:o.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(r===Aa)return o.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(r===wa)return o.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(r===_l||r===ba||r===Ra||r===Ca)if(o=t.get("EXT_texture_compression_rgtc"),o!==null){if(r===ks)return o.COMPRESSED_RED_RGTC1_EXT;if(r===ba)return o.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(r===Ra)return o.COMPRESSED_RED_GREEN_RGTC2_EXT;if(r===Ca)return o.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return r===Fn?n?s.UNSIGNED_INT_24_8:(o=t.get("WEBGL_depth_texture"),o!==null?o.UNSIGNED_INT_24_8_WEBGL:null):s[r]!==void 0?s[r]:null}return{convert:i}}class Xp extends ke{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class ge extends he{constructor(){super(),this.isGroup=!0,this.type="Group"}}const qp={type:"move"};class dr{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new ge,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new ge,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new C,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new C),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new ge,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new C,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new C),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let i=null,r=null,a=null;const o=this._targetRay,c=this._grip,l=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(l&&t.hand){a=!0;for(const _ of t.hand.values()){const p=e.getJointPose(_,n),f=this._getHandJoint(l,_);p!==null&&(f.matrix.fromArray(p.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=p.radius),f.visible=p!==null}const h=l.joints["index-finger-tip"],u=l.joints["thumb-tip"],d=h.position.distanceTo(u.position),m=.02,g=.005;l.inputState.pinching&&d>m+g?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!l.inputState.pinching&&d<=m-g&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else c!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(c.matrix.fromArray(r.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,r.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(r.linearVelocity)):c.hasLinearVelocity=!1,r.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(r.angularVelocity)):c.hasAngularVelocity=!1));o!==null&&(i=e.getPose(t.targetRaySpace,n),i===null&&r!==null&&(i=r),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity)):o.hasLinearVelocity=!1,i.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(qp)))}return o!==null&&(o.visible=i!==null),c!==null&&(c.visible=r!==null),l!==null&&(l.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new ge;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}class Yp extends xi{constructor(t,e){super();const n=this;let i=null,r=1,a=null,o="local-floor",c=1,l=null,h=null,u=null,d=null,m=null,g=null;const _=e.getContextAttributes();let p=null,f=null;const y=[],v=[],S=new lt;let D=null;const w=new ke;w.layers.enable(1),w.viewport=new _e;const b=new ke;b.layers.enable(2),b.viewport=new _e;const G=[w,b],M=new Xp;M.layers.enable(1),M.layers.enable(2);let A=null,O=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(W){let j=y[W];return j===void 0&&(j=new dr,y[W]=j),j.getTargetRaySpace()},this.getControllerGrip=function(W){let j=y[W];return j===void 0&&(j=new dr,y[W]=j),j.getGripSpace()},this.getHand=function(W){let j=y[W];return j===void 0&&(j=new dr,y[W]=j),j.getHandSpace()};function k(W){const j=v.indexOf(W.inputSource);if(j===-1)return;const pt=y[j];pt!==void 0&&(pt.update(W.inputSource,W.frame,l||a),pt.dispatchEvent({type:W.type,data:W.inputSource}))}function nt(){i.removeEventListener("select",k),i.removeEventListener("selectstart",k),i.removeEventListener("selectend",k),i.removeEventListener("squeeze",k),i.removeEventListener("squeezestart",k),i.removeEventListener("squeezeend",k),i.removeEventListener("end",nt),i.removeEventListener("inputsourceschange",L);for(let W=0;W<y.length;W++){const j=v[W];j!==null&&(v[W]=null,y[W].disconnect(j))}A=null,O=null,t.setRenderTarget(p),m=null,d=null,u=null,i=null,f=null,rt.stop(),n.isPresenting=!1,t.setPixelRatio(D),t.setSize(S.width,S.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(W){r=W,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(W){o=W,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||a},this.setReferenceSpace=function(W){l=W},this.getBaseLayer=function(){return d!==null?d:m},this.getBinding=function(){return u},this.getFrame=function(){return g},this.getSession=function(){return i},this.setSession=async function(W){if(i=W,i!==null){if(p=t.getRenderTarget(),i.addEventListener("select",k),i.addEventListener("selectstart",k),i.addEventListener("selectend",k),i.addEventListener("squeeze",k),i.addEventListener("squeezestart",k),i.addEventListener("squeezeend",k),i.addEventListener("end",nt),i.addEventListener("inputsourceschange",L),_.xrCompatible!==!0&&await e.makeXRCompatible(),D=t.getPixelRatio(),t.getSize(S),i.renderState.layers===void 0||t.capabilities.isWebGL2===!1){const j={antialias:i.renderState.layers===void 0?_.antialias:!0,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:r};m=new XRWebGLLayer(i,e,j),i.updateRenderState({baseLayer:m}),t.setPixelRatio(1),t.setSize(m.framebufferWidth,m.framebufferHeight,!1),f=new Gn(m.framebufferWidth,m.framebufferHeight,{format:je,type:Tn,colorSpace:t.outputColorSpace,stencilBuffer:_.stencil})}else{let j=null,pt=null,St=null;_.depth&&(St=_.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,j=_.stencil?_i:Bn,pt=_.stencil?Fn:Mn);const _t={colorFormat:e.RGBA8,depthFormat:St,scaleFactor:r};u=new XRWebGLBinding(i,e),d=u.createProjectionLayer(_t),i.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),f=new Gn(d.textureWidth,d.textureHeight,{format:je,type:Tn,depthTexture:new ac(d.textureWidth,d.textureHeight,pt,void 0,void 0,void 0,void 0,void 0,void 0,j),stencilBuffer:_.stencil,colorSpace:t.outputColorSpace,samples:_.antialias?4:0});const Ct=t.properties.get(f);Ct.__ignoreDepthValues=d.ignoreDepthValues}f.isXRRenderTarget=!0,this.setFoveation(c),l=null,a=await i.requestReferenceSpace(o),rt.setContext(i),rt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode};function L(W){for(let j=0;j<W.removed.length;j++){const pt=W.removed[j],St=v.indexOf(pt);St>=0&&(v[St]=null,y[St].disconnect(pt))}for(let j=0;j<W.added.length;j++){const pt=W.added[j];let St=v.indexOf(pt);if(St===-1){for(let Ct=0;Ct<y.length;Ct++)if(Ct>=v.length){v.push(pt),St=Ct;break}else if(v[Ct]===null){v[Ct]=pt,St=Ct;break}if(St===-1)break}const _t=y[St];_t&&_t.connect(pt)}}const F=new C,V=new C;function K(W,j,pt){F.setFromMatrixPosition(j.matrixWorld),V.setFromMatrixPosition(pt.matrixWorld);const St=F.distanceTo(V),_t=j.projectionMatrix.elements,Ct=pt.projectionMatrix.elements,Nt=_t[14]/(_t[10]-1),yt=_t[14]/(_t[10]+1),Dt=(_t[9]+1)/_t[5],R=(_t[9]-1)/_t[5],at=(_t[8]-1)/_t[0],q=(Ct[8]+1)/Ct[0],st=Nt*at,X=Nt*q,Tt=St/(-at+q),mt=Tt*-at;j.matrixWorld.decompose(W.position,W.quaternion,W.scale),W.translateX(mt),W.translateZ(Tt),W.matrixWorld.compose(W.position,W.quaternion,W.scale),W.matrixWorldInverse.copy(W.matrixWorld).invert();const E=Nt+Tt,x=yt+Tt,N=st-mt,et=X+(St-mt),Q=Dt*yt/x*E,J=R*yt/x*E;W.projectionMatrix.makePerspective(N,et,Q,J,E,x),W.projectionMatrixInverse.copy(W.projectionMatrix).invert()}function Y(W,j){j===null?W.matrixWorld.copy(W.matrix):W.matrixWorld.multiplyMatrices(j.matrixWorld,W.matrix),W.matrixWorldInverse.copy(W.matrixWorld).invert()}this.updateCamera=function(W){if(i===null)return;M.near=b.near=w.near=W.near,M.far=b.far=w.far=W.far,(A!==M.near||O!==M.far)&&(i.updateRenderState({depthNear:M.near,depthFar:M.far}),A=M.near,O=M.far);const j=W.parent,pt=M.cameras;Y(M,j);for(let St=0;St<pt.length;St++)Y(pt[St],j);pt.length===2?K(M,w,b):M.projectionMatrix.copy(w.projectionMatrix),$(W,M,j)};function $(W,j,pt){pt===null?W.matrix.copy(j.matrixWorld):(W.matrix.copy(pt.matrixWorld),W.matrix.invert(),W.matrix.multiply(j.matrixWorld)),W.matrix.decompose(W.position,W.quaternion,W.scale),W.updateMatrixWorld(!0),W.projectionMatrix.copy(j.projectionMatrix),W.projectionMatrixInverse.copy(j.projectionMatrixInverse),W.isPerspectiveCamera&&(W.fov=Fi*2*Math.atan(1/W.projectionMatrix.elements[5]),W.zoom=1)}this.getCamera=function(){return M},this.getFoveation=function(){if(!(d===null&&m===null))return c},this.setFoveation=function(W){c=W,d!==null&&(d.fixedFoveation=W),m!==null&&m.fixedFoveation!==void 0&&(m.fixedFoveation=W)};let Z=null;function it(W,j){if(h=j.getViewerPose(l||a),g=j,h!==null){const pt=h.views;m!==null&&(t.setRenderTargetFramebuffer(f,m.framebuffer),t.setRenderTarget(f));let St=!1;pt.length!==M.cameras.length&&(M.cameras.length=0,St=!0);for(let _t=0;_t<pt.length;_t++){const Ct=pt[_t];let Nt=null;if(m!==null)Nt=m.getViewport(Ct);else{const Dt=u.getViewSubImage(d,Ct);Nt=Dt.viewport,_t===0&&(t.setRenderTargetTextures(f,Dt.colorTexture,d.ignoreDepthValues?void 0:Dt.depthStencilTexture),t.setRenderTarget(f))}let yt=G[_t];yt===void 0&&(yt=new ke,yt.layers.enable(_t),yt.viewport=new _e,G[_t]=yt),yt.matrix.fromArray(Ct.transform.matrix),yt.matrix.decompose(yt.position,yt.quaternion,yt.scale),yt.projectionMatrix.fromArray(Ct.projectionMatrix),yt.projectionMatrixInverse.copy(yt.projectionMatrix).invert(),yt.viewport.set(Nt.x,Nt.y,Nt.width,Nt.height),_t===0&&(M.matrix.copy(yt.matrix),M.matrix.decompose(M.position,M.quaternion,M.scale)),St===!0&&M.cameras.push(yt)}}for(let pt=0;pt<y.length;pt++){const St=v[pt],_t=y[pt];St!==null&&_t!==void 0&&_t.update(St,j,l||a)}Z&&Z(W,j),j.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:j}),g=null}const rt=new sc;rt.setAnimationLoop(it),this.setAnimationLoop=function(W){Z=W},this.dispose=function(){}}}function $p(s,t){function e(p,f){p.matrixAutoUpdate===!0&&p.updateMatrix(),f.value.copy(p.matrix)}function n(p,f){f.color.getRGB(p.fogColor.value,ec(s)),f.isFog?(p.fogNear.value=f.near,p.fogFar.value=f.far):f.isFogExp2&&(p.fogDensity.value=f.density)}function i(p,f,y,v,S){f.isMeshBasicMaterial||f.isMeshLambertMaterial?r(p,f):f.isMeshToonMaterial?(r(p,f),u(p,f)):f.isMeshPhongMaterial?(r(p,f),h(p,f)):f.isMeshStandardMaterial?(r(p,f),d(p,f),f.isMeshPhysicalMaterial&&m(p,f,S)):f.isMeshMatcapMaterial?(r(p,f),g(p,f)):f.isMeshDepthMaterial?r(p,f):f.isMeshDistanceMaterial?(r(p,f),_(p,f)):f.isMeshNormalMaterial?r(p,f):f.isLineBasicMaterial?(a(p,f),f.isLineDashedMaterial&&o(p,f)):f.isPointsMaterial?c(p,f,y,v):f.isSpriteMaterial?l(p,f):f.isShadowMaterial?(p.color.value.copy(f.color),p.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function r(p,f){p.opacity.value=f.opacity,f.color&&p.diffuse.value.copy(f.color),f.emissive&&p.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(p.map.value=f.map,e(f.map,p.mapTransform)),f.alphaMap&&(p.alphaMap.value=f.alphaMap,e(f.alphaMap,p.alphaMapTransform)),f.bumpMap&&(p.bumpMap.value=f.bumpMap,e(f.bumpMap,p.bumpMapTransform),p.bumpScale.value=f.bumpScale,f.side===Ie&&(p.bumpScale.value*=-1)),f.normalMap&&(p.normalMap.value=f.normalMap,e(f.normalMap,p.normalMapTransform),p.normalScale.value.copy(f.normalScale),f.side===Ie&&p.normalScale.value.negate()),f.displacementMap&&(p.displacementMap.value=f.displacementMap,e(f.displacementMap,p.displacementMapTransform),p.displacementScale.value=f.displacementScale,p.displacementBias.value=f.displacementBias),f.emissiveMap&&(p.emissiveMap.value=f.emissiveMap,e(f.emissiveMap,p.emissiveMapTransform)),f.specularMap&&(p.specularMap.value=f.specularMap,e(f.specularMap,p.specularMapTransform)),f.alphaTest>0&&(p.alphaTest.value=f.alphaTest);const y=t.get(f).envMap;if(y&&(p.envMap.value=y,p.flipEnvMap.value=y.isCubeTexture&&y.isRenderTargetTexture===!1?-1:1,p.reflectivity.value=f.reflectivity,p.ior.value=f.ior,p.refractionRatio.value=f.refractionRatio),f.lightMap){p.lightMap.value=f.lightMap;const v=s._useLegacyLights===!0?Math.PI:1;p.lightMapIntensity.value=f.lightMapIntensity*v,e(f.lightMap,p.lightMapTransform)}f.aoMap&&(p.aoMap.value=f.aoMap,p.aoMapIntensity.value=f.aoMapIntensity,e(f.aoMap,p.aoMapTransform))}function a(p,f){p.diffuse.value.copy(f.color),p.opacity.value=f.opacity,f.map&&(p.map.value=f.map,e(f.map,p.mapTransform))}function o(p,f){p.dashSize.value=f.dashSize,p.totalSize.value=f.dashSize+f.gapSize,p.scale.value=f.scale}function c(p,f,y,v){p.diffuse.value.copy(f.color),p.opacity.value=f.opacity,p.size.value=f.size*y,p.scale.value=v*.5,f.map&&(p.map.value=f.map,e(f.map,p.uvTransform)),f.alphaMap&&(p.alphaMap.value=f.alphaMap,e(f.alphaMap,p.alphaMapTransform)),f.alphaTest>0&&(p.alphaTest.value=f.alphaTest)}function l(p,f){p.diffuse.value.copy(f.color),p.opacity.value=f.opacity,p.rotation.value=f.rotation,f.map&&(p.map.value=f.map,e(f.map,p.mapTransform)),f.alphaMap&&(p.alphaMap.value=f.alphaMap,e(f.alphaMap,p.alphaMapTransform)),f.alphaTest>0&&(p.alphaTest.value=f.alphaTest)}function h(p,f){p.specular.value.copy(f.specular),p.shininess.value=Math.max(f.shininess,1e-4)}function u(p,f){f.gradientMap&&(p.gradientMap.value=f.gradientMap)}function d(p,f){p.metalness.value=f.metalness,f.metalnessMap&&(p.metalnessMap.value=f.metalnessMap,e(f.metalnessMap,p.metalnessMapTransform)),p.roughness.value=f.roughness,f.roughnessMap&&(p.roughnessMap.value=f.roughnessMap,e(f.roughnessMap,p.roughnessMapTransform)),t.get(f).envMap&&(p.envMapIntensity.value=f.envMapIntensity)}function m(p,f,y){p.ior.value=f.ior,f.sheen>0&&(p.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),p.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(p.sheenColorMap.value=f.sheenColorMap,e(f.sheenColorMap,p.sheenColorMapTransform)),f.sheenRoughnessMap&&(p.sheenRoughnessMap.value=f.sheenRoughnessMap,e(f.sheenRoughnessMap,p.sheenRoughnessMapTransform))),f.clearcoat>0&&(p.clearcoat.value=f.clearcoat,p.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(p.clearcoatMap.value=f.clearcoatMap,e(f.clearcoatMap,p.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,e(f.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(p.clearcoatNormalMap.value=f.clearcoatNormalMap,e(f.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===Ie&&p.clearcoatNormalScale.value.negate())),f.iridescence>0&&(p.iridescence.value=f.iridescence,p.iridescenceIOR.value=f.iridescenceIOR,p.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(p.iridescenceMap.value=f.iridescenceMap,e(f.iridescenceMap,p.iridescenceMapTransform)),f.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=f.iridescenceThicknessMap,e(f.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),f.transmission>0&&(p.transmission.value=f.transmission,p.transmissionSamplerMap.value=y.texture,p.transmissionSamplerSize.value.set(y.width,y.height),f.transmissionMap&&(p.transmissionMap.value=f.transmissionMap,e(f.transmissionMap,p.transmissionMapTransform)),p.thickness.value=f.thickness,f.thicknessMap&&(p.thicknessMap.value=f.thicknessMap,e(f.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=f.attenuationDistance,p.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(p.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(p.anisotropyMap.value=f.anisotropyMap,e(f.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=f.specularIntensity,p.specularColor.value.copy(f.specularColor),f.specularColorMap&&(p.specularColorMap.value=f.specularColorMap,e(f.specularColorMap,p.specularColorMapTransform)),f.specularIntensityMap&&(p.specularIntensityMap.value=f.specularIntensityMap,e(f.specularIntensityMap,p.specularIntensityMapTransform))}function g(p,f){f.matcap&&(p.matcap.value=f.matcap)}function _(p,f){const y=t.get(f).light;p.referencePosition.value.setFromMatrixPosition(y.matrixWorld),p.nearDistance.value=y.shadow.camera.near,p.farDistance.value=y.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function Kp(s,t,e,n){let i={},r={},a=[];const o=e.isWebGL2?s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS):0;function c(y,v){const S=v.program;n.uniformBlockBinding(y,S)}function l(y,v){let S=i[y.id];S===void 0&&(g(y),S=h(y),i[y.id]=S,y.addEventListener("dispose",p));const D=v.program;n.updateUBOMapping(y,D);const w=t.render.frame;r[y.id]!==w&&(d(y),r[y.id]=w)}function h(y){const v=u();y.__bindingPointIndex=v;const S=s.createBuffer(),D=y.__size,w=y.usage;return s.bindBuffer(s.UNIFORM_BUFFER,S),s.bufferData(s.UNIFORM_BUFFER,D,w),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,v,S),S}function u(){for(let y=0;y<o;y++)if(a.indexOf(y)===-1)return a.push(y),y;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(y){const v=i[y.id],S=y.uniforms,D=y.__cache;s.bindBuffer(s.UNIFORM_BUFFER,v);for(let w=0,b=S.length;w<b;w++){const G=Array.isArray(S[w])?S[w]:[S[w]];for(let M=0,A=G.length;M<A;M++){const O=G[M];if(m(O,w,M,D)===!0){const k=O.__offset,nt=Array.isArray(O.value)?O.value:[O.value];let L=0;for(let F=0;F<nt.length;F++){const V=nt[F],K=_(V);typeof V=="number"||typeof V=="boolean"?(O.__data[0]=V,s.bufferSubData(s.UNIFORM_BUFFER,k+L,O.__data)):V.isMatrix3?(O.__data[0]=V.elements[0],O.__data[1]=V.elements[1],O.__data[2]=V.elements[2],O.__data[3]=0,O.__data[4]=V.elements[3],O.__data[5]=V.elements[4],O.__data[6]=V.elements[5],O.__data[7]=0,O.__data[8]=V.elements[6],O.__data[9]=V.elements[7],O.__data[10]=V.elements[8],O.__data[11]=0):(V.toArray(O.__data,L),L+=K.storage/Float32Array.BYTES_PER_ELEMENT)}s.bufferSubData(s.UNIFORM_BUFFER,k,O.__data)}}}s.bindBuffer(s.UNIFORM_BUFFER,null)}function m(y,v,S,D){const w=y.value,b=v+"_"+S;if(D[b]===void 0)return typeof w=="number"||typeof w=="boolean"?D[b]=w:D[b]=w.clone(),!0;{const G=D[b];if(typeof w=="number"||typeof w=="boolean"){if(G!==w)return D[b]=w,!0}else if(G.equals(w)===!1)return G.copy(w),!0}return!1}function g(y){const v=y.uniforms;let S=0;const D=16;for(let b=0,G=v.length;b<G;b++){const M=Array.isArray(v[b])?v[b]:[v[b]];for(let A=0,O=M.length;A<O;A++){const k=M[A],nt=Array.isArray(k.value)?k.value:[k.value];for(let L=0,F=nt.length;L<F;L++){const V=nt[L],K=_(V),Y=S%D;Y!==0&&D-Y<K.boundary&&(S+=D-Y),k.__data=new Float32Array(K.storage/Float32Array.BYTES_PER_ELEMENT),k.__offset=S,S+=K.storage}}}const w=S%D;return w>0&&(S+=D-w),y.__size=S,y.__cache={},this}function _(y){const v={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(v.boundary=4,v.storage=4):y.isVector2?(v.boundary=8,v.storage=8):y.isVector3||y.isColor?(v.boundary=16,v.storage=12):y.isVector4?(v.boundary=16,v.storage=16):y.isMatrix3?(v.boundary=48,v.storage=48):y.isMatrix4?(v.boundary=64,v.storage=64):y.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",y),v}function p(y){const v=y.target;v.removeEventListener("dispose",p);const S=a.indexOf(v.__bindingPointIndex);a.splice(S,1),s.deleteBuffer(i[v.id]),delete i[v.id],delete r[v.id]}function f(){for(const y in i)s.deleteBuffer(i[y]);a=[],i={},r={}}return{bind:c,update:l,dispose:f}}class dc{constructor(t={}){const{canvas:e=kl(),context:n=null,depth:i=!0,stencil:r=!0,alpha:a=!1,antialias:o=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1}=t;this.isWebGLRenderer=!0;let d;n!==null?d=n.getContextAttributes().alpha:d=a;const m=new Uint32Array(4),g=new Int32Array(4);let _=null,p=null;const f=[],y=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=ve,this._useLegacyLights=!1,this.toneMapping=En,this.toneMappingExposure=1;const v=this;let S=!1,D=0,w=0,b=null,G=-1,M=null;const A=new _e,O=new _e;let k=null;const nt=new Ft(0);let L=0,F=e.width,V=e.height,K=1,Y=null,$=null;const Z=new _e(0,0,F,V),it=new _e(0,0,F,V);let rt=!1;const W=new Nr;let j=!1,pt=!1,St=null;const _t=new ee,Ct=new lt,Nt=new C,yt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function Dt(){return b===null?K:1}let R=n;function at(T,U){for(let z=0;z<T.length;z++){const H=T[z],B=e.getContext(H,U);if(B!==null)return B}return null}try{const T={alpha:!0,depth:i,stencil:r,antialias:o,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${Lr}`),e.addEventListener("webglcontextlost",ot,!1),e.addEventListener("webglcontextrestored",P,!1),e.addEventListener("webglcontextcreationerror",dt,!1),R===null){const U=["webgl2","webgl","experimental-webgl"];if(v.isWebGL1Renderer===!0&&U.shift(),R=at(U,T),R===null)throw at(U)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}typeof WebGLRenderingContext<"u"&&R instanceof WebGLRenderingContext&&console.warn("THREE.WebGLRenderer: WebGL 1 support was deprecated in r153 and will be removed in r163."),R.getShaderPrecisionFormat===void 0&&(R.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(T){throw console.error("THREE.WebGLRenderer: "+T.message),T}let q,st,X,Tt,mt,E,x,N,et,Q,J,Mt,ut,vt,wt,Bt,tt,Yt,qt,It,At,xt,Gt,$t;function re(){q=new rf(R),st=new jd(R,q,t),q.init(st),xt=new Wp(R,q,st),X=new Vp(R,q,st),Tt=new cf(R),mt=new Rp,E=new kp(R,q,X,mt,st,xt,Tt),x=new tf(v),N=new sf(v),et=new mh(R,st),Gt=new Zd(R,q,et,st),Q=new af(R,et,Tt,Gt),J=new df(R,Q,et,Tt),qt=new uf(R,st,E),Bt=new Qd(mt),Mt=new bp(v,x,N,q,st,Gt,Bt),ut=new $p(v,mt),vt=new Pp,wt=new Op(q,st),Yt=new Kd(v,x,N,X,J,d,c),tt=new Hp(v,J,st),$t=new Kp(R,Tt,st,X),It=new Jd(R,q,Tt,st),At=new of(R,q,Tt,st),Tt.programs=Mt.programs,v.capabilities=st,v.extensions=q,v.properties=mt,v.renderLists=vt,v.shadowMap=tt,v.state=X,v.info=Tt}re();const kt=new Yp(v,R);this.xr=kt,this.getContext=function(){return R},this.getContextAttributes=function(){return R.getContextAttributes()},this.forceContextLoss=function(){const T=q.get("WEBGL_lose_context");T&&T.loseContext()},this.forceContextRestore=function(){const T=q.get("WEBGL_lose_context");T&&T.restoreContext()},this.getPixelRatio=function(){return K},this.setPixelRatio=function(T){T!==void 0&&(K=T,this.setSize(F,V,!1))},this.getSize=function(T){return T.set(F,V)},this.setSize=function(T,U,z=!0){if(kt.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}F=T,V=U,e.width=Math.floor(T*K),e.height=Math.floor(U*K),z===!0&&(e.style.width=T+"px",e.style.height=U+"px"),this.setViewport(0,0,T,U)},this.getDrawingBufferSize=function(T){return T.set(F*K,V*K).floor()},this.setDrawingBufferSize=function(T,U,z){F=T,V=U,K=z,e.width=Math.floor(T*z),e.height=Math.floor(U*z),this.setViewport(0,0,T,U)},this.getCurrentViewport=function(T){return T.copy(A)},this.getViewport=function(T){return T.copy(Z)},this.setViewport=function(T,U,z,H){T.isVector4?Z.set(T.x,T.y,T.z,T.w):Z.set(T,U,z,H),X.viewport(A.copy(Z).multiplyScalar(K).floor())},this.getScissor=function(T){return T.copy(it)},this.setScissor=function(T,U,z,H){T.isVector4?it.set(T.x,T.y,T.z,T.w):it.set(T,U,z,H),X.scissor(O.copy(it).multiplyScalar(K).floor())},this.getScissorTest=function(){return rt},this.setScissorTest=function(T){X.setScissorTest(rt=T)},this.setOpaqueSort=function(T){Y=T},this.setTransparentSort=function(T){$=T},this.getClearColor=function(T){return T.copy(Yt.getClearColor())},this.setClearColor=function(){Yt.setClearColor.apply(Yt,arguments)},this.getClearAlpha=function(){return Yt.getClearAlpha()},this.setClearAlpha=function(){Yt.setClearAlpha.apply(Yt,arguments)},this.clear=function(T=!0,U=!0,z=!0){let H=0;if(T){let B=!1;if(b!==null){const gt=b.texture.format;B=gt===Vo||gt===Ho||gt===Go}if(B){const gt=b.texture.type,Et=gt===Tn||gt===Mn||gt===Dr||gt===Fn||gt===Bo||gt===zo,Rt=Yt.getClearColor(),Lt=Yt.getClearAlpha(),Vt=Rt.r,Ot=Rt.g,zt=Rt.b;Et?(m[0]=Vt,m[1]=Ot,m[2]=zt,m[3]=Lt,R.clearBufferuiv(R.COLOR,0,m)):(g[0]=Vt,g[1]=Ot,g[2]=zt,g[3]=Lt,R.clearBufferiv(R.COLOR,0,g))}else H|=R.COLOR_BUFFER_BIT}U&&(H|=R.DEPTH_BUFFER_BIT),z&&(H|=R.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),R.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",ot,!1),e.removeEventListener("webglcontextrestored",P,!1),e.removeEventListener("webglcontextcreationerror",dt,!1),vt.dispose(),wt.dispose(),mt.dispose(),x.dispose(),N.dispose(),J.dispose(),Gt.dispose(),$t.dispose(),Mt.dispose(),kt.dispose(),kt.removeEventListener("sessionstart",Ee),kt.removeEventListener("sessionend",jt),St&&(St.dispose(),St=null),Te.stop()};function ot(T){T.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),S=!0}function P(){console.log("THREE.WebGLRenderer: Context Restored."),S=!1;const T=Tt.autoReset,U=tt.enabled,z=tt.autoUpdate,H=tt.needsUpdate,B=tt.type;re(),Tt.autoReset=T,tt.enabled=U,tt.autoUpdate=z,tt.needsUpdate=H,tt.type=B}function dt(T){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",T.statusMessage)}function ft(T){const U=T.target;U.removeEventListener("dispose",ft),Pt(U)}function Pt(T){bt(T),mt.remove(T)}function bt(T){const U=mt.get(T).programs;U!==void 0&&(U.forEach(function(z){Mt.releaseProgram(z)}),T.isShaderMaterial&&Mt.releaseShaderCache(T))}this.renderBufferDirect=function(T,U,z,H,B,gt){U===null&&(U=yt);const Et=B.isMesh&&B.matrixWorld.determinant()<0,Rt=Tc(T,U,z,H,B);X.setMaterial(H,Et);let Lt=z.index,Vt=1;if(H.wireframe===!0){if(Lt=Q.getWireframeAttribute(z),Lt===void 0)return;Vt=2}const Ot=z.drawRange,zt=z.attributes.position;let oe=Ot.start*Vt,Oe=(Ot.start+Ot.count)*Vt;gt!==null&&(oe=Math.max(oe,gt.start*Vt),Oe=Math.min(Oe,(gt.start+gt.count)*Vt)),Lt!==null?(oe=Math.max(oe,0),Oe=Math.min(Oe,Lt.count)):zt!=null&&(oe=Math.max(oe,0),Oe=Math.min(Oe,zt.count));const pe=Oe-oe;if(pe<0||pe===1/0)return;Gt.setup(B,H,Rt,z,Lt);let sn,ie=It;if(Lt!==null&&(sn=et.get(Lt),ie=At,ie.setIndex(sn)),B.isMesh)H.wireframe===!0?(X.setLineWidth(H.wireframeLinewidth*Dt()),ie.setMode(R.LINES)):ie.setMode(R.TRIANGLES);else if(B.isLine){let Wt=H.linewidth;Wt===void 0&&(Wt=1),X.setLineWidth(Wt*Dt()),B.isLineSegments?ie.setMode(R.LINES):B.isLineLoop?ie.setMode(R.LINE_LOOP):ie.setMode(R.LINE_STRIP)}else B.isPoints?ie.setMode(R.POINTS):B.isSprite&&ie.setMode(R.TRIANGLES);if(B.isBatchedMesh)ie.renderMultiDraw(B._multiDrawStarts,B._multiDrawCounts,B._multiDrawCount);else if(B.isInstancedMesh)ie.renderInstances(oe,pe,B.count);else if(z.isInstancedBufferGeometry){const Wt=z._maxInstanceCount!==void 0?z._maxInstanceCount:1/0,Us=Math.min(z.instanceCount,Wt);ie.renderInstances(oe,pe,Us)}else ie.render(oe,pe)};function Zt(T,U,z){T.transparent===!0&&T.side===Ze&&T.forceSinglePass===!1?(T.side=Ie,T.needsUpdate=!0,Xi(T,U,z),T.side=wn,T.needsUpdate=!0,Xi(T,U,z),T.side=Ze):Xi(T,U,z)}this.compile=function(T,U,z=null){z===null&&(z=T),p=wt.get(z),p.init(),y.push(p),z.traverseVisible(function(B){B.isLight&&B.layers.test(U.layers)&&(p.pushLight(B),B.castShadow&&p.pushShadow(B))}),T!==z&&T.traverseVisible(function(B){B.isLight&&B.layers.test(U.layers)&&(p.pushLight(B),B.castShadow&&p.pushShadow(B))}),p.setupLights(v._useLegacyLights);const H=new Set;return T.traverse(function(B){const gt=B.material;if(gt)if(Array.isArray(gt))for(let Et=0;Et<gt.length;Et++){const Rt=gt[Et];Zt(Rt,z,B),H.add(Rt)}else Zt(gt,z,B),H.add(gt)}),y.pop(),p=null,H},this.compileAsync=function(T,U,z=null){const H=this.compile(T,U,z);return new Promise(B=>{function gt(){if(H.forEach(function(Et){mt.get(Et).currentProgram.isReady()&&H.delete(Et)}),H.size===0){B(T);return}setTimeout(gt,10)}q.get("KHR_parallel_shader_compile")!==null?gt():setTimeout(gt,10)})};let Jt=null;function fe(T){Jt&&Jt(T)}function Ee(){Te.stop()}function jt(){Te.start()}const Te=new sc;Te.setAnimationLoop(fe),typeof self<"u"&&Te.setContext(self),this.setAnimationLoop=function(T){Jt=T,kt.setAnimationLoop(T),T===null?Te.stop():Te.start()},kt.addEventListener("sessionstart",Ee),kt.addEventListener("sessionend",jt),this.render=function(T,U){if(U!==void 0&&U.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(S===!0)return;T.matrixWorldAutoUpdate===!0&&T.updateMatrixWorld(),U.parent===null&&U.matrixWorldAutoUpdate===!0&&U.updateMatrixWorld(),kt.enabled===!0&&kt.isPresenting===!0&&(kt.cameraAutoUpdate===!0&&kt.updateCamera(U),U=kt.getCamera()),T.isScene===!0&&T.onBeforeRender(v,T,U,b),p=wt.get(T,y.length),p.init(),y.push(p),_t.multiplyMatrices(U.projectionMatrix,U.matrixWorldInverse),W.setFromProjectionMatrix(_t),pt=this.localClippingEnabled,j=Bt.init(this.clippingPlanes,pt),_=vt.get(T,f.length),_.init(),f.push(_),Qe(T,U,0,v.sortObjects),_.finish(),v.sortObjects===!0&&_.sort(Y,$),this.info.render.frame++,j===!0&&Bt.beginShadows();const z=p.state.shadowsArray;if(tt.render(z,T,U),j===!0&&Bt.endShadows(),this.info.autoReset===!0&&this.info.reset(),Yt.render(_,T),p.setupLights(v._useLegacyLights),U.isArrayCamera){const H=U.cameras;for(let B=0,gt=H.length;B<gt;B++){const Et=H[B];qr(_,T,Et,Et.viewport)}}else qr(_,T,U);b!==null&&(E.updateMultisampleRenderTarget(b),E.updateRenderTargetMipmap(b)),T.isScene===!0&&T.onAfterRender(v,T,U),Gt.resetDefaultState(),G=-1,M=null,y.pop(),y.length>0?p=y[y.length-1]:p=null,f.pop(),f.length>0?_=f[f.length-1]:_=null};function Qe(T,U,z,H){if(T.visible===!1)return;if(T.layers.test(U.layers)){if(T.isGroup)z=T.renderOrder;else if(T.isLOD)T.autoUpdate===!0&&T.update(U);else if(T.isLight)p.pushLight(T),T.castShadow&&p.pushShadow(T);else if(T.isSprite){if(!T.frustumCulled||W.intersectsSprite(T)){H&&Nt.setFromMatrixPosition(T.matrixWorld).applyMatrix4(_t);const Et=J.update(T),Rt=T.material;Rt.visible&&_.push(T,Et,Rt,z,Nt.z,null)}}else if((T.isMesh||T.isLine||T.isPoints)&&(!T.frustumCulled||W.intersectsObject(T))){const Et=J.update(T),Rt=T.material;if(H&&(T.boundingSphere!==void 0?(T.boundingSphere===null&&T.computeBoundingSphere(),Nt.copy(T.boundingSphere.center)):(Et.boundingSphere===null&&Et.computeBoundingSphere(),Nt.copy(Et.boundingSphere.center)),Nt.applyMatrix4(T.matrixWorld).applyMatrix4(_t)),Array.isArray(Rt)){const Lt=Et.groups;for(let Vt=0,Ot=Lt.length;Vt<Ot;Vt++){const zt=Lt[Vt],oe=Rt[zt.materialIndex];oe&&oe.visible&&_.push(T,Et,oe,z,Nt.z,zt)}}else Rt.visible&&_.push(T,Et,Rt,z,Nt.z,null)}}const gt=T.children;for(let Et=0,Rt=gt.length;Et<Rt;Et++)Qe(gt[Et],U,z,H)}function qr(T,U,z,H){const B=T.opaque,gt=T.transmissive,Et=T.transparent;p.setupLightsView(z),j===!0&&Bt.setGlobalState(v.clippingPlanes,z),gt.length>0&&Ec(B,gt,U,z),H&&X.viewport(A.copy(H)),B.length>0&&Wi(B,U,z),gt.length>0&&Wi(gt,U,z),Et.length>0&&Wi(Et,U,z),X.buffers.depth.setTest(!0),X.buffers.depth.setMask(!0),X.buffers.color.setMask(!0),X.setPolygonOffset(!1)}function Ec(T,U,z,H){if((z.isScene===!0?z.overrideMaterial:null)!==null)return;const gt=st.isWebGL2;St===null&&(St=new Gn(1,1,{generateMipmaps:!0,type:q.has("EXT_color_buffer_half_float")?Oi:Tn,minFilter:Ni,samples:gt?4:0})),v.getDrawingBufferSize(Ct),gt?St.setSize(Ct.x,Ct.y):St.setSize(As(Ct.x),As(Ct.y));const Et=v.getRenderTarget();v.setRenderTarget(St),v.getClearColor(nt),L=v.getClearAlpha(),L<1&&v.setClearColor(16777215,.5),v.clear();const Rt=v.toneMapping;v.toneMapping=En,Wi(T,z,H),E.updateMultisampleRenderTarget(St),E.updateRenderTargetMipmap(St);let Lt=!1;for(let Vt=0,Ot=U.length;Vt<Ot;Vt++){const zt=U[Vt],oe=zt.object,Oe=zt.geometry,pe=zt.material,sn=zt.group;if(pe.side===Ze&&oe.layers.test(H.layers)){const ie=pe.side;pe.side=Ie,pe.needsUpdate=!0,Yr(oe,z,H,Oe,pe,sn),pe.side=ie,pe.needsUpdate=!0,Lt=!0}}Lt===!0&&(E.updateMultisampleRenderTarget(St),E.updateRenderTargetMipmap(St)),v.setRenderTarget(Et),v.setClearColor(nt,L),v.toneMapping=Rt}function Wi(T,U,z){const H=U.isScene===!0?U.overrideMaterial:null;for(let B=0,gt=T.length;B<gt;B++){const Et=T[B],Rt=Et.object,Lt=Et.geometry,Vt=H===null?Et.material:H,Ot=Et.group;Rt.layers.test(z.layers)&&Yr(Rt,U,z,Lt,Vt,Ot)}}function Yr(T,U,z,H,B,gt){T.onBeforeRender(v,U,z,H,B,gt),T.modelViewMatrix.multiplyMatrices(z.matrixWorldInverse,T.matrixWorld),T.normalMatrix.getNormalMatrix(T.modelViewMatrix),B.onBeforeRender(v,U,z,H,T,gt),B.transparent===!0&&B.side===Ze&&B.forceSinglePass===!1?(B.side=Ie,B.needsUpdate=!0,v.renderBufferDirect(z,U,H,B,T,gt),B.side=wn,B.needsUpdate=!0,v.renderBufferDirect(z,U,H,B,T,gt),B.side=Ze):v.renderBufferDirect(z,U,H,B,T,gt),T.onAfterRender(v,U,z,H,B,gt)}function Xi(T,U,z){U.isScene!==!0&&(U=yt);const H=mt.get(T),B=p.state.lights,gt=p.state.shadowsArray,Et=B.state.version,Rt=Mt.getParameters(T,B.state,gt,U,z),Lt=Mt.getProgramCacheKey(Rt);let Vt=H.programs;H.environment=T.isMeshStandardMaterial?U.environment:null,H.fog=U.fog,H.envMap=(T.isMeshStandardMaterial?N:x).get(T.envMap||H.environment),Vt===void 0&&(T.addEventListener("dispose",ft),Vt=new Map,H.programs=Vt);let Ot=Vt.get(Lt);if(Ot!==void 0){if(H.currentProgram===Ot&&H.lightsStateVersion===Et)return Kr(T,Rt),Ot}else Rt.uniforms=Mt.getUniforms(T),T.onBuild(z,Rt,v),T.onBeforeCompile(Rt,v),Ot=Mt.acquireProgram(Rt,Lt),Vt.set(Lt,Ot),H.uniforms=Rt.uniforms;const zt=H.uniforms;return(!T.isShaderMaterial&&!T.isRawShaderMaterial||T.clipping===!0)&&(zt.clippingPlanes=Bt.uniform),Kr(T,Rt),H.needsLights=wc(T),H.lightsStateVersion=Et,H.needsLights&&(zt.ambientLightColor.value=B.state.ambient,zt.lightProbe.value=B.state.probe,zt.directionalLights.value=B.state.directional,zt.directionalLightShadows.value=B.state.directionalShadow,zt.spotLights.value=B.state.spot,zt.spotLightShadows.value=B.state.spotShadow,zt.rectAreaLights.value=B.state.rectArea,zt.ltc_1.value=B.state.rectAreaLTC1,zt.ltc_2.value=B.state.rectAreaLTC2,zt.pointLights.value=B.state.point,zt.pointLightShadows.value=B.state.pointShadow,zt.hemisphereLights.value=B.state.hemi,zt.directionalShadowMap.value=B.state.directionalShadowMap,zt.directionalShadowMatrix.value=B.state.directionalShadowMatrix,zt.spotShadowMap.value=B.state.spotShadowMap,zt.spotLightMatrix.value=B.state.spotLightMatrix,zt.spotLightMap.value=B.state.spotLightMap,zt.pointShadowMap.value=B.state.pointShadowMap,zt.pointShadowMatrix.value=B.state.pointShadowMatrix),H.currentProgram=Ot,H.uniformsList=null,Ot}function $r(T){if(T.uniformsList===null){const U=T.currentProgram.getUniforms();T.uniformsList=vs.seqWithValue(U.seq,T.uniforms)}return T.uniformsList}function Kr(T,U){const z=mt.get(T);z.outputColorSpace=U.outputColorSpace,z.batching=U.batching,z.instancing=U.instancing,z.instancingColor=U.instancingColor,z.skinning=U.skinning,z.morphTargets=U.morphTargets,z.morphNormals=U.morphNormals,z.morphColors=U.morphColors,z.morphTargetsCount=U.morphTargetsCount,z.numClippingPlanes=U.numClippingPlanes,z.numIntersection=U.numClipIntersection,z.vertexAlphas=U.vertexAlphas,z.vertexTangents=U.vertexTangents,z.toneMapping=U.toneMapping}function Tc(T,U,z,H,B){U.isScene!==!0&&(U=yt),E.resetTextureUnits();const gt=U.fog,Et=H.isMeshStandardMaterial?U.environment:null,Rt=b===null?v.outputColorSpace:b.isXRRenderTarget===!0?b.texture.colorSpace:dn,Lt=(H.isMeshStandardMaterial?N:x).get(H.envMap||Et),Vt=H.vertexColors===!0&&!!z.attributes.color&&z.attributes.color.itemSize===4,Ot=!!z.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),zt=!!z.morphAttributes.position,oe=!!z.morphAttributes.normal,Oe=!!z.morphAttributes.color;let pe=En;H.toneMapped&&(b===null||b.isXRRenderTarget===!0)&&(pe=v.toneMapping);const sn=z.morphAttributes.position||z.morphAttributes.normal||z.morphAttributes.color,ie=sn!==void 0?sn.length:0,Wt=mt.get(H),Us=p.state.lights;if(j===!0&&(pt===!0||T!==M)){const Ge=T===M&&H.id===G;Bt.setState(H,T,Ge)}let ae=!1;H.version===Wt.__version?(Wt.needsLights&&Wt.lightsStateVersion!==Us.state.version||Wt.outputColorSpace!==Rt||B.isBatchedMesh&&Wt.batching===!1||!B.isBatchedMesh&&Wt.batching===!0||B.isInstancedMesh&&Wt.instancing===!1||!B.isInstancedMesh&&Wt.instancing===!0||B.isSkinnedMesh&&Wt.skinning===!1||!B.isSkinnedMesh&&Wt.skinning===!0||B.isInstancedMesh&&Wt.instancingColor===!0&&B.instanceColor===null||B.isInstancedMesh&&Wt.instancingColor===!1&&B.instanceColor!==null||Wt.envMap!==Lt||H.fog===!0&&Wt.fog!==gt||Wt.numClippingPlanes!==void 0&&(Wt.numClippingPlanes!==Bt.numPlanes||Wt.numIntersection!==Bt.numIntersection)||Wt.vertexAlphas!==Vt||Wt.vertexTangents!==Ot||Wt.morphTargets!==zt||Wt.morphNormals!==oe||Wt.morphColors!==Oe||Wt.toneMapping!==pe||st.isWebGL2===!0&&Wt.morphTargetsCount!==ie)&&(ae=!0):(ae=!0,Wt.__version=H.version);let bn=Wt.currentProgram;ae===!0&&(bn=Xi(H,U,B));let Zr=!1,yi=!1,Ns=!1;const Me=bn.getUniforms(),Rn=Wt.uniforms;if(X.useProgram(bn.program)&&(Zr=!0,yi=!0,Ns=!0),H.id!==G&&(G=H.id,yi=!0),Zr||M!==T){Me.setValue(R,"projectionMatrix",T.projectionMatrix),Me.setValue(R,"viewMatrix",T.matrixWorldInverse);const Ge=Me.map.cameraPosition;Ge!==void 0&&Ge.setValue(R,Nt.setFromMatrixPosition(T.matrixWorld)),st.logarithmicDepthBuffer&&Me.setValue(R,"logDepthBufFC",2/(Math.log(T.far+1)/Math.LN2)),(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)&&Me.setValue(R,"isOrthographic",T.isOrthographicCamera===!0),M!==T&&(M=T,yi=!0,Ns=!0)}if(B.isSkinnedMesh){Me.setOptional(R,B,"bindMatrix"),Me.setOptional(R,B,"bindMatrixInverse");const Ge=B.skeleton;Ge&&(st.floatVertexTextures?(Ge.boneTexture===null&&Ge.computeBoneTexture(),Me.setValue(R,"boneTexture",Ge.boneTexture,E)):console.warn("THREE.WebGLRenderer: SkinnedMesh can only be used with WebGL 2. With WebGL 1 OES_texture_float and vertex textures support is required."))}B.isBatchedMesh&&(Me.setOptional(R,B,"batchingTexture"),Me.setValue(R,"batchingTexture",B._matricesTexture,E));const Os=z.morphAttributes;if((Os.position!==void 0||Os.normal!==void 0||Os.color!==void 0&&st.isWebGL2===!0)&&qt.update(B,z,bn),(yi||Wt.receiveShadow!==B.receiveShadow)&&(Wt.receiveShadow=B.receiveShadow,Me.setValue(R,"receiveShadow",B.receiveShadow)),H.isMeshGouraudMaterial&&H.envMap!==null&&(Rn.envMap.value=Lt,Rn.flipEnvMap.value=Lt.isCubeTexture&&Lt.isRenderTargetTexture===!1?-1:1),yi&&(Me.setValue(R,"toneMappingExposure",v.toneMappingExposure),Wt.needsLights&&Ac(Rn,Ns),gt&&H.fog===!0&&ut.refreshFogUniforms(Rn,gt),ut.refreshMaterialUniforms(Rn,H,K,V,St),vs.upload(R,$r(Wt),Rn,E)),H.isShaderMaterial&&H.uniformsNeedUpdate===!0&&(vs.upload(R,$r(Wt),Rn,E),H.uniformsNeedUpdate=!1),H.isSpriteMaterial&&Me.setValue(R,"center",B.center),Me.setValue(R,"modelViewMatrix",B.modelViewMatrix),Me.setValue(R,"normalMatrix",B.normalMatrix),Me.setValue(R,"modelMatrix",B.matrixWorld),H.isShaderMaterial||H.isRawShaderMaterial){const Ge=H.uniformsGroups;for(let Fs=0,bc=Ge.length;Fs<bc;Fs++)if(st.isWebGL2){const Jr=Ge[Fs];$t.update(Jr,bn),$t.bind(Jr,bn)}else console.warn("THREE.WebGLRenderer: Uniform Buffer Objects can only be used with WebGL 2.")}return bn}function Ac(T,U){T.ambientLightColor.needsUpdate=U,T.lightProbe.needsUpdate=U,T.directionalLights.needsUpdate=U,T.directionalLightShadows.needsUpdate=U,T.pointLights.needsUpdate=U,T.pointLightShadows.needsUpdate=U,T.spotLights.needsUpdate=U,T.spotLightShadows.needsUpdate=U,T.rectAreaLights.needsUpdate=U,T.hemisphereLights.needsUpdate=U}function wc(T){return T.isMeshLambertMaterial||T.isMeshToonMaterial||T.isMeshPhongMaterial||T.isMeshStandardMaterial||T.isShadowMaterial||T.isShaderMaterial&&T.lights===!0}this.getActiveCubeFace=function(){return D},this.getActiveMipmapLevel=function(){return w},this.getRenderTarget=function(){return b},this.setRenderTargetTextures=function(T,U,z){mt.get(T.texture).__webglTexture=U,mt.get(T.depthTexture).__webglTexture=z;const H=mt.get(T);H.__hasExternalTextures=!0,H.__hasExternalTextures&&(H.__autoAllocateDepthBuffer=z===void 0,H.__autoAllocateDepthBuffer||q.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),H.__useRenderToTexture=!1))},this.setRenderTargetFramebuffer=function(T,U){const z=mt.get(T);z.__webglFramebuffer=U,z.__useDefaultFramebuffer=U===void 0},this.setRenderTarget=function(T,U=0,z=0){b=T,D=U,w=z;let H=!0,B=null,gt=!1,Et=!1;if(T){const Lt=mt.get(T);Lt.__useDefaultFramebuffer!==void 0?(X.bindFramebuffer(R.FRAMEBUFFER,null),H=!1):Lt.__webglFramebuffer===void 0?E.setupRenderTarget(T):Lt.__hasExternalTextures&&E.rebindTextures(T,mt.get(T.texture).__webglTexture,mt.get(T.depthTexture).__webglTexture);const Vt=T.texture;(Vt.isData3DTexture||Vt.isDataArrayTexture||Vt.isCompressedArrayTexture)&&(Et=!0);const Ot=mt.get(T).__webglFramebuffer;T.isWebGLCubeRenderTarget?(Array.isArray(Ot[U])?B=Ot[U][z]:B=Ot[U],gt=!0):st.isWebGL2&&T.samples>0&&E.useMultisampledRTT(T)===!1?B=mt.get(T).__webglMultisampledFramebuffer:Array.isArray(Ot)?B=Ot[z]:B=Ot,A.copy(T.viewport),O.copy(T.scissor),k=T.scissorTest}else A.copy(Z).multiplyScalar(K).floor(),O.copy(it).multiplyScalar(K).floor(),k=rt;if(X.bindFramebuffer(R.FRAMEBUFFER,B)&&st.drawBuffers&&H&&X.drawBuffers(T,B),X.viewport(A),X.scissor(O),X.setScissorTest(k),gt){const Lt=mt.get(T.texture);R.framebufferTexture2D(R.FRAMEBUFFER,R.COLOR_ATTACHMENT0,R.TEXTURE_CUBE_MAP_POSITIVE_X+U,Lt.__webglTexture,z)}else if(Et){const Lt=mt.get(T.texture),Vt=U||0;R.framebufferTextureLayer(R.FRAMEBUFFER,R.COLOR_ATTACHMENT0,Lt.__webglTexture,z||0,Vt)}G=-1},this.readRenderTargetPixels=function(T,U,z,H,B,gt,Et){if(!(T&&T.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Rt=mt.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&Et!==void 0&&(Rt=Rt[Et]),Rt){X.bindFramebuffer(R.FRAMEBUFFER,Rt);try{const Lt=T.texture,Vt=Lt.format,Ot=Lt.type;if(Vt!==je&&xt.convert(Vt)!==R.getParameter(R.IMPLEMENTATION_COLOR_READ_FORMAT)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}const zt=Ot===Oi&&(q.has("EXT_color_buffer_half_float")||st.isWebGL2&&q.has("EXT_color_buffer_float"));if(Ot!==Tn&&xt.convert(Ot)!==R.getParameter(R.IMPLEMENTATION_COLOR_READ_TYPE)&&!(Ot===Sn&&(st.isWebGL2||q.has("OES_texture_float")||q.has("WEBGL_color_buffer_float")))&&!zt){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}U>=0&&U<=T.width-H&&z>=0&&z<=T.height-B&&R.readPixels(U,z,H,B,xt.convert(Vt),xt.convert(Ot),gt)}finally{const Lt=b!==null?mt.get(b).__webglFramebuffer:null;X.bindFramebuffer(R.FRAMEBUFFER,Lt)}}},this.copyFramebufferToTexture=function(T,U,z=0){const H=Math.pow(2,-z),B=Math.floor(U.image.width*H),gt=Math.floor(U.image.height*H);E.setTexture2D(U,0),R.copyTexSubImage2D(R.TEXTURE_2D,z,0,0,T.x,T.y,B,gt),X.unbindTexture()},this.copyTextureToTexture=function(T,U,z,H=0){const B=U.image.width,gt=U.image.height,Et=xt.convert(z.format),Rt=xt.convert(z.type);E.setTexture2D(z,0),R.pixelStorei(R.UNPACK_FLIP_Y_WEBGL,z.flipY),R.pixelStorei(R.UNPACK_PREMULTIPLY_ALPHA_WEBGL,z.premultiplyAlpha),R.pixelStorei(R.UNPACK_ALIGNMENT,z.unpackAlignment),U.isDataTexture?R.texSubImage2D(R.TEXTURE_2D,H,T.x,T.y,B,gt,Et,Rt,U.image.data):U.isCompressedTexture?R.compressedTexSubImage2D(R.TEXTURE_2D,H,T.x,T.y,U.mipmaps[0].width,U.mipmaps[0].height,Et,U.mipmaps[0].data):R.texSubImage2D(R.TEXTURE_2D,H,T.x,T.y,Et,Rt,U.image),H===0&&z.generateMipmaps&&R.generateMipmap(R.TEXTURE_2D),X.unbindTexture()},this.copyTextureToTexture3D=function(T,U,z,H,B=0){if(v.isWebGL1Renderer){console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: can only be used with WebGL2.");return}const gt=T.max.x-T.min.x+1,Et=T.max.y-T.min.y+1,Rt=T.max.z-T.min.z+1,Lt=xt.convert(H.format),Vt=xt.convert(H.type);let Ot;if(H.isData3DTexture)E.setTexture3D(H,0),Ot=R.TEXTURE_3D;else if(H.isDataArrayTexture||H.isCompressedArrayTexture)E.setTexture2DArray(H,0),Ot=R.TEXTURE_2D_ARRAY;else{console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");return}R.pixelStorei(R.UNPACK_FLIP_Y_WEBGL,H.flipY),R.pixelStorei(R.UNPACK_PREMULTIPLY_ALPHA_WEBGL,H.premultiplyAlpha),R.pixelStorei(R.UNPACK_ALIGNMENT,H.unpackAlignment);const zt=R.getParameter(R.UNPACK_ROW_LENGTH),oe=R.getParameter(R.UNPACK_IMAGE_HEIGHT),Oe=R.getParameter(R.UNPACK_SKIP_PIXELS),pe=R.getParameter(R.UNPACK_SKIP_ROWS),sn=R.getParameter(R.UNPACK_SKIP_IMAGES),ie=z.isCompressedTexture?z.mipmaps[B]:z.image;R.pixelStorei(R.UNPACK_ROW_LENGTH,ie.width),R.pixelStorei(R.UNPACK_IMAGE_HEIGHT,ie.height),R.pixelStorei(R.UNPACK_SKIP_PIXELS,T.min.x),R.pixelStorei(R.UNPACK_SKIP_ROWS,T.min.y),R.pixelStorei(R.UNPACK_SKIP_IMAGES,T.min.z),z.isDataTexture||z.isData3DTexture?R.texSubImage3D(Ot,B,U.x,U.y,U.z,gt,Et,Rt,Lt,Vt,ie.data):z.isCompressedArrayTexture?(console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: untested support for compressed srcTexture."),R.compressedTexSubImage3D(Ot,B,U.x,U.y,U.z,gt,Et,Rt,Lt,ie.data)):R.texSubImage3D(Ot,B,U.x,U.y,U.z,gt,Et,Rt,Lt,Vt,ie),R.pixelStorei(R.UNPACK_ROW_LENGTH,zt),R.pixelStorei(R.UNPACK_IMAGE_HEIGHT,oe),R.pixelStorei(R.UNPACK_SKIP_PIXELS,Oe),R.pixelStorei(R.UNPACK_SKIP_ROWS,pe),R.pixelStorei(R.UNPACK_SKIP_IMAGES,sn),B===0&&H.generateMipmaps&&R.generateMipmap(Ot),X.unbindTexture()},this.initTexture=function(T){T.isCubeTexture?E.setTextureCube(T,0):T.isData3DTexture?E.setTexture3D(T,0):T.isDataArrayTexture||T.isCompressedArrayTexture?E.setTexture2DArray(T,0):E.setTexture2D(T,0),X.unbindTexture()},this.resetState=function(){D=0,w=0,b=null,X.reset(),Gt.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return un}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorSpace=t===Ir?"display-p3":"srgb",e.unpackColorSpace=Kt.workingColorSpace===Cs?"display-p3":"srgb"}get outputEncoding(){return console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace===ve?zn:Wo}set outputEncoding(t){console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace=t===zn?ve:dn}get useLegacyLights(){return console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights}set useLegacyLights(t){console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights=t}}class Zp extends dc{}Zp.prototype.isWebGL1Renderer=!0;class Fr{constructor(t,e=25e-5){this.isFogExp2=!0,this.name="",this.color=new Ft(t),this.density=e}clone(){return new Fr(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}}class Br{constructor(t,e=1,n=1e3){this.isFog=!0,this.name="",this.color=new Ft(t),this.near=e,this.far=n}clone(){return new Br(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class Jp extends he{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e}}class xo extends Xe{constructor(t,e,n,i=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const oi=new ee,Mo=new ee,ps=[],So=new Wn,jp=new ee,bi=new ht,Ri=new Vi;class yo extends ht{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new xo(new Float32Array(n*16),16),this.instanceColor=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,jp)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new Wn),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,oi),So.copy(t.boundingBox).applyMatrix4(oi),this.boundingBox.union(So)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new Vi),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,oi),Ri.copy(t.boundingSphere).applyMatrix4(oi),this.boundingSphere.union(Ri)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}raycast(t,e){const n=this.matrixWorld,i=this.count;if(bi.geometry=this.geometry,bi.material=this.material,bi.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Ri.copy(this.boundingSphere),Ri.applyMatrix4(n),t.ray.intersectsSphere(Ri)!==!1))for(let r=0;r<i;r++){this.getMatrixAt(r,oi),Mo.multiplyMatrices(n,oi),bi.matrixWorld=Mo,bi.raycast(t,ps);for(let a=0,o=ps.length;a<o;a++){const c=ps[a];c.instanceId=r,c.object=this,e.push(c)}ps.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new xo(new Float32Array(this.instanceMatrix.count*3),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"})}}class fc extends Ue{constructor(t,e,n,i,r,a,o,c,l){super(t,e,n,i,r,a,o,c,l),this.isCanvasTexture=!0,this.needsUpdate=!0}}class nn{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(t,e){const n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){const t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const e=[];let n,i=this.getPoint(0),r=0;e.push(0);for(let a=1;a<=t;a++)n=this.getPoint(a/t),r+=n.distanceTo(i),e.push(r),i=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e){const n=this.getLengths();let i=0;const r=n.length;let a;e?a=e:a=t*n[r-1];let o=0,c=r-1,l;for(;o<=c;)if(i=Math.floor(o+(c-o)/2),l=n[i]-a,l<0)o=i+1;else if(l>0)c=i-1;else{c=i;break}if(i=c,n[i]===a)return i/(r-1);const h=n[i],d=n[i+1]-h,m=(a-h)/d;return(i+m)/(r-1)}getTangent(t,e){let i=t-1e-4,r=t+1e-4;i<0&&(i=0),r>1&&(r=1);const a=this.getPoint(i),o=this.getPoint(r),c=e||(a.isVector2?new lt:new C);return c.copy(o).sub(a).normalize(),c}getTangentAt(t,e){const n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e){const n=new C,i=[],r=[],a=[],o=new C,c=new ee;for(let m=0;m<=t;m++){const g=m/t;i[m]=this.getTangentAt(g,new C)}r[0]=new C,a[0]=new C;let l=Number.MAX_VALUE;const h=Math.abs(i[0].x),u=Math.abs(i[0].y),d=Math.abs(i[0].z);h<=l&&(l=h,n.set(1,0,0)),u<=l&&(l=u,n.set(0,1,0)),d<=l&&n.set(0,0,1),o.crossVectors(i[0],n).normalize(),r[0].crossVectors(i[0],o),a[0].crossVectors(i[0],r[0]);for(let m=1;m<=t;m++){if(r[m]=r[m-1].clone(),a[m]=a[m-1].clone(),o.crossVectors(i[m-1],i[m]),o.length()>Number.EPSILON){o.normalize();const g=Math.acos(xe(i[m-1].dot(i[m]),-1,1));r[m].applyMatrix4(c.makeRotationAxis(o,g))}a[m].crossVectors(i[m],r[m])}if(e===!0){let m=Math.acos(xe(r[0].dot(r[t]),-1,1));m/=t,i[0].dot(o.crossVectors(r[0],r[t]))>0&&(m=-m);for(let g=1;g<=t;g++)r[g].applyMatrix4(c.makeRotationAxis(i[g],m*g)),a[g].crossVectors(i[g],r[g])}return{tangents:i,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){const t={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}}class zr extends nn{constructor(t=0,e=0,n=1,i=1,r=0,a=Math.PI*2,o=!1,c=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=i,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=c}getPoint(t,e){const n=e||new lt,i=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=i;for(;r>i;)r-=i;r<Number.EPSILON&&(a?r=0:r=i),this.aClockwise===!0&&!a&&(r===i?r=-i:r=r-i);const o=this.aStartAngle+t*r;let c=this.aX+this.xRadius*Math.cos(o),l=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){const h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=c-this.aX,m=l-this.aY;c=d*h-m*u+this.aX,l=d*u+m*h+this.aY}return n.set(c,l)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){const t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}}class Qp extends zr{constructor(t,e,n,i,r,a){super(t,e,n,n,i,r,a),this.isArcCurve=!0,this.type="ArcCurve"}}function Gr(){let s=0,t=0,e=0,n=0;function i(r,a,o,c){s=r,t=o,e=-3*r+3*a-2*o-c,n=2*r-2*a+o+c}return{initCatmullRom:function(r,a,o,c,l){i(a,o,l*(o-r),l*(c-a))},initNonuniformCatmullRom:function(r,a,o,c,l,h,u){let d=(a-r)/l-(o-r)/(l+h)+(o-a)/h,m=(o-a)/h-(c-a)/(h+u)+(c-o)/u;d*=h,m*=h,i(a,o,d,m)},calc:function(r){const a=r*r,o=a*r;return s+t*r+e*a+n*o}}}const ms=new C,fr=new Gr,pr=new Gr,mr=new Gr;class tm extends nn{constructor(t=[],e=!1,n="centripetal",i=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=i}getPoint(t,e=new C){const n=e,i=this.points,r=i.length,a=(r-(this.closed?0:1))*t;let o=Math.floor(a),c=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:c===0&&o===r-1&&(o=r-2,c=1);let l,h;this.closed||o>0?l=i[(o-1)%r]:(ms.subVectors(i[0],i[1]).add(i[0]),l=ms);const u=i[o%r],d=i[(o+1)%r];if(this.closed||o+2<r?h=i[(o+2)%r]:(ms.subVectors(i[r-1],i[r-2]).add(i[r-1]),h=ms),this.curveType==="centripetal"||this.curveType==="chordal"){const m=this.curveType==="chordal"?.5:.25;let g=Math.pow(l.distanceToSquared(u),m),_=Math.pow(u.distanceToSquared(d),m),p=Math.pow(d.distanceToSquared(h),m);_<1e-4&&(_=1),g<1e-4&&(g=_),p<1e-4&&(p=_),fr.initNonuniformCatmullRom(l.x,u.x,d.x,h.x,g,_,p),pr.initNonuniformCatmullRom(l.y,u.y,d.y,h.y,g,_,p),mr.initNonuniformCatmullRom(l.z,u.z,d.z,h.z,g,_,p)}else this.curveType==="catmullrom"&&(fr.initCatmullRom(l.x,u.x,d.x,h.x,this.tension),pr.initCatmullRom(l.y,u.y,d.y,h.y,this.tension),mr.initCatmullRom(l.z,u.z,d.z,h.z,this.tension));return n.set(fr.calc(c),pr.calc(c),mr.calc(c)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(i.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const i=this.points[e];t.points.push(i.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(new C().fromArray(i))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}}function Eo(s,t,e,n,i){const r=(n-t)*.5,a=(i-e)*.5,o=s*s,c=s*o;return(2*e-2*n+r+a)*c+(-3*e+3*n-2*r-a)*o+r*s+e}function em(s,t){const e=1-s;return e*e*t}function nm(s,t){return 2*(1-s)*s*t}function im(s,t){return s*s*t}function Di(s,t,e,n){return em(s,t)+nm(s,e)+im(s,n)}function sm(s,t){const e=1-s;return e*e*e*t}function rm(s,t){const e=1-s;return 3*e*e*s*t}function am(s,t){return 3*(1-s)*s*s*t}function om(s,t){return s*s*s*t}function Ii(s,t,e,n,i){return sm(s,t)+rm(s,e)+am(s,n)+om(s,i)}class pc extends nn{constructor(t=new lt,e=new lt,n=new lt,i=new lt){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=i}getPoint(t,e=new lt){const n=e,i=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(Ii(t,i.x,r.x,a.x,o.x),Ii(t,i.y,r.y,a.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class cm extends nn{constructor(t=new C,e=new C,n=new C,i=new C){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=i}getPoint(t,e=new C){const n=e,i=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(Ii(t,i.x,r.x,a.x,o.x),Ii(t,i.y,r.y,a.y,o.y),Ii(t,i.z,r.z,a.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class mc extends nn{constructor(t=new lt,e=new lt){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new lt){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new lt){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class lm extends nn{constructor(t=new C,e=new C){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new C){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new C){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class gc extends nn{constructor(t=new lt,e=new lt,n=new lt){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new lt){const n=e,i=this.v0,r=this.v1,a=this.v2;return n.set(Di(t,i.x,r.x,a.x),Di(t,i.y,r.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class hm extends nn{constructor(t=new C,e=new C,n=new C){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new C){const n=e,i=this.v0,r=this.v1,a=this.v2;return n.set(Di(t,i.x,r.x,a.x),Di(t,i.y,r.y,a.y),Di(t,i.z,r.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class _c extends nn{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new lt){const n=e,i=this.points,r=(i.length-1)*t,a=Math.floor(r),o=r-a,c=i[a===0?a:a-1],l=i[a],h=i[a>i.length-2?i.length-1:a+1],u=i[a>i.length-3?i.length-1:a+2];return n.set(Eo(o,c.x,l.x,h.x,u.x),Eo(o,c.y,l.y,h.y,u.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(i.clone())}return this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const i=this.points[e];t.points.push(i.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(new lt().fromArray(i))}return this}}var br=Object.freeze({__proto__:null,ArcCurve:Qp,CatmullRomCurve3:tm,CubicBezierCurve:pc,CubicBezierCurve3:cm,EllipseCurve:zr,LineCurve:mc,LineCurve3:lm,QuadraticBezierCurve:gc,QuadraticBezierCurve3:hm,SplineCurve:_c});class um extends nn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){const t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){const n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new br[n](e,t))}return this}getPoint(t,e){const n=t*this.getLength(),i=this.getCurveLengths();let r=0;for(;r<i.length;){if(i[r]>=n){const a=i[r]-n,o=this.curves[r],c=o.getLength(),l=c===0?0:1-a/c;return o.getPointAt(l,e)}r++}return null}getLength(){const t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const t=[];let e=0;for(let n=0,i=this.curves.length;n<i;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){const e=[];let n;for(let i=0,r=this.curves;i<r.length;i++){const a=r[i],o=a.isEllipseCurve?t*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?t*a.points.length:t,c=a.getPoints(o);for(let l=0;l<c.length;l++){const h=c[l];n&&n.equals(h)||(e.push(h),n=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const i=t.curves[e];this.curves.push(i.clone())}return this.autoClose=t.autoClose,this}toJSON(){const t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){const i=this.curves[e];t.curves.push(i.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const i=t.curves[e];this.curves.push(new br[i.type]().fromJSON(i))}return this}}class To extends um{constructor(t){super(),this.type="Path",this.currentPoint=new lt,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){const n=new mc(this.currentPoint.clone(),new lt(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,i){const r=new gc(this.currentPoint.clone(),new lt(t,e),new lt(n,i));return this.curves.push(r),this.currentPoint.set(n,i),this}bezierCurveTo(t,e,n,i,r,a){const o=new pc(this.currentPoint.clone(),new lt(t,e),new lt(n,i),new lt(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(t){const e=[this.currentPoint.clone()].concat(t),n=new _c(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,i,r,a){const o=this.currentPoint.x,c=this.currentPoint.y;return this.absarc(t+o,e+c,n,i,r,a),this}absarc(t,e,n,i,r,a){return this.absellipse(t,e,n,n,i,r,a),this}ellipse(t,e,n,i,r,a,o,c){const l=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+l,e+h,n,i,r,a,o,c),this}absellipse(t,e,n,i,r,a,o,c){const l=new zr(t,e,n,i,r,a,o,c);if(this.curves.length>0){const u=l.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(l);const h=l.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){const t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}}class be extends Ne{constructor(t=1,e=1,n=1,i=32,r=1,a=!1,o=0,c=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:i,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:c};const l=this;i=Math.floor(i),r=Math.floor(r);const h=[],u=[],d=[],m=[];let g=0;const _=[],p=n/2;let f=0;y(),a===!1&&(t>0&&v(!0),e>0&&v(!1)),this.setIndex(h),this.setAttribute("position",new ne(u,3)),this.setAttribute("normal",new ne(d,3)),this.setAttribute("uv",new ne(m,2));function y(){const S=new C,D=new C;let w=0;const b=(e-t)/n;for(let G=0;G<=r;G++){const M=[],A=G/r,O=A*(e-t)+t;for(let k=0;k<=i;k++){const nt=k/i,L=nt*c+o,F=Math.sin(L),V=Math.cos(L);D.x=O*F,D.y=-A*n+p,D.z=O*V,u.push(D.x,D.y,D.z),S.set(F,b,V).normalize(),d.push(S.x,S.y,S.z),m.push(nt,1-A),M.push(g++)}_.push(M)}for(let G=0;G<i;G++)for(let M=0;M<r;M++){const A=_[M][G],O=_[M+1][G],k=_[M+1][G+1],nt=_[M][G+1];h.push(A,O,nt),h.push(O,k,nt),w+=6}l.addGroup(f,w,0),f+=w}function v(S){const D=g,w=new lt,b=new C;let G=0;const M=S===!0?t:e,A=S===!0?1:-1;for(let k=1;k<=i;k++)u.push(0,p*A,0),d.push(0,A,0),m.push(.5,.5),g++;const O=g;for(let k=0;k<=i;k++){const L=k/i*c+o,F=Math.cos(L),V=Math.sin(L);b.x=M*V,b.y=p*A,b.z=M*F,u.push(b.x,b.y,b.z),d.push(0,A,0),w.x=F*.5+.5,w.y=V*.5*A+.5,m.push(w.x,w.y),g++}for(let k=0;k<i;k++){const nt=D+k,L=O+k;S===!0?h.push(L,L+1,nt):h.push(L+1,L,nt),G+=3}l.addGroup(f,G,S===!0?1:2),f+=G}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new be(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class le extends be{constructor(t=1,e=1,n=32,i=1,r=!1,a=0,o=Math.PI*2){super(0,t,e,n,i,r,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:i,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(t){return new le(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class Ds extends Ne{constructor(t=[],e=[],n=1,i=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:n,detail:i};const r=[],a=[];o(i),l(n),h(),this.setAttribute("position",new ne(r,3)),this.setAttribute("normal",new ne(r.slice(),3)),this.setAttribute("uv",new ne(a,2)),i===0?this.computeVertexNormals():this.normalizeNormals();function o(y){const v=new C,S=new C,D=new C;for(let w=0;w<e.length;w+=3)m(e[w+0],v),m(e[w+1],S),m(e[w+2],D),c(v,S,D,y)}function c(y,v,S,D){const w=D+1,b=[];for(let G=0;G<=w;G++){b[G]=[];const M=y.clone().lerp(S,G/w),A=v.clone().lerp(S,G/w),O=w-G;for(let k=0;k<=O;k++)k===0&&G===w?b[G][k]=M:b[G][k]=M.clone().lerp(A,k/O)}for(let G=0;G<w;G++)for(let M=0;M<2*(w-G)-1;M++){const A=Math.floor(M/2);M%2===0?(d(b[G][A+1]),d(b[G+1][A]),d(b[G][A])):(d(b[G][A+1]),d(b[G+1][A+1]),d(b[G+1][A]))}}function l(y){const v=new C;for(let S=0;S<r.length;S+=3)v.x=r[S+0],v.y=r[S+1],v.z=r[S+2],v.normalize().multiplyScalar(y),r[S+0]=v.x,r[S+1]=v.y,r[S+2]=v.z}function h(){const y=new C;for(let v=0;v<r.length;v+=3){y.x=r[v+0],y.y=r[v+1],y.z=r[v+2];const S=p(y)/2/Math.PI+.5,D=f(y)/Math.PI+.5;a.push(S,1-D)}g(),u()}function u(){for(let y=0;y<a.length;y+=6){const v=a[y+0],S=a[y+2],D=a[y+4],w=Math.max(v,S,D),b=Math.min(v,S,D);w>.9&&b<.1&&(v<.2&&(a[y+0]+=1),S<.2&&(a[y+2]+=1),D<.2&&(a[y+4]+=1))}}function d(y){r.push(y.x,y.y,y.z)}function m(y,v){const S=y*3;v.x=t[S+0],v.y=t[S+1],v.z=t[S+2]}function g(){const y=new C,v=new C,S=new C,D=new C,w=new lt,b=new lt,G=new lt;for(let M=0,A=0;M<r.length;M+=9,A+=6){y.set(r[M+0],r[M+1],r[M+2]),v.set(r[M+3],r[M+4],r[M+5]),S.set(r[M+6],r[M+7],r[M+8]),w.set(a[A+0],a[A+1]),b.set(a[A+2],a[A+3]),G.set(a[A+4],a[A+5]),D.copy(y).add(v).add(S).divideScalar(3);const O=p(D);_(w,A+0,y,O),_(b,A+2,v,O),_(G,A+4,S,O)}}function _(y,v,S,D){D<0&&y.x===1&&(a[v]=y.x-1),S.x===0&&S.z===0&&(a[v]=D/2/Math.PI+.5)}function p(y){return Math.atan2(y.z,-y.x)}function f(y){return Math.atan2(-y.y,Math.sqrt(y.x*y.x+y.z*y.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ds(t.vertices,t.indices,t.radius,t.details)}}class Hr extends Ds{constructor(t=1,e=0){const n=(1+Math.sqrt(5))/2,i=1/n,r=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-i,-n,0,-i,n,0,i,-n,0,i,n,-i,-n,0,-i,n,0,i,-n,0,i,n,0,-n,0,-i,n,0,-i,-n,0,i,n,0,i],a=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(r,a,t,e),this.type="DodecahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new Hr(t.radius,t.detail)}}class Bi extends To{constructor(t){super(t),this.uuid=kn(),this.type="Shape",this.holes=[]}getPointsHoles(t){const e=[];for(let n=0,i=this.holes.length;n<i;n++)e[n]=this.holes[n].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){const i=t.holes[e];this.holes.push(i.clone())}return this}toJSON(){const t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,n=this.holes.length;e<n;e++){const i=this.holes[e];t.holes.push(i.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){const i=t.holes[e];this.holes.push(new To().fromJSON(i))}return this}}const dm={triangulate:function(s,t,e=2){const n=t&&t.length,i=n?t[0]*e:s.length;let r=vc(s,0,i,e,!0);const a=[];if(!r||r.next===r.prev)return a;let o,c,l,h,u,d,m;if(n&&(r=_m(s,t,r,e)),s.length>80*e){o=l=s[0],c=h=s[1];for(let g=e;g<i;g+=e)u=s[g],d=s[g+1],u<o&&(o=u),d<c&&(c=d),u>l&&(l=u),d>h&&(h=d);m=Math.max(l-o,h-c),m=m!==0?32767/m:0}return zi(r,a,e,o,c,m,0),a}};function vc(s,t,e,n,i){let r,a;if(i===Rm(s,t,e,n)>0)for(r=t;r<e;r+=n)a=Ao(r,s[r],s[r+1],a);else for(r=e-n;r>=t;r-=n)a=Ao(r,s[r],s[r+1],a);return a&&Is(a,a.next)&&(Hi(a),a=a.next),a}function Vn(s,t){if(!s)return s;t||(t=s);let e=s,n;do if(n=!1,!e.steiner&&(Is(e,e.next)||se(e.prev,e,e.next)===0)){if(Hi(e),e=t=e.prev,e===e.next)break;n=!0}else e=e.next;while(n||e!==t);return t}function zi(s,t,e,n,i,r,a){if(!s)return;!a&&r&&ym(s,n,i,r);let o=s,c,l;for(;s.prev!==s.next;){if(c=s.prev,l=s.next,r?pm(s,n,i,r):fm(s)){t.push(c.i/e|0),t.push(s.i/e|0),t.push(l.i/e|0),Hi(s),s=l.next,o=l.next;continue}if(s=l,s===o){a?a===1?(s=mm(Vn(s),t,e),zi(s,t,e,n,i,r,2)):a===2&&gm(s,t,e,n,i,r):zi(Vn(s),t,e,n,i,r,1);break}}}function fm(s){const t=s.prev,e=s,n=s.next;if(se(t,e,n)>=0)return!1;const i=t.x,r=e.x,a=n.x,o=t.y,c=e.y,l=n.y,h=i<r?i<a?i:a:r<a?r:a,u=o<c?o<l?o:l:c<l?c:l,d=i>r?i>a?i:a:r>a?r:a,m=o>c?o>l?o:l:c>l?c:l;let g=n.next;for(;g!==t;){if(g.x>=h&&g.x<=d&&g.y>=u&&g.y<=m&&di(i,o,r,c,a,l,g.x,g.y)&&se(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function pm(s,t,e,n){const i=s.prev,r=s,a=s.next;if(se(i,r,a)>=0)return!1;const o=i.x,c=r.x,l=a.x,h=i.y,u=r.y,d=a.y,m=o<c?o<l?o:l:c<l?c:l,g=h<u?h<d?h:d:u<d?u:d,_=o>c?o>l?o:l:c>l?c:l,p=h>u?h>d?h:d:u>d?u:d,f=Rr(m,g,t,e,n),y=Rr(_,p,t,e,n);let v=s.prevZ,S=s.nextZ;for(;v&&v.z>=f&&S&&S.z<=y;){if(v.x>=m&&v.x<=_&&v.y>=g&&v.y<=p&&v!==i&&v!==a&&di(o,h,c,u,l,d,v.x,v.y)&&se(v.prev,v,v.next)>=0||(v=v.prevZ,S.x>=m&&S.x<=_&&S.y>=g&&S.y<=p&&S!==i&&S!==a&&di(o,h,c,u,l,d,S.x,S.y)&&se(S.prev,S,S.next)>=0))return!1;S=S.nextZ}for(;v&&v.z>=f;){if(v.x>=m&&v.x<=_&&v.y>=g&&v.y<=p&&v!==i&&v!==a&&di(o,h,c,u,l,d,v.x,v.y)&&se(v.prev,v,v.next)>=0)return!1;v=v.prevZ}for(;S&&S.z<=y;){if(S.x>=m&&S.x<=_&&S.y>=g&&S.y<=p&&S!==i&&S!==a&&di(o,h,c,u,l,d,S.x,S.y)&&se(S.prev,S,S.next)>=0)return!1;S=S.nextZ}return!0}function mm(s,t,e){let n=s;do{const i=n.prev,r=n.next.next;!Is(i,r)&&xc(i,n,n.next,r)&&Gi(i,r)&&Gi(r,i)&&(t.push(i.i/e|0),t.push(n.i/e|0),t.push(r.i/e|0),Hi(n),Hi(n.next),n=s=r),n=n.next}while(n!==s);return Vn(n)}function gm(s,t,e,n,i,r){let a=s;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&Am(a,o)){let c=Mc(a,o);a=Vn(a,a.next),c=Vn(c,c.next),zi(a,t,e,n,i,r,0),zi(c,t,e,n,i,r,0);return}o=o.next}a=a.next}while(a!==s)}function _m(s,t,e,n){const i=[];let r,a,o,c,l;for(r=0,a=t.length;r<a;r++)o=t[r]*n,c=r<a-1?t[r+1]*n:s.length,l=vc(s,o,c,n,!1),l===l.next&&(l.steiner=!0),i.push(Tm(l));for(i.sort(vm),r=0;r<i.length;r++)e=xm(i[r],e);return e}function vm(s,t){return s.x-t.x}function xm(s,t){const e=Mm(s,t);if(!e)return t;const n=Mc(e,s);return Vn(n,n.next),Vn(e,e.next)}function Mm(s,t){let e=t,n=-1/0,i;const r=s.x,a=s.y;do{if(a<=e.y&&a>=e.next.y&&e.next.y!==e.y){const d=e.x+(a-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(d<=r&&d>n&&(n=d,i=e.x<e.next.x?e:e.next,d===r))return i}e=e.next}while(e!==t);if(!i)return null;const o=i,c=i.x,l=i.y;let h=1/0,u;e=i;do r>=e.x&&e.x>=c&&r!==e.x&&di(a<l?r:n,a,c,l,a<l?n:r,a,e.x,e.y)&&(u=Math.abs(a-e.y)/(r-e.x),Gi(e,s)&&(u<h||u===h&&(e.x>i.x||e.x===i.x&&Sm(i,e)))&&(i=e,h=u)),e=e.next;while(e!==o);return i}function Sm(s,t){return se(s.prev,s,t.prev)<0&&se(t.next,s,s.next)<0}function ym(s,t,e,n){let i=s;do i.z===0&&(i.z=Rr(i.x,i.y,t,e,n)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next;while(i!==s);i.prevZ.nextZ=null,i.prevZ=null,Em(i)}function Em(s){let t,e,n,i,r,a,o,c,l=1;do{for(e=s,s=null,r=null,a=0;e;){for(a++,n=e,o=0,t=0;t<l&&(o++,n=n.nextZ,!!n);t++);for(c=l;o>0||c>0&&n;)o!==0&&(c===0||!n||e.z<=n.z)?(i=e,e=e.nextZ,o--):(i=n,n=n.nextZ,c--),r?r.nextZ=i:s=i,i.prevZ=r,r=i;e=n}r.nextZ=null,l*=2}while(a>1);return s}function Rr(s,t,e,n,i){return s=(s-e)*i|0,t=(t-n)*i|0,s=(s|s<<8)&16711935,s=(s|s<<4)&252645135,s=(s|s<<2)&858993459,s=(s|s<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,s|t<<1}function Tm(s){let t=s,e=s;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==s);return e}function di(s,t,e,n,i,r,a,o){return(i-a)*(t-o)>=(s-a)*(r-o)&&(s-a)*(n-o)>=(e-a)*(t-o)&&(e-a)*(r-o)>=(i-a)*(n-o)}function Am(s,t){return s.next.i!==t.i&&s.prev.i!==t.i&&!wm(s,t)&&(Gi(s,t)&&Gi(t,s)&&bm(s,t)&&(se(s.prev,s,t.prev)||se(s,t.prev,t))||Is(s,t)&&se(s.prev,s,s.next)>0&&se(t.prev,t,t.next)>0)}function se(s,t,e){return(t.y-s.y)*(e.x-t.x)-(t.x-s.x)*(e.y-t.y)}function Is(s,t){return s.x===t.x&&s.y===t.y}function xc(s,t,e,n){const i=_s(se(s,t,e)),r=_s(se(s,t,n)),a=_s(se(e,n,s)),o=_s(se(e,n,t));return!!(i!==r&&a!==o||i===0&&gs(s,e,t)||r===0&&gs(s,n,t)||a===0&&gs(e,s,n)||o===0&&gs(e,t,n))}function gs(s,t,e){return t.x<=Math.max(s.x,e.x)&&t.x>=Math.min(s.x,e.x)&&t.y<=Math.max(s.y,e.y)&&t.y>=Math.min(s.y,e.y)}function _s(s){return s>0?1:s<0?-1:0}function wm(s,t){let e=s;do{if(e.i!==s.i&&e.next.i!==s.i&&e.i!==t.i&&e.next.i!==t.i&&xc(e,e.next,s,t))return!0;e=e.next}while(e!==s);return!1}function Gi(s,t){return se(s.prev,s,s.next)<0?se(s,t,s.next)>=0&&se(s,s.prev,t)>=0:se(s,t,s.prev)<0||se(s,s.next,t)<0}function bm(s,t){let e=s,n=!1;const i=(s.x+t.x)/2,r=(s.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&i<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(n=!n),e=e.next;while(e!==s);return n}function Mc(s,t){const e=new Cr(s.i,s.x,s.y),n=new Cr(t.i,t.x,t.y),i=s.next,r=t.prev;return s.next=t,t.prev=s,e.next=i,i.prev=e,n.next=e,e.prev=n,r.next=n,n.prev=r,n}function Ao(s,t,e,n){const i=new Cr(s,t,e);return n?(i.next=n.next,i.prev=n,n.next.prev=i,n.next=i):(i.prev=i,i.next=i),i}function Hi(s){s.next.prev=s.prev,s.prev.next=s.next,s.prevZ&&(s.prevZ.nextZ=s.nextZ),s.nextZ&&(s.nextZ.prevZ=s.prevZ)}function Cr(s,t,e){this.i=s,this.x=t,this.y=e,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}function Rm(s,t,e,n){let i=0;for(let r=t,a=e-n;r<e;r+=n)i+=(s[a]-s[r])*(s[r+1]+s[a+1]),a=r;return i}class An{static area(t){const e=t.length;let n=0;for(let i=e-1,r=0;r<e;i=r++)n+=t[i].x*t[r].y-t[r].x*t[i].y;return n*.5}static isClockWise(t){return An.area(t)<0}static triangulateShape(t,e){const n=[],i=[],r=[];wo(t),bo(n,t);let a=t.length;e.forEach(wo);for(let c=0;c<e.length;c++)i.push(a),a+=e[c].length,bo(n,e[c]);const o=dm.triangulate(n,i);for(let c=0;c<o.length;c+=3)r.push(o.slice(c,c+3));return r}}function wo(s){const t=s.length;t>2&&s[t-1].equals(s[0])&&s.pop()}function bo(s,t){for(let e=0;e<t.length;e++)s.push(t[e].x),s.push(t[e].y)}class Vr extends Ne{constructor(t=new Bi([new lt(.5,.5),new lt(-.5,.5),new lt(-.5,-.5),new lt(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];const n=this,i=[],r=[];for(let o=0,c=t.length;o<c;o++){const l=t[o];a(l)}this.setAttribute("position",new ne(i,3)),this.setAttribute("uv",new ne(r,2)),this.computeVertexNormals();function a(o){const c=[],l=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,u=e.depth!==void 0?e.depth:1;let d=e.bevelEnabled!==void 0?e.bevelEnabled:!0,m=e.bevelThickness!==void 0?e.bevelThickness:.2,g=e.bevelSize!==void 0?e.bevelSize:m-.1,_=e.bevelOffset!==void 0?e.bevelOffset:0,p=e.bevelSegments!==void 0?e.bevelSegments:3;const f=e.extrudePath,y=e.UVGenerator!==void 0?e.UVGenerator:Cm;let v,S=!1,D,w,b,G;f&&(v=f.getSpacedPoints(h),S=!0,d=!1,D=f.computeFrenetFrames(h,!1),w=new C,b=new C,G=new C),d||(p=0,m=0,g=0,_=0);const M=o.extractPoints(l);let A=M.shape;const O=M.holes;if(!An.isClockWise(A)){A=A.reverse();for(let R=0,at=O.length;R<at;R++){const q=O[R];An.isClockWise(q)&&(O[R]=q.reverse())}}const nt=An.triangulateShape(A,O),L=A;for(let R=0,at=O.length;R<at;R++){const q=O[R];A=A.concat(q)}function F(R,at,q){return at||console.error("THREE.ExtrudeGeometry: vec does not exist"),R.clone().addScaledVector(at,q)}const V=A.length,K=nt.length;function Y(R,at,q){let st,X,Tt;const mt=R.x-at.x,E=R.y-at.y,x=q.x-R.x,N=q.y-R.y,et=mt*mt+E*E,Q=mt*N-E*x;if(Math.abs(Q)>Number.EPSILON){const J=Math.sqrt(et),Mt=Math.sqrt(x*x+N*N),ut=at.x-E/J,vt=at.y+mt/J,wt=q.x-N/Mt,Bt=q.y+x/Mt,tt=((wt-ut)*N-(Bt-vt)*x)/(mt*N-E*x);st=ut+mt*tt-R.x,X=vt+E*tt-R.y;const Yt=st*st+X*X;if(Yt<=2)return new lt(st,X);Tt=Math.sqrt(Yt/2)}else{let J=!1;mt>Number.EPSILON?x>Number.EPSILON&&(J=!0):mt<-Number.EPSILON?x<-Number.EPSILON&&(J=!0):Math.sign(E)===Math.sign(N)&&(J=!0),J?(st=-E,X=mt,Tt=Math.sqrt(et)):(st=mt,X=E,Tt=Math.sqrt(et/2))}return new lt(st/Tt,X/Tt)}const $=[];for(let R=0,at=L.length,q=at-1,st=R+1;R<at;R++,q++,st++)q===at&&(q=0),st===at&&(st=0),$[R]=Y(L[R],L[q],L[st]);const Z=[];let it,rt=$.concat();for(let R=0,at=O.length;R<at;R++){const q=O[R];it=[];for(let st=0,X=q.length,Tt=X-1,mt=st+1;st<X;st++,Tt++,mt++)Tt===X&&(Tt=0),mt===X&&(mt=0),it[st]=Y(q[st],q[Tt],q[mt]);Z.push(it),rt=rt.concat(it)}for(let R=0;R<p;R++){const at=R/p,q=m*Math.cos(at*Math.PI/2),st=g*Math.sin(at*Math.PI/2)+_;for(let X=0,Tt=L.length;X<Tt;X++){const mt=F(L[X],$[X],st);_t(mt.x,mt.y,-q)}for(let X=0,Tt=O.length;X<Tt;X++){const mt=O[X];it=Z[X];for(let E=0,x=mt.length;E<x;E++){const N=F(mt[E],it[E],st);_t(N.x,N.y,-q)}}}const W=g+_;for(let R=0;R<V;R++){const at=d?F(A[R],rt[R],W):A[R];S?(b.copy(D.normals[0]).multiplyScalar(at.x),w.copy(D.binormals[0]).multiplyScalar(at.y),G.copy(v[0]).add(b).add(w),_t(G.x,G.y,G.z)):_t(at.x,at.y,0)}for(let R=1;R<=h;R++)for(let at=0;at<V;at++){const q=d?F(A[at],rt[at],W):A[at];S?(b.copy(D.normals[R]).multiplyScalar(q.x),w.copy(D.binormals[R]).multiplyScalar(q.y),G.copy(v[R]).add(b).add(w),_t(G.x,G.y,G.z)):_t(q.x,q.y,u/h*R)}for(let R=p-1;R>=0;R--){const at=R/p,q=m*Math.cos(at*Math.PI/2),st=g*Math.sin(at*Math.PI/2)+_;for(let X=0,Tt=L.length;X<Tt;X++){const mt=F(L[X],$[X],st);_t(mt.x,mt.y,u+q)}for(let X=0,Tt=O.length;X<Tt;X++){const mt=O[X];it=Z[X];for(let E=0,x=mt.length;E<x;E++){const N=F(mt[E],it[E],st);S?_t(N.x,N.y+v[h-1].y,v[h-1].x+q):_t(N.x,N.y,u+q)}}}j(),pt();function j(){const R=i.length/3;if(d){let at=0,q=V*at;for(let st=0;st<K;st++){const X=nt[st];Ct(X[2]+q,X[1]+q,X[0]+q)}at=h+p*2,q=V*at;for(let st=0;st<K;st++){const X=nt[st];Ct(X[0]+q,X[1]+q,X[2]+q)}}else{for(let at=0;at<K;at++){const q=nt[at];Ct(q[2],q[1],q[0])}for(let at=0;at<K;at++){const q=nt[at];Ct(q[0]+V*h,q[1]+V*h,q[2]+V*h)}}n.addGroup(R,i.length/3-R,0)}function pt(){const R=i.length/3;let at=0;St(L,at),at+=L.length;for(let q=0,st=O.length;q<st;q++){const X=O[q];St(X,at),at+=X.length}n.addGroup(R,i.length/3-R,1)}function St(R,at){let q=R.length;for(;--q>=0;){const st=q;let X=q-1;X<0&&(X=R.length-1);for(let Tt=0,mt=h+p*2;Tt<mt;Tt++){const E=V*Tt,x=V*(Tt+1),N=at+st+E,et=at+X+E,Q=at+X+x,J=at+st+x;Nt(N,et,Q,J)}}}function _t(R,at,q){c.push(R),c.push(at),c.push(q)}function Ct(R,at,q){yt(R),yt(at),yt(q);const st=i.length/3,X=y.generateTopUV(n,i,st-3,st-2,st-1);Dt(X[0]),Dt(X[1]),Dt(X[2])}function Nt(R,at,q,st){yt(R),yt(at),yt(st),yt(at),yt(q),yt(st);const X=i.length/3,Tt=y.generateSideWallUV(n,i,X-6,X-3,X-2,X-1);Dt(Tt[0]),Dt(Tt[1]),Dt(Tt[3]),Dt(Tt[1]),Dt(Tt[2]),Dt(Tt[3])}function yt(R){i.push(c[R*3+0]),i.push(c[R*3+1]),i.push(c[R*3+2])}function Dt(R){r.push(R.x),r.push(R.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON(),e=this.parameters.shapes,n=this.parameters.options;return Pm(e,n,t)}static fromJSON(t,e){const n=[];for(let r=0,a=t.shapes.length;r<a;r++){const o=e[t.shapes[r]];n.push(o)}const i=t.options.extrudePath;return i!==void 0&&(t.options.extrudePath=new br[i.type]().fromJSON(i)),new Vr(n,t.options)}}const Cm={generateTopUV:function(s,t,e,n,i){const r=t[e*3],a=t[e*3+1],o=t[n*3],c=t[n*3+1],l=t[i*3],h=t[i*3+1];return[new lt(r,a),new lt(o,c),new lt(l,h)]},generateSideWallUV:function(s,t,e,n,i,r){const a=t[e*3],o=t[e*3+1],c=t[e*3+2],l=t[n*3],h=t[n*3+1],u=t[n*3+2],d=t[i*3],m=t[i*3+1],g=t[i*3+2],_=t[r*3],p=t[r*3+1],f=t[r*3+2];return Math.abs(o-h)<Math.abs(a-l)?[new lt(a,1-c),new lt(l,1-u),new lt(d,1-g),new lt(_,1-f)]:[new lt(o,1-c),new lt(h,1-u),new lt(m,1-g),new lt(p,1-f)]}};function Pm(s,t,e){if(e.shapes=[],Array.isArray(s))for(let n=0,i=s.length;n<i;n++){const r=s[n];e.shapes.push(r.uuid)}else e.shapes.push(s.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}class kr extends Ds{constructor(t=1,e=0){const n=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],i=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(n,i,t,e),this.type="OctahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new kr(t.radius,t.detail)}}class bs extends Ne{constructor(t=new Bi([new lt(0,.5),new lt(-.5,-.5),new lt(.5,-.5)]),e=12){super(),this.type="ShapeGeometry",this.parameters={shapes:t,curveSegments:e};const n=[],i=[],r=[],a=[];let o=0,c=0;if(Array.isArray(t)===!1)l(t);else for(let h=0;h<t.length;h++)l(t[h]),this.addGroup(o,c,h),o+=c,c=0;this.setIndex(n),this.setAttribute("position",new ne(i,3)),this.setAttribute("normal",new ne(r,3)),this.setAttribute("uv",new ne(a,2));function l(h){const u=i.length/3,d=h.extractPoints(e);let m=d.shape;const g=d.holes;An.isClockWise(m)===!1&&(m=m.reverse());for(let p=0,f=g.length;p<f;p++){const y=g[p];An.isClockWise(y)===!0&&(g[p]=y.reverse())}const _=An.triangulateShape(m,g);for(let p=0,f=g.length;p<f;p++){const y=g[p];m=m.concat(y)}for(let p=0,f=m.length;p<f;p++){const y=m[p];i.push(y.x,y.y,0),r.push(0,0,1),a.push(y.x,y.y)}for(let p=0,f=_.length;p<f;p++){const y=_[p],v=y[0]+u,S=y[1]+u,D=y[2]+u;n.push(v,S,D),c+=3}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON(),e=this.parameters.shapes;return Lm(e,t)}static fromJSON(t,e){const n=[];for(let i=0,r=t.shapes.length;i<r;i++){const a=e[t.shapes[i]];n.push(a)}return new bs(n,t.curveSegments)}}function Lm(s,t){if(t.shapes=[],Array.isArray(s))for(let e=0,n=s.length;e<n;e++){const i=s[e];t.shapes.push(i.uuid)}else t.shapes.push(s.uuid);return t}class De extends Ne{constructor(t=1,e=32,n=16,i=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:i,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));const c=Math.min(a+o,Math.PI);let l=0;const h=[],u=new C,d=new C,m=[],g=[],_=[],p=[];for(let f=0;f<=n;f++){const y=[],v=f/n;let S=0;f===0&&a===0?S=.5/e:f===n&&c===Math.PI&&(S=-.5/e);for(let D=0;D<=e;D++){const w=D/e;u.x=-t*Math.cos(i+w*r)*Math.sin(a+v*o),u.y=t*Math.cos(a+v*o),u.z=t*Math.sin(i+w*r)*Math.sin(a+v*o),g.push(u.x,u.y,u.z),d.copy(u).normalize(),_.push(d.x,d.y,d.z),p.push(w+S,1-v),y.push(l++)}h.push(y)}for(let f=0;f<n;f++)for(let y=0;y<e;y++){const v=h[f][y+1],S=h[f][y],D=h[f+1][y],w=h[f+1][y+1];(f!==0||a>0)&&m.push(v,S,w),(f!==n-1||c<Math.PI)&&m.push(S,D,w)}this.setIndex(m),this.setAttribute("position",new ne(g,3)),this.setAttribute("normal",new ne(_,3)),this.setAttribute("uv",new ne(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new De(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class Wr extends Ne{constructor(t=1,e=.4,n=12,i=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:n,tubularSegments:i,arc:r},n=Math.floor(n),i=Math.floor(i);const a=[],o=[],c=[],l=[],h=new C,u=new C,d=new C;for(let m=0;m<=n;m++)for(let g=0;g<=i;g++){const _=g/i*r,p=m/n*Math.PI*2;u.x=(t+e*Math.cos(p))*Math.cos(_),u.y=(t+e*Math.cos(p))*Math.sin(_),u.z=e*Math.sin(p),o.push(u.x,u.y,u.z),h.x=t*Math.cos(_),h.y=t*Math.sin(_),d.subVectors(u,h).normalize(),c.push(d.x,d.y,d.z),l.push(g/i),l.push(m/n)}for(let m=1;m<=n;m++)for(let g=1;g<=i;g++){const _=(i+1)*m+g-1,p=(i+1)*(m-1)+g-1,f=(i+1)*(m-1)+g,y=(i+1)*m+g;a.push(_,p,y),a.push(p,f,y)}this.setIndex(a),this.setAttribute("position",new ne(o,3)),this.setAttribute("normal",new ne(c,3)),this.setAttribute("uv",new ne(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Wr(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}}class Ut extends ki{constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new Ft(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ft(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Xo,this.normalScale=new lt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class Xr extends he{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Ft(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),e}}class Dm extends Xr{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(he.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ft(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const gr=new ee,Ro=new C,Co=new C;class Im{constructor(t){this.camera=t,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new lt(512,512),this.map=null,this.mapPass=null,this.matrix=new ee,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Nr,this._frameExtents=new lt(1,1),this._viewportCount=1,this._viewports=[new _e(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;Ro.setFromMatrixPosition(t.matrixWorld),e.position.copy(Ro),Co.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Co),e.updateMatrixWorld(),gr.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(gr),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(gr)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}class Um extends Im{constructor(){super(new rc(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class Nm extends Xr{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(he.DEFAULT_UP),this.updateMatrix(),this.target=new he,this.shadow=new Um}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}class Om extends Xr{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Lr}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Lr);class Fm{constructor(){I(this,"lastRequestId");I(this,"isRunning",!1);I(this,"lastTimestamp",0);I(this,"accumulator",0);I(this,"DEFAULT_FPS",60);I(this,"MIN_FPS",20);I(this,"targetFps",this.DEFAULT_FPS)}get targetFrameTime(){return 1e3/this.targetFps}get maxDeltaTime(){return 1e3/this.MIN_FPS}setTargetFPS(t){this.targetFps=Math.min(Math.max(t,this.MIN_FPS),144)}start(t,e){if(this.isRunning)return;this.isRunning=!0,this.lastTimestamp=performance.now(),this.accumulator=0;const n=i=>{if(!this.isRunning)return;this.lastRequestId=requestAnimationFrame(n);let r=i-this.lastTimestamp;for(this.lastTimestamp=i,r=Math.min(r,this.maxDeltaTime),this.accumulator+=r;this.accumulator>=this.targetFrameTime;)t(this.targetFrameTime/1e3),this.accumulator-=this.targetFrameTime;e()};requestAnimationFrame(n)}stop(){this.isRunning=!1,this.lastRequestId&&(cancelAnimationFrame(this.lastRequestId),this.lastRequestId=void 0)}isActive(){return this.isRunning}}const Ui=class Ui{static detectMobile(){return/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)||window.innerWidth<=768||"ontouchstart"in window}static getPixelRatio(){return this.isMobile?Math.min(window.devicePixelRatio,1.5):Math.min(window.devicePixelRatio,2)}static getShadowEnabled(){return!this.isMobile}static getAntialiasEnabled(){return!this.isMobile}static getMaxEnemies(){return this.isMobile?5:10}static getParticleCount(){return this.isMobile?20:50}static getProjectilePoolSize(){return this.isMobile?100:200}static getTargetFPS(){return this.isMobile?30:60}};I(Ui,"isMobile",Ui.detectMobile()),I(Ui,"DEBUG",!1);let en=Ui;const te={PLAYER:{PITCH_SPEED:2,YAW_SPEED:1.5,ROLL_SPEED:3,BASE_SPEED:50,MAX_SPEED:100},PROJECTILE:{SPEED:100,MAX_DISTANCE:500},CAMERA:{FOV:75,NEAR:.1,FAR:2e3,OFFSET:{x:0,y:5,z:15},SMOOTH_FACTOR:.1},WORLD:{FOG_NEAR:100,FOG_FAR:1e3},POWERUP:{SPAWN_CHANCE:.15,COLLECT_RADIUS:5},LEVEL:{START_DELAY:2,WAVE_DELAY:5},MISSILE:{DAMAGE:100,STARTING_MISSILES:2}};class Bm{constructor(){I(this,"scene");I(this,"camera");I(this,"renderer");this.scene=new Jp,this.scene.fog=new Br(8900331,te.WORLD.FOG_NEAR,te.WORLD.FOG_FAR),this.camera=new ke(te.CAMERA.FOV,window.innerWidth/window.innerHeight,te.CAMERA.NEAR,te.CAMERA.FAR),this.camera.position.set(0,5,10),this.renderer=new dc({antialias:en.getAntialiasEnabled(),powerPreference:"high-performance"}),this.renderer.setSize(window.innerWidth,window.innerHeight),this.renderer.setPixelRatio(en.getPixelRatio()),this.renderer.shadowMap.enabled=en.getShadowEnabled(),this.renderer.shadowMap.type=Uo,document.body.appendChild(this.renderer.domElement),this.setupLighting(),this.setupSkybox(),this.setupGround(),this.setupResizeHandler()}setupLighting(){const t=new Om(16777215,.6);this.scene.add(t);const e=new Nm(16777215,1);e.position.set(100,100,50),e.castShadow=en.getShadowEnabled(),e.shadow.mapSize.width=2048,e.shadow.mapSize.height=2048,e.shadow.camera.near=.5,e.shadow.camera.far=500,this.scene.add(e);const n=new Dm(8900331,4021340,.4);this.scene.add(n)}setupSkybox(){const t=document.createElement("canvas");t.width=2,t.height=512;const e=t.getContext("2d"),n=e.createLinearGradient(0,0,0,512);n.addColorStop(0,"#1e3c72"),n.addColorStop(.3,"#2a5298"),n.addColorStop(.6,"#87CEEB"),n.addColorStop(1,"#ffffff"),e.fillStyle=n,e.fillRect(0,0,2,512);const i=new fc(t);this.scene.background=i}setupGround(){const t=new Le(2e3,2e3),e=new Ut({color:4021340,roughness:1,metalness:0}),n=new ht(t,e);n.rotation.x=-Math.PI/2,n.position.y=-50,n.receiveShadow=!0,this.scene.add(n)}setupResizeHandler(){window.addEventListener("resize",()=>{this.camera.aspect=window.innerWidth/window.innerHeight,this.camera.updateProjectionMatrix(),this.renderer.setSize(window.innerWidth,window.innerHeight)})}render(){this.renderer.render(this.scene,this.camera)}dispose(){this.renderer.dispose(),this.scene.traverse(t=>{t instanceof ht&&(t.geometry.dispose(),Array.isArray(t.material)?t.material.forEach(e=>e.dispose()):t.material.dispose())})}}class zm{constructor(){I(this,"keys",new Set);I(this,"joystickActive",!1);I(this,"joystickX",0);I(this,"joystickY",0);I(this,"firePressed",!1);I(this,"throttlePressed",!1);I(this,"missilePressed",!1);I(this,"isMobile");this.isMobile=en.isMobile,this.setupListeners()}setupListeners(){window.addEventListener("keydown",t=>{this.keys.add(t.code)}),window.addEventListener("keyup",t=>{this.keys.delete(t.code)}),this.isMobile&&this.setupTouchControls()}setupTouchControls(){const t=document.getElementById("joystick"),e=document.getElementById("joystick-knob"),n=document.getElementById("fire-button"),i=document.getElementById("throttle-button"),r=document.getElementById("missile-button");if(!t||!e){console.warn("Joystick elements not found");return}let a=t.getBoundingClientRect();t.addEventListener("touchstart",o=>{o.preventDefault(),this.joystickActive=!0,a=t.getBoundingClientRect()},{passive:!1}),t.addEventListener("touchmove",o=>{if(o.preventDefault(),!this.joystickActive)return;const c=o.touches[0],l=a.left+a.width/2,h=a.top+a.height/2,u=a.width/2;let d=c.clientX-l,m=c.clientY-h;const g=Math.sqrt(d*d+m*m);g>u&&(d=d/g*u,m=m/g*u),e.style.transform=`translate(${d}px, ${m}px)`,this.joystickX=d/u,this.joystickY=m/u},{passive:!1}),t.addEventListener("touchend",()=>{this.joystickActive=!1,this.joystickX=0,this.joystickY=0,e.style.transform="translate(0px, 0px)"}),n&&(n.addEventListener("touchstart",o=>{o.preventDefault(),this.firePressed=!0},{passive:!1}),n.addEventListener("touchend",()=>{this.firePressed=!1})),i&&(i.addEventListener("touchstart",o=>{o.preventDefault(),this.throttlePressed=!0},{passive:!1}),i.addEventListener("touchend",()=>{this.throttlePressed=!1})),r&&(r.addEventListener("touchstart",o=>{o.preventDefault(),this.missilePressed=!0},{passive:!1}),r.addEventListener("touchend",()=>{this.missilePressed=!1})),document.addEventListener("touchmove",o=>{o.target instanceof Element&&o.target.closest(".mobile-controls")&&o.preventDefault()},{passive:!1})}getState(){return this.isMobile?this.getMobileState():this.getDesktopState()}getMobileState(){return{pitchUp:this.joystickY<-.3,pitchDown:this.joystickY>.3,yawLeft:this.joystickX<-.3,yawRight:this.joystickX>.3,rollLeft:!1,rollRight:!1,fire:this.firePressed,missile:this.missilePressed,throttle:this.throttlePressed}}getDesktopState(){return{pitchUp:this.keys.has("KeyW")||this.keys.has("ArrowUp"),pitchDown:this.keys.has("KeyS")||this.keys.has("ArrowDown"),yawLeft:this.keys.has("KeyA"),yawRight:this.keys.has("KeyD"),rollLeft:this.keys.has("KeyQ"),rollRight:this.keys.has("KeyE"),fire:this.keys.has("Space"),missile:this.keys.has("KeyM")||this.keys.has("ShiftRight"),throttle:this.keys.has("ShiftLeft")||this.keys.has("ControlLeft")}}}class Gm{constructor(t){I(this,"aircraft");I(this,"currentSpeed");I(this,"forward");this.aircraft=t,this.currentSpeed=te.PLAYER.BASE_SPEED,this.forward=new C}update(t,e){e.throttle?this.currentSpeed=Math.min(te.PLAYER.MAX_SPEED,this.currentSpeed+20*t):this.currentSpeed=Math.max(te.PLAYER.BASE_SPEED*.5,this.currentSpeed-10*t),e.pitchUp&&this.aircraft.rotateX(te.PLAYER.PITCH_SPEED*t),e.pitchDown&&this.aircraft.rotateX(-2*t),e.yawLeft&&this.aircraft.rotateY(te.PLAYER.YAW_SPEED*t),e.yawRight&&this.aircraft.rotateY(-1.5*t),e.rollLeft&&this.aircraft.rotateZ(te.PLAYER.ROLL_SPEED*t),e.rollRight&&this.aircraft.rotateZ(-3*t),this.forward.set(0,0,-1),this.forward.applyQuaternion(this.aircraft.quaternion),this.aircraft.position.addScaledVector(this.forward,this.currentSpeed*t)}getPosition(){return this.aircraft.position}getQuaternion(){return this.aircraft.quaternion}getSpeed(){return this.currentSpeed}getAircraft(){return this.aircraft}}class Hm{constructor(t,e,n){I(this,"camera");I(this,"target");I(this,"offset");I(this,"currentPosition");I(this,"smoothFactor");this.camera=t,this.target=e,this.offset=n||new C(te.CAMERA.OFFSET.x,te.CAMERA.OFFSET.y,te.CAMERA.OFFSET.z),this.currentPosition=new C,this.smoothFactor=te.CAMERA.SMOOTH_FACTOR}update(){const t=this.offset.clone();t.applyQuaternion(this.target.quaternion),t.add(this.target.position),this.currentPosition.lerp(t,this.smoothFactor),this.camera.position.copy(this.currentPosition),this.camera.lookAt(this.target.position)}setSmoothFactor(t){this.smoothFactor=Math.max(0,Math.min(1,t))}}class Po{constructor(t){I(this,"pool",[]);I(this,"maxDistance");I(this,"scene");this.scene=t,this.maxDistance=te.PROJECTILE.MAX_DISTANCE;const e=en.getProjectilePoolSize(),n=new De(.3,8,8),i=new ze({color:16776960,transparent:!0,opacity:.9});for(let r=0;r<e;r++){const a=new ht(n,i.clone());a.visible=!1,this.scene.add(a),this.pool.push({mesh:a,direction:new C,speed:te.PROJECTILE.SPEED,active:!1,startPosition:new C})}}fire(t,e){const n=this.pool.find(i=>!i.active);n&&(n.mesh.position.copy(t),n.direction.copy(e).normalize(),n.startPosition.copy(t),n.mesh.visible=!0,n.active=!0)}update(t){for(const e of this.pool){if(!e.active)continue;e.mesh.position.addScaledVector(e.direction,e.speed*t),e.mesh.position.distanceTo(e.startPosition)>this.maxDistance&&this.deactivate(e)}}checkCollisions(t,e){for(const n of this.pool)if(n.active)for(const i of t){if(!i.visible)continue;if(n.mesh.position.distanceTo(i.position)<5){e(i,n.mesh),this.deactivate(n);break}}}deactivate(t){t.mesh.visible=!1,t.active=!1}getActiveProjectiles(){return this.pool.filter(t=>t.active).map(t=>t.mesh)}}class Sc{constructor(t=100){I(this,"maxHealth");I(this,"currentHealth");I(this,"isDead",!1);I(this,"onDamage");I(this,"onDeath");this.maxHealth=t,this.currentHealth=t}takeDamage(t){this.isDead||(this.currentHealth=Math.max(0,this.currentHealth-t),this.onDamage&&this.onDamage(t,this.currentHealth),this.currentHealth<=0&&(this.isDead=!0,this.onDeath&&this.onDeath()))}heal(t){this.isDead||(this.currentHealth=Math.min(this.maxHealth,this.currentHealth+t))}getHealthPercent(){return this.currentHealth/this.maxHealth}getCurrentHealth(){return this.currentHealth}getMaxHealth(){return this.maxHealth}isEntityDead(){return this.isDead}reset(){this.currentHealth=this.maxHealth,this.isDead=!1}}class Vm{constructor(t){I(this,"mesh");I(this,"velocity");I(this,"target");I(this,"active",!0);I(this,"lifetime",0);I(this,"maxLifetime",10);I(this,"turnSpeed",2);I(this,"speed",80);const e=new le(.15,1.5,8),n=new Ut({color:16729156,emissive:16711680,emissiveIntensity:.5,metalness:.8,roughness:.2});this.mesh=new ht(e,n),this.mesh.rotation.x=Math.PI/2,this.mesh.castShadow=!0;const i=new le(.1,.8,8),r=new ze({color:16755200,transparent:!0,opacity:.8}),a=new ht(i,r);a.rotation.x=-Math.PI/2,a.position.z=.8,this.mesh.add(a),t.add(this.mesh),this.velocity=new C,this.target=null}update(t){if(this.lifetime+=t,this.lifetime>this.maxLifetime){this.active=!1;return}if(this.target&&this.target.parent&&this.huntTarget(t),this.mesh.position.add(this.velocity.clone().multiplyScalar(t)),this.velocity.length()>.1){const e=this.mesh.position.clone().add(this.velocity);this.mesh.lookAt(e)}}huntTarget(t){const e=this.target.position.clone().sub(this.mesh.position);if(e.length()<5)return;e.normalize();const i=this.velocity.clone().normalize(),r=e,a=i.angleTo(r),o=this.turnSpeed*t;let c=Math.min(a,o);new C().crossVectors(i,r).y<0&&(c=-c);const h=new C(0,1,0);this.velocity.applyAxisAngle(h,c),this.velocity.normalize().multiplyScalar(this.speed)}setDirection(t){this.velocity.copy(t).normalize().multiplyScalar(this.speed)}dispose(t){t.remove(this.mesh),this.mesh.geometry.dispose(),this.mesh.material.dispose()}}class km{constructor(t){I(this,"scene");I(this,"missiles",[]);I(this,"maxMissiles",99);this.scene=t}fire(t,e,n){if(this.missiles.length>=this.maxMissiles)return;const i=new Vm(this.scene);i.mesh.position.copy(t),i.setDirection(e),n&&(i.target=n),this.missiles.push(i)}update(t){for(let e=this.missiles.length-1;e>=0;e--){const n=this.missiles[e];n.update(t),n.active||(n.dispose(this.scene),this.missiles.splice(e,1))}}checkCollisions(t,e){for(const n of this.missiles)if(n.active){for(const i of t)if(n.mesh.position.distanceTo(i.position)<3){n.active=!1,e(i);break}}}clear(){for(const t of this.missiles)t.dispose(this.scene);this.missiles=[]}getMissileCount(){return this.missiles.length}setMaxMissiles(t){this.maxMissiles=t}}class Wm{constructor(){I(this,"container");I(this,"healthBar");I(this,"scoreDisplay");I(this,"speedDisplay");I(this,"enemiesDisplay");I(this,"livesDisplay");I(this,"missilesDisplay");this.container=document.createElement("div"),this.container.id="hud";const t=en.isMobile,e=t?"10px":"20px",n=t?"16px":"20px";this.container.style.cssText=`
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
    `,this.healthBar=this.createHealthBar(t),this.scoreDisplay=document.createElement("div"),this.scoreDisplay.style.cssText=`
      font-size: ${n};
      position: absolute;
      top: ${e};
      right: ${e};
    `,this.scoreDisplay.textContent="分数: 0",this.speedDisplay=document.createElement("div"),this.speedDisplay.style.cssText=`
      font-size: ${t?"14px":"18px"};
      position: absolute;
      bottom: ${t?"40%":"20px"};
      left: ${e};
    `,this.speedDisplay.textContent="速度: 0 km/h",this.enemiesDisplay=document.createElement("div"),this.enemiesDisplay.style.cssText=`
      font-size: ${t?"14px":"18px"};
      position: absolute;
      top: ${t?"40px":"50px"};
      right: ${e};
    `,this.enemiesDisplay.textContent="敌人: 0",this.livesDisplay=document.createElement("div"),this.livesDisplay.style.cssText=`
      font-size: ${t?"14px":"18px"};
      position: absolute;
      top: ${t?"65px":"80px"};
      right: ${e};
    `,this.livesDisplay.textContent="生命: ❤️❤️❤️",this.missilesDisplay=document.createElement("div"),this.missilesDisplay.style.cssText=`
      font-size: ${t?"14px":"18px"};
      position: absolute;
      top: ${t?"90px":"110px"};
      right: ${e};
      color: #ff6600;
    `,this.missilesDisplay.textContent="导弹: 🚀🚀",this.container.appendChild(this.healthBar),this.container.appendChild(this.scoreDisplay),this.container.appendChild(this.speedDisplay),this.container.appendChild(this.enemiesDisplay),this.container.appendChild(this.livesDisplay),this.container.appendChild(this.missilesDisplay),document.body.appendChild(this.container)}createHealthBar(t){const e=document.createElement("div"),n=t?"200px":"300px",i=t?"15px":"20px";return e.style.cssText=`
      width: ${n};
      height: ${i};
      background: rgba(0,0,0,0.5);
      border-radius: 10px;
      overflow: hidden;
      border: 2px solid rgba(255,255,255,0.5);
    `,this.healthBar=document.createElement("div"),this.healthBar.style.cssText=`
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, #00ff00, #88ff00);
      transition: width 0.3s, background 0.3s;
    `,e.appendChild(this.healthBar),e}updateHealth(t){this.healthBar.style.width=`${t*100}%`,t>.6?this.healthBar.style.background="linear-gradient(90deg, #00ff00, #88ff00)":t>.3?this.healthBar.style.background="linear-gradient(90deg, #ffff00, #ffaa00)":this.healthBar.style.background="linear-gradient(90deg, #ff4444, #ff0000)"}updateScore(t){this.scoreDisplay.textContent=`分数: ${t}`}updateSpeed(t){const e=Math.round(t*10);this.speedDisplay.textContent=`速度: ${e} km/h`}updateEnemies(t){this.enemiesDisplay.textContent=`敌人: ${t}`}updateLives(t){const e="❤️".repeat(Math.max(0,t))+"🖤".repeat(Math.max(0,3-t));this.livesDisplay.textContent=`生命: ${e}`}updateMissiles(t){const n="🚀".repeat(Math.max(0,t))+"⬜".repeat(Math.max(0,10-t));this.missilesDisplay.textContent=`导弹: ${n}`}hide(){this.container.style.display="none"}show(){this.container.style.display="block"}}class Xm{constructor(){I(this,"container");I(this,"settingsContainer");I(this,"onStart");I(this,"settings",{difficulty:1,soundVolume:.7,playerLives:3});this.container=this.createContainer(),this.settingsContainer=this.createSettingsPanel(),this.container.appendChild(this.settingsContainer),document.body.appendChild(this.container)}createContainer(){const t=document.createElement("div");return t.id="start-menu",t.innerHTML=`
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
    `,t.appendChild(a),t}createSettingRow(t,e,n,i){const r=document.createElement("div");r.className="setting-row";const a=document.createElement("span");a.className="setting-label",a.textContent=t;const o=document.createElement("div");o.className="setting-control";const c=document.createElement("button");c.className="setting-btn",c.textContent="-",c.onclick=n;const l=document.createElement("span");l.className="setting-value",l.textContent=e,l.id=`${t.toLowerCase()}-value`;const h=document.createElement("button");return h.className="setting-btn",h.textContent="+",h.onclick=i,o.appendChild(c),o.appendChild(l),o.appendChild(h),r.appendChild(a),r.appendChild(o),r}getDifficultyText(t){return["简单","普通","困难","专家","地狱"][t-1]}updateDisplay(){const t=document.getElementById("难度-value")||document.querySelector("#difficulty-row .setting-value"),e=document.getElementById("音效音量-value")||document.querySelector("#sound-row .setting-value"),n=document.getElementById("生命数-value")||document.querySelector("#lives-row .setting-value");t&&(t.textContent=this.getDifficultyText(this.settings.difficulty)),e&&(e.textContent=`${Math.round(this.settings.soundVolume*100)}%`),n&&(n.textContent=`${this.settings.playerLives}`)}startGame(){var t;this.container.style.display="none",(t=this.onStart)==null||t.call(this,this.settings)}setOnStart(t){this.onStart=t}show(){this.container.style.display="flex"}hide(){this.container.style.display="none"}}class qm{constructor(){I(this,"container");I(this,"indicators",new Map);this.container=document.createElement("div"),this.container.id="enemy-indicators",this.container.style.cssText=`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 45;
    `,document.body.appendChild(this.container)}update(t){const e=new Set(t.map(n=>n.id));for(const[n,i]of this.indicators)e.has(n)||(i.remove(),this.indicators.delete(n));for(const n of t)n.inView?this.hideIndicator(n.id):this.showOrUpdateIndicator(n)}showOrUpdateIndicator(t){let e=this.indicators.get(t.id);e||(e=this.createIndicator(t.isTargeted),this.container.appendChild(e),this.indicators.set(t.id,e));const{position:n,rotation:i}=this.calculateIndicatorPosition(t.screenPos);e.style.left=`${n.x}px`,e.style.top=`${n.y}px`,e.style.transform=`translate(-50%, -50%) rotate(${i}deg)`;const r=e.querySelector(".distance-label");r&&(r.textContent=`${Math.round(t.distance)}m`),e.style.display="block"}createIndicator(t){const e=document.createElement("div");e.className="enemy-indicator";const n=t?"#ff0000":"#ff6600",i=t?"40px":"30px";e.style.cssText=`
      position: absolute;
      width: ${i};
      height: ${i};
      display: none;
    `;const r=document.createElement("div");r.innerHTML=`
      <svg width="${i}" height="${i}" viewBox="0 0 24 24" fill="${n}">
        <path d="M12 2 L22 12 L12 8 L2 12 Z" />
      </svg>
    `;const a=document.createElement("span");return a.className="distance-label",a.style.cssText=`
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      color: ${n};
      font-size: 12px;
      font-weight: bold;
      text-shadow: 1px 1px 2px black;
      white-space: nowrap;
    `,e.appendChild(r),e.appendChild(a),e}calculateIndicatorPosition(t){const n=window.innerWidth/2,i=window.innerHeight/2,r=t.x-n,a=t.y-i,c=Math.atan2(a,r)*180/Math.PI+90,l=Math.min(n,i)-50,h=Math.sqrt(r*r+a*a),u=Math.min(h,l),d=r/h,m=a/h;let g=n+d*u,_=i+m*u;return g=Math.max(50,Math.min(window.innerWidth-50,g)),_=Math.max(50,Math.min(window.innerHeight-50,_)),{position:{x:g,y:_},rotation:c}}hideIndicator(t){const e=this.indicators.get(t);e&&(e.style.display="none")}clear(){for(const t of this.indicators.values())t.remove();this.indicators.clear()}}class Ym{constructor(){I(this,"container");I(this,"lockBox");I(this,"lockProgress");I(this,"targetIndicator");I(this,"isLockingOn",!1);I(this,"currentTarget",null);I(this,"lockProgressValue",0);I(this,"lockTime",3);I(this,"lockBoxSize",.15);I(this,"maxLockDistance",150);this.container=document.createElement("div"),this.container.id="lock-on-indicator",this.container.style.cssText=`
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 40;
      display: none;
    `,this.lockBox=document.createElement("div"),this.lockBox.className="lock-box",this.updateLockBoxStyle(!1),this.lockProgress=document.createElement("div"),this.lockProgress.className="lock-progress",this.targetIndicator=document.createElement("div"),this.targetIndicator.className="target-indicator",this.targetIndicator.style.cssText=`
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 60px;
      height: 60px;
      border: 3px solid #00ff00;
      border-radius: 50%;
      display: none;
      box-shadow: 0 0 20px #00ff00, inset 0 0 20px rgba(0, 255, 0, 0.3);
      animation: pulse 0.5s ease-in-out infinite;
    `,this.container.appendChild(this.lockProgress),this.container.appendChild(this.lockBox),this.container.appendChild(this.targetIndicator),document.body.appendChild(this.container),this.addStyles()}addStyles(){const t=document.createElement("style");t.textContent=`
      @keyframes pulse {
        0%, 100% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
        50% {
          transform: translate(-50%, -50%) scale(1.1);
          opacity: 0.8;
        }
      }

      .lock-progress {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 0, 0.6);
        background: rgba(255, 255, 0, 0.1);
        transition: all 0.1s;
      }

      .lock-box {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border: 2px solid rgba(255, 255, 0, 0.8);
        background: rgba(255, 255, 0, 0.05);
        transition: all 0.2s;
      }
    `,document.head.appendChild(t)}updateLockBoxStyle(t){const e=this.getBoxSize(),n=t?"#00ff00":"rgba(255, 255, 0, 0.8)",i=t?"rgba(0, 255, 0, 0.2)":"rgba(255, 255, 0, 0.05)";this.lockBox.style.cssText=`
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: ${e}px;
      height: ${e}px;
      border: 2px solid ${n};
      background: ${i};
      transition: all 0.2s;
      box-shadow: ${t?"0 0 15px #00ff00":"none"};
    `}getBoxSize(){return Math.min(window.innerWidth,window.innerHeight)*this.lockBoxSize}startLockOn(){this.isLockingOn=!0,this.lockProgressValue=0,this.currentTarget=null,this.container.style.display="block",this.updateLockBoxStyle(!1),this.targetIndicator.style.display="none";const t=this.getBoxSize();this.lockProgress.style.cssText=`
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: ${t}px;
      height: ${t}px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 0, 0.6);
      background: rgba(255, 255, 0, 0.1);
    `}cancelLockOn(){this.isLockingOn=!1,this.currentTarget=null,this.lockProgressValue=0,this.container.style.display="none"}onMissileFired(){this.cancelLockOn()}update(t,e,n,i){if(!this.isLockingOn)return!1;let r=null,a=1/0;for(const o of e){const c=t.distanceTo(o.position);if(c>this.maxLockDistance)continue;const l=this.worldToScreen(o.position,n);this.isInLockBox(l)&&c<a&&(a=c,r=o)}if(r){this.currentTarget=r,this.lockProgressValue+=i/this.lockTime;const c=this.getBoxSize()*(1-this.lockProgressValue);if(this.lockProgress.style.width=`${c}px`,this.lockProgress.style.height=`${c}px`,this.lockProgressValue>=1)return this.lockProgressValue=1,this.onLockComplete(),!0}else this.currentTarget=null,this.lockProgressValue=Math.max(0,this.lockProgressValue-i*2);return!1}onLockComplete(){this.updateLockBoxStyle(!0),this.targetIndicator.style.display="block",this.lockBox.style.background="rgba(0, 255, 0, 0.3)",this.lockBox.style.boxShadow="0 0 20px #00ff00",this.lockProgress.style.opacity="0"}isInLockBox(t){const i=this.lockBoxSize/2;return t.x>=.5-i&&t.x<=.5+i&&t.y>=.5-i&&t.y<=.5+i}worldToScreen(t,e){const n=t.clone();return n.project(e),{x:(n.x+1)/2,y:(n.y+1)/2}}getCurrentTarget(){return this.lockProgressValue>=1?this.currentTarget:null}getLockProgress(){return this.lockProgressValue}isLocking(){return this.isLockingOn}dispose(){this.container.remove()}}var xs=(s=>(s.MENU="MENU",s.PLAYING="PLAYING",s.PAUSED="PAUSED",s.GAME_OVER="GAME_OVER",s))(xs||{});class $m{constructor(){I(this,"status","MENU");I(this,"score",0);I(this,"enemiesDestroyed",0)}setStatus(t){this.status=t}getStatus(){return this.status}addScore(t){this.score+=t}getScore(){return this.score}incrementEnemiesDestroyed(){this.enemiesDestroyed++}getEnemiesDestroyed(){return this.enemiesDestroyed}reset(){this.score=0,this.enemiesDestroyed=0,this.status="MENU"}}var li=(s=>(s.LAKE="LAKE",s.DESERT="DESERT",s.MOUNTAINS="MOUNTAINS",s.OCEAN="OCEAN",s.CITY="CITY",s))(li||{});const Km=[{id:1,name:"湖畔晨曦",description:"在宁静的湖面上空进行首次战斗",terrain:"LAKE",groundColor:2969622,waterColor:2003199,fogColor:11393254,skyColors:["#1e3c72","#2a5298","#87ceeb","#ffffff"],totalWaves:5,enemiesPerWave:[2,3,3,4,4],enemyTypes:[{type:"SCOUT",minWave:1,maxCount:2},{type:"FIGHTER",minWave:2,maxCount:2}],waveInterval:15,powerUpFrequency:.3,powerUpTypes:["HEALTH","SPEED","SHIELD"],difficulty:2},{id:2,name:"沙漠风暴",description:"在炎热的沙漠上空迎战敌人",terrain:"DESERT",groundColor:12759680,fogColor:16032864,skyColors:["#ff6b35","#ff8c42","#ffd166","#fff8dc"],totalWaves:6,enemiesPerWave:[3,3,4,4,5,5],enemyTypes:[{type:"SCOUT",minWave:1,maxCount:2},{type:"FIGHTER",minWave:1,maxCount:3},{type:"SNIPER",minWave:3,maxCount:1}],waveInterval:12,powerUpFrequency:.25,powerUpTypes:["HEALTH","DAMAGE","SPEED"],difficulty:4},{id:3,name:"雪山之巅",description:"在高耸的雪山上空进行艰苦战斗",terrain:"MOUNTAINS",groundColor:16777215,fogColor:14474460,skyColors:["#2c3e50","#4ca1af","#c4e0e5","#ffffff"],totalWaves:7,enemiesPerWave:[3,4,4,5,5,6,6],enemyTypes:[{type:"FIGHTER",minWave:1,maxCount:3},{type:"HEAVY",minWave:2,maxCount:2},{type:"SNIPER",minWave:3,maxCount:2}],waveInterval:10,powerUpFrequency:.35,powerUpTypes:["HEALTH","SHIELD","DAMAGE","SPEED"],difficulty:6},{id:4,name:"深海决战",description:"在广阔的海洋上空进行最终决战",terrain:"OCEAN",groundColor:139,waterColor:27028,fogColor:8900331,skyColors:["#0f0c29","#302b63","#24243e","#0f0c29"],totalWaves:8,enemiesPerWave:[4,4,5,5,6,6,7,8],enemyTypes:[{type:"FIGHTER",minWave:1,maxCount:4},{type:"HEAVY",minWave:2,maxCount:2},{type:"SNIPER",minWave:3,maxCount:2},{type:"ACE",minWave:5,maxCount:1}],waveInterval:8,powerUpFrequency:.4,powerUpTypes:["HEALTH","SHIELD","DAMAGE","SPEED","MULTISHOT"],difficulty:8},{id:5,name:"城市废墟",description:"在废弃的城市上空进行终极挑战",terrain:"CITY",groundColor:4013373,fogColor:6908265,skyColors:["#1a1a2e","#16213e","#0f3460","#533483"],totalWaves:10,enemiesPerWave:[4,5,5,6,6,7,7,8,8,10],enemyTypes:[{type:"SCOUT",minWave:1,maxCount:3},{type:"FIGHTER",minWave:1,maxCount:4},{type:"HEAVY",minWave:2,maxCount:3},{type:"SNIPER",minWave:3,maxCount:2},{type:"ACE",minWave:6,maxCount:2}],waveInterval:6,powerUpFrequency:.5,powerUpTypes:["HEALTH","SHIELD","DAMAGE","SPEED","MULTISHOT","BOMB"],difficulty:10}];function Zm(s){return Km.find(t=>t.id===s)}var Pe=(s=>(s.SCOUT="SCOUT",s.FIGHTER="FIGHTER",s.HEAVY="HEAVY",s.SNIPER="SNIPER",s.ACE="ACE",s))(Pe||{});const yc={SCOUT:{type:"SCOUT",name:"侦察机",health:30,speed:40,damage:10,detectionRange:120,attackRange:25,attackCooldown:2,evasionChance:.3,accuracy:.4,turnSpeed:1.5,maxRollAngle:Math.PI/4,wanderRadius:80,scoreValue:50,color:4521796,scale:.7},FIGHTER:{type:"FIGHTER",name:"战斗机",health:50,speed:30,damage:15,detectionRange:100,attackRange:30,attackCooldown:2.5,evasionChance:.15,accuracy:.5,turnSpeed:1,maxRollAngle:Math.PI/4,wanderRadius:60,scoreValue:100,color:16729156,scale:1},HEAVY:{type:"HEAVY",name:"重型轰炸机",health:150,speed:15,damage:30,detectionRange:80,attackRange:40,attackCooldown:4,evasionChance:.02,accuracy:.6,turnSpeed:.4,maxRollAngle:Math.PI/10,wanderRadius:40,scoreValue:200,color:8930304,scale:1.8},SNIPER:{type:"SNIPER",name:"狙击机",health:40,speed:20,damage:40,detectionRange:200,attackRange:80,attackCooldown:5,evasionChance:.2,accuracy:.7,turnSpeed:.8,maxRollAngle:Math.PI/8,wanderRadius:100,scoreValue:150,color:8913151,scale:.9},ACE:{type:"ACE",name:"王牌飞行员",health:80,speed:35,damage:25,detectionRange:150,attackRange:35,attackCooldown:2,evasionChance:.4,accuracy:.6,turnSpeed:2,maxRollAngle:Math.PI/3,wanderRadius:60,scoreValue:500,color:16768256,scale:1.2}};function Jm(s,t){const e=[];return s===1?t<=2?e.push("SCOUT"):e.push("SCOUT","FIGHTER"):s===2?(e.push("FIGHTER"),t>=2&&e.push("SNIPER"),t>=3&&e.push("SCOUT")):s===3?(e.push("FIGHTER","SNIPER"),t>=2&&e.push("HEAVY")):(e.push("FIGHTER","HEAVY"),t>=2&&e.push("ACE"),t>=3&&e.push("SNIPER")),e}function jm(s){const t=s.map(i=>1e3/yc[i].scoreValue),e=t.reduce((i,r)=>i+r,0);let n=Math.random()*e;for(let i=0;i<s.length;i++)if(n-=t[i],n<=0)return s[i];return s[0]}var vn=(s=>(s.PATROL="PATROL",s.PURSUIT="PURSUIT",s.ATTACK="ATTACK",s.EVADE="EVADE",s.CIRCLE="CIRCLE",s.DIVE="DIVE",s.RETREAT="RETREAT",s))(vn||{});class Qm{constructor(t){I(this,"currentState");I(this,"stateTime",0);I(this,"config");this.config=t,this.currentState="PATROL"}getState(){return this.currentState}getStateTime(){return this.stateTime}getConfig(){return this.config}update(t,e,n,i){switch(this.stateTime+=t,this.currentState){case"PATROL":this.updatePatrolState(e);break;case"PURSUIT":this.updatePursuitState(e,n,i);break;case"ATTACK":this.updateAttackState(e,n,i);break;case"EVADE":this.updateEvadeState();break;case"CIRCLE":this.updateCircleState(e);break;case"DIVE":this.updateDiveState(e);break;case"RETREAT":this.updateRetreatState(e);break}}updatePatrolState(t){t<this.config.detectionRange&&(this.config.type===Pe.SNIPER?this.transition("CIRCLE"):this.config.type===Pe.HEAVY?this.transition("ATTACK"):this.transition("PURSUIT"))}updatePursuitState(t,e,n){if(e<n*.3&&Math.random()<this.config.evasionChance){this.transition("EVADE");return}t<this.config.attackRange?this.config.type===Pe.ACE&&Math.random()<.3?this.transition("DIVE"):this.transition("ATTACK"):t>this.config.detectionRange*1.5?this.transition("PATROL"):this.config.type===Pe.SNIPER&&t<this.config.attackRange*.5&&this.transition("RETREAT")}updateAttackState(t,e,n){if(e<n*.4&&Math.random()<this.config.evasionChance){this.transition("EVADE");return}t>this.config.attackRange*1.3?this.transition("PURSUIT"):this.stateTime>5&&(this.config.type===Pe.ACE?this.transition(Math.random()<.5?"CIRCLE":"DIVE"):this.transition("PURSUIT"))}updateEvadeState(){this.stateTime>2&&(Math.random()<.6?this.transition("RETREAT"):this.transition("PURSUIT"))}updateCircleState(t){t>this.config.attackRange?this.transition("PURSUIT"):this.stateTime>8&&this.transition("ATTACK")}updateDiveState(t){(this.stateTime>2||t<10)&&this.transition("EVADE")}updateRetreatState(t){t>this.config.attackRange*.8&&this.transition("CIRCLE")}transition(t){this.currentState=t,this.stateTime=0}startEvade(){this.transition("EVADE")}}class tg{constructor(t,e){I(this,"mesh");I(this,"fsm");I(this,"health");I(this,"config");I(this,"patrolAngle");I(this,"circleAngle",0);I(this,"attackCooldown",0);I(this,"onFire");I(this,"onDestroy");this.mesh=t,this.config=e,this.fsm=new Qm(e),this.health=new Sc(e.health),this.patrolAngle=Math.random()*Math.PI*2,this.health.onDeath=()=>{var n;(n=this.onDestroy)==null||n.call(this,this.mesh.position.clone())}}update(t,e){const n=this.mesh.position.distanceTo(e);switch(this.fsm.update(t,n,this.health.getCurrentHealth(),this.health.getMaxHealth()),this.fsm.getState()){case vn.PATROL:this.updatePatrol(t);break;case vn.PURSUIT:this.updatePursuit(t,e);break;case vn.ATTACK:this.updateAttack(t,e);break;case vn.EVADE:this.updateEvade(t,e);break;case vn.CIRCLE:this.updateCircle(t,e);break;case vn.DIVE:this.updateDive(t,e);break;case vn.RETREAT:this.updateRetreat(t,e);break}this.attackCooldown=Math.max(0,this.attackCooldown-t)}updatePatrol(t){this.patrolAngle+=t*.2;const e=Math.cos(this.patrolAngle)*this.config.wanderRadius,n=Math.sin(this.patrolAngle)*this.config.wanderRadius,r=new C(e,this.mesh.position.y,n).clone().sub(this.mesh.position).normalize();this.mesh.position.addScaledVector(r,this.config.speed*.3*t);const a=new C(Math.cos(this.patrolAngle+.1)*this.config.wanderRadius,this.mesh.position.y,Math.sin(this.patrolAngle+.1)*this.config.wanderRadius);this.smoothLookAt(a,t)}updatePursuit(t,e){const i=e.clone().clone().sub(this.mesh.position).normalize();this.config.type===Pe.SCOUT?this.mesh.position.addScaledVector(i,this.config.speed*t):this.config.type===Pe.HEAVY?this.mesh.position.addScaledVector(i,this.config.speed*t):this.mesh.position.addScaledVector(i,this.config.speed*t),this.smoothLookAt(e,t)}updateAttack(t,e){var n;if(this.config.type===Pe.SNIPER)this.smoothLookAt(e,t*.5);else if(this.config.type===Pe.ACE){const i=Math.sin(this.fsm.getStateTime()*5)*.5;this.mesh.position.x+=i*t,this.smoothLookAt(e,t)}else this.smoothLookAt(e,t);if(this.attackCooldown<=0){const i=e.clone().sub(this.mesh.position),r=(1-this.config.accuracy)*Math.PI*.2;i.x+=(Math.random()-.5)*r,i.y+=(Math.random()-.5)*r,i.z+=(Math.random()-.5)*r,i.normalize(),(n=this.onFire)==null||n.call(this,this.mesh.position.clone(),i,this.config.damage),this.attackCooldown=this.config.attackCooldown}}updateEvade(t,e){const n=this.mesh.position.clone().sub(e).normalize();n.x+=(Math.random()-.5)*2,n.z+=(Math.random()-.5)*2,n.normalize(),this.mesh.position.addScaledVector(n,this.config.speed*1.5*t)}updateCircle(t,e){var c;this.circleAngle+=t*1.5;const n=this.config.attackRange*.7,i=e.x+Math.cos(this.circleAngle)*n,r=e.z+Math.sin(this.circleAngle)*n,o=new C(i,this.mesh.position.y,r).clone().sub(this.mesh.position).normalize();if(this.mesh.position.addScaledVector(o,this.config.speed*t),this.config.type===Pe.SNIPER&&this.attackCooldown<=0){const l=e.clone().sub(this.mesh.position).normalize();(c=this.onFire)==null||c.call(this,this.mesh.position.clone(),l,this.config.damage),this.attackCooldown=this.config.attackCooldown}}updateDive(t,e){var i;const n=e.clone().sub(this.mesh.position).normalize();this.mesh.position.addScaledVector(n,this.config.speed*2*t),this.smoothLookAt(e,t*2),this.attackCooldown<=0&&((i=this.onFire)==null||i.call(this,this.mesh.position.clone(),n,this.config.damage),this.attackCooldown=this.config.attackCooldown*.5)}updateRetreat(t,e){const n=this.mesh.position.clone().sub(e).normalize();this.mesh.position.addScaledVector(n,this.config.speed*.8*t)}smoothLookAt(t,e){if(t.clone().sub(this.mesh.position).length()<.1)return;const i=new Mi,r=new ee;r.lookAt(this.mesh.position,t,new C(0,1,0)),i.setFromRotationMatrix(r),this.mesh.quaternion.slerp(i,Math.min(1,this.config.turnSpeed*e))}takeDamage(t){this.health.takeDamage(t)}getPosition(){return this.mesh.position}getMesh(){return this.mesh}getConfig(){return this.config}isAlive(){return!this.health.isEntityDead()}reset(t){this.mesh.position.copy(t),this.health.reset(),this.attackCooldown=0,this.patrolAngle=Math.random()*Math.PI*2,this.mesh.visible=!0}}class eg{constructor(t){I(this,"scene");I(this,"terrainGroup");I(this,"waterMesh");I(this,"trees",[]);I(this,"clouds",[]);I(this,"grass",null);I(this,"rocks",[]);I(this,"time",0);this.scene=t,this.terrainGroup=new ge,this.terrainGroup.name="terrain",this.scene.add(this.terrainGroup)}generateTerrain(t){switch(this.clearTerrain(),this.createSky(t.skyColors),t.terrain){case li.LAKE:this.generateLakeTerrain(t);break;case li.DESERT:this.generateDesertTerrain(t);break;case li.MOUNTAINS:this.generateMountainTerrain(t);break;case li.OCEAN:this.generateOceanTerrain(t);break;case li.CITY:this.generateCityTerrain(t);break}this.createClouds(),this.scene.fog=new Fr(t.fogColor,8e-4)}generateLakeTerrain(t){const e=new Le(2e3,2e3,200,200),n=e.attributes.position;for(let a=0;a<n.count;a++){const o=n.getX(a),c=n.getY(a),l=Math.sin(o*.01)*Math.cos(c*.01)*8,h=Math.sin(o*.03+1)*Math.cos(c*.03)*3,u=Math.sin(o*.005)*Math.cos(c*.005)*15;n.setZ(a,l+h+u)}e.computeVertexNormals();const i=new Ut({color:t.groundColor,roughness:.9,metalness:0,flatShading:!1}),r=new ht(e,i);r.rotation.x=-Math.PI/2,r.position.y=-50,r.receiveShadow=!0,this.terrainGroup.add(r),this.createBeautifulLake(t),this.createForest(80,-49,1e3,200),this.createGrassField(500,1e5),this.createFlowers(300,2e4),this.createRocks(30)}createBeautifulLake(t){const e=new Bi,n=64;for(let u=0;u<=n;u++){const d=u/n*Math.PI*2,m=180+Math.sin(d*3)*20+Math.cos(d*5)*15,g=Math.cos(d)*m,_=Math.sin(d)*m;u===0?e.moveTo(g,_):e.lineTo(g,_)}const i=new bs(e,32),r=new Ut({color:t.waterColor||2003199,transparent:!0,opacity:.85,roughness:.1,metalness:.3}),a=new ht(i,r);a.rotation.x=-Math.PI/2,a.position.y=-48.5,this.terrainGroup.add(a),this.waterMesh=a;const o=new Bi;for(let u=0;u<=n;u++){const d=u/n*Math.PI*2,m=200+Math.sin(d*3)*20+Math.cos(d*5)*15,g=Math.cos(d)*m,_=Math.sin(d)*m;u===0?o.moveTo(g,_):o.lineTo(g,_)}o.holes.push(e);const c=new bs(o),l=new Ut({color:16049340,roughness:1,metalness:0}),h=new ht(c,l);h.rotation.x=-Math.PI/2,h.position.y=-48.8,h.receiveShadow=!0,this.terrainGroup.add(h)}createForest(t,e,n,i){const r=[{color:2263842,height:12,width:6},{color:3050327,height:18,width:5},{color:3329330,height:8,width:4},{color:25600,height:15,width:7}];for(let a=0;a<t;a++){const o=Math.random()*Math.PI*2,c=i+Math.random()*(n-i),l=Math.cos(o)*c,h=Math.sin(o)*c,u=r[Math.floor(Math.random()*r.length)],d=this.createBeautifulTree(u.color,u.height,u.width);d.position.set(l,e,h),d.scale.setScalar(.8+Math.random()*.6),d.rotation.y=Math.random()*Math.PI*2,this.terrainGroup.add(d),this.trees.push(d)}}createBeautifulTree(t,e,n){const i=new ge,r=new be(n*.08,n*.15,e*.4,8),a=new Ut({color:4863784,roughness:.9}),o=new ht(r,a);o.position.y=e*.2,o.castShadow=!0,i.add(o);const c=new Ut({color:t,roughness:.8}),l=new ht(new le(n*.8,e*.4,8),c);l.position.y=e*.5,l.castShadow=!0,i.add(l);const h=new ht(new le(n*.6,e*.35,8),c);h.position.y=e*.7,h.castShadow=!0,i.add(h);const u=new ht(new le(n*.4,e*.3,8),c);return u.position.y=e*.9,u.castShadow=!0,i.add(u),i}createGrassField(t,e){const n=new le(.1,.5,4),i=new Ut({color:8190976,roughness:.9});this.grass=new yo(n,i,e);const r=new he;for(let a=0;a<e;a++){const o=Math.random()*Math.PI*2,c=Math.random()*t;r.position.set(Math.cos(o)*c,-49.5,Math.sin(o)*c),r.rotation.set((Math.random()-.5)*.2,Math.random()*Math.PI*2,(Math.random()-.5)*.2),r.scale.setScalar(.5+Math.random()*1),r.updateMatrix(),this.grass.setMatrixAt(a,r.matrix)}this.grass.instanceMatrix.needsUpdate=!0,this.terrainGroup.add(this.grass)}createFlowers(t,e){const n=[16738740,16766720,16737095,9662683,52945],i=new De(.15,8,8);n.forEach(r=>{const a=new Ut({color:r,emissive:r,emissiveIntensity:.1}),o=new yo(i,a,Math.floor(e/n.length)),c=new he;for(let l=0;l<Math.floor(e/n.length);l++){const h=Math.random()*Math.PI*2,u=Math.random()*t;c.position.set(Math.cos(h)*u,-49.3,Math.sin(h)*u),c.scale.setScalar(.8+Math.random()*.4),c.updateMatrix(),o.setMatrixAt(l,c.matrix)}o.instanceMatrix.needsUpdate=!0,this.terrainGroup.add(o)})}createRocks(t){for(let e=0;e<t;e++){const n=new Hr(1+Math.random()*2,0),i=n.attributes.position;for(let o=0;o<i.count;o++)i.setX(o,i.getX(o)*(.8+Math.random()*.4)),i.setY(o,i.getY(o)*(.6+Math.random()*.8)),i.setZ(o,i.getZ(o)*(.8+Math.random()*.4));n.computeVertexNormals();const r=new Ut({color:new Ft().setHSL(0,0,.3+Math.random()*.2),roughness:.9,metalness:.1}),a=new ht(n,r);a.position.set((Math.random()-.5)*1500,-49,(Math.random()-.5)*1500),a.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI),a.castShadow=!0,a.receiveShadow=!0,this.terrainGroup.add(a),this.rocks.push(a)}}generateDesertTerrain(t){const e=new Le(2e3,2e3,150,150),n=e.attributes.position;for(let a=0;a<n.count;a++){const o=n.getX(a),c=n.getY(a),l=Math.sin(o*.008+c*.003)*8,h=Math.sin(o*.015)*Math.cos(c*.012)*5,u=Math.sin(o*.004+c*.006)*12;n.setZ(a,Math.max(0,l+h+u))}e.computeVertexNormals();const i=new Ut({color:t.groundColor,roughness:1,metalness:0}),r=new ht(e,i);r.rotation.x=-Math.PI/2,r.position.y=-50,r.receiveShadow=!0,this.terrainGroup.add(r),this.createCacti(50),this.createRocks(20),this.createDeadTrees(15)}createCacti(t){for(let e=0;e<t;e++){const n=(Math.random()-.5)*1500,i=(Math.random()-.5)*1500,r=this.createBeautifulCactus();r.position.set(n,-50,i),r.scale.setScalar(.5+Math.random()*1),r.rotation.y=Math.random()*Math.PI*2,this.terrainGroup.add(r)}}createBeautifulCactus(){const t=new ge,e=new Ut({color:2972199,roughness:.8}),n=6+Math.random()*4,i=new ht(new be(.8,1.2,n,8),e);i.position.y=n/2,i.castShadow=!0,t.add(i);const r=Math.floor(Math.random()*3)+1;for(let a=0;a<r;a++){const o=Math.random()>.5?1:-1,c=n*(.3+Math.random()*.4),l=new ht(new be(.4,.5,2+Math.random()*2,8),e);l.rotation.z=Math.PI/2*o,l.position.set(o*1.5,c,0),l.castShadow=!0,t.add(l);const h=new ht(new be(.3,.4,2+Math.random()*2,8),e);h.position.set(o*2.5,c+1,0),h.castShadow=!0,t.add(h)}if(Math.random()>.6){const a=new ht(new De(.3,8,8),new Ut({color:16738740,emissive:16738740,emissiveIntensity:.2}));a.position.y=n+.3,t.add(a)}return t}createDeadTrees(t){for(let e=0;e<t;e++){const n=(Math.random()-.5)*1500,i=(Math.random()-.5)*1500,r=new ge,a=new Ut({color:4865066,roughness:1}),o=new ht(new be(.3,.5,5+Math.random()*3,6),a);o.position.y=2.5,o.rotation.set((Math.random()-.5)*.3,0,(Math.random()-.5)*.3),o.castShadow=!0,r.add(o);for(let c=0;c<3;c++){const l=new ht(new be(.1,.15,2+Math.random(),6),a);l.position.set((Math.random()-.5)*.5,3+c*1.2,(Math.random()-.5)*.5),l.rotation.set((Math.random()-.5)*1,Math.random()*Math.PI*2,(Math.random()-.5)*1),l.castShadow=!0,r.add(l)}r.position.set(n,-50,i),r.scale.setScalar(.5+Math.random()*.5),this.terrainGroup.add(r)}}generateMountainTerrain(t){const e=new Le(2e3,2e3,150,150),n=e.attributes.position;for(let a=0;a<n.count;a++){const o=n.getX(a),c=n.getY(a),l=Math.sin(o*.02)*Math.cos(c*.02)*40,h=Math.sin(o*.035)*Math.cos(c*.03)*20,u=Math.sin(o*.1)*Math.cos(c*.1)*5;n.setZ(a,Math.max(0,l+h+u))}e.computeVertexNormals();const i=new Ut({color:t.groundColor,roughness:.8,metalness:0}),r=new ht(e,i);r.rotation.x=-Math.PI/2,r.position.y=-50,r.receiveShadow=!0,this.terrainGroup.add(r),this.createBeautifulMountains(20),this.createPineForest(60,-50,800,200)}createBeautifulMountains(t){for(let e=0;e<t;e++){const n=e/t*Math.PI*2+Math.random()*.5,i=400+Math.random()*400,r=Math.cos(n)*i,a=Math.sin(n)*i,o=new ge,c=60+Math.random()*60,l=30+Math.random()*20,h=new Ut({color:6908265,roughness:.9,flatShading:!0}),u=new ht(new le(l,c,6+Math.floor(Math.random()*3)),h);u.position.y=c/2,u.castShadow=!0,o.add(u);const d=new Ut({color:16777215,roughness:.5}),m=new ht(new le(l*.5,c*.35,6),d);m.position.y=c*.7,o.add(m),o.position.set(r,-50,a),o.rotation.y=Math.random()*Math.PI*2,this.terrainGroup.add(o)}}createPineForest(t,e,n,i){for(let r=0;r<t;r++){const a=Math.random()*Math.PI*2,o=i+Math.random()*(n-i),c=Math.cos(a)*o,l=Math.sin(a)*o,h=this.createPineTree();h.position.set(c,e,l),h.scale.setScalar(.6+Math.random()*.8),this.terrainGroup.add(h),this.trees.push(h)}}createPineTree(){const t=new ge,e=new ht(new be(.2,.4,3,8),new Ut({color:4863784}));e.position.y=1.5,e.castShadow=!0,t.add(e);const n=new Ut({color:1722154,roughness:.8});for(let i=0;i<5;i++){const r=new ht(new le(2-i*.3,2.5-i*.3,8),n);r.position.y=3+i*1.5,r.castShadow=!0,t.add(r)}if(Math.random()>.5){const i=new ht(new le(.3,1,8),new Ut({color:16777215}));i.position.y=10,t.add(i)}return t}generateOceanTerrain(t){const e=new Le(3e3,3e3,200,200),n=e.attributes.position;for(let a=0;a<n.count;a++){const o=n.getX(a),c=n.getY(a),l=Math.sin(o*.05)*Math.cos(c*.05)*2;n.setZ(a,l)}e.computeVertexNormals();const i=new Ut({color:t.waterColor||27028,transparent:!0,opacity:.9,roughness:.1,metalness:.3}),r=new ht(e,i);r.rotation.x=-Math.PI/2,r.position.y=-50,this.terrainGroup.add(r),this.waterMesh=r,this.createTropicalIslands(10),this.createPalmTrees(40)}createTropicalIslands(t){for(let e=0;e<t;e++){const n=(Math.random()-.5)*2e3,i=(Math.random()-.5)*2e3,r=new ge,a=15+Math.random()*25,o=new ht(new le(a,a*.5,8),new Ut({color:12759680,roughness:1}));o.position.y=-47,r.add(o);const c=new ht(new be(a*1.3,a*1.5,2,16),new Ut({color:16049340,roughness:1}));c.position.y=-48,r.add(c);const l=new ht(new le(a*.8,a*.4,8),new Ut({color:2263842}));l.position.y=-46,r.add(l),r.position.set(n,0,i),this.terrainGroup.add(r)}}createPalmTrees(t){for(let e=0;e<t;e++){const n=(Math.random()-.5)*1800,i=(Math.random()-.5)*1800,r=this.createBeautifulPalmTree();r.position.set(n,-48,i),r.scale.setScalar(.5+Math.random()*.5),r.rotation.y=Math.random()*Math.PI*2,this.terrainGroup.add(r),this.trees.push(r)}}createBeautifulPalmTree(){const t=new ge,e=new Ut({color:9127187,roughness:.9}),n=new ht(new be(.2,.4,8,8),e);n.rotation.set((Math.random()-.5)*.3,0,(Math.random()-.5)*.3),n.position.y=4,n.castShadow=!0,t.add(n);const i=new Ut({color:2263842,side:Ze});for(let r=0;r<8;r++){const a=new ht(new Le(.8,6),i);a.position.set(0,8,0),a.rotation.set(Math.PI/4,r/8*Math.PI*2,0),t.add(a)}for(let r=0;r<3;r++){const a=new ht(new De(.3,8,8),new Ut({color:6636321}));a.position.set((Math.random()-.5)*.5,7.5,(Math.random()-.5)*.5),t.add(a)}return t}generateCityTerrain(t){const e=new Le(2e3,2e3),n=new Ut({color:t.groundColor,roughness:.7,metalness:0}),i=new ht(e,n);i.rotation.x=-Math.PI/2,i.position.y=-50,i.receiveShadow=!0,this.terrainGroup.add(i),this.createRoads(),this.createBuildings(120)}createRoads(){const t=new Ut({color:3355443,roughness:.9});for(let e=-3;e<=3;e++){const n=new ht(new Le(2e3,20),t);n.rotation.x=-Math.PI/2,n.position.set(0,-49.9,e*250),this.terrainGroup.add(n);const i=new Ut({color:16777215});for(let r=-20;r<=20;r++){const a=new ht(new Le(15,1),i);a.rotation.x=-Math.PI/2,a.position.set(r*50,-49.8,e*250),this.terrainGroup.add(a)}}for(let e=-3;e<=3;e++){const n=new ht(new Le(20,2e3),t);n.rotation.x=-Math.PI/2,n.position.set(e*250,-49.9,0),this.terrainGroup.add(n)}}createBuildings(t){for(let e=0;e<t;e++){const n=Math.floor((Math.random()-.5)*6),i=Math.floor((Math.random()-.5)*6),r=n*250+(Math.random()-.5)*200,a=i*250+(Math.random()-.5)*200,o=this.createBeautifulBuilding();o.position.set(r,-50,a),this.terrainGroup.add(o)}}createBeautifulBuilding(){const t=new ge,e=15+Math.random()*60,n=8+Math.random()*15,i=8+Math.random()*15,r=new Ut({color:new Ft().setHSL(Math.random()*.1+.55,.1+Math.random()*.1,.2+Math.random()*.3),roughness:.5,metalness:.3}),a=new ht(new Ce(n,e,i),r);a.position.y=e/2,a.castShadow=!0,a.receiveShadow=!0,t.add(a);const o=new Ut({color:16777113,emissive:16776960,emissiveIntensity:.3}),c=1.5,l=4;for(let h=3;h<e-3;h+=l)for(let u=0;u<4;u++){const d=new ht(new Le(c,c*1.5),o),m=u/4*Math.PI*2,g=(u%2===0?n:i)/2+.1;d.position.set(Math.cos(m)*g*.7,h,Math.sin(m)*g*.7),d.rotation.y=-m+Math.PI/2,t.add(d)}if(Math.random()>.5){const h=new ht(new Ce(n*.3,3,i*.3),r);h.position.y=e+1.5,t.add(h)}if(Math.random()>.7){const h=new ht(new be(.1,.1,5,8),new Ut({color:8947848}));h.position.y=e+2.5,t.add(h)}return t}createSky(t){const e=document.createElement("canvas");e.width=2,e.height=512;const n=e.getContext("2d"),i=n.createLinearGradient(0,0,0,512);i.addColorStop(0,t[0]),i.addColorStop(.3,t[1]),i.addColorStop(.6,t[2]),i.addColorStop(1,t[3]),n.fillStyle=i,n.fillRect(0,0,2,512);const r=new fc(e);this.scene.background=r}createClouds(){for(let t=0;t<30;t++){const e=this.createFluffyCloud();e.position.set((Math.random()-.5)*2e3,80+Math.random()*150,(Math.random()-.5)*2e3),e.scale.setScalar(8+Math.random()*15),this.terrainGroup.add(e),this.clouds.push(e)}}createFluffyCloud(){const t=new ge,e=new Ut({color:16777215,transparent:!0,opacity:.9}),n=5+Math.floor(Math.random()*4);for(let i=0;i<n;i++){const r=.5+Math.random()*.5,a=new ht(new De(r,12,12),e);a.position.set((Math.random()-.5)*2,(Math.random()-.5)*.5,(Math.random()-.5)*1.5),t.add(a)}return t}update(t){if(this.time+=t,this.waterMesh){const e=this.waterMesh.geometry.attributes.position;for(let n=0;n<e.count;n++){const i=e.getX(n),r=e.getY(n),a=Math.sin(i*.05+this.time)*Math.cos(r*.05+this.time*.7)*2;e.setZ(n,a)}e.needsUpdate=!0}for(const e of this.clouds)e.position.x+=t*3,e.position.x>1200&&(e.position.x=-1200)}clearTerrain(){for(;this.terrainGroup.children.length>0;){const t=this.terrainGroup.children[0];this.terrainGroup.remove(t),t instanceof ht&&(t.geometry.dispose(),Array.isArray(t.material)?t.material.forEach(e=>e.dispose()):t.material.dispose())}this.trees=[],this.clouds=[],this.waterMesh=void 0,this.grass=null,this.rocks=[]}}class ng{constructor(t){I(this,"scene");I(this,"terrainGenerator");I(this,"currentLevel",null);I(this,"currentWave",0);I(this,"state","IDLE");I(this,"enemies",[]);I(this,"enemyPool",[]);I(this,"enemiesSpawnedThisWave",0);I(this,"enemiesKilledThisWave",0);I(this,"spawnTimer",0);I(this,"spawnInterval",3);I(this,"onWaveStart");I(this,"onWaveComplete");I(this,"onLevelComplete");I(this,"onEnemySpawned");I(this,"onEnemyKilled");I(this,"onAllEnemiesCleared");this.scene=t,this.terrainGenerator=new eg(t)}loadLevel(t){const e=Zm(t);if(!e){console.error(`Level ${t} not found`);return}this.currentLevel=e,this.currentWave=0,this.state="IDLE",this.enemiesSpawnedThisWave=0,this.enemiesKilledThisWave=0,this.terrainGenerator.generateTerrain(e),console.log(`Loaded level ${t}: ${e.name}`)}startWave(){var t;if(this.currentLevel){if(this.currentWave>=this.currentLevel.totalWaves){this.completeLevel();return}this.currentWave++,this.enemiesSpawnedThisWave=0,this.enemiesKilledThisWave=0,this.state="WAVE_ACTIVE",this.spawnTimer=0,(t=this.onWaveStart)==null||t.call(this,this.currentWave),console.log(`Wave ${this.currentWave} started`)}}update(t,e){if(this.terrainGenerator.update(t),this.state!=="WAVE_ACTIVE")return;for(const r of this.enemies)r.isAlive()&&r.update(t,e);this.spawnTimer+=t;const n=this.currentLevel.enemiesPerWave[this.currentWave-1]||3;this.spawnTimer>=this.spawnInterval&&this.enemiesSpawnedThisWave<n&&(this.spawnEnemy(e),this.spawnTimer=0);const i=this.enemies.filter(r=>r.isAlive());this.enemiesSpawnedThisWave>=n&&i.length===0&&this.completeWave()}spawnEnemy(t){var a;if(!this.currentLevel)return;const e=Jm(this.currentLevel.id,this.currentWave),n=jm(e),i=this.getOrCreateEnemy(n),r=this.getSpawnPosition(t);i.reset(r),this.enemiesSpawnedThisWave++,(a=this.onEnemySpawned)==null||a.call(this,i)}getSpawnPosition(t){let a=null,o=0;for(let c=0;c<20;c++){const l=this.enemiesSpawnedThisWave*137.5%360,h=(Math.random()-.5)*60,u=Vl.degToRad(l+h),d=120+Math.random()*130,m=(Math.random()-.5)*30,g=new C(t.x+Math.cos(u)*d,m,t.z+Math.sin(u)*d);let _=1/0;for(const p of this.enemies)if(p.isAlive()){const f=g.distanceTo(p.getPosition());_=Math.min(_,f)}if((_===1/0||_>o)&&(o=_,a=g,_>=40))break}return a||new C(t.x+(Math.random()-.5)*200,0,t.z+(Math.random()-.5)*200)}getOrCreateEnemy(t){const e=this.enemyPool.findIndex(a=>a.getConfig().type===t);if(e!==-1){const a=this.enemyPool.splice(e,1)[0];return this.enemies.push(a),a}const n=yc[t],i=this.createEnemyMesh(n);this.scene.add(i);const r=new tg(i,n);return r.onDestroy=()=>{var o;(o=this.onEnemyKilled)==null||o.call(this,r),this.enemiesKilledThisWave++;const a=this.enemies.indexOf(r);a!==-1&&(this.enemies.splice(a,1),this.enemyPool.push(r))},this.enemies.push(r),r}createEnemyMesh(t){const e=new ge,n=t.scale;switch(t.type){case Pe.SCOUT:this.addScoutMesh(e,t.color,n);break;case Pe.HEAVY:this.addHeavyMesh(e,t.color,n);break;case Pe.SNIPER:this.addSniperMesh(e,t.color,n);break;case Pe.ACE:this.addAceMesh(e,t.color,n);break;default:this.addFighterMesh(e,t.color,n)}return e}addScoutMesh(t,e,n){const i=new Ut({color:e,metalness:.5,roughness:.3}),r=new ht(new le(.3*n,3*n,8),i);r.rotation.x=Math.PI/2,t.add(r);const a=new ht(new Ce(3*n,.05*n,.5*n),i);a.position.z=.3*n,t.add(a)}addHeavyMesh(t,e,n){const i=new Ut({color:e,metalness:.3,roughness:.5}),r=new ht(new be(.8*n,1*n,4*n,8),i);r.rotation.x=Math.PI/2,t.add(r);const a=new ht(new Ce(8*n,.1*n,2*n),i);a.position.z=.5*n,t.add(a);for(let o=-1;o<=1;o+=2)for(let c=-1;c<=1;c+=2){const l=new ht(new be(.2*n,.2*n,1*n,8),i);l.position.set(o*2*n,0,c*.5*n),l.rotation.x=Math.PI/2,t.add(l)}}addSniperMesh(t,e,n){const i=new Ut({color:e,metalness:.7,roughness:.2}),r=new ht(new le(.4*n,4*n,8),i);r.rotation.x=Math.PI/2,t.add(r);const a=new ht(new Ce(2*n,.05*n,1*n),i);a.position.set(-1.2*n,0,.5*n),a.rotation.z=-.2,t.add(a);const o=a.clone();o.position.x=1.2*n,o.rotation.z=.2,t.add(o)}addAceMesh(t,e,n){const i=new Ut({color:e,metalness:.8,roughness:.1}),r=new ht(new le(.5*n,3.5*n,12),i);r.rotation.x=Math.PI/2,t.add(r);const a=new Ne,o=new Float32Array([0,0,0,-3*n,0,1.5*n,0,0,1*n,3*n,0,1.5*n]);a.setAttribute("position",new Xe(o,3)),a.setIndex([0,1,2,0,2,3]);const c=new ht(a,i);t.add(c);for(let l=-1;l<=1;l+=2){const h=new ht(new Ce(.05*n,.8*n,.5*n),i);h.position.set(l*.3*n,.4*n,1.5*n),t.add(h)}}addFighterMesh(t,e,n){const i=new Ut({color:e,metalness:.5,roughness:.3}),r=new ht(new le(.4*n,2.5*n,8),i);r.rotation.x=Math.PI/2,t.add(r);const a=new ht(new Ce(3*n,.08*n,.8*n),i);a.position.z=.3*n,t.add(a);const o=new ht(new Ce(1.5*n,.08*n,.5*n),i);o.position.z=1.2*n,t.add(o)}completeWave(){var t;this.state="WAVE_COMPLETE",(t=this.onWaveComplete)==null||t.call(this,this.currentWave),console.log(`Wave ${this.currentWave} complete!`),this.currentWave>=this.currentLevel.totalWaves&&this.completeLevel()}completeLevel(){var t;this.state="LEVEL_COMPLETE",(t=this.onLevelComplete)==null||t.call(this,this.currentLevel.id),console.log(`Level ${this.currentLevel.id} complete!`)}getCurrentLevel(){return this.currentLevel}getCurrentWave(){return this.currentWave}getState(){return this.state}getAliveEnemyCount(){return this.enemies.filter(t=>t.isAlive()).length}getEnemies(){return this.enemies}clear(){for(const t of this.enemies)this.scene.remove(t.getMesh());for(const t of this.enemyPool)this.scene.remove(t.getMesh());this.enemies=[],this.enemyPool=[],this.state="IDLE"}}class ig{constructor(t){I(this,"scene");I(this,"particles",[]);I(this,"particleMeshes");I(this,"maxParticles");I(this,"geometries",new Map);I(this,"materials",new Map);this.scene=t,this.particleMeshes=new ge,this.particleMeshes.name="particles",this.scene.add(this.particleMeshes),this.maxParticles=en.isMobile?200:500,this.initAssets()}initAssets(){this.geometries.set("EXPLOSION",new De(.5,8,8)),this.materials.set("EXPLOSION",new ze({color:16737792,transparent:!0,opacity:1})),this.geometries.set("SMOKE",new De(1,8,8)),this.materials.set("SMOKE",new ze({color:8947848,transparent:!0,opacity:.6})),this.geometries.set("SPARK",new De(.1,4,4)),this.materials.set("SPARK",new ze({color:16776960,transparent:!0,opacity:1})),this.geometries.set("FIRE",new De(.3,8,8)),this.materials.set("FIRE",new ze({color:16729088,transparent:!0,opacity:.9})),this.geometries.set("DEBRIS",new Ce(.3,.3,.3)),this.materials.set("DEBRIS",new ze({color:6710886}))}createExplosion(t,e=1){const n=Math.floor(30*e);for(let i=0;i<n*.4;i++)this.spawnParticle("FIRE",t.clone(),{speed:20*e,life:.3+Math.random()*.3,size:.5+Math.random()*1.5,color:new Ft().setHSL(.05+Math.random()*.1,1,.5)});for(let i=0;i<n*.3;i++)this.spawnParticle("EXPLOSION",t.clone(),{speed:30*e,life:.2+Math.random()*.4,size:.3+Math.random()*1,color:new Ft().setHSL(.08,1,.6)});for(let i=0;i<n*.2;i++)this.spawnParticle("SPARK",t.clone(),{speed:50*e,life:.5+Math.random()*.5,size:.1+Math.random()*.2,color:new Ft(16776960)});for(let i=0;i<n*.1;i++)this.spawnParticle("DEBRIS",t.clone(),{speed:15*e,life:1+Math.random()*1,size:.2+Math.random()*.3,color:new Ft(6710886),gravity:!0});setTimeout(()=>{for(let i=0;i<n*.3;i++)this.spawnParticle("SMOKE",t.clone(),{speed:5*e,life:2+Math.random()*2,size:2+Math.random()*3,color:new Ft().setHSL(0,0,.3+Math.random()*.3)})},100)}createHit(t){for(let e=0;e<10;e++)this.spawnParticle("SPARK",t.clone(),{speed:20,life:.2+Math.random()*.3,size:.1+Math.random()*.2,color:new Ft(16755200)})}createTrail(t,e){this.spawnParticle("SMOKE",t.clone(),{speed:2,life:.3,size:.3,color:e.clone()})}spawnParticle(t,e,n){if(this.particles.length>=this.maxParticles){const u=this.particles.shift();u!=null&&u.mesh&&this.particleMeshes.remove(u.mesh)}const r=new C((Math.random()-.5)*2,(Math.random()-.5)*2,(Math.random()-.5)*2).normalize().multiplyScalar(n.speed),a=this.geometries.get(t),o=this.materials.get(t);if(!a||!o)return;const c=o.clone();c.color=n.color;const l=new ht(a,c);l.position.copy(e),l.scale.setScalar(n.size),this.particleMeshes.add(l);const h={position:e.clone(),velocity:r,life:n.life,maxLife:n.life,size:n.size,color:n.color,type:t,mesh:l,active:!0};this.particles.push(h)}update(t){const e=new C(0,-9.8,0);for(let n=this.particles.length-1;n>=0;n--){const i=this.particles[n];if(i.active){if(i.life-=t,i.life<=0){i.mesh&&(this.particleMeshes.remove(i.mesh),i.mesh.geometry.dispose(),i.mesh.material.dispose()),this.particles.splice(n,1);continue}if(i.velocity.add(e.clone().multiplyScalar(t*.3)),i.position.add(i.velocity.clone().multiplyScalar(t)),i.mesh){i.mesh.position.copy(i.position);const r=i.life/i.maxLife,a=i.mesh.material;if(a.opacity=r,i.type==="SMOKE"){const o=i.size*(1+(1-r)*2);i.mesh.scale.setScalar(o)}i.type==="DEBRIS"&&(i.mesh.rotation.x+=t*5,i.mesh.rotation.y+=t*3)}}}}clear(){for(const t of this.particles)t.mesh&&(this.particleMeshes.remove(t.mesh),t.mesh.geometry.dispose(),t.mesh.material.dispose());this.particles=[]}getActiveCount(){return this.particles.length}}class sg{constructor(){I(this,"context",null);I(this,"masterVolume",null);I(this,"engineOscillator",null);I(this,"engineGain",null);I(this,"isEnginePlaying",!1);I(this,"masterVolumeValue",.5);I(this,"sfxVolume",.7)}initContext(){if(!this.context)try{this.context=new(window.AudioContext||window.webkitAudioContext),this.masterVolume=this.context.createGain(),this.masterVolume.gain.value=this.masterVolumeValue,this.masterVolume.connect(this.context.destination)}catch{console.warn("Web Audio API not supported")}}resume(){var t;this.initContext(),((t=this.context)==null?void 0:t.state)==="suspended"&&this.context.resume()}startEngine(){if(this.initContext(),!(!this.context||!this.masterVolume||this.isEnginePlaying))try{this.engineOscillator=this.context.createOscillator(),this.engineGain=this.context.createGain(),this.engineOscillator.type="sawtooth",this.engineOscillator.frequency.value=80,this.engineGain.gain.value=.05*this.sfxVolume;const t=this.context.createBiquadFilter();t.type="lowpass",t.frequency.value=500,this.engineOscillator.connect(t),t.connect(this.engineGain),this.engineGain.connect(this.masterVolume),this.engineOscillator.start(),this.isEnginePlaying=!0}catch{console.warn("Failed to start engine sound")}}updateEngine(t){var o,c;if(!this.engineOscillator||!this.engineGain)return;const e=60,n=150,i=Math.min(t/100,1),r=e+(n-e)*i;this.engineOscillator.frequency.setValueAtTime(r,((o=this.context)==null?void 0:o.currentTime)||0);const a=.03+i*.04;this.engineGain.gain.setValueAtTime(a*this.sfxVolume,((c=this.context)==null?void 0:c.currentTime)||0)}stopEngine(){this.engineOscillator&&(this.engineOscillator.stop(),this.engineOscillator=null),this.isEnginePlaying=!1}playShoot(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="square",e.frequency.setValueAtTime(800,t),e.frequency.exponentialRampToValueAtTime(200,t+.1),n.gain.setValueAtTime(.2*this.sfxVolume,t),n.gain.exponentialRampToValueAtTime(.01,t+.1),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.1),this.playNoise(.05,.1,.1*this.sfxVolume)}catch{}}playExplosion(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="sine",e.frequency.setValueAtTime(150,t),e.frequency.exponentialRampToValueAtTime(20,t+.5),n.gain.setValueAtTime(.5*this.sfxVolume,t),n.gain.exponentialRampToValueAtTime(.01,t+.5),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.5),this.playNoise(.3,.5,.3*this.sfxVolume)}catch{}}playHit(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="triangle",e.frequency.setValueAtTime(400,t),e.frequency.exponentialRampToValueAtTime(100,t+.1),n.gain.setValueAtTime(.15*this.sfxVolume,t),n.gain.exponentialRampToValueAtTime(.01,t+.1),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.1)}catch{}}playPowerUp(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime;[523.25,659.25,783.99,1046.5].forEach((n,i)=>{const r=this.context.createOscillator(),a=this.context.createGain();r.type="sine",r.frequency.value=n;const o=t+i*.08;a.gain.setValueAtTime(0,o),a.gain.linearRampToValueAtTime(.15*this.sfxVolume,o+.02),a.gain.exponentialRampToValueAtTime(.01,o+.15),r.connect(a),a.connect(this.masterVolume),r.start(o),r.stop(o+.15)})}catch{}}playLevelUp(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime;[392,523.25,659.25,783.99].forEach((n,i)=>{const r=this.context.createOscillator(),a=this.context.createGain();r.type="triangle",r.frequency.value=n;const o=t+i*.1;a.gain.setValueAtTime(0,o),a.gain.linearRampToValueAtTime(.2*this.sfxVolume,o+.05),a.gain.exponentialRampToValueAtTime(.01,o+.3),r.connect(a),a.connect(this.masterVolume),r.start(o),r.stop(o+.3)})}catch{}}playWaveStart(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime;for(let e=0;e<3;e++){const n=this.context.createOscillator(),i=this.context.createGain();n.type="square",n.frequency.value=440;const r=t+e*.15;i.gain.setValueAtTime(.1*this.sfxVolume,r),i.gain.setValueAtTime(0,r+.1),n.connect(i),i.connect(this.masterVolume),n.start(r),n.stop(r+.1)}}catch{}}playGameOver(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime;[392,349.23,329.63,293.66].forEach((n,i)=>{const r=this.context.createOscillator(),a=this.context.createGain();r.type="triangle",r.frequency.value=n;const o=t+i*.2;a.gain.setValueAtTime(.15*this.sfxVolume,o),a.gain.exponentialRampToValueAtTime(.01,o+.4),r.connect(a),a.connect(this.masterVolume),r.start(o),r.stop(o+.4)})}catch{}}playNoise(t,e,n){if(!(!this.context||!this.masterVolume))try{const i=this.context.sampleRate*t,r=this.context.createBuffer(1,i,this.context.sampleRate),a=r.getChannelData(0);for(let h=0;h<i;h++)a[h]=Math.random()*2-1;const o=this.context.createBufferSource();o.buffer=r;const c=this.context.createGain(),l=this.context.currentTime;c.gain.setValueAtTime(0,l),c.gain.linearRampToValueAtTime(n,l+e),c.gain.exponentialRampToValueAtTime(.01,l+t),o.connect(c),c.connect(this.masterVolume),o.start(l)}catch{}}setMasterVolume(t){this.masterVolumeValue=Math.max(0,Math.min(1,t)),this.masterVolume&&(this.masterVolume.gain.value=this.masterVolumeValue)}setSFXVolume(t){this.sfxVolume=Math.max(0,Math.min(1,t))}mute(){this.masterVolume&&(this.masterVolume.gain.value=0)}unmute(){this.masterVolume&&(this.masterVolume.gain.value=this.masterVolumeValue)}}var xn=(s=>(s.HEALTH="HEALTH",s.SHIELD="SHIELD",s.SPEED="SPEED",s.DAMAGE="DAMAGE",s.MULTISHOT="MULTISHOT",s.BOMB="BOMB",s))(xn||{});const rg={HEALTH:{type:"HEALTH",name:"生命恢复",description:"恢复 30 点生命值",color:65280,duration:0,value:30,icon:"❤️"},SHIELD:{type:"SHIELD",name:"能量护盾",description:"获得 10 秒无敌护盾",color:65535,duration:10,value:1,icon:"🛡️"},SPEED:{type:"SPEED",name:"速度提升",description:"速度提升 50%，持续 15 秒",color:16776960,duration:15,value:1.5,icon:"⚡"},DAMAGE:{type:"DAMAGE",name:"伤害提升",description:"伤害提升 100%，持续 20 秒",color:16729156,duration:20,value:2,icon:"🔥"},MULTISHOT:{type:"MULTISHOT",name:"多重射击",description:"同时发射 3 发子弹，持续 12 秒",color:16711935,duration:12,value:3,icon:"🎯"},BOMB:{type:"BOMB",name:"清屏炸弹",description:"消灭屏幕上所有敌人",color:16746496,duration:0,value:1,icon:"💣"}};class ag{constructor(t,e){I(this,"mesh");I(this,"config");I(this,"rotationSpeed",2);I(this,"bobSpeed",3);I(this,"bobAmount",.5);I(this,"baseY");I(this,"time",0);I(this,"active",!0);this.config=rg[e],this.baseY=t.y,this.mesh=this.createMesh(t)}createMesh(t){const e=new ge,n=new Wr(1.5,.2,8,16),i=new ze({color:this.config.color,transparent:!0,opacity:.8}),r=new ht(n,i);r.rotation.x=Math.PI/2,e.add(r);const a=new kr(.8,0),o=new Ut({color:this.config.color,emissive:this.config.color,emissiveIntensity:.5,metalness:.5,roughness:.3}),c=new ht(a,o);e.add(c);const l=new De(1.2,16,16),h=new ze({color:this.config.color,transparent:!0,opacity:.3}),u=new ht(l,h);return e.add(u),e.position.copy(t),e}update(t){if(!this.active)return;this.time+=t,this.mesh.rotation.y+=this.rotationSpeed*t,this.mesh.position.y=this.baseY+Math.sin(this.time*this.bobSpeed)*this.bobAmount;const e=1+Math.sin(this.time*4)*.1;this.mesh.scale.setScalar(e)}getMesh(){return this.mesh}getConfig(){return this.config}getType(){return this.config.type}isActive(){return this.active}deactivate(){this.active=!1,this.mesh.visible=!1}checkCollision(t,e){return this.mesh.position.distanceTo(t)<e+2}}class og{constructor(t){I(this,"scene");I(this,"powerUps",[]);I(this,"activePowerUps",[]);I(this,"onPowerUpCollected");I(this,"onPowerUpExpired");I(this,"onBombUsed");this.scene=t}spawn(t,e){const n=e||this.getRandomPowerUpType(),i=new ag(t.clone(),n);this.powerUps.push(i),this.scene.add(i.getMesh())}getRandomPowerUpType(){const t=Object.values(xn),e=[30,15,20,20,10,5],n=e.reduce((r,a)=>r+a,0);let i=Math.random()*n;for(let r=0;r<t.length;r++)if(i-=e[r],i<=0)return t[r];return"HEALTH"}update(t){var e;for(const n of this.powerUps)n.update(t);for(let n=this.activePowerUps.length-1;n>=0;n--){const i=this.activePowerUps[n];i.config.duration>0&&(i.remainingTime-=t,i.remainingTime<=0&&(this.activePowerUps.splice(n,1),(e=this.onPowerUpExpired)==null||e.call(this,i.type)))}}checkCollisions(t,e){var n;for(let i=this.powerUps.length-1;i>=0;i--){const r=this.powerUps[i];if(r.checkCollision(t,e)){const a=r.getType(),o=r.getConfig();return this.activatePowerUp(a,o),this.scene.remove(r.getMesh()),this.powerUps.splice(i,1),(n=this.onPowerUpCollected)==null||n.call(this,a,o),a}}return null}activatePowerUp(t,e){var i;if(t==="BOMB"){(i=this.onBombUsed)==null||i.call(this);return}if(e.duration===0)return;const n=this.activePowerUps.find(r=>r.type===t);n?n.remainingTime=e.duration:this.activePowerUps.push({type:t,config:e,remainingTime:e.duration,startTime:Date.now()})}hasEffect(t){return this.activePowerUps.some(e=>e.type===t)}getEffectRemainingTime(t){const e=this.activePowerUps.find(n=>n.type===t);return e?e.remainingTime:0}getEffectValue(t){const e=this.activePowerUps.find(n=>n.type===t);return e?e.config.value:1}getActiveEffects(){return this.activePowerUps}clear(){for(const t of this.powerUps)this.scene.remove(t.getMesh());this.powerUps=[],this.activePowerUps=[]}}var Pr=(s=>(s.MAX_HEALTH="MAX_HEALTH",s.DAMAGE="DAMAGE",s.FIRE_RATE="FIRE_RATE",s.SPEED="SPEED",s.SHIELD_DURATION="SHIELD_DURATION",s))(Pr||{});const _r={MAX_HEALTH:{type:"MAX_HEALTH",name:"最大生命值",description:"增加最大生命值",maxLevel:10,baseCost:100,costMultiplier:1.5,effectPerLevel:20},DAMAGE:{type:"DAMAGE",name:"武器伤害",description:"增加子弹伤害",maxLevel:10,baseCost:150,costMultiplier:1.6,effectPerLevel:5},FIRE_RATE:{type:"FIRE_RATE",name:"射速",description:"提高射击速度",maxLevel:8,baseCost:200,costMultiplier:1.7,effectPerLevel:.02},SPEED:{type:"SPEED",name:"飞行速度",description:"提高最大飞行速度",maxLevel:8,baseCost:120,costMultiplier:1.5,effectPerLevel:5},SHIELD_DURATION:{type:"SHIELD_DURATION",name:"护盾持续时间",description:"增加护盾持续时间",maxLevel:5,baseCost:250,costMultiplier:2,effectPerLevel:2}};class cg{constructor(){I(this,"upgradeLevels",new Map);I(this,"totalScore",0);I(this,"availablePoints",0);Object.values(Pr).forEach(t=>{this.upgradeLevels.set(t,0)})}addScore(t){this.totalScore+=t;const e=Math.floor(this.totalScore/500)-this.availablePoints;e>0&&(this.availablePoints+=e)}getLevel(t){return this.upgradeLevels.get(t)||0}upgrade(t){const e=this.getLevel(t),n=_r[t];if(e>=n.maxLevel)return!1;const i=this.getUpgradeCost(t);return this.availablePoints<i?!1:(this.availablePoints-=i,this.upgradeLevels.set(t,e+1),!0)}getUpgradeCost(t){const e=this.getLevel(t),n=_r[t];return Math.floor(n.baseCost*Math.pow(n.costMultiplier,e))}getEffectValue(t){const e=this.getLevel(t),n=_r[t];return e*n.effectPerLevel}getTotalScore(){return this.totalScore}getAvailablePoints(){return this.availablePoints}reset(){Object.values(Pr).forEach(t=>{this.upgradeLevels.set(t,0)}),this.totalScore=0,this.availablePoints=0}export(){const t={totalScore:this.totalScore,availablePoints:this.availablePoints,upgrades:{}};return this.upgradeLevels.forEach((e,n)=>{t.upgrades[n]=e}),t}import(t){this.totalScore=t.totalScore||0,this.availablePoints=t.availablePoints||0,t.upgrades&&Object.entries(t.upgrades).forEach(([e,n])=>{this.upgradeLevels.set(e,n)})}}class lg{constructor(){I(this,"upgrades");I(this,"baseHealth",100);I(this,"baseDamage",25);I(this,"baseFireRate",.15);I(this,"baseSpeed",100);I(this,"baseShieldDuration",10);this.upgrades=new cg}getMaxHealth(){return this.baseHealth+this.upgrades.getEffectValue("MAX_HEALTH")}getDamage(t=1){return(this.baseDamage+this.upgrades.getEffectValue("DAMAGE"))*t}getFireRate(){const t=this.upgrades.getEffectValue("FIRE_RATE");return Math.max(.05,this.baseFireRate-t)}getMaxSpeed(){return this.baseSpeed+this.upgrades.getEffectValue("SPEED")}getShieldDuration(){return this.baseShieldDuration+this.upgrades.getEffectValue("SHIELD_DURATION")}getUpgrades(){return this.upgrades}addScore(t){this.upgrades.addScore(t)}reset(){this.upgrades.reset()}}class hg{constructor(){I(this,"gameLoop");I(this,"gameScene");I(this,"inputHandler");I(this,"gameState");I(this,"playerAircraft");I(this,"playerController");I(this,"playerHealth");I(this,"playerStats");I(this,"thirdPersonCamera");I(this,"playerProjectilePool");I(this,"enemyProjectilePool");I(this,"levelManager");I(this,"particleSystem");I(this,"audioManager");I(this,"powerUpManager");I(this,"hud");I(this,"startMenu");I(this,"enemyIndicator");I(this,"lockOnIndicator");I(this,"fireCooldown",0);I(this,"missileSystem");I(this,"missileCount",2);I(this,"maxMissiles",10);I(this,"currentLevelId",1);I(this,"waveDelayTimer",0);I(this,"shieldMesh");I(this,"shieldActive",!1);I(this,"lives",3);I(this,"isRespawning",!1);I(this,"respawnTimer",0);I(this,"respawnDelay",2);I(this,"invincibleTimer",0);I(this,"invincibleDuration",3);I(this,"audioInitialized",!1);this.gameLoop=new Fm,this.gameScene=new Bm,this.inputHandler=new zm,this.gameState=new $m,this.playerStats=new lg,this.playerAircraft=this.createPlayerAircraft(),this.playerController=new Gm(this.playerAircraft),this.playerHealth=new Sc(this.playerStats.getMaxHealth()),this.thirdPersonCamera=new Hm(this.gameScene.camera,this.playerAircraft),this.playerProjectilePool=new Po(this.gameScene.scene),this.enemyProjectilePool=new Po(this.gameScene.scene),this.levelManager=new ng(this.gameScene.scene),this.particleSystem=new ig(this.gameScene.scene),this.audioManager=new sg,this.powerUpManager=new og(this.gameScene.scene),this.hud=new Wm,this.enemyIndicator=new qm,this.lockOnIndicator=new Ym,this.missileSystem=new km(this.gameScene.scene),this.startMenu=new Xm,this.setupCallbacks(),this.startMenu.setOnStart(t=>{this.lives=t.playerLives,this.audioManager.setSFXVolume(t.soundVolume),this.start()})}setupCallbacks(){this.playerHealth.onDamage=()=>{!this.shieldActive&&!this.isRespawning&&this.invincibleTimer<=0&&(this.audioManager.playHit(),this.particleSystem.createHit(this.playerAircraft.position))},this.playerHealth.onDeath=()=>{this.onPlayerDeath()},this.levelManager.onWaveStart=t=>{this.audioManager.playWaveStart(),console.log(`第 ${t} 波开始！`)},this.levelManager.onWaveComplete=t=>{console.log(`第 ${t} 波完成！`),this.waveDelayTimer=te.LEVEL.WAVE_DELAY},this.levelManager.onLevelComplete=t=>{this.audioManager.playLevelUp(),console.log(`关卡 ${t} 完成！`)},this.levelManager.onEnemySpawned=t=>{t.onFire=(e,n)=>{this.enemyProjectilePool.fire(e,n)},t.onDestroy=()=>{const e=t.getConfig(),n=t.getPosition().clone();this.gameState.addScore(e.scoreValue),this.playerStats.addScore(e.scoreValue),this.audioManager.playExplosion(),this.particleSystem.createExplosion(n,e.scale),Math.random()<te.POWERUP.SPAWN_CHANCE&&this.powerUpManager.spawn(n),this.missileCount<this.maxMissiles&&(this.missileCount++,this.hud.updateMissiles(this.missileCount))}},this.powerUpManager.onPowerUpCollected=(t,e)=>{this.audioManager.playPowerUp(),console.log(`获得道具: ${e.name}`),t===xn.HEALTH?this.playerHealth.heal(e.value):t===xn.SHIELD&&this.activateShield()},this.powerUpManager.onPowerUpExpired=t=>{t===xn.SHIELD&&this.deactivateShield()},this.powerUpManager.onBombUsed=()=>{const t=this.levelManager.getEnemies();for(const e of t)e.isAlive()&&e.takeDamage(9999);console.log("炸弹清屏！")}}onPlayerDeath(){this.lives--,this.audioManager.stopEngine(),this.audioManager.playExplosion(),this.particleSystem.createExplosion(this.playerAircraft.position,2),this.lockOnIndicator.cancelLockOn(),this.playerAircraft.visible=!1,this.lives<=0?(this.gameState.setStatus(xs.GAME_OVER),this.audioManager.playGameOver(),console.log("游戏结束！最终得分:",this.gameState.getScore())):(this.isRespawning=!0,this.respawnTimer=this.respawnDelay,console.log(`剩余生命: ${this.lives}`))}respawnPlayer(){this.playerHealth.reset(),this.playerAircraft.position.set(0,0,0),this.playerAircraft.rotation.set(0,0,0),this.playerAircraft.quaternion.set(0,0,0,1),this.playerAircraft.visible=!0,this.missileCount=te.MISSILE.STARTING_MISSILES,this.hud.updateMissiles(this.missileCount),this.invincibleTimer=this.invincibleDuration,this.isRespawning=!1,this.audioManager.startEngine(),console.log("复活成功！")}activateShield(){if(this.shieldActive=!0,!this.shieldMesh){const t=new De(3,16,16),e=new ze({color:65535,transparent:!0,opacity:.3,side:Ze});this.shieldMesh=new ht(t,e),this.gameScene.scene.add(this.shieldMesh)}this.shieldMesh.visible=!0}deactivateShield(){this.shieldActive=!1,this.shieldMesh&&(this.shieldMesh.visible=!1)}createPlayerAircraft(){const t=new ge,e=new Ut({color:4491519,metalness:.7,roughness:.2}),n=new le(.5,3.5,12),i=new ht(n,e);i.rotation.x=Math.PI/2,t.add(i);const r=new Ut({color:1118515,metalness:.9,roughness:.1}),a=new De(.3,12,12),o=new ht(a,r);o.position.set(0,.3,-.5),o.scale.set(1,.6,1.5),t.add(o);const c=new Ut({color:3368669,metalness:.6,roughness:.3}),l=new Bi;l.moveTo(0,0),l.lineTo(2,.8),l.lineTo(.3,1),l.lineTo(0,0);const h={depth:.05,bevelEnabled:!1},u=new Vr(l,h),d=new ht(u,c);d.rotation.x=Math.PI/2,d.rotation.z=Math.PI,d.position.set(-.3,0,.3),t.add(d);const m=new ht(u,c);m.rotation.x=Math.PI/2,m.position.set(.3,0,.3),t.add(m);const g=new Ce(.05,.8,.6),_=new ht(g,c);_.position.set(0,.5,1.5),t.add(_);const p=new le(.2,.8,8),f=new ze({color:16729088,transparent:!0,opacity:.8}),y=new ht(p,f);return y.rotation.x=-Math.PI/2,y.position.set(0,0,2),y.name="engineGlow",t.add(y),t.traverse(v=>{v instanceof ht&&v.name!=="engineGlow"&&(v.castShadow=!0,v.receiveShadow=!0)}),this.gameScene.scene.add(t),t}update(t){if(this.gameState.getStatus()!==xs.PLAYING)return;if(this.isRespawning){this.respawnTimer-=t,this.respawnTimer<=0&&this.respawnPlayer();return}this.invincibleTimer>0?(this.invincibleTimer-=t,this.playerAircraft.visible&&(this.playerAircraft.visible=Math.floor(this.invincibleTimer*10)%2===0)):this.playerAircraft.visible=!0;const e=this.levelManager.getEnemies().filter(c=>c.isAlive()).map(c=>c.getMesh());this.updateEnemyIndicators(e);const n=this.inputHandler.getState();this.playerController.update(t,n);const i=this.playerStats.getFireRate();this.fireCooldown=Math.max(0,this.fireCooldown-t),n.fire&&this.fireCooldown<=0&&(this.playerFire(),this.fireCooldown=i),this.handleMissileInput(n,e),this.playerProjectilePool.update(t),this.enemyProjectilePool.update(t),this.missileSystem.update(t),this.levelManager.update(t,this.playerController.getPosition()),this.waveDelayTimer>0&&(this.waveDelayTimer-=t,this.waveDelayTimer<=0&&this.levelManager.startWave());const r=this.levelManager.getEnemies().filter(c=>c.isAlive()).map(c=>c.getMesh()),a=this.powerUpManager.hasEffect(xn.DAMAGE)?this.powerUpManager.getEffectValue(xn.DAMAGE):1;this.playerProjectilePool.checkCollisions(r,c=>{const l=this.levelManager.getEnemies().find(h=>h.getMesh()===c);if(l){const h=this.playerStats.getDamage(a);l.takeDamage(h)}}),this.missileSystem.checkCollisions(r,c=>{const l=this.levelManager.getEnemies().find(h=>h.getMesh()===c);l&&(l.takeDamage(te.MISSILE.DAMAGE),this.audioManager.playExplosion(),this.particleSystem.createExplosion(c.position.clone(),2))}),!this.shieldActive&&this.invincibleTimer<=0&&this.enemyProjectilePool.checkCollisions([this.playerAircraft],()=>{this.playerHealth.takeDamage(10)}),this.powerUpManager.update(t),this.powerUpManager.checkCollisions(this.playerController.getPosition(),te.POWERUP.COLLECT_RADIUS),this.particleSystem.update(t),this.shieldMesh&&this.shieldActive&&this.shieldMesh.position.copy(this.playerAircraft.position),this.audioManager.updateEngine(this.playerController.getSpeed());const o=this.playerAircraft.getObjectByName("engineGlow");if(o){const c=.5+this.playerController.getSpeed()/100*1;o.scale.setScalar(c)}this.thirdPersonCamera.update(),this.hud.updateHealth(this.playerHealth.getHealthPercent()/(this.playerStats.getMaxHealth()/100)),this.hud.updateSpeed(this.playerController.getSpeed()),this.hud.updateScore(this.gameState.getScore()),this.hud.updateEnemies(this.levelManager.getAliveEnemyCount()),this.hud.updateLives(this.lives)}updateEnemyIndicators(t){const e=this.playerController.getPosition(),n=t.map(i=>{const r=i.position.clone(),a=this.worldToScreen(r),o=e.distanceTo(r),c=a.x>=0&&a.x<=1&&a.y>=0&&a.y<=1&&a.z<1;return{id:i.uuid,screenPos:a,distance:o,inView:c,isTargeted:!1}});this.enemyIndicator.update(n)}worldToScreen(t){const e=t.clone();return e.project(this.gameScene.camera),{x:(e.x+1)/2,y:(e.y+1)/2,z:e.z}}handleMissileInput(t,e){if(this.lockOnIndicator.isLocking()?this.lockOnIndicator.update(this.playerController.getPosition(),e,this.gameScene.camera,.016):t.missile?this.lockOnIndicator.startLockOn():this.lockOnIndicator.cancelLockOn(),t.missile&&this.missileCount>0){const n=this.lockOnIndicator.getCurrentTarget();n?this.fireMissile(n):this.lockOnIndicator.getLockProgress()>=1&&this.fireMissile()}}fireMissile(t){if(this.missileCount<=0)return;const e=this.playerController.getPosition().clone(),n=this.playerController.getQuaternion(),i=new C(0,0,-1);i.applyQuaternion(n),e.add(i.clone().multiplyScalar(2)),this.missileSystem.fire(e,i,t),this.missileCount--,this.hud.updateMissiles(this.missileCount),this.lockOnIndicator.onMissileFired()}playerFire(){const t=this.playerController.getPosition().clone(),e=this.playerController.getQuaternion(),n=new C(0,0,-1);if(n.applyQuaternion(e),t.add(n.clone().multiplyScalar(2)),this.audioManager.playShoot(),this.powerUpManager.hasEffect(xn.MULTISHOT))for(let r=-1;r<=1;r++){const a=n.clone();a.applyAxisAngle(new C(0,1,0),r*.15),this.playerProjectilePool.fire(t.clone(),a.normalize())}else this.playerProjectilePool.fire(t,n)}render(){this.gameScene.render()}start(){this.gameState.setStatus(xs.PLAYING),this.audioInitialized||(this.audioManager.resume(),this.audioInitialized=!0),this.levelManager.loadLevel(this.currentLevelId),setTimeout(()=>{this.levelManager.startWave()},te.LEVEL.START_DELAY*1e3),this.missileCount=te.MISSILE.STARTING_MISSILES,this.hud.updateMissiles(this.missileCount),this.gameLoop.start(t=>this.update(t),()=>this.render()),this.audioManager.startEngine(),console.log("游戏开始！")}stop(){this.gameLoop.stop(),this.audioManager.stopEngine()}dispose(){this.stop(),this.levelManager.clear(),this.particleSystem.clear(),this.powerUpManager.clear(),this.gameScene.dispose()}}function ug(){const s=document.getElementById("loading-screen");s&&s.classList.add("hidden")}function Lo(s){const t=document.getElementById("loading-screen");t&&(t.innerHTML=`
      <div style="text-align: center; color: white;">
        <h1 style="font-size: 32px; margin-bottom: 20px;">⚠️ 加载失败</h1>
        <p style="font-size: 16px; opacity: 0.8;">${s}</p>
        <p style="font-size: 14px; margin-top: 20px; opacity: 0.6;">
          请尝试刷新页面或使用其他浏览器
        </p>
      </div>
    `)}function dg(){try{const s=document.createElement("canvas");return(s.getContext("webgl")||s.getContext("experimental-webgl"))!==null}catch{return!1}}async function Do(){if(!dg()){Lo("您的浏览器不支持 WebGL");return}try{const s=new hg;ug(),console.log("🎮 Air Supreme - 3D 空战游戏"),console.log("📖 控制说明:"),console.log("  W/S - 俯仰（机头上下）"),console.log("  A/D - 偏航（机头左右）"),console.log("  Q/E - 翻滚（机翼倾斜）"),console.log("  空格 - 开火"),console.log("  Shift - 加速"),console.log(""),console.log("📱 移动端: 使用虚拟摇杆和按钮控制"),s.start(),window.addEventListener("beforeunload",()=>{s.dispose()})}catch(s){console.error("游戏初始化失败:",s),Lo("游戏初始化失败，请查看控制台了解详情")}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>Do()):Do();
