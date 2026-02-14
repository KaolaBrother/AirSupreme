var ec=Object.defineProperty;var nc=(s,t,e)=>t in s?ec(s,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):s[t]=e;var A=(s,t,e)=>nc(s,typeof t!="symbol"?t+"":t,e);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function e(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(i){if(i.ep)return;i.ep=!0;const r=e(i);fetch(i.href,r)}})();/**
 * @license
 * Copyright 2010-2023 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Kr="160",ic=0,xa=1,sc=2,nl=1,il=2,pn=3,Dn=0,ze=1,Be=2,Cn=0,Vn=1,qi=2,ya=3,Ma=4,rc=5,Gn=100,ac=101,oc=102,Sa=103,Ea=104,lc=200,cc=201,hc=202,uc=203,Fr=204,Or=205,dc=206,fc=207,pc=208,mc=209,gc=210,_c=211,vc=212,xc=213,yc=214,Mc=0,Sc=1,Ec=2,Fs=3,wc=4,Tc=5,Ac=6,bc=7,sl=0,Cc=1,Rc=2,Rn=0,Pc=1,Lc=2,Dc=3,Ic=4,Uc=5,Nc=6,rl=300,wi=301,Ti=302,Br=303,zr=304,Ws=306,Hr=1e3,tn=1001,Gr=1002,Fe=1003,wa=1004,Qs=1005,qe=1006,Fc=1007,Yi=1008,Pn=1009,Oc=1010,Bc=1011,Qr=1012,al=1013,An=1014,bn=1015,$i=1016,ol=1017,ll=1018,Wn=1020,zc=1021,en=1023,Hc=1024,Gc=1025,Xn=1026,Ai=1027,kc=1028,cl=1029,Vc=1030,hl=1031,ul=1033,tr=33776,er=33777,nr=33778,ir=33779,Ta=35840,Aa=35841,ba=35842,Ca=35843,dl=36196,Ra=37492,Pa=37496,La=37808,Da=37809,Ia=37810,Ua=37811,Na=37812,Fa=37813,Oa=37814,Ba=37815,za=37816,Ha=37817,Ga=37818,ka=37819,Va=37820,Wa=37821,sr=36492,Xa=36494,qa=36495,Wc=36283,Ya=36284,$a=36285,ja=36286,fl=3e3,qn=3001,Xc=3200,qc=3201,pl=0,Yc=1,je="",Ee="srgb",vn="srgb-linear",ta="display-p3",Xs="display-p3-linear",Os="linear",ee="srgb",Bs="rec709",zs="p3",Jn=7680,Za=519,$c=512,jc=513,Zc=514,ml=515,Jc=516,Kc=517,Qc=518,th=519,kr=35044,Ja="300 es",Vr=1035,gn=2e3,Hs=2001;class Ci{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const i=this._listeners[t];if(i!==void 0){const r=i.indexOf(e);r!==-1&&i.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const n=this._listeners[t.type];if(n!==void 0){t.target=this;const i=n.slice(0);for(let r=0,a=i.length;r<a;r++)i[r].call(this,t);t.target=null}}}const Ae=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],rr=Math.PI/180,Wr=180/Math.PI;function _n(){const s=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ae[s&255]+Ae[s>>8&255]+Ae[s>>16&255]+Ae[s>>24&255]+"-"+Ae[t&255]+Ae[t>>8&255]+"-"+Ae[t>>16&15|64]+Ae[t>>24&255]+"-"+Ae[e&63|128]+Ae[e>>8&255]+"-"+Ae[e>>16&255]+Ae[e>>24&255]+Ae[n&255]+Ae[n>>8&255]+Ae[n>>16&255]+Ae[n>>24&255]).toLowerCase()}function Re(s,t,e){return Math.max(t,Math.min(e,s))}function eh(s,t){return(s%t+t)%t}function ar(s,t,e){return(1-e)*s+e*t}function Ka(s){return(s&s-1)===0&&s!==0}function Xr(s){return Math.pow(2,Math.floor(Math.log(s)/Math.LN2))}function mn(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("Invalid component type.")}}function Jt(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("Invalid component type.")}}class at{constructor(t=0,e=0){at.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,i=t.elements;return this.x=i[0]*e+i[3]*n+i[6],this.y=i[1]*e+i[4]*n+i[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(Re(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),i=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*n-a*i+t.x,this.y=r*i+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Xt{constructor(t,e,n,i,r,a,o,l,c){Xt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,i,r,a,o,l,c)}set(t,e,n,i,r,a,o,l,c){const h=this.elements;return h[0]=t,h[1]=i,h[2]=o,h[3]=e,h[4]=r,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],u=n[7],d=n[2],m=n[5],g=n[8],_=i[0],p=i[3],f=i[6],S=i[1],v=i[4],y=i[7],L=i[2],b=i[5],C=i[8];return r[0]=a*_+o*S+l*L,r[3]=a*p+o*v+l*b,r[6]=a*f+o*y+l*C,r[1]=c*_+h*S+u*L,r[4]=c*p+h*v+u*b,r[7]=c*f+h*y+u*C,r[2]=d*_+m*S+g*L,r[5]=d*p+m*v+g*b,r[8]=d*f+m*y+g*C,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return e*a*h-e*o*c-n*r*h+n*o*l+i*r*c-i*a*l}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=h*a-o*c,d=o*l-h*r,m=c*r-a*l,g=e*u+n*d+i*m;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const _=1/g;return t[0]=u*_,t[1]=(i*c-h*n)*_,t[2]=(o*n-i*a)*_,t[3]=d*_,t[4]=(h*e-i*l)*_,t[5]=(i*r-o*e)*_,t[6]=m*_,t[7]=(n*l-c*e)*_,t[8]=(a*e-n*r)*_,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,i,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+t,-i*c,i*l,-i*(-c*a+l*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(or.makeScale(t,e)),this}rotate(t){return this.premultiply(or.makeRotation(-t)),this}translate(t,e){return this.premultiply(or.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<9;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const or=new Xt;function gl(s){for(let t=s.length-1;t>=0;--t)if(s[t]>=65535)return!0;return!1}function Gs(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function nh(){const s=Gs("canvas");return s.style.display="block",s}const Qa={};function ki(s){s in Qa||(Qa[s]=!0,console.warn(s))}const to=new Xt().set(.8224621,.177538,0,.0331941,.9668058,0,.0170827,.0723974,.9105199),eo=new Xt().set(1.2249401,-.2249404,0,-.0420569,1.0420571,0,-.0196376,-.0786361,1.0982735),is={[vn]:{transfer:Os,primaries:Bs,toReference:s=>s,fromReference:s=>s},[Ee]:{transfer:ee,primaries:Bs,toReference:s=>s.convertSRGBToLinear(),fromReference:s=>s.convertLinearToSRGB()},[Xs]:{transfer:Os,primaries:zs,toReference:s=>s.applyMatrix3(eo),fromReference:s=>s.applyMatrix3(to)},[ta]:{transfer:ee,primaries:zs,toReference:s=>s.convertSRGBToLinear().applyMatrix3(eo),fromReference:s=>s.applyMatrix3(to).convertLinearToSRGB()}},ih=new Set([vn,Xs]),Zt={enabled:!0,_workingColorSpace:vn,get workingColorSpace(){return this._workingColorSpace},set workingColorSpace(s){if(!ih.has(s))throw new Error(`Unsupported working color space, "${s}".`);this._workingColorSpace=s},convert:function(s,t,e){if(this.enabled===!1||t===e||!t||!e)return s;const n=is[t].toReference,i=is[e].fromReference;return i(n(s))},fromWorkingColorSpace:function(s,t){return this.convert(s,this._workingColorSpace,t)},toWorkingColorSpace:function(s,t){return this.convert(s,t,this._workingColorSpace)},getPrimaries:function(s){return is[s].primaries},getTransfer:function(s){return s===je?Os:is[s].transfer}};function Si(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function lr(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}let Kn;class _l{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{Kn===void 0&&(Kn=Gs("canvas")),Kn.width=t.width,Kn.height=t.height;const n=Kn.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=Kn}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=Gs("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const i=n.getImageData(0,0,t.width,t.height),r=i.data;for(let a=0;a<r.length;a++)r[a]=Si(r[a]/255)*255;return n.putImageData(i,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(Si(e[n]/255)*255):e[n]=Si(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let sh=0;class vl{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:sh++}),this.uuid=_n(),this.data=t,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let a=0,o=i.length;a<o;a++)i[a].isDataTexture?r.push(cr(i[a].image)):r.push(cr(i[a]))}else r=cr(i);n.url=r}return e||(t.images[this.uuid]=n),n}}function cr(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?_l.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let rh=0;class He extends Ci{constructor(t=He.DEFAULT_IMAGE,e=He.DEFAULT_MAPPING,n=tn,i=tn,r=qe,a=Yi,o=en,l=Pn,c=He.DEFAULT_ANISOTROPY,h=je){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:rh++}),this.uuid=_n(),this.name="",this.source=new vl(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new at(0,0),this.repeat=new at(1,1),this.center=new at(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Xt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,typeof h=="string"?this.colorSpace=h:(ki("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=h===qn?Ee:je),this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.needsPMREMUpdate=!1}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==rl)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Hr:t.x=t.x-Math.floor(t.x);break;case tn:t.x=t.x<0?0:1;break;case Gr:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Hr:t.y=t.y-Math.floor(t.y);break;case tn:t.y=t.y<0?0:1;break;case Gr:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}get encoding(){return ki("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace===Ee?qn:fl}set encoding(t){ki("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=t===qn?Ee:je}}He.DEFAULT_IMAGE=null;He.DEFAULT_MAPPING=rl;He.DEFAULT_ANISOTROPY=1;class Se{constructor(t=0,e=0,n=0,i=1){Se.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=i}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,i){return this.x=t,this.y=e,this.z=n,this.w=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*i+a[12]*r,this.y=a[1]*e+a[5]*n+a[9]*i+a[13]*r,this.z=a[2]*e+a[6]*n+a[10]*i+a[14]*r,this.w=a[3]*e+a[7]*n+a[11]*i+a[15]*r,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,i,r;const l=t.elements,c=l[0],h=l[4],u=l[8],d=l[1],m=l[5],g=l[9],_=l[2],p=l[6],f=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-_)<.01&&Math.abs(g-p)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+_)<.1&&Math.abs(g+p)<.1&&Math.abs(c+m+f-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const v=(c+1)/2,y=(m+1)/2,L=(f+1)/2,b=(h+d)/4,C=(u+_)/4,O=(g+p)/4;return v>y&&v>L?v<.01?(n=0,i=.707106781,r=.707106781):(n=Math.sqrt(v),i=b/n,r=C/n):y>L?y<.01?(n=.707106781,i=0,r=.707106781):(i=Math.sqrt(y),n=b/i,r=O/i):L<.01?(n=.707106781,i=.707106781,r=0):(r=Math.sqrt(L),n=C/r,i=O/r),this.set(n,i,r,e),this}let S=Math.sqrt((p-g)*(p-g)+(u-_)*(u-_)+(d-h)*(d-h));return Math.abs(S)<.001&&(S=1),this.x=(p-g)/S,this.y=(u-_)/S,this.z=(d-h)/S,this.w=Math.acos((c+m+f-1)/2),this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class ah extends Ci{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new Se(0,0,t,e),this.scissorTest=!1,this.viewport=new Se(0,0,t,e);const i={width:t,height:e,depth:1};n.encoding!==void 0&&(ki("THREE.WebGLRenderTarget: option.encoding has been replaced by option.colorSpace."),n.colorSpace=n.encoding===qn?Ee:je),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:qe,depthBuffer:!0,stencilBuffer:!1,depthTexture:null,samples:0},n),this.texture=new He(i,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.flipY=!1,this.texture.generateMipmaps=n.generateMipmaps,this.texture.internalFormat=n.internalFormat,this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}setSize(t,e,n=1){(this.width!==t||this.height!==e||this.depth!==n)&&(this.width=t,this.height=e,this.depth=n,this.texture.image.width=t,this.texture.image.height=e,this.texture.image.depth=n,this.dispose()),this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.texture=t.texture.clone(),this.texture.isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new vl(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Yn extends ah{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class xl extends He{constructor(t=null,e=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=Fe,this.minFilter=Fe,this.wrapR=tn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class oh extends He{constructor(t=null,e=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=Fe,this.minFilter=Fe,this.wrapR=tn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Ri{constructor(t=0,e=0,n=0,i=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=i}static slerpFlat(t,e,n,i,r,a,o){let l=n[i+0],c=n[i+1],h=n[i+2],u=n[i+3];const d=r[a+0],m=r[a+1],g=r[a+2],_=r[a+3];if(o===0){t[e+0]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u;return}if(o===1){t[e+0]=d,t[e+1]=m,t[e+2]=g,t[e+3]=_;return}if(u!==_||l!==d||c!==m||h!==g){let p=1-o;const f=l*d+c*m+h*g+u*_,S=f>=0?1:-1,v=1-f*f;if(v>Number.EPSILON){const L=Math.sqrt(v),b=Math.atan2(L,f*S);p=Math.sin(p*b)/L,o=Math.sin(o*b)/L}const y=o*S;if(l=l*p+d*y,c=c*p+m*y,h=h*p+g*y,u=u*p+_*y,p===1-o){const L=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=L,c*=L,h*=L,u*=L}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,i,r,a){const o=n[i],l=n[i+1],c=n[i+2],h=n[i+3],u=r[a],d=r[a+1],m=r[a+2],g=r[a+3];return t[e]=o*g+h*u+l*m-c*d,t[e+1]=l*g+h*d+c*u-o*m,t[e+2]=c*g+h*m+o*d-l*u,t[e+3]=h*g-o*u-l*d-c*m,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,i){return this._x=t,this._y=e,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,i=t._y,r=t._z,a=t._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(i/2),u=o(r/2),d=l(n/2),m=l(i/2),g=l(r/2);switch(a){case"XYZ":this._x=d*h*u+c*m*g,this._y=c*m*u-d*h*g,this._z=c*h*g+d*m*u,this._w=c*h*u-d*m*g;break;case"YXZ":this._x=d*h*u+c*m*g,this._y=c*m*u-d*h*g,this._z=c*h*g-d*m*u,this._w=c*h*u+d*m*g;break;case"ZXY":this._x=d*h*u-c*m*g,this._y=c*m*u+d*h*g,this._z=c*h*g+d*m*u,this._w=c*h*u-d*m*g;break;case"ZYX":this._x=d*h*u-c*m*g,this._y=c*m*u+d*h*g,this._z=c*h*g-d*m*u,this._w=c*h*u+d*m*g;break;case"YZX":this._x=d*h*u+c*m*g,this._y=c*m*u+d*h*g,this._z=c*h*g-d*m*u,this._w=c*h*u-d*m*g;break;case"XZY":this._x=d*h*u-c*m*g,this._y=c*m*u-d*h*g,this._z=c*h*g+d*m*u,this._w=c*h*u+d*m*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,i=Math.sin(n);return this._x=t.x*i,this._y=t.y*i,this._z=t.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],i=e[4],r=e[8],a=e[1],o=e[5],l=e[9],c=e[2],h=e[6],u=e[10],d=n+o+u;if(d>0){const m=.5/Math.sqrt(d+1);this._w=.25/m,this._x=(h-l)*m,this._y=(r-c)*m,this._z=(a-i)*m}else if(n>o&&n>u){const m=2*Math.sqrt(1+n-o-u);this._w=(h-l)/m,this._x=.25*m,this._y=(i+a)/m,this._z=(r+c)/m}else if(o>u){const m=2*Math.sqrt(1+o-n-u);this._w=(r-c)/m,this._x=(i+a)/m,this._y=.25*m,this._z=(l+h)/m}else{const m=2*Math.sqrt(1+u-n-o);this._w=(a-i)/m,this._x=(r+c)/m,this._y=(l+h)/m,this._z=.25*m}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Re(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const i=Math.min(1,e/n);return this.slerp(t,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,i=t._y,r=t._z,a=t._w,o=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+a*o+i*c-r*l,this._y=i*h+a*l+r*o-n*c,this._z=r*h+a*c+n*l-i*o,this._w=a*h-n*o-i*l-r*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,i=this._y,r=this._z,a=this._w;let o=a*t._w+n*t._x+i*t._y+r*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=a,this._x=n,this._y=i,this._z=r,this;const l=1-o*o;if(l<=Number.EPSILON){const m=1-e;return this._w=m*a+e*this._w,this._x=m*n+e*this._x,this._y=m*i+e*this._y,this._z=m*r+e*this._z,this.normalize(),this}const c=Math.sqrt(l),h=Math.atan2(c,o),u=Math.sin((1-e)*h)/c,d=Math.sin(e*h)/c;return this._w=a*u+this._w*d,this._x=n*u+this._x*d,this._y=i*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=Math.random(),e=Math.sqrt(1-t),n=Math.sqrt(t),i=2*Math.PI*Math.random(),r=2*Math.PI*Math.random();return this.set(e*Math.cos(i),n*Math.sin(r),n*Math.cos(r),e*Math.sin(i))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class R{constructor(t=0,e=0,n=0){R.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(no.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(no.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,i=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*i,this.y=r[1]*e+r[4]*n+r[7]*i,this.z=r[2]*e+r[5]*n+r[8]*i,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,r=t.elements,a=1/(r[3]*e+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*i+r[12])*a,this.y=(r[1]*e+r[5]*n+r[9]*i+r[13])*a,this.z=(r[2]*e+r[6]*n+r[10]*i+r[14])*a,this}applyQuaternion(t){const e=this.x,n=this.y,i=this.z,r=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*i-o*n),h=2*(o*e-r*i),u=2*(r*n-a*e);return this.x=e+l*c+a*u-o*h,this.y=n+l*h+o*c-r*u,this.z=i+l*u+r*h-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,i=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*i,this.y=r[1]*e+r[5]*n+r[9]*i,this.z=r[2]*e+r[6]*n+r[10]*i,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,i=t.y,r=t.z,a=e.x,o=e.y,l=e.z;return this.x=i*l-r*o,this.y=r*a-n*l,this.z=n*o-i*a,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return hr.copy(this).projectOnVector(t),this.sub(hr)}reflect(t){return this.sub(hr.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(Re(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,i=this.z-t.z;return e*e+n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const i=Math.sin(e)*t;return this.x=i*Math.sin(n),this.y=Math.cos(e)*t,this.z=i*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),i=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=i,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=(Math.random()-.5)*2,e=Math.random()*Math.PI*2,n=Math.sqrt(1-t**2);return this.x=n*Math.cos(e),this.y=n*Math.sin(e),this.z=t,this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const hr=new R,no=new Ri;class Zn{constructor(t=new R(1/0,1/0,1/0),e=new R(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(Ze.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(Ze.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=Ze.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,Ze):Ze.fromBufferAttribute(r,a),Ze.applyMatrix4(t.matrixWorld),this.expandByPoint(Ze);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),ss.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ss.copy(n.boundingBox)),ss.applyMatrix4(t.matrixWorld),this.union(ss)}const i=t.children;for(let r=0,a=i.length;r<a;r++)this.expandByObject(i[r],e);return this}containsPoint(t){return!(t.x<this.min.x||t.x>this.max.x||t.y<this.min.y||t.y>this.max.y||t.z<this.min.z||t.z>this.max.z)}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return!(t.max.x<this.min.x||t.min.x>this.max.x||t.max.y<this.min.y||t.min.y>this.max.y||t.max.z<this.min.z||t.min.z>this.max.z)}intersectsSphere(t){return this.clampPoint(t.center,Ze),Ze.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Ii),rs.subVectors(this.max,Ii),Qn.subVectors(t.a,Ii),ti.subVectors(t.b,Ii),ei.subVectors(t.c,Ii),yn.subVectors(ti,Qn),Mn.subVectors(ei,ti),Nn.subVectors(Qn,ei);let e=[0,-yn.z,yn.y,0,-Mn.z,Mn.y,0,-Nn.z,Nn.y,yn.z,0,-yn.x,Mn.z,0,-Mn.x,Nn.z,0,-Nn.x,-yn.y,yn.x,0,-Mn.y,Mn.x,0,-Nn.y,Nn.x,0];return!ur(e,Qn,ti,ei,rs)||(e=[1,0,0,0,1,0,0,0,1],!ur(e,Qn,ti,ei,rs))?!1:(as.crossVectors(yn,Mn),e=[as.x,as.y,as.z],ur(e,Qn,ti,ei,rs))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,Ze).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(Ze).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(cn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),cn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),cn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),cn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),cn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),cn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),cn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),cn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(cn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const cn=[new R,new R,new R,new R,new R,new R,new R,new R],Ze=new R,ss=new Zn,Qn=new R,ti=new R,ei=new R,yn=new R,Mn=new R,Nn=new R,Ii=new R,rs=new R,as=new R,Fn=new R;function ur(s,t,e,n,i){for(let r=0,a=s.length-3;r<=a;r+=3){Fn.fromArray(s,r);const o=i.x*Math.abs(Fn.x)+i.y*Math.abs(Fn.y)+i.z*Math.abs(Fn.z),l=t.dot(Fn),c=e.dot(Fn),h=n.dot(Fn);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}const lh=new Zn,Ui=new R,dr=new R;class Pi{constructor(t=new R,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):lh.setFromPoints(t).getCenter(n);let i=0;for(let r=0,a=t.length;r<a;r++)i=Math.max(i,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(i),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Ui.subVectors(t,this.center);const e=Ui.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),i=(n-this.radius)*.5;this.center.addScaledVector(Ui,i/n),this.radius+=i}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(dr.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Ui.copy(t.center).add(dr)),this.expandByPoint(Ui.copy(t.center).sub(dr))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const hn=new R,fr=new R,os=new R,Sn=new R,pr=new R,ls=new R,mr=new R;class yl{constructor(t=new R,e=new R(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,hn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=hn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(hn.copy(this.origin).addScaledVector(this.direction,e),hn.distanceToSquared(t))}distanceSqToSegment(t,e,n,i){fr.copy(t).add(e).multiplyScalar(.5),os.copy(e).sub(t).normalize(),Sn.copy(this.origin).sub(fr);const r=t.distanceTo(e)*.5,a=-this.direction.dot(os),o=Sn.dot(this.direction),l=-Sn.dot(os),c=Sn.lengthSq(),h=Math.abs(1-a*a);let u,d,m,g;if(h>0)if(u=a*l-o,d=a*o-l,g=r*h,u>=0)if(d>=-g)if(d<=g){const _=1/h;u*=_,d*=_,m=u*(u+a*d+2*o)+d*(a*u+d+2*l)+c}else d=r,u=Math.max(0,-(a*d+o)),m=-u*u+d*(d+2*l)+c;else d=-r,u=Math.max(0,-(a*d+o)),m=-u*u+d*(d+2*l)+c;else d<=-g?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-l),r),m=-u*u+d*(d+2*l)+c):d<=g?(u=0,d=Math.min(Math.max(-r,-l),r),m=d*(d+2*l)+c):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-l),r),m=-u*u+d*(d+2*l)+c);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),m=-u*u+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),i&&i.copy(fr).addScaledVector(os,d),m}intersectSphere(t,e){hn.subVectors(t.center,this.origin);const n=hn.dot(this.direction),i=hn.dot(hn)-n*n,r=t.radius*t.radius;if(i>r)return null;const a=Math.sqrt(r-i),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,i,r,a,o,l;const c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(t.min.x-d.x)*c,i=(t.max.x-d.x)*c):(n=(t.max.x-d.x)*c,i=(t.min.x-d.x)*c),h>=0?(r=(t.min.y-d.y)*h,a=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,a=(t.min.y-d.y)*h),n>a||r>i||((r>n||isNaN(n))&&(n=r),(a<i||isNaN(i))&&(i=a),u>=0?(o=(t.min.z-d.z)*u,l=(t.max.z-d.z)*u):(o=(t.max.z-d.z)*u,l=(t.min.z-d.z)*u),n>l||o>i)||((o>n||n!==n)&&(n=o),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,e)}intersectsBox(t){return this.intersectBox(t,hn)!==null}intersectTriangle(t,e,n,i,r){pr.subVectors(e,t),ls.subVectors(n,t),mr.crossVectors(pr,ls);let a=this.direction.dot(mr),o;if(a>0){if(i)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Sn.subVectors(this.origin,t);const l=o*this.direction.dot(ls.crossVectors(Sn,ls));if(l<0)return null;const c=o*this.direction.dot(pr.cross(Sn));if(c<0||l+c>a)return null;const h=-o*Sn.dot(mr);return h<0?null:this.at(h/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class ne{constructor(t,e,n,i,r,a,o,l,c,h,u,d,m,g,_,p){ne.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,i,r,a,o,l,c,h,u,d,m,g,_,p)}set(t,e,n,i,r,a,o,l,c,h,u,d,m,g,_,p){const f=this.elements;return f[0]=t,f[4]=e,f[8]=n,f[12]=i,f[1]=r,f[5]=a,f[9]=o,f[13]=l,f[2]=c,f[6]=h,f[10]=u,f[14]=d,f[3]=m,f[7]=g,f[11]=_,f[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ne().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,i=1/ni.setFromMatrixColumn(t,0).length(),r=1/ni.setFromMatrixColumn(t,1).length(),a=1/ni.setFromMatrixColumn(t,2).length();return e[0]=n[0]*i,e[1]=n[1]*i,e[2]=n[2]*i,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,i=t.y,r=t.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(i),c=Math.sin(i),h=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){const d=a*h,m=a*u,g=o*h,_=o*u;e[0]=l*h,e[4]=-l*u,e[8]=c,e[1]=m+g*c,e[5]=d-_*c,e[9]=-o*l,e[2]=_-d*c,e[6]=g+m*c,e[10]=a*l}else if(t.order==="YXZ"){const d=l*h,m=l*u,g=c*h,_=c*u;e[0]=d+_*o,e[4]=g*o-m,e[8]=a*c,e[1]=a*u,e[5]=a*h,e[9]=-o,e[2]=m*o-g,e[6]=_+d*o,e[10]=a*l}else if(t.order==="ZXY"){const d=l*h,m=l*u,g=c*h,_=c*u;e[0]=d-_*o,e[4]=-a*u,e[8]=g+m*o,e[1]=m+g*o,e[5]=a*h,e[9]=_-d*o,e[2]=-a*c,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){const d=a*h,m=a*u,g=o*h,_=o*u;e[0]=l*h,e[4]=g*c-m,e[8]=d*c+_,e[1]=l*u,e[5]=_*c+d,e[9]=m*c-g,e[2]=-c,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){const d=a*l,m=a*c,g=o*l,_=o*c;e[0]=l*h,e[4]=_-d*u,e[8]=g*u+m,e[1]=u,e[5]=a*h,e[9]=-o*h,e[2]=-c*h,e[6]=m*u+g,e[10]=d-_*u}else if(t.order==="XZY"){const d=a*l,m=a*c,g=o*l,_=o*c;e[0]=l*h,e[4]=-u,e[8]=c*h,e[1]=d*u+_,e[5]=a*h,e[9]=m*u-g,e[2]=g*u-m,e[6]=o*h,e[10]=_*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(ch,t,hh)}lookAt(t,e,n){const i=this.elements;return ke.subVectors(t,e),ke.lengthSq()===0&&(ke.z=1),ke.normalize(),En.crossVectors(n,ke),En.lengthSq()===0&&(Math.abs(n.z)===1?ke.x+=1e-4:ke.z+=1e-4,ke.normalize(),En.crossVectors(n,ke)),En.normalize(),cs.crossVectors(ke,En),i[0]=En.x,i[4]=cs.x,i[8]=ke.x,i[1]=En.y,i[5]=cs.y,i[9]=ke.y,i[2]=En.z,i[6]=cs.z,i[10]=ke.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],u=n[5],d=n[9],m=n[13],g=n[2],_=n[6],p=n[10],f=n[14],S=n[3],v=n[7],y=n[11],L=n[15],b=i[0],C=i[4],O=i[8],M=i[12],w=i[1],F=i[5],G=i[9],J=i[13],D=i[2],B=i[6],k=i[10],Y=i[14],$=i[3],j=i[7],Z=i[11],it=i[15];return r[0]=a*b+o*w+l*D+c*$,r[4]=a*C+o*F+l*B+c*j,r[8]=a*O+o*G+l*k+c*Z,r[12]=a*M+o*J+l*Y+c*it,r[1]=h*b+u*w+d*D+m*$,r[5]=h*C+u*F+d*B+m*j,r[9]=h*O+u*G+d*k+m*Z,r[13]=h*M+u*J+d*Y+m*it,r[2]=g*b+_*w+p*D+f*$,r[6]=g*C+_*F+p*B+f*j,r[10]=g*O+_*G+p*k+f*Z,r[14]=g*M+_*J+p*Y+f*it,r[3]=S*b+v*w+y*D+L*$,r[7]=S*C+v*F+y*B+L*j,r[11]=S*O+v*G+y*k+L*Z,r[15]=S*M+v*J+y*Y+L*it,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],i=t[8],r=t[12],a=t[1],o=t[5],l=t[9],c=t[13],h=t[2],u=t[6],d=t[10],m=t[14],g=t[3],_=t[7],p=t[11],f=t[15];return g*(+r*l*u-i*c*u-r*o*d+n*c*d+i*o*m-n*l*m)+_*(+e*l*m-e*c*d+r*a*d-i*a*m+i*c*h-r*l*h)+p*(+e*c*u-e*o*m-r*a*u+n*a*m+r*o*h-n*c*h)+f*(-i*o*h-e*l*u+e*o*d+i*a*u-n*a*d+n*l*h)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const i=this.elements;return t.isVector3?(i[12]=t.x,i[13]=t.y,i[14]=t.z):(i[12]=t,i[13]=e,i[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=t[9],d=t[10],m=t[11],g=t[12],_=t[13],p=t[14],f=t[15],S=u*p*c-_*d*c+_*l*m-o*p*m-u*l*f+o*d*f,v=g*d*c-h*p*c-g*l*m+a*p*m+h*l*f-a*d*f,y=h*_*c-g*u*c+g*o*m-a*_*m-h*o*f+a*u*f,L=g*u*l-h*_*l-g*o*d+a*_*d+h*o*p-a*u*p,b=e*S+n*v+i*y+r*L;if(b===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const C=1/b;return t[0]=S*C,t[1]=(_*d*r-u*p*r-_*i*m+n*p*m+u*i*f-n*d*f)*C,t[2]=(o*p*r-_*l*r+_*i*c-n*p*c-o*i*f+n*l*f)*C,t[3]=(u*l*r-o*d*r-u*i*c+n*d*c+o*i*m-n*l*m)*C,t[4]=v*C,t[5]=(h*p*r-g*d*r+g*i*m-e*p*m-h*i*f+e*d*f)*C,t[6]=(g*l*r-a*p*r-g*i*c+e*p*c+a*i*f-e*l*f)*C,t[7]=(a*d*r-h*l*r+h*i*c-e*d*c-a*i*m+e*l*m)*C,t[8]=y*C,t[9]=(g*u*r-h*_*r-g*n*m+e*_*m+h*n*f-e*u*f)*C,t[10]=(a*_*r-g*o*r+g*n*c-e*_*c-a*n*f+e*o*f)*C,t[11]=(h*o*r-a*u*r-h*n*c+e*u*c+a*n*m-e*o*m)*C,t[12]=L*C,t[13]=(h*_*i-g*u*i+g*n*d-e*_*d-h*n*p+e*u*p)*C,t[14]=(g*o*i-a*_*i-g*n*l+e*_*l+a*n*p-e*o*p)*C,t[15]=(a*u*i-h*o*i+h*n*l-e*u*l-a*n*d+e*o*d)*C,this}scale(t){const e=this.elements,n=t.x,i=t.y,r=t.z;return e[0]*=n,e[4]*=i,e[8]*=r,e[1]*=n,e[5]*=i,e[9]*=r,e[2]*=n,e[6]*=i,e[10]*=r,e[3]*=n,e[7]*=i,e[11]*=r,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],i=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,i))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),i=Math.sin(e),r=1-n,a=t.x,o=t.y,l=t.z,c=r*a,h=r*o;return this.set(c*a+n,c*o-i*l,c*l+i*o,0,c*o+i*l,h*o+n,h*l-i*a,0,c*l-i*o,h*l+i*a,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,i,r,a){return this.set(1,n,r,0,t,1,a,0,e,i,1,0,0,0,0,1),this}compose(t,e,n){const i=this.elements,r=e._x,a=e._y,o=e._z,l=e._w,c=r+r,h=a+a,u=o+o,d=r*c,m=r*h,g=r*u,_=a*h,p=a*u,f=o*u,S=l*c,v=l*h,y=l*u,L=n.x,b=n.y,C=n.z;return i[0]=(1-(_+f))*L,i[1]=(m+y)*L,i[2]=(g-v)*L,i[3]=0,i[4]=(m-y)*b,i[5]=(1-(d+f))*b,i[6]=(p+S)*b,i[7]=0,i[8]=(g+v)*C,i[9]=(p-S)*C,i[10]=(1-(d+_))*C,i[11]=0,i[12]=t.x,i[13]=t.y,i[14]=t.z,i[15]=1,this}decompose(t,e,n){const i=this.elements;let r=ni.set(i[0],i[1],i[2]).length();const a=ni.set(i[4],i[5],i[6]).length(),o=ni.set(i[8],i[9],i[10]).length();this.determinant()<0&&(r=-r),t.x=i[12],t.y=i[13],t.z=i[14],Je.copy(this);const c=1/r,h=1/a,u=1/o;return Je.elements[0]*=c,Je.elements[1]*=c,Je.elements[2]*=c,Je.elements[4]*=h,Je.elements[5]*=h,Je.elements[6]*=h,Je.elements[8]*=u,Je.elements[9]*=u,Je.elements[10]*=u,e.setFromRotationMatrix(Je),n.x=r,n.y=a,n.z=o,this}makePerspective(t,e,n,i,r,a,o=gn){const l=this.elements,c=2*r/(e-t),h=2*r/(n-i),u=(e+t)/(e-t),d=(n+i)/(n-i);let m,g;if(o===gn)m=-(a+r)/(a-r),g=-2*a*r/(a-r);else if(o===Hs)m=-a/(a-r),g=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=h,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=m,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,n,i,r,a,o=gn){const l=this.elements,c=1/(e-t),h=1/(n-i),u=1/(a-r),d=(e+t)*c,m=(n+i)*h;let g,_;if(o===gn)g=(a+r)*u,_=-2*u;else if(o===Hs)g=r*u,_=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-m,l[2]=0,l[6]=0,l[10]=_,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<16;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const ni=new R,Je=new ne,ch=new R(0,0,0),hh=new R(1,1,1),En=new R,cs=new R,ke=new R,io=new ne,so=new Ri;class qs{constructor(t=0,e=0,n=0,i=qs.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=i}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,i=this._order){return this._x=t,this._y=e,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const i=t.elements,r=i[0],a=i[4],o=i[8],l=i[1],c=i[5],h=i[9],u=i[2],d=i[6],m=i[10];switch(e){case"XYZ":this._y=Math.asin(Re(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,m),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Re(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,m),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(Re(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,m),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Re(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,m),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Re(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,m));break;case"XZY":this._z=Math.asin(-Re(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,m),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return io.makeRotationFromQuaternion(t),this.setFromRotationMatrix(io,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return so.setFromEuler(this),this.setFromQuaternion(so,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}qs.DEFAULT_ORDER="XYZ";class Ml{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let uh=0;const ro=new R,ii=new Ri,un=new ne,hs=new R,Ni=new R,dh=new R,fh=new Ri,ao=new R(1,0,0),oo=new R(0,1,0),lo=new R(0,0,1),ph={type:"added"},mh={type:"removed"};class oe extends Ci{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:uh++}),this.uuid=_n(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=oe.DEFAULT_UP.clone();const t=new R,e=new qs,n=new Ri,i=new R(1,1,1);function r(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new ne},normalMatrix:{value:new Xt}}),this.matrix=new ne,this.matrixWorld=new ne,this.matrixAutoUpdate=oe.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=oe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Ml,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return ii.setFromAxisAngle(t,e),this.quaternion.multiply(ii),this}rotateOnWorldAxis(t,e){return ii.setFromAxisAngle(t,e),this.quaternion.premultiply(ii),this}rotateX(t){return this.rotateOnAxis(ao,t)}rotateY(t){return this.rotateOnAxis(oo,t)}rotateZ(t){return this.rotateOnAxis(lo,t)}translateOnAxis(t,e){return ro.copy(t).applyQuaternion(this.quaternion),this.position.add(ro.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(ao,t)}translateY(t){return this.translateOnAxis(oo,t)}translateZ(t){return this.translateOnAxis(lo,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(un.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?hs.copy(t):hs.set(t,e,n);const i=this.parent;this.updateWorldMatrix(!0,!1),Ni.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?un.lookAt(Ni,hs,this.up):un.lookAt(hs,Ni,this.up),this.quaternion.setFromRotationMatrix(un),i&&(un.extractRotation(i.matrixWorld),ii.setFromRotationMatrix(un),this.quaternion.premultiply(ii.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.parent!==null&&t.parent.remove(t),t.parent=this,this.children.push(t),t.dispatchEvent(ph)):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(mh)),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),un.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),un.multiply(t.parent.matrixWorld)),t.applyMatrix4(un),this.add(t),t.updateWorldMatrix(!1,!0),this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,i=this.children.length;n<i;n++){const a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const i=this.children;for(let r=0,a=i.length;r<a;r++)i[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ni,t,dh),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ni,fh,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,i=e.length;n<i;n++){const r=e[n];(r.matrixWorldAutoUpdate===!0||t===!0)&&r.updateMatrixWorld(t)}}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.matrixWorldAutoUpdate===!0&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),e===!0){const i=this.children;for(let r=0,a=i.length;r<a;r++){const o=i[r];o.matrixWorldAutoUpdate===!0&&o.updateWorldMatrix(!1,!0)}}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.visibility=this._visibility,i.active=this._active,i.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),i.maxGeometryCount=this._maxGeometryCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.geometryCount=this._geometryCount,i.matricesTexture=this._matricesTexture.toJSON(t),this.boundingSphere!==null&&(i.boundingSphere={center:i.boundingSphere.center.toArray(),radius:i.boundingSphere.radius}),this.boundingBox!==null&&(i.boundingBox={min:i.boundingBox.min.toArray(),max:i.boundingBox.max.toArray()}));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(t.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];r(t.shapes,u)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(t.materials,this.material[l]));i.material=o}else i.material=r(t.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];i.animations.push(r(t.animations,l))}}if(e){const o=a(t.geometries),l=a(t.materials),c=a(t.textures),h=a(t.images),u=a(t.shapes),d=a(t.skeletons),m=a(t.animations),g=a(t.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),m.length>0&&(n.animations=m),g.length>0&&(n.nodes=g)}return n.object=i,n;function a(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const i=t.children[n];this.add(i.clone())}return this}}oe.DEFAULT_UP=new R(0,1,0);oe.DEFAULT_MATRIX_AUTO_UPDATE=!0;oe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Ke=new R,dn=new R,gr=new R,fn=new R,si=new R,ri=new R,co=new R,_r=new R,vr=new R,xr=new R;let us=!1;class Ye{constructor(t=new R,e=new R,n=new R){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,i){i.subVectors(n,e),Ke.subVectors(t,e),i.cross(Ke);const r=i.lengthSq();return r>0?i.multiplyScalar(1/Math.sqrt(r)):i.set(0,0,0)}static getBarycoord(t,e,n,i,r){Ke.subVectors(i,e),dn.subVectors(n,e),gr.subVectors(t,e);const a=Ke.dot(Ke),o=Ke.dot(dn),l=Ke.dot(gr),c=dn.dot(dn),h=dn.dot(gr),u=a*c-o*o;if(u===0)return r.set(0,0,0),null;const d=1/u,m=(c*l-o*h)*d,g=(a*h-o*l)*d;return r.set(1-m-g,g,m)}static containsPoint(t,e,n,i){return this.getBarycoord(t,e,n,i,fn)===null?!1:fn.x>=0&&fn.y>=0&&fn.x+fn.y<=1}static getUV(t,e,n,i,r,a,o,l){return us===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),us=!0),this.getInterpolation(t,e,n,i,r,a,o,l)}static getInterpolation(t,e,n,i,r,a,o,l){return this.getBarycoord(t,e,n,i,fn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,fn.x),l.addScaledVector(a,fn.y),l.addScaledVector(o,fn.z),l)}static isFrontFacing(t,e,n,i){return Ke.subVectors(n,e),dn.subVectors(t,e),Ke.cross(dn).dot(i)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,i){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[i]),this}setFromAttributeAndIndices(t,e,n,i){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,i),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Ke.subVectors(this.c,this.b),dn.subVectors(this.a,this.b),Ke.cross(dn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Ye.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return Ye.getBarycoord(t,this.a,this.b,this.c,e)}getUV(t,e,n,i,r){return us===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),us=!0),Ye.getInterpolation(t,this.a,this.b,this.c,e,n,i,r)}getInterpolation(t,e,n,i,r){return Ye.getInterpolation(t,this.a,this.b,this.c,e,n,i,r)}containsPoint(t){return Ye.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Ye.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,i=this.b,r=this.c;let a,o;si.subVectors(i,n),ri.subVectors(r,n),_r.subVectors(t,n);const l=si.dot(_r),c=ri.dot(_r);if(l<=0&&c<=0)return e.copy(n);vr.subVectors(t,i);const h=si.dot(vr),u=ri.dot(vr);if(h>=0&&u<=h)return e.copy(i);const d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return a=l/(l-h),e.copy(n).addScaledVector(si,a);xr.subVectors(t,r);const m=si.dot(xr),g=ri.dot(xr);if(g>=0&&m<=g)return e.copy(r);const _=m*c-l*g;if(_<=0&&c>=0&&g<=0)return o=c/(c-g),e.copy(n).addScaledVector(ri,o);const p=h*g-m*u;if(p<=0&&u-h>=0&&m-g>=0)return co.subVectors(r,i),o=(u-h)/(u-h+(m-g)),e.copy(i).addScaledVector(co,o);const f=1/(p+_+d);return a=_*f,o=d*f,e.copy(n).addScaledVector(si,a).addScaledVector(ri,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const Sl={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},wn={h:0,s:0,l:0},ds={h:0,s:0,l:0};function yr(s,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?s+(t-s)*6*e:e<1/2?t:e<2/3?s+(t-s)*6*(2/3-e):s}class Tt{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const i=t;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Ee){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Zt.toWorkingColorSpace(this,e),this}setRGB(t,e,n,i=Zt.workingColorSpace){return this.r=t,this.g=e,this.b=n,Zt.toWorkingColorSpace(this,i),this}setHSL(t,e,n,i=Zt.workingColorSpace){if(t=eh(t,1),e=Re(e,0,1),n=Re(n,0,1),e===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+e):n+e-n*e,a=2*n-r;this.r=yr(a,r,t+1/3),this.g=yr(a,r,t),this.b=yr(a,r,t-1/3)}return Zt.toWorkingColorSpace(this,i),this}setStyle(t,e=Ee){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(t)){let r;const a=i[1],o=i[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=i[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Ee){const n=Sl[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Si(t.r),this.g=Si(t.g),this.b=Si(t.b),this}copyLinearToSRGB(t){return this.r=lr(t.r),this.g=lr(t.g),this.b=lr(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Ee){return Zt.fromWorkingColorSpace(be.copy(this),t),Math.round(Re(be.r*255,0,255))*65536+Math.round(Re(be.g*255,0,255))*256+Math.round(Re(be.b*255,0,255))}getHexString(t=Ee){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Zt.workingColorSpace){Zt.fromWorkingColorSpace(be.copy(this),e);const n=be.r,i=be.g,r=be.b,a=Math.max(n,i,r),o=Math.min(n,i,r);let l,c;const h=(o+a)/2;if(o===a)l=0,c=0;else{const u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case n:l=(i-r)/u+(i<r?6:0);break;case i:l=(r-n)/u+2;break;case r:l=(n-i)/u+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=Zt.workingColorSpace){return Zt.fromWorkingColorSpace(be.copy(this),e),t.r=be.r,t.g=be.g,t.b=be.b,t}getStyle(t=Ee){Zt.fromWorkingColorSpace(be.copy(this),t);const e=be.r,n=be.g,i=be.b;return t!==Ee?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(t,e,n){return this.getHSL(wn),this.setHSL(wn.h+t,wn.s+e,wn.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(wn),t.getHSL(ds);const n=ar(wn.h,ds.h,e),i=ar(wn.s,ds.s,e),r=ar(wn.l,ds.l,e);return this.setHSL(n,i,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,i=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*i,this.g=r[1]*e+r[4]*n+r[7]*i,this.b=r[2]*e+r[5]*n+r[8]*i,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const be=new Tt;Tt.NAMES=Sl;let gh=0;class xn extends Ci{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:gh++}),this.uuid=_n(),this.name="",this.type="Material",this.blending=Vn,this.side=Dn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Fr,this.blendDst=Or,this.blendEquation=Gn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Tt(0,0,0),this.blendAlpha=0,this.depthFunc=Fs,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Za,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Jn,this.stencilZFail=Jn,this.stencilZPass=Jn,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBuild(){}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const i=this[e];if(i===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Vn&&(n.blending=this.blending),this.side!==Dn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Fr&&(n.blendSrc=this.blendSrc),this.blendDst!==Or&&(n.blendDst=this.blendDst),this.blendEquation!==Gn&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Fs&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Za&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Jn&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Jn&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Jn&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(e){const r=i(t.textures),a=i(t.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const i=e.length;n=new Array(i);for(let r=0;r!==i;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}}class fe extends xn{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Tt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=sl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const de=new R,fs=new at;class Pe{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=kr,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.gpuType=bn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}get updateRange(){return console.warn("THREE.BufferAttribute: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[t+i]=e.array[n+i];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)fs.fromBufferAttribute(this,e),fs.applyMatrix3(t),this.setXY(e,fs.x,fs.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)de.fromBufferAttribute(this,e),de.applyMatrix3(t),this.setXYZ(e,de.x,de.y,de.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)de.fromBufferAttribute(this,e),de.applyMatrix4(t),this.setXYZ(e,de.x,de.y,de.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)de.fromBufferAttribute(this,e),de.applyNormalMatrix(t),this.setXYZ(e,de.x,de.y,de.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)de.fromBufferAttribute(this,e),de.transformDirection(t),this.setXYZ(e,de.x,de.y,de.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=mn(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Jt(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=mn(e,this.array)),e}setX(t,e){return this.normalized&&(e=Jt(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=mn(e,this.array)),e}setY(t,e){return this.normalized&&(e=Jt(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=mn(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Jt(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=mn(e,this.array)),e}setW(t,e){return this.normalized&&(e=Jt(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Jt(e,this.array),n=Jt(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,i){return t*=this.itemSize,this.normalized&&(e=Jt(e,this.array),n=Jt(n,this.array),i=Jt(i,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this}setXYZW(t,e,n,i,r){return t*=this.itemSize,this.normalized&&(e=Jt(e,this.array),n=Jt(n,this.array),i=Jt(i,this.array),r=Jt(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==kr&&(t.usage=this.usage),t}}class El extends Pe{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class wl extends Pe{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class ie extends Pe{constructor(t,e,n){super(new Float32Array(t),e,n)}}let _h=0;const Xe=new ne,Mr=new oe,ai=new R,Ve=new Zn,Fi=new Zn,xe=new R;class we extends Ci{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:_h++}),this.uuid=_n(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(gl(t)?wl:El)(t,1):this.index=t,this}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Xt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}const i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(t),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return Xe.makeRotationFromQuaternion(t),this.applyMatrix4(Xe),this}rotateX(t){return Xe.makeRotationX(t),this.applyMatrix4(Xe),this}rotateY(t){return Xe.makeRotationY(t),this.applyMatrix4(Xe),this}rotateZ(t){return Xe.makeRotationZ(t),this.applyMatrix4(Xe),this}translate(t,e,n){return Xe.makeTranslation(t,e,n),this.applyMatrix4(Xe),this}scale(t,e,n){return Xe.makeScale(t,e,n),this.applyMatrix4(Xe),this}lookAt(t){return Mr.lookAt(t),Mr.updateMatrix(),this.applyMatrix4(Mr.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ai).negate(),this.translate(ai.x,ai.y,ai.z),this}setFromPoints(t){const e=[];for(let n=0,i=t.length;n<i;n++){const r=t[n];e.push(r.x,r.y,r.z||0)}return this.setAttribute("position",new ie(e,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Zn);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingBox.set(new R(-1/0,-1/0,-1/0),new R(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,i=e.length;n<i;n++){const r=e[n];Ve.setFromBufferAttribute(r),this.morphTargetsRelative?(xe.addVectors(this.boundingBox.min,Ve.min),this.boundingBox.expandByPoint(xe),xe.addVectors(this.boundingBox.max,Ve.max),this.boundingBox.expandByPoint(xe)):(this.boundingBox.expandByPoint(Ve.min),this.boundingBox.expandByPoint(Ve.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Pi);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingSphere.set(new R,1/0);return}if(t){const n=this.boundingSphere.center;if(Ve.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){const o=e[r];Fi.setFromBufferAttribute(o),this.morphTargetsRelative?(xe.addVectors(Ve.min,Fi.min),Ve.expandByPoint(xe),xe.addVectors(Ve.max,Fi.max),Ve.expandByPoint(xe)):(Ve.expandByPoint(Fi.min),Ve.expandByPoint(Fi.max))}Ve.getCenter(n);let i=0;for(let r=0,a=t.count;r<a;r++)xe.fromBufferAttribute(t,r),i=Math.max(i,n.distanceToSquared(xe));if(e)for(let r=0,a=e.length;r<a;r++){const o=e[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)xe.fromBufferAttribute(o,c),l&&(ai.fromBufferAttribute(t,c),xe.add(ai)),i=Math.max(i,n.distanceToSquared(xe))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.array,i=e.position.array,r=e.normal.array,a=e.uv.array,o=i.length/3;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Pe(new Float32Array(4*o),4));const l=this.getAttribute("tangent").array,c=[],h=[];for(let w=0;w<o;w++)c[w]=new R,h[w]=new R;const u=new R,d=new R,m=new R,g=new at,_=new at,p=new at,f=new R,S=new R;function v(w,F,G){u.fromArray(i,w*3),d.fromArray(i,F*3),m.fromArray(i,G*3),g.fromArray(a,w*2),_.fromArray(a,F*2),p.fromArray(a,G*2),d.sub(u),m.sub(u),_.sub(g),p.sub(g);const J=1/(_.x*p.y-p.x*_.y);isFinite(J)&&(f.copy(d).multiplyScalar(p.y).addScaledVector(m,-_.y).multiplyScalar(J),S.copy(m).multiplyScalar(_.x).addScaledVector(d,-p.x).multiplyScalar(J),c[w].add(f),c[F].add(f),c[G].add(f),h[w].add(S),h[F].add(S),h[G].add(S))}let y=this.groups;y.length===0&&(y=[{start:0,count:n.length}]);for(let w=0,F=y.length;w<F;++w){const G=y[w],J=G.start,D=G.count;for(let B=J,k=J+D;B<k;B+=3)v(n[B+0],n[B+1],n[B+2])}const L=new R,b=new R,C=new R,O=new R;function M(w){C.fromArray(r,w*3),O.copy(C);const F=c[w];L.copy(F),L.sub(C.multiplyScalar(C.dot(F))).normalize(),b.crossVectors(O,F);const J=b.dot(h[w])<0?-1:1;l[w*4]=L.x,l[w*4+1]=L.y,l[w*4+2]=L.z,l[w*4+3]=J}for(let w=0,F=y.length;w<F;++w){const G=y[w],J=G.start,D=G.count;for(let B=J,k=J+D;B<k;B+=3)M(n[B+0]),M(n[B+1]),M(n[B+2])}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Pe(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,m=n.count;d<m;d++)n.setXYZ(d,0,0,0);const i=new R,r=new R,a=new R,o=new R,l=new R,c=new R,h=new R,u=new R;if(t)for(let d=0,m=t.count;d<m;d+=3){const g=t.getX(d+0),_=t.getX(d+1),p=t.getX(d+2);i.fromBufferAttribute(e,g),r.fromBufferAttribute(e,_),a.fromBufferAttribute(e,p),h.subVectors(a,r),u.subVectors(i,r),h.cross(u),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,_),c.fromBufferAttribute(n,p),o.add(h),l.add(h),c.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(_,l.x,l.y,l.z),n.setXYZ(p,c.x,c.y,c.z)}else for(let d=0,m=e.count;d<m;d+=3)i.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),a.fromBufferAttribute(e,d+2),h.subVectors(a,r),u.subVectors(i,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)xe.fromBufferAttribute(t,e),xe.normalize(),t.setXYZ(e,xe.x,xe.y,xe.z)}toNonIndexed(){function t(o,l){const c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h);let m=0,g=0;for(let _=0,p=l.length;_<p;_++){o.isInterleavedBufferAttribute?m=l[_]*o.data.stride+o.offset:m=l[_]*h;for(let f=0;f<h;f++)d[g++]=c[m++]}return new Pe(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new we,n=this.index.array,i=this.attributes;for(const o in i){const l=i[o],c=t(l,n);e.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let h=0,u=c.length;h<u;h++){const d=c[h],m=t(d,n);l.push(m)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const l in n){const c=n[l];t.data.attributes[l]=c.toJSON(t.data)}const i={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){const m=c[u];h.push(m.toJSON(t.data))}h.length>0&&(i[l]=h,r=!0)}r&&(t.data.morphAttributes=i,t.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(t.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone(e));const i=t.attributes;for(const c in i){const h=i[c];this.setAttribute(c,h.clone(e))}const r=t.morphAttributes;for(const c in r){const h=[],u=r[c];for(let d=0,m=u.length;d<m;d++)h.push(u[d].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;const a=t.groups;for(let c=0,h=a.length;c<h;c++){const u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}const o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const ho=new ne,On=new yl,ps=new Pi,uo=new R,oi=new R,li=new R,ci=new R,Sr=new R,ms=new R,gs=new at,_s=new at,vs=new at,fo=new R,po=new R,mo=new R,xs=new R,ys=new R;class st extends oe{constructor(t=new we,e=new fe){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){const n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(i,t);const o=this.morphTargetInfluences;if(r&&o){ms.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const h=o[l],u=r[l];h!==0&&(Sr.fromBufferAttribute(u,t),a?ms.addScaledVector(Sr,h):ms.addScaledVector(Sr.sub(e),h))}e.add(ms)}return e}raycast(t,e){const n=this.geometry,i=this.material,r=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),ps.copy(n.boundingSphere),ps.applyMatrix4(r),On.copy(t.ray).recast(t.near),!(ps.containsPoint(On.origin)===!1&&(On.intersectSphere(ps,uo)===null||On.origin.distanceToSquared(uo)>(t.far-t.near)**2))&&(ho.copy(r).invert(),On.copy(t.ray).applyMatrix4(ho),!(n.boundingBox!==null&&On.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,On)))}_computeIntersections(t,e,n){let i;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,m=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,_=d.length;g<_;g++){const p=d[g],f=a[p.materialIndex],S=Math.max(p.start,m.start),v=Math.min(o.count,Math.min(p.start+p.count,m.start+m.count));for(let y=S,L=v;y<L;y+=3){const b=o.getX(y),C=o.getX(y+1),O=o.getX(y+2);i=Ms(this,f,t,n,c,h,u,b,C,O),i&&(i.faceIndex=Math.floor(y/3),i.face.materialIndex=p.materialIndex,e.push(i))}}else{const g=Math.max(0,m.start),_=Math.min(o.count,m.start+m.count);for(let p=g,f=_;p<f;p+=3){const S=o.getX(p),v=o.getX(p+1),y=o.getX(p+2);i=Ms(this,a,t,n,c,h,u,S,v,y),i&&(i.faceIndex=Math.floor(p/3),e.push(i))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,_=d.length;g<_;g++){const p=d[g],f=a[p.materialIndex],S=Math.max(p.start,m.start),v=Math.min(l.count,Math.min(p.start+p.count,m.start+m.count));for(let y=S,L=v;y<L;y+=3){const b=y,C=y+1,O=y+2;i=Ms(this,f,t,n,c,h,u,b,C,O),i&&(i.faceIndex=Math.floor(y/3),i.face.materialIndex=p.materialIndex,e.push(i))}}else{const g=Math.max(0,m.start),_=Math.min(l.count,m.start+m.count);for(let p=g,f=_;p<f;p+=3){const S=p,v=p+1,y=p+2;i=Ms(this,a,t,n,c,h,u,S,v,y),i&&(i.faceIndex=Math.floor(p/3),e.push(i))}}}}function vh(s,t,e,n,i,r,a,o){let l;if(t.side===ze?l=n.intersectTriangle(a,r,i,!0,o):l=n.intersectTriangle(i,r,a,t.side===Dn,o),l===null)return null;ys.copy(o),ys.applyMatrix4(s.matrixWorld);const c=e.ray.origin.distanceTo(ys);return c<e.near||c>e.far?null:{distance:c,point:ys.clone(),object:s}}function Ms(s,t,e,n,i,r,a,o,l,c){s.getVertexPosition(o,oi),s.getVertexPosition(l,li),s.getVertexPosition(c,ci);const h=vh(s,t,e,n,oi,li,ci,xs);if(h){i&&(gs.fromBufferAttribute(i,o),_s.fromBufferAttribute(i,l),vs.fromBufferAttribute(i,c),h.uv=Ye.getInterpolation(xs,oi,li,ci,gs,_s,vs,new at)),r&&(gs.fromBufferAttribute(r,o),_s.fromBufferAttribute(r,l),vs.fromBufferAttribute(r,c),h.uv1=Ye.getInterpolation(xs,oi,li,ci,gs,_s,vs,new at),h.uv2=h.uv1),a&&(fo.fromBufferAttribute(a,o),po.fromBufferAttribute(a,l),mo.fromBufferAttribute(a,c),h.normal=Ye.getInterpolation(xs,oi,li,ci,fo,po,mo,new R),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const u={a:o,b:l,c,normal:new R,materialIndex:0};Ye.getNormal(oi,li,ci,u.normal),h.face=u}return h}class Oe extends we{constructor(t=1,e=1,n=1,i=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:i,heightSegments:r,depthSegments:a};const o=this;i=Math.floor(i),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],h=[],u=[];let d=0,m=0;g("z","y","x",-1,-1,n,e,t,a,r,0),g("z","y","x",1,-1,n,e,-t,a,r,1),g("x","z","y",1,1,t,n,e,i,a,2),g("x","z","y",1,-1,t,n,-e,i,a,3),g("x","y","z",1,-1,t,e,n,i,r,4),g("x","y","z",-1,-1,t,e,-n,i,r,5),this.setIndex(l),this.setAttribute("position",new ie(c,3)),this.setAttribute("normal",new ie(h,3)),this.setAttribute("uv",new ie(u,2));function g(_,p,f,S,v,y,L,b,C,O,M){const w=y/C,F=L/O,G=y/2,J=L/2,D=b/2,B=C+1,k=O+1;let Y=0,$=0;const j=new R;for(let Z=0;Z<k;Z++){const it=Z*F-J;for(let ot=0;ot<B;ot++){const W=ot*w-G;j[_]=W*S,j[p]=it*v,j[f]=D,c.push(j.x,j.y,j.z),j[_]=0,j[p]=0,j[f]=b>0?1:-1,h.push(j.x,j.y,j.z),u.push(ot/C),u.push(1-Z/O),Y+=1}}for(let Z=0;Z<O;Z++)for(let it=0;it<C;it++){const ot=d+it+B*Z,W=d+it+B*(Z+1),Q=d+(it+1)+B*(Z+1),pt=d+(it+1)+B*Z;l.push(ot,W,pt),l.push(W,Q,pt),$+=6}o.addGroup(m,$,M),m+=$,d+=Y}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Oe(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function bi(s){const t={};for(const e in s){t[e]={};for(const n in s[e]){const i=s[e][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=i.clone():Array.isArray(i)?t[e][n]=i.slice():t[e][n]=i}}return t}function Ue(s){const t={};for(let e=0;e<s.length;e++){const n=bi(s[e]);for(const i in n)t[i]=n[i]}return t}function xh(s){const t=[];for(let e=0;e<s.length;e++)t.push(s[e].clone());return t}function Tl(s){return s.getRenderTarget()===null?s.outputColorSpace:Zt.workingColorSpace}const yh={clone:bi,merge:Ue};var Mh=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Sh=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class $n extends xn{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Mh,this.fragmentShader=Sh,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1,clipCullDistance:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=bi(t.uniforms),this.uniformsGroups=xh(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const i in this.uniforms){const a=this.uniforms[i].value;a&&a.isTexture?e.uniforms[i]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[i]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[i]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[i]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[i]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[i]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[i]={type:"m4",value:a.toArray()}:e.uniforms[i]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class Al extends oe{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ne,this.projectionMatrix=new ne,this.projectionMatrixInverse=new ne,this.coordinateSystem=gn}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}class $e extends Al{constructor(t=50,e=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=Wr*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(rr*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Wr*2*Math.atan(Math.tan(rr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}setViewOffset(t,e,n,i,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(rr*.5*this.fov)/this.zoom,n=2*e,i=this.aspect*n,r=-.5*i;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*i/l,e-=a.offsetY*n/c,i*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const hi=-90,ui=1;class Eh extends oe{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const i=new $e(hi,ui,t,e);i.layers=this.layers,this.add(i);const r=new $e(hi,ui,t,e);r.layers=this.layers,this.add(r);const a=new $e(hi,ui,t,e);a.layers=this.layers,this.add(a);const o=new $e(hi,ui,t,e);o.layers=this.layers,this.add(o);const l=new $e(hi,ui,t,e);l.layers=this.layers,this.add(l);const c=new $e(hi,ui,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,i,r,a,o,l]=e;for(const c of e)this.remove(c);if(t===gn)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===Hs)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,h]=this.children,u=t.getRenderTarget(),d=t.getActiveCubeFace(),m=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;const _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,i),t.render(e,r),t.setRenderTarget(n,1,i),t.render(e,a),t.setRenderTarget(n,2,i),t.render(e,o),t.setRenderTarget(n,3,i),t.render(e,l),t.setRenderTarget(n,4,i),t.render(e,c),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,i),t.render(e,h),t.setRenderTarget(u,d,m),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class bl extends He{constructor(t,e,n,i,r,a,o,l,c,h){t=t!==void 0?t:[],e=e!==void 0?e:wi,super(t,e,n,i,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class wh extends Yn{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},i=[n,n,n,n,n,n];e.encoding!==void 0&&(ki("THREE.WebGLCubeRenderTarget: option.encoding has been replaced by option.colorSpace."),e.colorSpace=e.encoding===qn?Ee:je),this.texture=new bl(i,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:qe}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},i=new Oe(5,5,5),r=new $n({name:"CubemapFromEquirect",uniforms:bi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:ze,blending:Cn});r.uniforms.tEquirect.value=e;const a=new st(i,r),o=e.minFilter;return e.minFilter===Yi&&(e.minFilter=qe),new Eh(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e,n,i){const r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,i);t.setRenderTarget(r)}}const Er=new R,Th=new R,Ah=new Xt;class zn{constructor(t=new R(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,i){return this.normal.set(t,e,n),this.constant=i,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const i=Er.subVectors(n,e).cross(Th.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(i,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta(Er),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const r=-(t.start.dot(this.normal)+this.constant)/i;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||Ah.getNormalMatrix(t),i=this.coplanarPoint(Er).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Bn=new Pi,Ss=new R;class ea{constructor(t=new zn,e=new zn,n=new zn,i=new zn,r=new zn,a=new zn){this.planes=[t,e,n,i,r,a]}set(t,e,n,i,r,a){const o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(i),o[4].copy(r),o[5].copy(a),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=gn){const n=this.planes,i=t.elements,r=i[0],a=i[1],o=i[2],l=i[3],c=i[4],h=i[5],u=i[6],d=i[7],m=i[8],g=i[9],_=i[10],p=i[11],f=i[12],S=i[13],v=i[14],y=i[15];if(n[0].setComponents(l-r,d-c,p-m,y-f).normalize(),n[1].setComponents(l+r,d+c,p+m,y+f).normalize(),n[2].setComponents(l+a,d+h,p+g,y+S).normalize(),n[3].setComponents(l-a,d-h,p-g,y-S).normalize(),n[4].setComponents(l-o,d-u,p-_,y-v).normalize(),e===gn)n[5].setComponents(l+o,d+u,p+_,y+v).normalize();else if(e===Hs)n[5].setComponents(o,u,_,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Bn.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Bn.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Bn)}intersectsSprite(t){return Bn.center.set(0,0,0),Bn.radius=.7071067811865476,Bn.applyMatrix4(t.matrixWorld),this.intersectsSphere(Bn)}intersectsSphere(t){const e=this.planes,n=t.center,i=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const i=e[n];if(Ss.x=i.normal.x>0?t.max.x:t.min.x,Ss.y=i.normal.y>0?t.max.y:t.min.y,Ss.z=i.normal.z>0?t.max.z:t.min.z,i.distanceToPoint(Ss)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Cl(){let s=null,t=!1,e=null,n=null;function i(r,a){e(r,a),n=s.requestAnimationFrame(i)}return{start:function(){t!==!0&&e!==null&&(n=s.requestAnimationFrame(i),t=!0)},stop:function(){s.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){s=r}}}function bh(s,t){const e=t.isWebGL2,n=new WeakMap;function i(c,h){const u=c.array,d=c.usage,m=u.byteLength,g=s.createBuffer();s.bindBuffer(h,g),s.bufferData(h,u,d),c.onUploadCallback();let _;if(u instanceof Float32Array)_=s.FLOAT;else if(u instanceof Uint16Array)if(c.isFloat16BufferAttribute)if(e)_=s.HALF_FLOAT;else throw new Error("THREE.WebGLAttributes: Usage of Float16BufferAttribute requires WebGL2.");else _=s.UNSIGNED_SHORT;else if(u instanceof Int16Array)_=s.SHORT;else if(u instanceof Uint32Array)_=s.UNSIGNED_INT;else if(u instanceof Int32Array)_=s.INT;else if(u instanceof Int8Array)_=s.BYTE;else if(u instanceof Uint8Array)_=s.UNSIGNED_BYTE;else if(u instanceof Uint8ClampedArray)_=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+u);return{buffer:g,type:_,bytesPerElement:u.BYTES_PER_ELEMENT,version:c.version,size:m}}function r(c,h,u){const d=h.array,m=h._updateRange,g=h.updateRanges;if(s.bindBuffer(u,c),m.count===-1&&g.length===0&&s.bufferSubData(u,0,d),g.length!==0){for(let _=0,p=g.length;_<p;_++){const f=g[_];e?s.bufferSubData(u,f.start*d.BYTES_PER_ELEMENT,d,f.start,f.count):s.bufferSubData(u,f.start*d.BYTES_PER_ELEMENT,d.subarray(f.start,f.start+f.count))}h.clearUpdateRanges()}m.count!==-1&&(e?s.bufferSubData(u,m.offset*d.BYTES_PER_ELEMENT,d,m.offset,m.count):s.bufferSubData(u,m.offset*d.BYTES_PER_ELEMENT,d.subarray(m.offset,m.offset+m.count)),m.count=-1),h.onUploadCallback()}function a(c){return c.isInterleavedBufferAttribute&&(c=c.data),n.get(c)}function o(c){c.isInterleavedBufferAttribute&&(c=c.data);const h=n.get(c);h&&(s.deleteBuffer(h.buffer),n.delete(c))}function l(c,h){if(c.isGLBufferAttribute){const d=n.get(c);(!d||d.version<c.version)&&n.set(c,{buffer:c.buffer,type:c.type,bytesPerElement:c.elementSize,version:c.version});return}c.isInterleavedBufferAttribute&&(c=c.data);const u=n.get(c);if(u===void 0)n.set(c,i(c,h));else if(u.version<c.version){if(u.size!==c.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");r(u.buffer,c,h),u.version=c.version}}return{get:a,remove:o,update:l}}class Ce extends we{constructor(t=1,e=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:i};const r=t/2,a=e/2,o=Math.floor(n),l=Math.floor(i),c=o+1,h=l+1,u=t/o,d=e/l,m=[],g=[],_=[],p=[];for(let f=0;f<h;f++){const S=f*d-a;for(let v=0;v<c;v++){const y=v*u-r;g.push(y,-S,0),_.push(0,0,1),p.push(v/o),p.push(1-f/l)}}for(let f=0;f<l;f++)for(let S=0;S<o;S++){const v=S+c*f,y=S+c*(f+1),L=S+1+c*(f+1),b=S+1+c*f;m.push(v,y,b),m.push(y,L,b)}this.setIndex(m),this.setAttribute("position",new ie(g,3)),this.setAttribute("normal",new ie(_,3)),this.setAttribute("uv",new ie(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ce(t.width,t.height,t.widthSegments,t.heightSegments)}}var Ch=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Rh=`#ifdef USE_ALPHAHASH
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
#endif`,Ph=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Lh=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Dh=`#ifdef USE_ALPHATEST
	if ( diffuseColor.a < alphaTest ) discard;
#endif`,Ih=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Uh=`#ifdef USE_AOMAP
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
#endif`,Nh=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Fh=`#ifdef USE_BATCHING
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
#endif`,Oh=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( batchId );
#endif`,Bh=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,zh=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Hh=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Gh=`#ifdef USE_IRIDESCENCE
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
#endif`,kh=`#ifdef USE_BUMPMAP
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
#endif`,Vh=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Wh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Xh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,qh=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Yh=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,$h=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,jh=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,Zh=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,Jh=`#define PI 3.141592653589793
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
} // validated`,Kh=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Qh=`vec3 transformedNormal = objectNormal;
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
#endif`,tu=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,eu=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,nu=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,iu=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,su="gl_FragColor = linearToOutputTexel( gl_FragColor );",ru=`
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
}`,au=`#ifdef USE_ENVMAP
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
#endif`,ou=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,lu=`#ifdef USE_ENVMAP
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
#endif`,cu=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,hu=`#ifdef USE_ENVMAP
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
#endif`,uu=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,du=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fu=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,pu=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,mu=`#ifdef USE_GRADIENTMAP
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
}`,gu=`#ifdef USE_LIGHTMAP
	vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
	vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
	reflectedLight.indirectDiffuse += lightMapIrradiance;
#endif`,_u=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,vu=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,xu=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,yu=`uniform bool receiveShadow;
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
#endif`,Mu=`#ifdef USE_ENVMAP
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
#endif`,Su=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Eu=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,wu=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Tu=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Au=`PhysicalMaterial material;
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
#endif`,bu=`struct PhysicalMaterial {
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
}`,Cu=`
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
#endif`,Ru=`#if defined( RE_IndirectDiffuse )
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
#endif`,Pu=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Lu=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Du=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Iu=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
		varying float vIsPerspective;
	#else
		uniform float logDepthBufFC;
	#endif
#endif`,Uu=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
	#else
		if ( isPerspectiveMatrix( projectionMatrix ) ) {
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		}
	#endif
#endif`,Nu=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
	
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Fu=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Ou=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,Bu=`#if defined( USE_POINTS_UV )
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
#endif`,zu=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Hu=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Gu=`#if defined( USE_MORPHCOLORS ) && defined( MORPHTARGETS_TEXTURE )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,ku=`#ifdef USE_MORPHNORMALS
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
#endif`,Vu=`#ifdef USE_MORPHTARGETS
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
#endif`,Wu=`#ifdef USE_MORPHTARGETS
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
#endif`,Xu=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,qu=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,Yu=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,$u=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,ju=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Zu=`#ifdef USE_NORMALMAP
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
#endif`,Ju=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Ku=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Qu=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,td=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,ed=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,nd=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,id=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,sd=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,rd=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,ad=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,od=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,ld=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,cd=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,hd=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,ud=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,dd=`float getShadowMask() {
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
}`,fd=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,pd=`#ifdef USE_SKINNING
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
#endif`,md=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,gd=`#ifdef USE_SKINNING
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
#endif`,_d=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,vd=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,xd=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,yd=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,Md=`#ifdef USE_TRANSMISSION
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
#endif`,Sd=`#ifdef USE_TRANSMISSION
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
#endif`,Ed=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,wd=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,Td=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,Ad=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const bd=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Cd=`uniform sampler2D t2D;
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
}`,Rd=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Pd=`#ifdef ENVMAP_TYPE_CUBE
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
}`,Ld=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Dd=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Id=`#include <common>
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
}`,Ud=`#if DEPTH_PACKING == 3200
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
}`,Nd=`#define DISTANCE
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
}`,Fd=`#define DISTANCE
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
}`,Od=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Bd=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,zd=`uniform float scale;
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
}`,Hd=`uniform vec3 diffuse;
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
}`,Gd=`#include <common>
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
}`,kd=`uniform vec3 diffuse;
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
}`,Vd=`#define LAMBERT
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
}`,Wd=`#define LAMBERT
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
}`,Xd=`#define MATCAP
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
}`,qd=`#define MATCAP
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
}`,Yd=`#define NORMAL
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
}`,$d=`#define NORMAL
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
}`,jd=`#define PHONG
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
}`,Zd=`#define PHONG
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
}`,Jd=`#define STANDARD
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
}`,Kd=`#define STANDARD
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
}`,Qd=`#define TOON
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
}`,tf=`#define TOON
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
}`,ef=`uniform float size;
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
}`,nf=`uniform vec3 diffuse;
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
}`,sf=`#include <common>
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
}`,rf=`uniform vec3 color;
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
}`,af=`uniform float rotation;
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
}`,of=`uniform vec3 diffuse;
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
}`,Gt={alphahash_fragment:Ch,alphahash_pars_fragment:Rh,alphamap_fragment:Ph,alphamap_pars_fragment:Lh,alphatest_fragment:Dh,alphatest_pars_fragment:Ih,aomap_fragment:Uh,aomap_pars_fragment:Nh,batching_pars_vertex:Fh,batching_vertex:Oh,begin_vertex:Bh,beginnormal_vertex:zh,bsdfs:Hh,iridescence_fragment:Gh,bumpmap_pars_fragment:kh,clipping_planes_fragment:Vh,clipping_planes_pars_fragment:Wh,clipping_planes_pars_vertex:Xh,clipping_planes_vertex:qh,color_fragment:Yh,color_pars_fragment:$h,color_pars_vertex:jh,color_vertex:Zh,common:Jh,cube_uv_reflection_fragment:Kh,defaultnormal_vertex:Qh,displacementmap_pars_vertex:tu,displacementmap_vertex:eu,emissivemap_fragment:nu,emissivemap_pars_fragment:iu,colorspace_fragment:su,colorspace_pars_fragment:ru,envmap_fragment:au,envmap_common_pars_fragment:ou,envmap_pars_fragment:lu,envmap_pars_vertex:cu,envmap_physical_pars_fragment:Mu,envmap_vertex:hu,fog_vertex:uu,fog_pars_vertex:du,fog_fragment:fu,fog_pars_fragment:pu,gradientmap_pars_fragment:mu,lightmap_fragment:gu,lightmap_pars_fragment:_u,lights_lambert_fragment:vu,lights_lambert_pars_fragment:xu,lights_pars_begin:yu,lights_toon_fragment:Su,lights_toon_pars_fragment:Eu,lights_phong_fragment:wu,lights_phong_pars_fragment:Tu,lights_physical_fragment:Au,lights_physical_pars_fragment:bu,lights_fragment_begin:Cu,lights_fragment_maps:Ru,lights_fragment_end:Pu,logdepthbuf_fragment:Lu,logdepthbuf_pars_fragment:Du,logdepthbuf_pars_vertex:Iu,logdepthbuf_vertex:Uu,map_fragment:Nu,map_pars_fragment:Fu,map_particle_fragment:Ou,map_particle_pars_fragment:Bu,metalnessmap_fragment:zu,metalnessmap_pars_fragment:Hu,morphcolor_vertex:Gu,morphnormal_vertex:ku,morphtarget_pars_vertex:Vu,morphtarget_vertex:Wu,normal_fragment_begin:Xu,normal_fragment_maps:qu,normal_pars_fragment:Yu,normal_pars_vertex:$u,normal_vertex:ju,normalmap_pars_fragment:Zu,clearcoat_normal_fragment_begin:Ju,clearcoat_normal_fragment_maps:Ku,clearcoat_pars_fragment:Qu,iridescence_pars_fragment:td,opaque_fragment:ed,packing:nd,premultiplied_alpha_fragment:id,project_vertex:sd,dithering_fragment:rd,dithering_pars_fragment:ad,roughnessmap_fragment:od,roughnessmap_pars_fragment:ld,shadowmap_pars_fragment:cd,shadowmap_pars_vertex:hd,shadowmap_vertex:ud,shadowmask_pars_fragment:dd,skinbase_vertex:fd,skinning_pars_vertex:pd,skinning_vertex:md,skinnormal_vertex:gd,specularmap_fragment:_d,specularmap_pars_fragment:vd,tonemapping_fragment:xd,tonemapping_pars_fragment:yd,transmission_fragment:Md,transmission_pars_fragment:Sd,uv_pars_fragment:Ed,uv_pars_vertex:wd,uv_vertex:Td,worldpos_vertex:Ad,background_vert:bd,background_frag:Cd,backgroundCube_vert:Rd,backgroundCube_frag:Pd,cube_vert:Ld,cube_frag:Dd,depth_vert:Id,depth_frag:Ud,distanceRGBA_vert:Nd,distanceRGBA_frag:Fd,equirect_vert:Od,equirect_frag:Bd,linedashed_vert:zd,linedashed_frag:Hd,meshbasic_vert:Gd,meshbasic_frag:kd,meshlambert_vert:Vd,meshlambert_frag:Wd,meshmatcap_vert:Xd,meshmatcap_frag:qd,meshnormal_vert:Yd,meshnormal_frag:$d,meshphong_vert:jd,meshphong_frag:Zd,meshphysical_vert:Jd,meshphysical_frag:Kd,meshtoon_vert:Qd,meshtoon_frag:tf,points_vert:ef,points_frag:nf,shadow_vert:sf,shadow_frag:rf,sprite_vert:af,sprite_frag:of},ht={common:{diffuse:{value:new Tt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Xt},alphaMap:{value:null},alphaMapTransform:{value:new Xt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Xt}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Xt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Xt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Xt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Xt},normalScale:{value:new at(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Xt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Xt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Xt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Xt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Tt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Tt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Xt},alphaTest:{value:0},uvTransform:{value:new Xt}},sprite:{diffuse:{value:new Tt(16777215)},opacity:{value:1},center:{value:new at(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Xt},alphaMap:{value:null},alphaMapTransform:{value:new Xt},alphaTest:{value:0}}},rn={basic:{uniforms:Ue([ht.common,ht.specularmap,ht.envmap,ht.aomap,ht.lightmap,ht.fog]),vertexShader:Gt.meshbasic_vert,fragmentShader:Gt.meshbasic_frag},lambert:{uniforms:Ue([ht.common,ht.specularmap,ht.envmap,ht.aomap,ht.lightmap,ht.emissivemap,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.fog,ht.lights,{emissive:{value:new Tt(0)}}]),vertexShader:Gt.meshlambert_vert,fragmentShader:Gt.meshlambert_frag},phong:{uniforms:Ue([ht.common,ht.specularmap,ht.envmap,ht.aomap,ht.lightmap,ht.emissivemap,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.fog,ht.lights,{emissive:{value:new Tt(0)},specular:{value:new Tt(1118481)},shininess:{value:30}}]),vertexShader:Gt.meshphong_vert,fragmentShader:Gt.meshphong_frag},standard:{uniforms:Ue([ht.common,ht.envmap,ht.aomap,ht.lightmap,ht.emissivemap,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.roughnessmap,ht.metalnessmap,ht.fog,ht.lights,{emissive:{value:new Tt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Gt.meshphysical_vert,fragmentShader:Gt.meshphysical_frag},toon:{uniforms:Ue([ht.common,ht.aomap,ht.lightmap,ht.emissivemap,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.gradientmap,ht.fog,ht.lights,{emissive:{value:new Tt(0)}}]),vertexShader:Gt.meshtoon_vert,fragmentShader:Gt.meshtoon_frag},matcap:{uniforms:Ue([ht.common,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.fog,{matcap:{value:null}}]),vertexShader:Gt.meshmatcap_vert,fragmentShader:Gt.meshmatcap_frag},points:{uniforms:Ue([ht.points,ht.fog]),vertexShader:Gt.points_vert,fragmentShader:Gt.points_frag},dashed:{uniforms:Ue([ht.common,ht.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Gt.linedashed_vert,fragmentShader:Gt.linedashed_frag},depth:{uniforms:Ue([ht.common,ht.displacementmap]),vertexShader:Gt.depth_vert,fragmentShader:Gt.depth_frag},normal:{uniforms:Ue([ht.common,ht.bumpmap,ht.normalmap,ht.displacementmap,{opacity:{value:1}}]),vertexShader:Gt.meshnormal_vert,fragmentShader:Gt.meshnormal_frag},sprite:{uniforms:Ue([ht.sprite,ht.fog]),vertexShader:Gt.sprite_vert,fragmentShader:Gt.sprite_frag},background:{uniforms:{uvTransform:{value:new Xt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Gt.background_vert,fragmentShader:Gt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1}},vertexShader:Gt.backgroundCube_vert,fragmentShader:Gt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Gt.cube_vert,fragmentShader:Gt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Gt.equirect_vert,fragmentShader:Gt.equirect_frag},distanceRGBA:{uniforms:Ue([ht.common,ht.displacementmap,{referencePosition:{value:new R},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Gt.distanceRGBA_vert,fragmentShader:Gt.distanceRGBA_frag},shadow:{uniforms:Ue([ht.lights,ht.fog,{color:{value:new Tt(0)},opacity:{value:1}}]),vertexShader:Gt.shadow_vert,fragmentShader:Gt.shadow_frag}};rn.physical={uniforms:Ue([rn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Xt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Xt},clearcoatNormalScale:{value:new at(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Xt},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Xt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Xt},sheen:{value:0},sheenColor:{value:new Tt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Xt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Xt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Xt},transmissionSamplerSize:{value:new at},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Xt},attenuationDistance:{value:0},attenuationColor:{value:new Tt(0)},specularColor:{value:new Tt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Xt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Xt},anisotropyVector:{value:new at},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Xt}}]),vertexShader:Gt.meshphysical_vert,fragmentShader:Gt.meshphysical_frag};const Es={r:0,b:0,g:0};function lf(s,t,e,n,i,r,a){const o=new Tt(0);let l=r===!0?0:1,c,h,u=null,d=0,m=null;function g(p,f){let S=!1,v=f.isScene===!0?f.background:null;v&&v.isTexture&&(v=(f.backgroundBlurriness>0?e:t).get(v)),v===null?_(o,l):v&&v.isColor&&(_(v,1),S=!0);const y=s.xr.getEnvironmentBlendMode();y==="additive"?n.buffers.color.setClear(0,0,0,1,a):y==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(s.autoClear||S)&&s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil),v&&(v.isCubeTexture||v.mapping===Ws)?(h===void 0&&(h=new st(new Oe(1,1,1),new $n({name:"BackgroundCubeMaterial",uniforms:bi(rn.backgroundCube.uniforms),vertexShader:rn.backgroundCube.vertexShader,fragmentShader:rn.backgroundCube.fragmentShader,side:ze,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(L,b,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(h)),h.material.uniforms.envMap.value=v,h.material.uniforms.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=f.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,h.material.toneMapped=Zt.getTransfer(v.colorSpace)!==ee,(u!==v||d!==v.version||m!==s.toneMapping)&&(h.material.needsUpdate=!0,u=v,d=v.version,m=s.toneMapping),h.layers.enableAll(),p.unshift(h,h.geometry,h.material,0,0,null)):v&&v.isTexture&&(c===void 0&&(c=new st(new Ce(2,2),new $n({name:"BackgroundMaterial",uniforms:bi(rn.background.uniforms),vertexShader:rn.background.vertexShader,fragmentShader:rn.background.fragmentShader,side:Dn,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(c)),c.material.uniforms.t2D.value=v,c.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,c.material.toneMapped=Zt.getTransfer(v.colorSpace)!==ee,v.matrixAutoUpdate===!0&&v.updateMatrix(),c.material.uniforms.uvTransform.value.copy(v.matrix),(u!==v||d!==v.version||m!==s.toneMapping)&&(c.material.needsUpdate=!0,u=v,d=v.version,m=s.toneMapping),c.layers.enableAll(),p.unshift(c,c.geometry,c.material,0,0,null))}function _(p,f){p.getRGB(Es,Tl(s)),n.buffers.color.setClear(Es.r,Es.g,Es.b,f,a)}return{getClearColor:function(){return o},setClearColor:function(p,f=1){o.set(p),l=f,_(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(p){l=p,_(o,l)},render:g}}function cf(s,t,e,n){const i=s.getParameter(s.MAX_VERTEX_ATTRIBS),r=n.isWebGL2?null:t.get("OES_vertex_array_object"),a=n.isWebGL2||r!==null,o={},l=p(null);let c=l,h=!1;function u(D,B,k,Y,$){let j=!1;if(a){const Z=_(Y,k,B);c!==Z&&(c=Z,m(c.object)),j=f(D,Y,k,$),j&&S(D,Y,k,$)}else{const Z=B.wireframe===!0;(c.geometry!==Y.id||c.program!==k.id||c.wireframe!==Z)&&(c.geometry=Y.id,c.program=k.id,c.wireframe=Z,j=!0)}$!==null&&e.update($,s.ELEMENT_ARRAY_BUFFER),(j||h)&&(h=!1,O(D,B,k,Y),$!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,e.get($).buffer))}function d(){return n.isWebGL2?s.createVertexArray():r.createVertexArrayOES()}function m(D){return n.isWebGL2?s.bindVertexArray(D):r.bindVertexArrayOES(D)}function g(D){return n.isWebGL2?s.deleteVertexArray(D):r.deleteVertexArrayOES(D)}function _(D,B,k){const Y=k.wireframe===!0;let $=o[D.id];$===void 0&&($={},o[D.id]=$);let j=$[B.id];j===void 0&&(j={},$[B.id]=j);let Z=j[Y];return Z===void 0&&(Z=p(d()),j[Y]=Z),Z}function p(D){const B=[],k=[],Y=[];for(let $=0;$<i;$++)B[$]=0,k[$]=0,Y[$]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:B,enabledAttributes:k,attributeDivisors:Y,object:D,attributes:{},index:null}}function f(D,B,k,Y){const $=c.attributes,j=B.attributes;let Z=0;const it=k.getAttributes();for(const ot in it)if(it[ot].location>=0){const Q=$[ot];let pt=j[ot];if(pt===void 0&&(ot==="instanceMatrix"&&D.instanceMatrix&&(pt=D.instanceMatrix),ot==="instanceColor"&&D.instanceColor&&(pt=D.instanceColor)),Q===void 0||Q.attribute!==pt||pt&&Q.data!==pt.data)return!0;Z++}return c.attributesNum!==Z||c.index!==Y}function S(D,B,k,Y){const $={},j=B.attributes;let Z=0;const it=k.getAttributes();for(const ot in it)if(it[ot].location>=0){let Q=j[ot];Q===void 0&&(ot==="instanceMatrix"&&D.instanceMatrix&&(Q=D.instanceMatrix),ot==="instanceColor"&&D.instanceColor&&(Q=D.instanceColor));const pt={};pt.attribute=Q,Q&&Q.data&&(pt.data=Q.data),$[ot]=pt,Z++}c.attributes=$,c.attributesNum=Z,c.index=Y}function v(){const D=c.newAttributes;for(let B=0,k=D.length;B<k;B++)D[B]=0}function y(D){L(D,0)}function L(D,B){const k=c.newAttributes,Y=c.enabledAttributes,$=c.attributeDivisors;k[D]=1,Y[D]===0&&(s.enableVertexAttribArray(D),Y[D]=1),$[D]!==B&&((n.isWebGL2?s:t.get("ANGLE_instanced_arrays"))[n.isWebGL2?"vertexAttribDivisor":"vertexAttribDivisorANGLE"](D,B),$[D]=B)}function b(){const D=c.newAttributes,B=c.enabledAttributes;for(let k=0,Y=B.length;k<Y;k++)B[k]!==D[k]&&(s.disableVertexAttribArray(k),B[k]=0)}function C(D,B,k,Y,$,j,Z){Z===!0?s.vertexAttribIPointer(D,B,k,$,j):s.vertexAttribPointer(D,B,k,Y,$,j)}function O(D,B,k,Y){if(n.isWebGL2===!1&&(D.isInstancedMesh||Y.isInstancedBufferGeometry)&&t.get("ANGLE_instanced_arrays")===null)return;v();const $=Y.attributes,j=k.getAttributes(),Z=B.defaultAttributeValues;for(const it in j){const ot=j[it];if(ot.location>=0){let W=$[it];if(W===void 0&&(it==="instanceMatrix"&&D.instanceMatrix&&(W=D.instanceMatrix),it==="instanceColor"&&D.instanceColor&&(W=D.instanceColor)),W!==void 0){const Q=W.normalized,pt=W.itemSize,Mt=e.get(W);if(Mt===void 0)continue;const _t=Mt.buffer,Lt=Mt.type,Ft=Mt.bytesPerElement,St=n.isWebGL2===!0&&(Lt===s.INT||Lt===s.UNSIGNED_INT||W.gpuType===al);if(W.isInterleavedBufferAttribute){const Ut=W.data,P=Ut.stride,lt=W.offset;if(Ut.isInstancedInterleavedBuffer){for(let q=0;q<ot.locationSize;q++)L(ot.location+q,Ut.meshPerAttribute);D.isInstancedMesh!==!0&&Y._maxInstanceCount===void 0&&(Y._maxInstanceCount=Ut.meshPerAttribute*Ut.count)}else for(let q=0;q<ot.locationSize;q++)y(ot.location+q);s.bindBuffer(s.ARRAY_BUFFER,_t);for(let q=0;q<ot.locationSize;q++)C(ot.location+q,pt/ot.locationSize,Lt,Q,P*Ft,(lt+pt/ot.locationSize*q)*Ft,St)}else{if(W.isInstancedBufferAttribute){for(let Ut=0;Ut<ot.locationSize;Ut++)L(ot.location+Ut,W.meshPerAttribute);D.isInstancedMesh!==!0&&Y._maxInstanceCount===void 0&&(Y._maxInstanceCount=W.meshPerAttribute*W.count)}else for(let Ut=0;Ut<ot.locationSize;Ut++)y(ot.location+Ut);s.bindBuffer(s.ARRAY_BUFFER,_t);for(let Ut=0;Ut<ot.locationSize;Ut++)C(ot.location+Ut,pt/ot.locationSize,Lt,Q,pt*Ft,pt/ot.locationSize*Ut*Ft,St)}}else if(Z!==void 0){const Q=Z[it];if(Q!==void 0)switch(Q.length){case 2:s.vertexAttrib2fv(ot.location,Q);break;case 3:s.vertexAttrib3fv(ot.location,Q);break;case 4:s.vertexAttrib4fv(ot.location,Q);break;default:s.vertexAttrib1fv(ot.location,Q)}}}}b()}function M(){G();for(const D in o){const B=o[D];for(const k in B){const Y=B[k];for(const $ in Y)g(Y[$].object),delete Y[$];delete B[k]}delete o[D]}}function w(D){if(o[D.id]===void 0)return;const B=o[D.id];for(const k in B){const Y=B[k];for(const $ in Y)g(Y[$].object),delete Y[$];delete B[k]}delete o[D.id]}function F(D){for(const B in o){const k=o[B];if(k[D.id]===void 0)continue;const Y=k[D.id];for(const $ in Y)g(Y[$].object),delete Y[$];delete k[D.id]}}function G(){J(),h=!0,c!==l&&(c=l,m(c.object))}function J(){l.geometry=null,l.program=null,l.wireframe=!1}return{setup:u,reset:G,resetDefaultState:J,dispose:M,releaseStatesOfGeometry:w,releaseStatesOfProgram:F,initAttributes:v,enableAttribute:y,disableUnusedAttributes:b}}function hf(s,t,e,n){const i=n.isWebGL2;let r;function a(h){r=h}function o(h,u){s.drawArrays(r,h,u),e.update(u,r,1)}function l(h,u,d){if(d===0)return;let m,g;if(i)m=s,g="drawArraysInstanced";else if(m=t.get("ANGLE_instanced_arrays"),g="drawArraysInstancedANGLE",m===null){console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}m[g](r,h,u,d),e.update(u,r,d)}function c(h,u,d){if(d===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let g=0;g<d;g++)this.render(h[g],u[g]);else{m.multiDrawArraysWEBGL(r,h,0,u,0,d);let g=0;for(let _=0;_<d;_++)g+=u[_];e.update(g,r,1)}}this.setMode=a,this.render=o,this.renderInstances=l,this.renderMultiDraw=c}function uf(s,t,e){let n;function i(){if(n!==void 0)return n;if(t.has("EXT_texture_filter_anisotropic")===!0){const C=t.get("EXT_texture_filter_anisotropic");n=s.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n}function r(C){if(C==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}const a=typeof WebGL2RenderingContext<"u"&&s.constructor.name==="WebGL2RenderingContext";let o=e.precision!==void 0?e.precision:"highp";const l=r(o);l!==o&&(console.warn("THREE.WebGLRenderer:",o,"not supported, using",l,"instead."),o=l);const c=a||t.has("WEBGL_draw_buffers"),h=e.logarithmicDepthBuffer===!0,u=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),d=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),m=s.getParameter(s.MAX_TEXTURE_SIZE),g=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),_=s.getParameter(s.MAX_VERTEX_ATTRIBS),p=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),f=s.getParameter(s.MAX_VARYING_VECTORS),S=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),v=d>0,y=a||t.has("OES_texture_float"),L=v&&y,b=a?s.getParameter(s.MAX_SAMPLES):0;return{isWebGL2:a,drawBuffers:c,getMaxAnisotropy:i,getMaxPrecision:r,precision:o,logarithmicDepthBuffer:h,maxTextures:u,maxVertexTextures:d,maxTextureSize:m,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:p,maxVaryings:f,maxFragmentUniforms:S,vertexTextures:v,floatFragmentTextures:y,floatVertexTextures:L,maxSamples:b}}function df(s){const t=this;let e=null,n=0,i=!1,r=!1;const a=new zn,o=new Xt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){const m=u.length!==0||d||n!==0||i;return i=d,n=u.length,m},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){e=h(u,d,0)},this.setState=function(u,d,m){const g=u.clippingPlanes,_=u.clipIntersection,p=u.clipShadows,f=s.get(u);if(!i||g===null||g.length===0||r&&!p)r?h(null):c();else{const S=r?0:n,v=S*4;let y=f.clippingState||null;l.value=y,y=h(g,d,v,m);for(let L=0;L!==v;++L)y[L]=e[L];f.clippingState=y,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=S}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(u,d,m,g){const _=u!==null?u.length:0;let p=null;if(_!==0){if(p=l.value,g!==!0||p===null){const f=m+_*4,S=d.matrixWorldInverse;o.getNormalMatrix(S),(p===null||p.length<f)&&(p=new Float32Array(f));for(let v=0,y=m;v!==_;++v,y+=4)a.copy(u[v]).applyMatrix4(S,o),a.normal.toArray(p,y),p[y+3]=a.constant}l.value=p,l.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,p}}function ff(s){let t=new WeakMap;function e(a,o){return o===Br?a.mapping=wi:o===zr&&(a.mapping=Ti),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===Br||o===zr)if(t.has(a)){const l=t.get(a).texture;return e(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new wh(l.height/2);return c.fromEquirectangularTexture(s,a),t.set(a,c),a.addEventListener("dispose",i),e(c.texture,a.mapping)}else return null}}return a}function i(a){const o=a.target;o.removeEventListener("dispose",i);const l=t.get(o);l!==void 0&&(t.delete(o),l.dispose())}function r(){t=new WeakMap}return{get:n,dispose:r}}class Rl extends Al{constructor(t=-1,e=1,n=1,i=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=i,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,i,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2;let r=n-t,a=n+t,o=i+e,l=i-e;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const xi=4,go=[.125,.215,.35,.446,.526,.582],kn=20,wr=new Rl,_o=new Tt;let Tr=null,Ar=0,br=0;const Hn=(1+Math.sqrt(5))/2,di=1/Hn,vo=[new R(1,1,1),new R(-1,1,1),new R(1,1,-1),new R(-1,1,-1),new R(0,Hn,di),new R(0,Hn,-di),new R(di,0,Hn),new R(-di,0,Hn),new R(Hn,di,0),new R(-Hn,di,0)];class xo{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,i=100){Tr=this._renderer.getRenderTarget(),Ar=this._renderer.getActiveCubeFace(),br=this._renderer.getActiveMipmapLevel(),this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,n,i,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=So(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Mo(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(Tr,Ar,br),t.scissorTest=!1,ws(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===wi||t.mapping===Ti?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Tr=this._renderer.getRenderTarget(),Ar=this._renderer.getActiveCubeFace(),br=this._renderer.getActiveMipmapLevel();const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:qe,minFilter:qe,generateMipmaps:!1,type:$i,format:en,colorSpace:vn,depthBuffer:!1},i=yo(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=yo(t,e,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=pf(r)),this._blurMaterial=mf(r,t,e)}return i}_compileMaterial(t){const e=new st(this._lodPlanes[0],t);this._renderer.compile(e,wr)}_sceneToCubeUV(t,e,n,i){const o=new $e(90,1,e,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(_o),h.toneMapping=Rn,h.autoClear=!1;const m=new fe({name:"PMREM.Background",side:ze,depthWrite:!1,depthTest:!1}),g=new st(new Oe,m);let _=!1;const p=t.background;p?p.isColor&&(m.color.copy(p),t.background=null,_=!0):(m.color.copy(_o),_=!0);for(let f=0;f<6;f++){const S=f%3;S===0?(o.up.set(0,l[f],0),o.lookAt(c[f],0,0)):S===1?(o.up.set(0,0,l[f]),o.lookAt(0,c[f],0)):(o.up.set(0,l[f],0),o.lookAt(0,0,c[f]));const v=this._cubeSize;ws(i,S*v,f>2?v:0,v,v),h.setRenderTarget(i),_&&h.render(g,o),h.render(t,o)}g.geometry.dispose(),g.material.dispose(),h.toneMapping=d,h.autoClear=u,t.background=p}_textureToCubeUV(t,e){const n=this._renderer,i=t.mapping===wi||t.mapping===Ti;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=So()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Mo());const r=i?this._cubemapMaterial:this._equirectMaterial,a=new st(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=t;const l=this._cubeSize;ws(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(a,wr)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;for(let i=1;i<this._lodPlanes.length;i++){const r=Math.sqrt(this._sigmas[i]*this._sigmas[i]-this._sigmas[i-1]*this._sigmas[i-1]),a=vo[(i-1)%vo.length];this._blur(t,i-1,i,r,a)}e.autoClear=n}_blur(t,e,n,i,r){const a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,i,"latitudinal",r),this._halfBlur(a,t,n,n,i,"longitudinal",r)}_halfBlur(t,e,n,i,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,u=new st(this._lodPlanes[i],c),d=c.uniforms,m=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*m):2*Math.PI/(2*kn-1),_=r/g,p=isFinite(r)?1+Math.floor(h*_):kn;p>kn&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${p} samples when the maximum is set to ${kn}`);const f=[];let S=0;for(let C=0;C<kn;++C){const O=C/_,M=Math.exp(-O*O/2);f.push(M),C===0?S+=M:C<p&&(S+=2*M)}for(let C=0;C<f.length;C++)f[C]=f[C]/S;d.envMap.value=t.texture,d.samples.value=p,d.weights.value=f,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:v}=this;d.dTheta.value=g,d.mipInt.value=v-n;const y=this._sizeLods[i],L=3*y*(i>v-xi?i-v+xi:0),b=4*(this._cubeSize-y);ws(e,L,b,3*y,2*y),l.setRenderTarget(e),l.render(u,wr)}}function pf(s){const t=[],e=[],n=[];let i=s;const r=s-xi+1+go.length;for(let a=0;a<r;a++){const o=Math.pow(2,i);e.push(o);let l=1/o;a>s-xi?l=go[a-s+xi-1]:a===0&&(l=0),n.push(l);const c=1/(o-2),h=-c,u=1+c,d=[h,h,u,h,u,u,h,h,u,u,h,u],m=6,g=6,_=3,p=2,f=1,S=new Float32Array(_*g*m),v=new Float32Array(p*g*m),y=new Float32Array(f*g*m);for(let b=0;b<m;b++){const C=b%3*2/3-1,O=b>2?0:-1,M=[C,O,0,C+2/3,O,0,C+2/3,O+1,0,C,O,0,C+2/3,O+1,0,C,O+1,0];S.set(M,_*g*b),v.set(d,p*g*b);const w=[b,b,b,b,b,b];y.set(w,f*g*b)}const L=new we;L.setAttribute("position",new Pe(S,_)),L.setAttribute("uv",new Pe(v,p)),L.setAttribute("faceIndex",new Pe(y,f)),t.push(L),i>xi&&i--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function yo(s,t,e){const n=new Yn(s,t,e);return n.texture.mapping=Ws,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function ws(s,t,e,n,i){s.viewport.set(t,e,n,i),s.scissor.set(t,e,n,i)}function mf(s,t,e){const n=new Float32Array(kn),i=new R(0,1,0);return new $n({name:"SphericalGaussianBlur",defines:{n:kn,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:na(),fragmentShader:`

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
		`,blending:Cn,depthTest:!1,depthWrite:!1})}function Mo(){return new $n({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:na(),fragmentShader:`

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
		`,blending:Cn,depthTest:!1,depthWrite:!1})}function So(){return new $n({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:na(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Cn,depthTest:!1,depthWrite:!1})}function na(){return`

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
	`}function gf(s){let t=new WeakMap,e=null;function n(o){if(o&&o.isTexture){const l=o.mapping,c=l===Br||l===zr,h=l===wi||l===Ti;if(c||h)if(o.isRenderTargetTexture&&o.needsPMREMUpdate===!0){o.needsPMREMUpdate=!1;let u=t.get(o);return e===null&&(e=new xo(s)),u=c?e.fromEquirectangular(o,u):e.fromCubemap(o,u),t.set(o,u),u.texture}else{if(t.has(o))return t.get(o).texture;{const u=o.image;if(c&&u&&u.height>0||h&&u&&i(u)){e===null&&(e=new xo(s));const d=c?e.fromEquirectangular(o):e.fromCubemap(o);return t.set(o,d),o.addEventListener("dispose",r),d.texture}else return null}}}return o}function i(o){let l=0;const c=6;for(let h=0;h<c;h++)o[h]!==void 0&&l++;return l===c}function r(o){const l=o.target;l.removeEventListener("dispose",r);const c=t.get(l);c!==void 0&&(t.delete(l),c.dispose())}function a(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:a}}function _f(s){const t={};function e(n){if(t[n]!==void 0)return t[n];let i;switch(n){case"WEBGL_depth_texture":i=s.getExtension("WEBGL_depth_texture")||s.getExtension("MOZ_WEBGL_depth_texture")||s.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=s.getExtension("EXT_texture_filter_anisotropic")||s.getExtension("MOZ_EXT_texture_filter_anisotropic")||s.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=s.getExtension("WEBGL_compressed_texture_s3tc")||s.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=s.getExtension("WEBGL_compressed_texture_pvrtc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=s.getExtension(n)}return t[n]=i,i}return{has:function(n){return e(n)!==null},init:function(n){n.isWebGL2?(e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance")):(e("WEBGL_depth_texture"),e("OES_texture_float"),e("OES_texture_half_float"),e("OES_texture_half_float_linear"),e("OES_standard_derivatives"),e("OES_element_index_uint"),e("OES_vertex_array_object"),e("ANGLE_instanced_arrays")),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture")},get:function(n){const i=e(n);return i===null&&console.warn("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function vf(s,t,e,n){const i={},r=new WeakMap;function a(u){const d=u.target;d.index!==null&&t.remove(d.index);for(const g in d.attributes)t.remove(d.attributes[g]);for(const g in d.morphAttributes){const _=d.morphAttributes[g];for(let p=0,f=_.length;p<f;p++)t.remove(_[p])}d.removeEventListener("dispose",a),delete i[d.id];const m=r.get(d);m&&(t.remove(m),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function o(u,d){return i[d.id]===!0||(d.addEventListener("dispose",a),i[d.id]=!0,e.memory.geometries++),d}function l(u){const d=u.attributes;for(const g in d)t.update(d[g],s.ARRAY_BUFFER);const m=u.morphAttributes;for(const g in m){const _=m[g];for(let p=0,f=_.length;p<f;p++)t.update(_[p],s.ARRAY_BUFFER)}}function c(u){const d=[],m=u.index,g=u.attributes.position;let _=0;if(m!==null){const S=m.array;_=m.version;for(let v=0,y=S.length;v<y;v+=3){const L=S[v+0],b=S[v+1],C=S[v+2];d.push(L,b,b,C,C,L)}}else if(g!==void 0){const S=g.array;_=g.version;for(let v=0,y=S.length/3-1;v<y;v+=3){const L=v+0,b=v+1,C=v+2;d.push(L,b,b,C,C,L)}}else return;const p=new(gl(d)?wl:El)(d,1);p.version=_;const f=r.get(u);f&&t.remove(f),r.set(u,p)}function h(u){const d=r.get(u);if(d){const m=u.index;m!==null&&d.version<m.version&&c(u)}else c(u);return r.get(u)}return{get:o,update:l,getWireframeAttribute:h}}function xf(s,t,e,n){const i=n.isWebGL2;let r;function a(m){r=m}let o,l;function c(m){o=m.type,l=m.bytesPerElement}function h(m,g){s.drawElements(r,g,o,m*l),e.update(g,r,1)}function u(m,g,_){if(_===0)return;let p,f;if(i)p=s,f="drawElementsInstanced";else if(p=t.get("ANGLE_instanced_arrays"),f="drawElementsInstancedANGLE",p===null){console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}p[f](r,g,o,m*l,_),e.update(g,r,_)}function d(m,g,_){if(_===0)return;const p=t.get("WEBGL_multi_draw");if(p===null)for(let f=0;f<_;f++)this.render(m[f]/l,g[f]);else{p.multiDrawElementsWEBGL(r,g,0,o,m,0,_);let f=0;for(let S=0;S<_;S++)f+=g[S];e.update(f,r,1)}}this.setMode=a,this.setIndex=c,this.render=h,this.renderInstances=u,this.renderMultiDraw=d}function yf(s){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(e.calls++,a){case s.TRIANGLES:e.triangles+=o*(r/3);break;case s.LINES:e.lines+=o*(r/2);break;case s.LINE_STRIP:e.lines+=o*(r-1);break;case s.LINE_LOOP:e.lines+=o*r;break;case s.POINTS:e.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function i(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:i,update:n}}function Mf(s,t){return s[0]-t[0]}function Sf(s,t){return Math.abs(t[1])-Math.abs(s[1])}function Ef(s,t,e){const n={},i=new Float32Array(8),r=new WeakMap,a=new Se,o=[];for(let c=0;c<8;c++)o[c]=[c,0];function l(c,h,u){const d=c.morphTargetInfluences;if(t.isWebGL2===!0){const g=h.morphAttributes.position||h.morphAttributes.normal||h.morphAttributes.color,_=g!==void 0?g.length:0;let p=r.get(h);if(p===void 0||p.count!==_){let B=function(){J.dispose(),r.delete(h),h.removeEventListener("dispose",B)};var m=B;p!==void 0&&p.texture.dispose();const v=h.morphAttributes.position!==void 0,y=h.morphAttributes.normal!==void 0,L=h.morphAttributes.color!==void 0,b=h.morphAttributes.position||[],C=h.morphAttributes.normal||[],O=h.morphAttributes.color||[];let M=0;v===!0&&(M=1),y===!0&&(M=2),L===!0&&(M=3);let w=h.attributes.position.count*M,F=1;w>t.maxTextureSize&&(F=Math.ceil(w/t.maxTextureSize),w=t.maxTextureSize);const G=new Float32Array(w*F*4*_),J=new xl(G,w,F,_);J.type=bn,J.needsUpdate=!0;const D=M*4;for(let k=0;k<_;k++){const Y=b[k],$=C[k],j=O[k],Z=w*F*4*k;for(let it=0;it<Y.count;it++){const ot=it*D;v===!0&&(a.fromBufferAttribute(Y,it),G[Z+ot+0]=a.x,G[Z+ot+1]=a.y,G[Z+ot+2]=a.z,G[Z+ot+3]=0),y===!0&&(a.fromBufferAttribute($,it),G[Z+ot+4]=a.x,G[Z+ot+5]=a.y,G[Z+ot+6]=a.z,G[Z+ot+7]=0),L===!0&&(a.fromBufferAttribute(j,it),G[Z+ot+8]=a.x,G[Z+ot+9]=a.y,G[Z+ot+10]=a.z,G[Z+ot+11]=j.itemSize===4?a.w:1)}}p={count:_,texture:J,size:new at(w,F)},r.set(h,p),h.addEventListener("dispose",B)}let f=0;for(let v=0;v<d.length;v++)f+=d[v];const S=h.morphTargetsRelative?1:1-f;u.getUniforms().setValue(s,"morphTargetBaseInfluence",S),u.getUniforms().setValue(s,"morphTargetInfluences",d),u.getUniforms().setValue(s,"morphTargetsTexture",p.texture,e),u.getUniforms().setValue(s,"morphTargetsTextureSize",p.size)}else{const g=d===void 0?0:d.length;let _=n[h.id];if(_===void 0||_.length!==g){_=[];for(let y=0;y<g;y++)_[y]=[y,0];n[h.id]=_}for(let y=0;y<g;y++){const L=_[y];L[0]=y,L[1]=d[y]}_.sort(Sf);for(let y=0;y<8;y++)y<g&&_[y][1]?(o[y][0]=_[y][0],o[y][1]=_[y][1]):(o[y][0]=Number.MAX_SAFE_INTEGER,o[y][1]=0);o.sort(Mf);const p=h.morphAttributes.position,f=h.morphAttributes.normal;let S=0;for(let y=0;y<8;y++){const L=o[y],b=L[0],C=L[1];b!==Number.MAX_SAFE_INTEGER&&C?(p&&h.getAttribute("morphTarget"+y)!==p[b]&&h.setAttribute("morphTarget"+y,p[b]),f&&h.getAttribute("morphNormal"+y)!==f[b]&&h.setAttribute("morphNormal"+y,f[b]),i[y]=C,S+=C):(p&&h.hasAttribute("morphTarget"+y)===!0&&h.deleteAttribute("morphTarget"+y),f&&h.hasAttribute("morphNormal"+y)===!0&&h.deleteAttribute("morphNormal"+y),i[y]=0)}const v=h.morphTargetsRelative?1:1-S;u.getUniforms().setValue(s,"morphTargetBaseInfluence",v),u.getUniforms().setValue(s,"morphTargetInfluences",i)}}return{update:l}}function wf(s,t,e,n){let i=new WeakMap;function r(l){const c=n.render.frame,h=l.geometry,u=t.get(l,h);if(i.get(u)!==c&&(t.update(u),i.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),i.get(l)!==c&&(e.update(l.instanceMatrix,s.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,s.ARRAY_BUFFER),i.set(l,c))),l.isSkinnedMesh){const d=l.skeleton;i.get(d)!==c&&(d.update(),i.set(d,c))}return u}function a(){i=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:r,dispose:a}}class Pl extends He{constructor(t,e,n,i,r,a,o,l,c,h){if(h=h!==void 0?h:Xn,h!==Xn&&h!==Ai)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===Xn&&(n=An),n===void 0&&h===Ai&&(n=Wn),super(null,i,r,a,o,l,h,n,c),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=o!==void 0?o:Fe,this.minFilter=l!==void 0?l:Fe,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const Ll=new He,Dl=new Pl(1,1);Dl.compareFunction=ml;const Il=new xl,Ul=new oh,Nl=new bl,Eo=[],wo=[],To=new Float32Array(16),Ao=new Float32Array(9),bo=new Float32Array(4);function Li(s,t,e){const n=s[0];if(n<=0||n>0)return s;const i=t*e;let r=Eo[i];if(r===void 0&&(r=new Float32Array(i),Eo[i]=r),t!==0){n.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,s[a].toArray(r,o)}return r}function me(s,t){if(s.length!==t.length)return!1;for(let e=0,n=s.length;e<n;e++)if(s[e]!==t[e])return!1;return!0}function ge(s,t){for(let e=0,n=t.length;e<n;e++)s[e]=t[e]}function Ys(s,t){let e=wo[t];e===void 0&&(e=new Int32Array(t),wo[t]=e);for(let n=0;n!==t;++n)e[n]=s.allocateTextureUnit();return e}function Tf(s,t){const e=this.cache;e[0]!==t&&(s.uniform1f(this.addr,t),e[0]=t)}function Af(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(me(e,t))return;s.uniform2fv(this.addr,t),ge(e,t)}}function bf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(s.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(me(e,t))return;s.uniform3fv(this.addr,t),ge(e,t)}}function Cf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(me(e,t))return;s.uniform4fv(this.addr,t),ge(e,t)}}function Rf(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(me(e,t))return;s.uniformMatrix2fv(this.addr,!1,t),ge(e,t)}else{if(me(e,n))return;bo.set(n),s.uniformMatrix2fv(this.addr,!1,bo),ge(e,n)}}function Pf(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(me(e,t))return;s.uniformMatrix3fv(this.addr,!1,t),ge(e,t)}else{if(me(e,n))return;Ao.set(n),s.uniformMatrix3fv(this.addr,!1,Ao),ge(e,n)}}function Lf(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(me(e,t))return;s.uniformMatrix4fv(this.addr,!1,t),ge(e,t)}else{if(me(e,n))return;To.set(n),s.uniformMatrix4fv(this.addr,!1,To),ge(e,n)}}function Df(s,t){const e=this.cache;e[0]!==t&&(s.uniform1i(this.addr,t),e[0]=t)}function If(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(me(e,t))return;s.uniform2iv(this.addr,t),ge(e,t)}}function Uf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(me(e,t))return;s.uniform3iv(this.addr,t),ge(e,t)}}function Nf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(me(e,t))return;s.uniform4iv(this.addr,t),ge(e,t)}}function Ff(s,t){const e=this.cache;e[0]!==t&&(s.uniform1ui(this.addr,t),e[0]=t)}function Of(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(me(e,t))return;s.uniform2uiv(this.addr,t),ge(e,t)}}function Bf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(me(e,t))return;s.uniform3uiv(this.addr,t),ge(e,t)}}function zf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(me(e,t))return;s.uniform4uiv(this.addr,t),ge(e,t)}}function Hf(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i);const r=this.type===s.SAMPLER_2D_SHADOW?Dl:Ll;e.setTexture2D(t||r,i)}function Gf(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTexture3D(t||Ul,i)}function kf(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTextureCube(t||Nl,i)}function Vf(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTexture2DArray(t||Il,i)}function Wf(s){switch(s){case 5126:return Tf;case 35664:return Af;case 35665:return bf;case 35666:return Cf;case 35674:return Rf;case 35675:return Pf;case 35676:return Lf;case 5124:case 35670:return Df;case 35667:case 35671:return If;case 35668:case 35672:return Uf;case 35669:case 35673:return Nf;case 5125:return Ff;case 36294:return Of;case 36295:return Bf;case 36296:return zf;case 35678:case 36198:case 36298:case 36306:case 35682:return Hf;case 35679:case 36299:case 36307:return Gf;case 35680:case 36300:case 36308:case 36293:return kf;case 36289:case 36303:case 36311:case 36292:return Vf}}function Xf(s,t){s.uniform1fv(this.addr,t)}function qf(s,t){const e=Li(t,this.size,2);s.uniform2fv(this.addr,e)}function Yf(s,t){const e=Li(t,this.size,3);s.uniform3fv(this.addr,e)}function $f(s,t){const e=Li(t,this.size,4);s.uniform4fv(this.addr,e)}function jf(s,t){const e=Li(t,this.size,4);s.uniformMatrix2fv(this.addr,!1,e)}function Zf(s,t){const e=Li(t,this.size,9);s.uniformMatrix3fv(this.addr,!1,e)}function Jf(s,t){const e=Li(t,this.size,16);s.uniformMatrix4fv(this.addr,!1,e)}function Kf(s,t){s.uniform1iv(this.addr,t)}function Qf(s,t){s.uniform2iv(this.addr,t)}function tp(s,t){s.uniform3iv(this.addr,t)}function ep(s,t){s.uniform4iv(this.addr,t)}function np(s,t){s.uniform1uiv(this.addr,t)}function ip(s,t){s.uniform2uiv(this.addr,t)}function sp(s,t){s.uniform3uiv(this.addr,t)}function rp(s,t){s.uniform4uiv(this.addr,t)}function ap(s,t,e){const n=this.cache,i=t.length,r=Ys(e,i);me(n,r)||(s.uniform1iv(this.addr,r),ge(n,r));for(let a=0;a!==i;++a)e.setTexture2D(t[a]||Ll,r[a])}function op(s,t,e){const n=this.cache,i=t.length,r=Ys(e,i);me(n,r)||(s.uniform1iv(this.addr,r),ge(n,r));for(let a=0;a!==i;++a)e.setTexture3D(t[a]||Ul,r[a])}function lp(s,t,e){const n=this.cache,i=t.length,r=Ys(e,i);me(n,r)||(s.uniform1iv(this.addr,r),ge(n,r));for(let a=0;a!==i;++a)e.setTextureCube(t[a]||Nl,r[a])}function cp(s,t,e){const n=this.cache,i=t.length,r=Ys(e,i);me(n,r)||(s.uniform1iv(this.addr,r),ge(n,r));for(let a=0;a!==i;++a)e.setTexture2DArray(t[a]||Il,r[a])}function hp(s){switch(s){case 5126:return Xf;case 35664:return qf;case 35665:return Yf;case 35666:return $f;case 35674:return jf;case 35675:return Zf;case 35676:return Jf;case 5124:case 35670:return Kf;case 35667:case 35671:return Qf;case 35668:case 35672:return tp;case 35669:case 35673:return ep;case 5125:return np;case 36294:return ip;case 36295:return sp;case 36296:return rp;case 35678:case 36198:case 36298:case 36306:case 35682:return ap;case 35679:case 36299:case 36307:return op;case 35680:case 36300:case 36308:case 36293:return lp;case 36289:case 36303:case 36311:case 36292:return cp}}class up{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=Wf(e.type)}}class dp{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=hp(e.type)}}class fp{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const i=this.seq;for(let r=0,a=i.length;r!==a;++r){const o=i[r];o.setValue(t,e[o.id],n)}}}const Cr=/(\w+)(\])?(\[|\.)?/g;function Co(s,t){s.seq.push(t),s.map[t.id]=t}function pp(s,t,e){const n=s.name,i=n.length;for(Cr.lastIndex=0;;){const r=Cr.exec(n),a=Cr.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===i){Co(e,c===void 0?new up(o,s,t):new dp(o,s,t));break}else{let u=e.map[o];u===void 0&&(u=new fp(o),Co(e,u)),e=u}}}class Us{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let i=0;i<n;++i){const r=t.getActiveUniform(e,i),a=t.getUniformLocation(e,r.name);pp(r,a,this)}}setValue(t,e,n,i){const r=this.map[e];r!==void 0&&r.setValue(t,n,i)}setOptional(t,e,n){const i=e[n];i!==void 0&&this.setValue(t,n,i)}static upload(t,e,n,i){for(let r=0,a=e.length;r!==a;++r){const o=e[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,i)}}static seqWithValue(t,e){const n=[];for(let i=0,r=t.length;i!==r;++i){const a=t[i];a.id in e&&n.push(a)}return n}}function Ro(s,t,e){const n=s.createShader(t);return s.shaderSource(n,e),s.compileShader(n),n}const mp=37297;let gp=0;function _p(s,t){const e=s.split(`
`),n=[],i=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=i;a<r;a++){const o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}function vp(s){const t=Zt.getPrimaries(Zt.workingColorSpace),e=Zt.getPrimaries(s);let n;switch(t===e?n="":t===zs&&e===Bs?n="LinearDisplayP3ToLinearSRGB":t===Bs&&e===zs&&(n="LinearSRGBToLinearDisplayP3"),s){case vn:case Xs:return[n,"LinearTransferOETF"];case Ee:case ta:return[n,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space:",s),[n,"LinearTransferOETF"]}}function Po(s,t,e){const n=s.getShaderParameter(t,s.COMPILE_STATUS),i=s.getShaderInfoLog(t).trim();if(n&&i==="")return"";const r=/ERROR: 0:(\d+)/.exec(i);if(r){const a=parseInt(r[1]);return e.toUpperCase()+`

`+i+`

`+_p(s.getShaderSource(t),a)}else return i}function xp(s,t){const e=vp(t);return`vec4 ${s}( vec4 value ) { return ${e[0]}( ${e[1]}( value ) ); }`}function yp(s,t){let e;switch(t){case Pc:e="Linear";break;case Lc:e="Reinhard";break;case Dc:e="OptimizedCineon";break;case Ic:e="ACESFilmic";break;case Nc:e="AgX";break;case Uc:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+s+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}function Mp(s){return[s.extensionDerivatives||s.envMapCubeUVHeight||s.bumpMap||s.normalMapTangentSpace||s.clearcoatNormalMap||s.flatShading||s.shaderID==="physical"?"#extension GL_OES_standard_derivatives : enable":"",(s.extensionFragDepth||s.logarithmicDepthBuffer)&&s.rendererExtensionFragDepth?"#extension GL_EXT_frag_depth : enable":"",s.extensionDrawBuffers&&s.rendererExtensionDrawBuffers?"#extension GL_EXT_draw_buffers : require":"",(s.extensionShaderTextureLOD||s.envMap||s.transmission)&&s.rendererExtensionShaderTextureLod?"#extension GL_EXT_shader_texture_lod : enable":""].filter(yi).join(`
`)}function Sp(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":""].filter(yi).join(`
`)}function Ep(s){const t=[];for(const e in s){const n=s[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function wp(s,t){const e={},n=s.getProgramParameter(t,s.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){const r=s.getActiveAttrib(t,i),a=r.name;let o=1;r.type===s.FLOAT_MAT2&&(o=2),r.type===s.FLOAT_MAT3&&(o=3),r.type===s.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:s.getAttribLocation(t,a),locationSize:o}}return e}function yi(s){return s!==""}function Lo(s,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return s.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Do(s,t){return s.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const Tp=/^[ \t]*#include +<([\w\d./]+)>/gm;function qr(s){return s.replace(Tp,bp)}const Ap=new Map([["encodings_fragment","colorspace_fragment"],["encodings_pars_fragment","colorspace_pars_fragment"],["output_fragment","opaque_fragment"]]);function bp(s,t){let e=Gt[t];if(e===void 0){const n=Ap.get(t);if(n!==void 0)e=Gt[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return qr(e)}const Cp=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Io(s){return s.replace(Cp,Rp)}function Rp(s,t,e,n){let i="";for(let r=parseInt(t);r<parseInt(e);r++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return i}function Uo(s){let t="precision "+s.precision+` float;
precision `+s.precision+" int;";return s.precision==="highp"?t+=`
#define HIGH_PRECISION`:s.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function Pp(s){let t="SHADOWMAP_TYPE_BASIC";return s.shadowMapType===nl?t="SHADOWMAP_TYPE_PCF":s.shadowMapType===il?t="SHADOWMAP_TYPE_PCF_SOFT":s.shadowMapType===pn&&(t="SHADOWMAP_TYPE_VSM"),t}function Lp(s){let t="ENVMAP_TYPE_CUBE";if(s.envMap)switch(s.envMapMode){case wi:case Ti:t="ENVMAP_TYPE_CUBE";break;case Ws:t="ENVMAP_TYPE_CUBE_UV";break}return t}function Dp(s){let t="ENVMAP_MODE_REFLECTION";if(s.envMap)switch(s.envMapMode){case Ti:t="ENVMAP_MODE_REFRACTION";break}return t}function Ip(s){let t="ENVMAP_BLENDING_NONE";if(s.envMap)switch(s.combine){case sl:t="ENVMAP_BLENDING_MULTIPLY";break;case Cc:t="ENVMAP_BLENDING_MIX";break;case Rc:t="ENVMAP_BLENDING_ADD";break}return t}function Up(s){const t=s.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),7*16)),texelHeight:n,maxMip:e}}function Np(s,t,e,n){const i=s.getContext(),r=e.defines;let a=e.vertexShader,o=e.fragmentShader;const l=Pp(e),c=Lp(e),h=Dp(e),u=Ip(e),d=Up(e),m=e.isWebGL2?"":Mp(e),g=Sp(e),_=Ep(r),p=i.createProgram();let f,S,v=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(f=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_].filter(yi).join(`
`),f.length>0&&(f+=`
`),S=[m,"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_].filter(yi).join(`
`),S.length>0&&(S+=`
`)):(f=[Uo(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors&&e.isWebGL2?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0&&e.isWebGL2?"#define MORPHTARGETS_TEXTURE":"",e.morphTargetsCount>0&&e.isWebGL2?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0&&e.isWebGL2?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.useLegacyLights?"#define LEGACY_LIGHTS":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.logarithmicDepthBuffer&&e.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#if ( defined( USE_MORPHTARGETS ) && ! defined( MORPHTARGETS_TEXTURE ) )","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(yi).join(`
`),S=[m,Uo(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.useLegacyLights?"#define LEGACY_LIGHTS":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.logarithmicDepthBuffer&&e.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==Rn?"#define TONE_MAPPING":"",e.toneMapping!==Rn?Gt.tonemapping_pars_fragment:"",e.toneMapping!==Rn?yp("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Gt.colorspace_pars_fragment,xp("linearToOutputTexel",e.outputColorSpace),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(yi).join(`
`)),a=qr(a),a=Lo(a,e),a=Do(a,e),o=qr(o),o=Lo(o,e),o=Do(o,e),a=Io(a),o=Io(o),e.isWebGL2&&e.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,f=[g,"precision mediump sampler2DArray;","#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+f,S=["precision mediump sampler2DArray;","#define varying in",e.glslVersion===Ja?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===Ja?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+S);const y=v+f+a,L=v+S+o,b=Ro(i,i.VERTEX_SHADER,y),C=Ro(i,i.FRAGMENT_SHADER,L);i.attachShader(p,b),i.attachShader(p,C),e.index0AttributeName!==void 0?i.bindAttribLocation(p,0,e.index0AttributeName):e.morphTargets===!0&&i.bindAttribLocation(p,0,"position"),i.linkProgram(p);function O(G){if(s.debug.checkShaderErrors){const J=i.getProgramInfoLog(p).trim(),D=i.getShaderInfoLog(b).trim(),B=i.getShaderInfoLog(C).trim();let k=!0,Y=!0;if(i.getProgramParameter(p,i.LINK_STATUS)===!1)if(k=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(i,p,b,C);else{const $=Po(i,b,"vertex"),j=Po(i,C,"fragment");console.error("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(p,i.VALIDATE_STATUS)+`

Program Info Log: `+J+`
`+$+`
`+j)}else J!==""?console.warn("THREE.WebGLProgram: Program Info Log:",J):(D===""||B==="")&&(Y=!1);Y&&(G.diagnostics={runnable:k,programLog:J,vertexShader:{log:D,prefix:f},fragmentShader:{log:B,prefix:S}})}i.deleteShader(b),i.deleteShader(C),M=new Us(i,p),w=wp(i,p)}let M;this.getUniforms=function(){return M===void 0&&O(this),M};let w;this.getAttributes=function(){return w===void 0&&O(this),w};let F=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return F===!1&&(F=i.getProgramParameter(p,mp)),F},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(p),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=gp++,this.cacheKey=t,this.usedTimes=1,this.program=p,this.vertexShader=b,this.fragmentShader=C,this}let Fp=0;class Op{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,i=this._getShaderStage(e),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(t);return a.has(i)===!1&&(a.add(i),i.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new Bp(t),e.set(t,n)),n}}class Bp{constructor(t){this.id=Fp++,this.code=t,this.usedTimes=0}}function zp(s,t,e,n,i,r,a){const o=new Ml,l=new Op,c=[],h=i.isWebGL2,u=i.logarithmicDepthBuffer,d=i.vertexTextures;let m=i.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(M){return M===0?"uv":`uv${M}`}function p(M,w,F,G,J){const D=G.fog,B=J.geometry,k=M.isMeshStandardMaterial?G.environment:null,Y=(M.isMeshStandardMaterial?e:t).get(M.envMap||k),$=Y&&Y.mapping===Ws?Y.image.height:null,j=g[M.type];M.precision!==null&&(m=i.getMaxPrecision(M.precision),m!==M.precision&&console.warn("THREE.WebGLProgram.getParameters:",M.precision,"not supported, using",m,"instead."));const Z=B.morphAttributes.position||B.morphAttributes.normal||B.morphAttributes.color,it=Z!==void 0?Z.length:0;let ot=0;B.morphAttributes.position!==void 0&&(ot=1),B.morphAttributes.normal!==void 0&&(ot=2),B.morphAttributes.color!==void 0&&(ot=3);let W,Q,pt,Mt;if(j){const Le=rn[j];W=Le.vertexShader,Q=Le.fragmentShader}else W=M.vertexShader,Q=M.fragmentShader,l.update(M),pt=l.getVertexShaderID(M),Mt=l.getFragmentShaderID(M);const _t=s.getRenderTarget(),Lt=J.isInstancedMesh===!0,Ft=J.isBatchedMesh===!0,St=!!M.map,Ut=!!M.matcap,P=!!Y,lt=!!M.aoMap,q=!!M.lightMap,rt=!!M.bumpMap,X=!!M.normalMap,wt=!!M.displacementMap,mt=!!M.emissiveMap,E=!!M.metalnessMap,x=!!M.roughnessMap,N=M.anisotropy>0,nt=M.clearcoat>0,tt=M.iridescence>0,K=M.sheen>0,yt=M.transmission>0,ut=N&&!!M.anisotropyMap,vt=nt&&!!M.clearcoatMap,bt=nt&&!!M.clearcoatNormalMap,Bt=nt&&!!M.clearcoatRoughnessMap,et=tt&&!!M.iridescenceMap,Yt=tt&&!!M.iridescenceThicknessMap,qt=K&&!!M.sheenColorMap,Nt=K&&!!M.sheenRoughnessMap,At=!!M.specularMap,xt=!!M.specularColorMap,Ht=!!M.specularIntensityMap,$t=yt&&!!M.transmissionMap,le=yt&&!!M.thicknessMap,Vt=!!M.gradientMap,ct=!!M.alphaMap,I=M.alphaTest>0,dt=!!M.alphaHash,ft=!!M.extensions,Dt=!!B.attributes.uv1,Ct=!!B.attributes.uv2,Kt=!!B.attributes.uv3;let Qt=Rn;return M.toneMapped&&(_t===null||_t.isXRRenderTarget===!0)&&(Qt=s.toneMapping),{isWebGL2:h,shaderID:j,shaderType:M.type,shaderName:M.name,vertexShader:W,fragmentShader:Q,defines:M.defines,customVertexShaderID:pt,customFragmentShaderID:Mt,isRawShaderMaterial:M.isRawShaderMaterial===!0,glslVersion:M.glslVersion,precision:m,batching:Ft,instancing:Lt,instancingColor:Lt&&J.instanceColor!==null,supportsVertexTextures:d,outputColorSpace:_t===null?s.outputColorSpace:_t.isXRRenderTarget===!0?_t.texture.colorSpace:vn,map:St,matcap:Ut,envMap:P,envMapMode:P&&Y.mapping,envMapCubeUVHeight:$,aoMap:lt,lightMap:q,bumpMap:rt,normalMap:X,displacementMap:d&&wt,emissiveMap:mt,normalMapObjectSpace:X&&M.normalMapType===Yc,normalMapTangentSpace:X&&M.normalMapType===pl,metalnessMap:E,roughnessMap:x,anisotropy:N,anisotropyMap:ut,clearcoat:nt,clearcoatMap:vt,clearcoatNormalMap:bt,clearcoatRoughnessMap:Bt,iridescence:tt,iridescenceMap:et,iridescenceThicknessMap:Yt,sheen:K,sheenColorMap:qt,sheenRoughnessMap:Nt,specularMap:At,specularColorMap:xt,specularIntensityMap:Ht,transmission:yt,transmissionMap:$t,thicknessMap:le,gradientMap:Vt,opaque:M.transparent===!1&&M.blending===Vn,alphaMap:ct,alphaTest:I,alphaHash:dt,combine:M.combine,mapUv:St&&_(M.map.channel),aoMapUv:lt&&_(M.aoMap.channel),lightMapUv:q&&_(M.lightMap.channel),bumpMapUv:rt&&_(M.bumpMap.channel),normalMapUv:X&&_(M.normalMap.channel),displacementMapUv:wt&&_(M.displacementMap.channel),emissiveMapUv:mt&&_(M.emissiveMap.channel),metalnessMapUv:E&&_(M.metalnessMap.channel),roughnessMapUv:x&&_(M.roughnessMap.channel),anisotropyMapUv:ut&&_(M.anisotropyMap.channel),clearcoatMapUv:vt&&_(M.clearcoatMap.channel),clearcoatNormalMapUv:bt&&_(M.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Bt&&_(M.clearcoatRoughnessMap.channel),iridescenceMapUv:et&&_(M.iridescenceMap.channel),iridescenceThicknessMapUv:Yt&&_(M.iridescenceThicknessMap.channel),sheenColorMapUv:qt&&_(M.sheenColorMap.channel),sheenRoughnessMapUv:Nt&&_(M.sheenRoughnessMap.channel),specularMapUv:At&&_(M.specularMap.channel),specularColorMapUv:xt&&_(M.specularColorMap.channel),specularIntensityMapUv:Ht&&_(M.specularIntensityMap.channel),transmissionMapUv:$t&&_(M.transmissionMap.channel),thicknessMapUv:le&&_(M.thicknessMap.channel),alphaMapUv:ct&&_(M.alphaMap.channel),vertexTangents:!!B.attributes.tangent&&(X||N),vertexColors:M.vertexColors,vertexAlphas:M.vertexColors===!0&&!!B.attributes.color&&B.attributes.color.itemSize===4,vertexUv1s:Dt,vertexUv2s:Ct,vertexUv3s:Kt,pointsUvs:J.isPoints===!0&&!!B.attributes.uv&&(St||ct),fog:!!D,useFog:M.fog===!0,fogExp2:D&&D.isFogExp2,flatShading:M.flatShading===!0,sizeAttenuation:M.sizeAttenuation===!0,logarithmicDepthBuffer:u,skinning:J.isSkinnedMesh===!0,morphTargets:B.morphAttributes.position!==void 0,morphNormals:B.morphAttributes.normal!==void 0,morphColors:B.morphAttributes.color!==void 0,morphTargetsCount:it,morphTextureStride:ot,numDirLights:w.directional.length,numPointLights:w.point.length,numSpotLights:w.spot.length,numSpotLightMaps:w.spotLightMap.length,numRectAreaLights:w.rectArea.length,numHemiLights:w.hemi.length,numDirLightShadows:w.directionalShadowMap.length,numPointLightShadows:w.pointShadowMap.length,numSpotLightShadows:w.spotShadowMap.length,numSpotLightShadowsWithMaps:w.numSpotLightShadowsWithMaps,numLightProbes:w.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:M.dithering,shadowMapEnabled:s.shadowMap.enabled&&F.length>0,shadowMapType:s.shadowMap.type,toneMapping:Qt,useLegacyLights:s._useLegacyLights,decodeVideoTexture:St&&M.map.isVideoTexture===!0&&Zt.getTransfer(M.map.colorSpace)===ee,premultipliedAlpha:M.premultipliedAlpha,doubleSided:M.side===Be,flipSided:M.side===ze,useDepthPacking:M.depthPacking>=0,depthPacking:M.depthPacking||0,index0AttributeName:M.index0AttributeName,extensionDerivatives:ft&&M.extensions.derivatives===!0,extensionFragDepth:ft&&M.extensions.fragDepth===!0,extensionDrawBuffers:ft&&M.extensions.drawBuffers===!0,extensionShaderTextureLOD:ft&&M.extensions.shaderTextureLOD===!0,extensionClipCullDistance:ft&&M.extensions.clipCullDistance&&n.has("WEBGL_clip_cull_distance"),rendererExtensionFragDepth:h||n.has("EXT_frag_depth"),rendererExtensionDrawBuffers:h||n.has("WEBGL_draw_buffers"),rendererExtensionShaderTextureLod:h||n.has("EXT_shader_texture_lod"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:M.customProgramCacheKey()}}function f(M){const w=[];if(M.shaderID?w.push(M.shaderID):(w.push(M.customVertexShaderID),w.push(M.customFragmentShaderID)),M.defines!==void 0)for(const F in M.defines)w.push(F),w.push(M.defines[F]);return M.isRawShaderMaterial===!1&&(S(w,M),v(w,M),w.push(s.outputColorSpace)),w.push(M.customProgramCacheKey),w.join()}function S(M,w){M.push(w.precision),M.push(w.outputColorSpace),M.push(w.envMapMode),M.push(w.envMapCubeUVHeight),M.push(w.mapUv),M.push(w.alphaMapUv),M.push(w.lightMapUv),M.push(w.aoMapUv),M.push(w.bumpMapUv),M.push(w.normalMapUv),M.push(w.displacementMapUv),M.push(w.emissiveMapUv),M.push(w.metalnessMapUv),M.push(w.roughnessMapUv),M.push(w.anisotropyMapUv),M.push(w.clearcoatMapUv),M.push(w.clearcoatNormalMapUv),M.push(w.clearcoatRoughnessMapUv),M.push(w.iridescenceMapUv),M.push(w.iridescenceThicknessMapUv),M.push(w.sheenColorMapUv),M.push(w.sheenRoughnessMapUv),M.push(w.specularMapUv),M.push(w.specularColorMapUv),M.push(w.specularIntensityMapUv),M.push(w.transmissionMapUv),M.push(w.thicknessMapUv),M.push(w.combine),M.push(w.fogExp2),M.push(w.sizeAttenuation),M.push(w.morphTargetsCount),M.push(w.morphAttributeCount),M.push(w.numDirLights),M.push(w.numPointLights),M.push(w.numSpotLights),M.push(w.numSpotLightMaps),M.push(w.numHemiLights),M.push(w.numRectAreaLights),M.push(w.numDirLightShadows),M.push(w.numPointLightShadows),M.push(w.numSpotLightShadows),M.push(w.numSpotLightShadowsWithMaps),M.push(w.numLightProbes),M.push(w.shadowMapType),M.push(w.toneMapping),M.push(w.numClippingPlanes),M.push(w.numClipIntersection),M.push(w.depthPacking)}function v(M,w){o.disableAll(),w.isWebGL2&&o.enable(0),w.supportsVertexTextures&&o.enable(1),w.instancing&&o.enable(2),w.instancingColor&&o.enable(3),w.matcap&&o.enable(4),w.envMap&&o.enable(5),w.normalMapObjectSpace&&o.enable(6),w.normalMapTangentSpace&&o.enable(7),w.clearcoat&&o.enable(8),w.iridescence&&o.enable(9),w.alphaTest&&o.enable(10),w.vertexColors&&o.enable(11),w.vertexAlphas&&o.enable(12),w.vertexUv1s&&o.enable(13),w.vertexUv2s&&o.enable(14),w.vertexUv3s&&o.enable(15),w.vertexTangents&&o.enable(16),w.anisotropy&&o.enable(17),w.alphaHash&&o.enable(18),w.batching&&o.enable(19),M.push(o.mask),o.disableAll(),w.fog&&o.enable(0),w.useFog&&o.enable(1),w.flatShading&&o.enable(2),w.logarithmicDepthBuffer&&o.enable(3),w.skinning&&o.enable(4),w.morphTargets&&o.enable(5),w.morphNormals&&o.enable(6),w.morphColors&&o.enable(7),w.premultipliedAlpha&&o.enable(8),w.shadowMapEnabled&&o.enable(9),w.useLegacyLights&&o.enable(10),w.doubleSided&&o.enable(11),w.flipSided&&o.enable(12),w.useDepthPacking&&o.enable(13),w.dithering&&o.enable(14),w.transmission&&o.enable(15),w.sheen&&o.enable(16),w.opaque&&o.enable(17),w.pointsUvs&&o.enable(18),w.decodeVideoTexture&&o.enable(19),M.push(o.mask)}function y(M){const w=g[M.type];let F;if(w){const G=rn[w];F=yh.clone(G.uniforms)}else F=M.uniforms;return F}function L(M,w){let F;for(let G=0,J=c.length;G<J;G++){const D=c[G];if(D.cacheKey===w){F=D,++F.usedTimes;break}}return F===void 0&&(F=new Np(s,w,M,r),c.push(F)),F}function b(M){if(--M.usedTimes===0){const w=c.indexOf(M);c[w]=c[c.length-1],c.pop(),M.destroy()}}function C(M){l.remove(M)}function O(){l.dispose()}return{getParameters:p,getProgramCacheKey:f,getUniforms:y,acquireProgram:L,releaseProgram:b,releaseShaderCache:C,programs:c,dispose:O}}function Hp(){let s=new WeakMap;function t(r){let a=s.get(r);return a===void 0&&(a={},s.set(r,a)),a}function e(r){s.delete(r)}function n(r,a,o){s.get(r)[a]=o}function i(){s=new WeakMap}return{get:t,remove:e,update:n,dispose:i}}function Gp(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.material.id!==t.material.id?s.material.id-t.material.id:s.z!==t.z?s.z-t.z:s.id-t.id}function No(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.z!==t.z?t.z-s.z:s.id-t.id}function Fo(){const s=[];let t=0;const e=[],n=[],i=[];function r(){t=0,e.length=0,n.length=0,i.length=0}function a(u,d,m,g,_,p){let f=s[t];return f===void 0?(f={id:u.id,object:u,geometry:d,material:m,groupOrder:g,renderOrder:u.renderOrder,z:_,group:p},s[t]=f):(f.id=u.id,f.object=u,f.geometry=d,f.material=m,f.groupOrder=g,f.renderOrder=u.renderOrder,f.z=_,f.group=p),t++,f}function o(u,d,m,g,_,p){const f=a(u,d,m,g,_,p);m.transmission>0?n.push(f):m.transparent===!0?i.push(f):e.push(f)}function l(u,d,m,g,_,p){const f=a(u,d,m,g,_,p);m.transmission>0?n.unshift(f):m.transparent===!0?i.unshift(f):e.unshift(f)}function c(u,d){e.length>1&&e.sort(u||Gp),n.length>1&&n.sort(d||No),i.length>1&&i.sort(d||No)}function h(){for(let u=t,d=s.length;u<d;u++){const m=s[u];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:e,transmissive:n,transparent:i,init:r,push:o,unshift:l,finish:h,sort:c}}function kp(){let s=new WeakMap;function t(n,i){const r=s.get(n);let a;return r===void 0?(a=new Fo,s.set(n,[a])):i>=r.length?(a=new Fo,r.push(a)):a=r[i],a}function e(){s=new WeakMap}return{get:t,dispose:e}}function Vp(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new R,color:new Tt};break;case"SpotLight":e={position:new R,direction:new R,color:new Tt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new R,color:new Tt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new R,skyColor:new Tt,groundColor:new Tt};break;case"RectAreaLight":e={color:new Tt,position:new R,halfWidth:new R,halfHeight:new R};break}return s[t.id]=e,e}}}function Wp(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new at};break;case"SpotLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new at};break;case"PointLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new at,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[t.id]=e,e}}}let Xp=0;function qp(s,t){return(t.castShadow?2:0)-(s.castShadow?2:0)+(t.map?1:0)-(s.map?1:0)}function Yp(s,t){const e=new Vp,n=Wp(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let h=0;h<9;h++)i.probe.push(new R);const r=new R,a=new ne,o=new ne;function l(h,u){let d=0,m=0,g=0;for(let G=0;G<9;G++)i.probe[G].set(0,0,0);let _=0,p=0,f=0,S=0,v=0,y=0,L=0,b=0,C=0,O=0,M=0;h.sort(qp);const w=u===!0?Math.PI:1;for(let G=0,J=h.length;G<J;G++){const D=h[G],B=D.color,k=D.intensity,Y=D.distance,$=D.shadow&&D.shadow.map?D.shadow.map.texture:null;if(D.isAmbientLight)d+=B.r*k*w,m+=B.g*k*w,g+=B.b*k*w;else if(D.isLightProbe){for(let j=0;j<9;j++)i.probe[j].addScaledVector(D.sh.coefficients[j],k);M++}else if(D.isDirectionalLight){const j=e.get(D);if(j.color.copy(D.color).multiplyScalar(D.intensity*w),D.castShadow){const Z=D.shadow,it=n.get(D);it.shadowBias=Z.bias,it.shadowNormalBias=Z.normalBias,it.shadowRadius=Z.radius,it.shadowMapSize=Z.mapSize,i.directionalShadow[_]=it,i.directionalShadowMap[_]=$,i.directionalShadowMatrix[_]=D.shadow.matrix,y++}i.directional[_]=j,_++}else if(D.isSpotLight){const j=e.get(D);j.position.setFromMatrixPosition(D.matrixWorld),j.color.copy(B).multiplyScalar(k*w),j.distance=Y,j.coneCos=Math.cos(D.angle),j.penumbraCos=Math.cos(D.angle*(1-D.penumbra)),j.decay=D.decay,i.spot[f]=j;const Z=D.shadow;if(D.map&&(i.spotLightMap[C]=D.map,C++,Z.updateMatrices(D),D.castShadow&&O++),i.spotLightMatrix[f]=Z.matrix,D.castShadow){const it=n.get(D);it.shadowBias=Z.bias,it.shadowNormalBias=Z.normalBias,it.shadowRadius=Z.radius,it.shadowMapSize=Z.mapSize,i.spotShadow[f]=it,i.spotShadowMap[f]=$,b++}f++}else if(D.isRectAreaLight){const j=e.get(D);j.color.copy(B).multiplyScalar(k),j.halfWidth.set(D.width*.5,0,0),j.halfHeight.set(0,D.height*.5,0),i.rectArea[S]=j,S++}else if(D.isPointLight){const j=e.get(D);if(j.color.copy(D.color).multiplyScalar(D.intensity*w),j.distance=D.distance,j.decay=D.decay,D.castShadow){const Z=D.shadow,it=n.get(D);it.shadowBias=Z.bias,it.shadowNormalBias=Z.normalBias,it.shadowRadius=Z.radius,it.shadowMapSize=Z.mapSize,it.shadowCameraNear=Z.camera.near,it.shadowCameraFar=Z.camera.far,i.pointShadow[p]=it,i.pointShadowMap[p]=$,i.pointShadowMatrix[p]=D.shadow.matrix,L++}i.point[p]=j,p++}else if(D.isHemisphereLight){const j=e.get(D);j.skyColor.copy(D.color).multiplyScalar(k*w),j.groundColor.copy(D.groundColor).multiplyScalar(k*w),i.hemi[v]=j,v++}}S>0&&(t.isWebGL2?s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ht.LTC_FLOAT_1,i.rectAreaLTC2=ht.LTC_FLOAT_2):(i.rectAreaLTC1=ht.LTC_HALF_1,i.rectAreaLTC2=ht.LTC_HALF_2):s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ht.LTC_FLOAT_1,i.rectAreaLTC2=ht.LTC_FLOAT_2):s.has("OES_texture_half_float_linear")===!0?(i.rectAreaLTC1=ht.LTC_HALF_1,i.rectAreaLTC2=ht.LTC_HALF_2):console.error("THREE.WebGLRenderer: Unable to use RectAreaLight. Missing WebGL extensions.")),i.ambient[0]=d,i.ambient[1]=m,i.ambient[2]=g;const F=i.hash;(F.directionalLength!==_||F.pointLength!==p||F.spotLength!==f||F.rectAreaLength!==S||F.hemiLength!==v||F.numDirectionalShadows!==y||F.numPointShadows!==L||F.numSpotShadows!==b||F.numSpotMaps!==C||F.numLightProbes!==M)&&(i.directional.length=_,i.spot.length=f,i.rectArea.length=S,i.point.length=p,i.hemi.length=v,i.directionalShadow.length=y,i.directionalShadowMap.length=y,i.pointShadow.length=L,i.pointShadowMap.length=L,i.spotShadow.length=b,i.spotShadowMap.length=b,i.directionalShadowMatrix.length=y,i.pointShadowMatrix.length=L,i.spotLightMatrix.length=b+C-O,i.spotLightMap.length=C,i.numSpotLightShadowsWithMaps=O,i.numLightProbes=M,F.directionalLength=_,F.pointLength=p,F.spotLength=f,F.rectAreaLength=S,F.hemiLength=v,F.numDirectionalShadows=y,F.numPointShadows=L,F.numSpotShadows=b,F.numSpotMaps=C,F.numLightProbes=M,i.version=Xp++)}function c(h,u){let d=0,m=0,g=0,_=0,p=0;const f=u.matrixWorldInverse;for(let S=0,v=h.length;S<v;S++){const y=h[S];if(y.isDirectionalLight){const L=i.directional[d];L.direction.setFromMatrixPosition(y.matrixWorld),r.setFromMatrixPosition(y.target.matrixWorld),L.direction.sub(r),L.direction.transformDirection(f),d++}else if(y.isSpotLight){const L=i.spot[g];L.position.setFromMatrixPosition(y.matrixWorld),L.position.applyMatrix4(f),L.direction.setFromMatrixPosition(y.matrixWorld),r.setFromMatrixPosition(y.target.matrixWorld),L.direction.sub(r),L.direction.transformDirection(f),g++}else if(y.isRectAreaLight){const L=i.rectArea[_];L.position.setFromMatrixPosition(y.matrixWorld),L.position.applyMatrix4(f),o.identity(),a.copy(y.matrixWorld),a.premultiply(f),o.extractRotation(a),L.halfWidth.set(y.width*.5,0,0),L.halfHeight.set(0,y.height*.5,0),L.halfWidth.applyMatrix4(o),L.halfHeight.applyMatrix4(o),_++}else if(y.isPointLight){const L=i.point[m];L.position.setFromMatrixPosition(y.matrixWorld),L.position.applyMatrix4(f),m++}else if(y.isHemisphereLight){const L=i.hemi[p];L.direction.setFromMatrixPosition(y.matrixWorld),L.direction.transformDirection(f),p++}}}return{setup:l,setupView:c,state:i}}function Oo(s,t){const e=new Yp(s,t),n=[],i=[];function r(){n.length=0,i.length=0}function a(u){n.push(u)}function o(u){i.push(u)}function l(u){e.setup(n,u)}function c(u){e.setupView(n,u)}return{init:r,state:{lightsArray:n,shadowsArray:i,lights:e},setupLights:l,setupLightsView:c,pushLight:a,pushShadow:o}}function $p(s,t){let e=new WeakMap;function n(r,a=0){const o=e.get(r);let l;return o===void 0?(l=new Oo(s,t),e.set(r,[l])):a>=o.length?(l=new Oo(s,t),o.push(l)):l=o[a],l}function i(){e=new WeakMap}return{get:n,dispose:i}}class jp extends xn{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Xc,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class Zp extends xn{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const Jp=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Kp=`uniform sampler2D shadow_pass;
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
}`;function Qp(s,t,e){let n=new ea;const i=new at,r=new at,a=new Se,o=new jp({depthPacking:qc}),l=new Zp,c={},h=e.maxTextureSize,u={[Dn]:ze,[ze]:Dn,[Be]:Be},d=new $n({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new at},radius:{value:4}},vertexShader:Jp,fragmentShader:Kp}),m=d.clone();m.defines.HORIZONTAL_PASS=1;const g=new we;g.setAttribute("position",new Pe(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const _=new st(g,d),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=nl;let f=this.type;this.render=function(b,C,O){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||b.length===0)return;const M=s.getRenderTarget(),w=s.getActiveCubeFace(),F=s.getActiveMipmapLevel(),G=s.state;G.setBlending(Cn),G.buffers.color.setClear(1,1,1,1),G.buffers.depth.setTest(!0),G.setScissorTest(!1);const J=f!==pn&&this.type===pn,D=f===pn&&this.type!==pn;for(let B=0,k=b.length;B<k;B++){const Y=b[B],$=Y.shadow;if($===void 0){console.warn("THREE.WebGLShadowMap:",Y,"has no shadow.");continue}if($.autoUpdate===!1&&$.needsUpdate===!1)continue;i.copy($.mapSize);const j=$.getFrameExtents();if(i.multiply(j),r.copy($.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(r.x=Math.floor(h/j.x),i.x=r.x*j.x,$.mapSize.x=r.x),i.y>h&&(r.y=Math.floor(h/j.y),i.y=r.y*j.y,$.mapSize.y=r.y)),$.map===null||J===!0||D===!0){const it=this.type!==pn?{minFilter:Fe,magFilter:Fe}:{};$.map!==null&&$.map.dispose(),$.map=new Yn(i.x,i.y,it),$.map.texture.name=Y.name+".shadowMap",$.camera.updateProjectionMatrix()}s.setRenderTarget($.map),s.clear();const Z=$.getViewportCount();for(let it=0;it<Z;it++){const ot=$.getViewport(it);a.set(r.x*ot.x,r.y*ot.y,r.x*ot.z,r.y*ot.w),G.viewport(a),$.updateMatrices(Y,it),n=$.getFrustum(),y(C,O,$.camera,Y,this.type)}$.isPointLightShadow!==!0&&this.type===pn&&S($,O),$.needsUpdate=!1}f=this.type,p.needsUpdate=!1,s.setRenderTarget(M,w,F)};function S(b,C){const O=t.update(_);d.defines.VSM_SAMPLES!==b.blurSamples&&(d.defines.VSM_SAMPLES=b.blurSamples,m.defines.VSM_SAMPLES=b.blurSamples,d.needsUpdate=!0,m.needsUpdate=!0),b.mapPass===null&&(b.mapPass=new Yn(i.x,i.y)),d.uniforms.shadow_pass.value=b.map.texture,d.uniforms.resolution.value=b.mapSize,d.uniforms.radius.value=b.radius,s.setRenderTarget(b.mapPass),s.clear(),s.renderBufferDirect(C,null,O,d,_,null),m.uniforms.shadow_pass.value=b.mapPass.texture,m.uniforms.resolution.value=b.mapSize,m.uniforms.radius.value=b.radius,s.setRenderTarget(b.map),s.clear(),s.renderBufferDirect(C,null,O,m,_,null)}function v(b,C,O,M){let w=null;const F=O.isPointLight===!0?b.customDistanceMaterial:b.customDepthMaterial;if(F!==void 0)w=F;else if(w=O.isPointLight===!0?l:o,s.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0){const G=w.uuid,J=C.uuid;let D=c[G];D===void 0&&(D={},c[G]=D);let B=D[J];B===void 0&&(B=w.clone(),D[J]=B,C.addEventListener("dispose",L)),w=B}if(w.visible=C.visible,w.wireframe=C.wireframe,M===pn?w.side=C.shadowSide!==null?C.shadowSide:C.side:w.side=C.shadowSide!==null?C.shadowSide:u[C.side],w.alphaMap=C.alphaMap,w.alphaTest=C.alphaTest,w.map=C.map,w.clipShadows=C.clipShadows,w.clippingPlanes=C.clippingPlanes,w.clipIntersection=C.clipIntersection,w.displacementMap=C.displacementMap,w.displacementScale=C.displacementScale,w.displacementBias=C.displacementBias,w.wireframeLinewidth=C.wireframeLinewidth,w.linewidth=C.linewidth,O.isPointLight===!0&&w.isMeshDistanceMaterial===!0){const G=s.properties.get(w);G.light=O}return w}function y(b,C,O,M,w){if(b.visible===!1)return;if(b.layers.test(C.layers)&&(b.isMesh||b.isLine||b.isPoints)&&(b.castShadow||b.receiveShadow&&w===pn)&&(!b.frustumCulled||n.intersectsObject(b))){b.modelViewMatrix.multiplyMatrices(O.matrixWorldInverse,b.matrixWorld);const J=t.update(b),D=b.material;if(Array.isArray(D)){const B=J.groups;for(let k=0,Y=B.length;k<Y;k++){const $=B[k],j=D[$.materialIndex];if(j&&j.visible){const Z=v(b,j,M,w);b.onBeforeShadow(s,b,C,O,J,Z,$),s.renderBufferDirect(O,null,J,Z,b,$),b.onAfterShadow(s,b,C,O,J,Z,$)}}}else if(D.visible){const B=v(b,D,M,w);b.onBeforeShadow(s,b,C,O,J,B,null),s.renderBufferDirect(O,null,J,B,b,null),b.onAfterShadow(s,b,C,O,J,B,null)}}const G=b.children;for(let J=0,D=G.length;J<D;J++)y(G[J],C,O,M,w)}function L(b){b.target.removeEventListener("dispose",L);for(const O in c){const M=c[O],w=b.target.uuid;w in M&&(M[w].dispose(),delete M[w])}}}function tm(s,t,e){const n=e.isWebGL2;function i(){let I=!1;const dt=new Se;let ft=null;const Dt=new Se(0,0,0,0);return{setMask:function(Ct){ft!==Ct&&!I&&(s.colorMask(Ct,Ct,Ct,Ct),ft=Ct)},setLocked:function(Ct){I=Ct},setClear:function(Ct,Kt,Qt,_e,Le){Le===!0&&(Ct*=_e,Kt*=_e,Qt*=_e),dt.set(Ct,Kt,Qt,_e),Dt.equals(dt)===!1&&(s.clearColor(Ct,Kt,Qt,_e),Dt.copy(dt))},reset:function(){I=!1,ft=null,Dt.set(-1,0,0,0)}}}function r(){let I=!1,dt=null,ft=null,Dt=null;return{setTest:function(Ct){Ct?Ft(s.DEPTH_TEST):St(s.DEPTH_TEST)},setMask:function(Ct){dt!==Ct&&!I&&(s.depthMask(Ct),dt=Ct)},setFunc:function(Ct){if(ft!==Ct){switch(Ct){case Mc:s.depthFunc(s.NEVER);break;case Sc:s.depthFunc(s.ALWAYS);break;case Ec:s.depthFunc(s.LESS);break;case Fs:s.depthFunc(s.LEQUAL);break;case wc:s.depthFunc(s.EQUAL);break;case Tc:s.depthFunc(s.GEQUAL);break;case Ac:s.depthFunc(s.GREATER);break;case bc:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}ft=Ct}},setLocked:function(Ct){I=Ct},setClear:function(Ct){Dt!==Ct&&(s.clearDepth(Ct),Dt=Ct)},reset:function(){I=!1,dt=null,ft=null,Dt=null}}}function a(){let I=!1,dt=null,ft=null,Dt=null,Ct=null,Kt=null,Qt=null,_e=null,Le=null;return{setTest:function(te){I||(te?Ft(s.STENCIL_TEST):St(s.STENCIL_TEST))},setMask:function(te){dt!==te&&!I&&(s.stencilMask(te),dt=te)},setFunc:function(te,De,nn){(ft!==te||Dt!==De||Ct!==nn)&&(s.stencilFunc(te,De,nn),ft=te,Dt=De,Ct=nn)},setOp:function(te,De,nn){(Kt!==te||Qt!==De||_e!==nn)&&(s.stencilOp(te,De,nn),Kt=te,Qt=De,_e=nn)},setLocked:function(te){I=te},setClear:function(te){Le!==te&&(s.clearStencil(te),Le=te)},reset:function(){I=!1,dt=null,ft=null,Dt=null,Ct=null,Kt=null,Qt=null,_e=null,Le=null}}}const o=new i,l=new r,c=new a,h=new WeakMap,u=new WeakMap;let d={},m={},g=new WeakMap,_=[],p=null,f=!1,S=null,v=null,y=null,L=null,b=null,C=null,O=null,M=new Tt(0,0,0),w=0,F=!1,G=null,J=null,D=null,B=null,k=null;const Y=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let $=!1,j=0;const Z=s.getParameter(s.VERSION);Z.indexOf("WebGL")!==-1?(j=parseFloat(/^WebGL (\d)/.exec(Z)[1]),$=j>=1):Z.indexOf("OpenGL ES")!==-1&&(j=parseFloat(/^OpenGL ES (\d)/.exec(Z)[1]),$=j>=2);let it=null,ot={};const W=s.getParameter(s.SCISSOR_BOX),Q=s.getParameter(s.VIEWPORT),pt=new Se().fromArray(W),Mt=new Se().fromArray(Q);function _t(I,dt,ft,Dt){const Ct=new Uint8Array(4),Kt=s.createTexture();s.bindTexture(I,Kt),s.texParameteri(I,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(I,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let Qt=0;Qt<ft;Qt++)n&&(I===s.TEXTURE_3D||I===s.TEXTURE_2D_ARRAY)?s.texImage3D(dt,0,s.RGBA,1,1,Dt,0,s.RGBA,s.UNSIGNED_BYTE,Ct):s.texImage2D(dt+Qt,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,Ct);return Kt}const Lt={};Lt[s.TEXTURE_2D]=_t(s.TEXTURE_2D,s.TEXTURE_2D,1),Lt[s.TEXTURE_CUBE_MAP]=_t(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),n&&(Lt[s.TEXTURE_2D_ARRAY]=_t(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),Lt[s.TEXTURE_3D]=_t(s.TEXTURE_3D,s.TEXTURE_3D,1,1)),o.setClear(0,0,0,1),l.setClear(1),c.setClear(0),Ft(s.DEPTH_TEST),l.setFunc(Fs),mt(!1),E(xa),Ft(s.CULL_FACE),X(Cn);function Ft(I){d[I]!==!0&&(s.enable(I),d[I]=!0)}function St(I){d[I]!==!1&&(s.disable(I),d[I]=!1)}function Ut(I,dt){return m[I]!==dt?(s.bindFramebuffer(I,dt),m[I]=dt,n&&(I===s.DRAW_FRAMEBUFFER&&(m[s.FRAMEBUFFER]=dt),I===s.FRAMEBUFFER&&(m[s.DRAW_FRAMEBUFFER]=dt)),!0):!1}function P(I,dt){let ft=_,Dt=!1;if(I)if(ft=g.get(dt),ft===void 0&&(ft=[],g.set(dt,ft)),I.isWebGLMultipleRenderTargets){const Ct=I.texture;if(ft.length!==Ct.length||ft[0]!==s.COLOR_ATTACHMENT0){for(let Kt=0,Qt=Ct.length;Kt<Qt;Kt++)ft[Kt]=s.COLOR_ATTACHMENT0+Kt;ft.length=Ct.length,Dt=!0}}else ft[0]!==s.COLOR_ATTACHMENT0&&(ft[0]=s.COLOR_ATTACHMENT0,Dt=!0);else ft[0]!==s.BACK&&(ft[0]=s.BACK,Dt=!0);Dt&&(e.isWebGL2?s.drawBuffers(ft):t.get("WEBGL_draw_buffers").drawBuffersWEBGL(ft))}function lt(I){return p!==I?(s.useProgram(I),p=I,!0):!1}const q={[Gn]:s.FUNC_ADD,[ac]:s.FUNC_SUBTRACT,[oc]:s.FUNC_REVERSE_SUBTRACT};if(n)q[Sa]=s.MIN,q[Ea]=s.MAX;else{const I=t.get("EXT_blend_minmax");I!==null&&(q[Sa]=I.MIN_EXT,q[Ea]=I.MAX_EXT)}const rt={[lc]:s.ZERO,[cc]:s.ONE,[hc]:s.SRC_COLOR,[Fr]:s.SRC_ALPHA,[gc]:s.SRC_ALPHA_SATURATE,[pc]:s.DST_COLOR,[dc]:s.DST_ALPHA,[uc]:s.ONE_MINUS_SRC_COLOR,[Or]:s.ONE_MINUS_SRC_ALPHA,[mc]:s.ONE_MINUS_DST_COLOR,[fc]:s.ONE_MINUS_DST_ALPHA,[_c]:s.CONSTANT_COLOR,[vc]:s.ONE_MINUS_CONSTANT_COLOR,[xc]:s.CONSTANT_ALPHA,[yc]:s.ONE_MINUS_CONSTANT_ALPHA};function X(I,dt,ft,Dt,Ct,Kt,Qt,_e,Le,te){if(I===Cn){f===!0&&(St(s.BLEND),f=!1);return}if(f===!1&&(Ft(s.BLEND),f=!0),I!==rc){if(I!==S||te!==F){if((v!==Gn||b!==Gn)&&(s.blendEquation(s.FUNC_ADD),v=Gn,b=Gn),te)switch(I){case Vn:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case qi:s.blendFunc(s.ONE,s.ONE);break;case ya:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case Ma:s.blendFuncSeparate(s.ZERO,s.SRC_COLOR,s.ZERO,s.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}else switch(I){case Vn:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case qi:s.blendFunc(s.SRC_ALPHA,s.ONE);break;case ya:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case Ma:s.blendFunc(s.ZERO,s.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}y=null,L=null,C=null,O=null,M.set(0,0,0),w=0,S=I,F=te}return}Ct=Ct||dt,Kt=Kt||ft,Qt=Qt||Dt,(dt!==v||Ct!==b)&&(s.blendEquationSeparate(q[dt],q[Ct]),v=dt,b=Ct),(ft!==y||Dt!==L||Kt!==C||Qt!==O)&&(s.blendFuncSeparate(rt[ft],rt[Dt],rt[Kt],rt[Qt]),y=ft,L=Dt,C=Kt,O=Qt),(_e.equals(M)===!1||Le!==w)&&(s.blendColor(_e.r,_e.g,_e.b,Le),M.copy(_e),w=Le),S=I,F=!1}function wt(I,dt){I.side===Be?St(s.CULL_FACE):Ft(s.CULL_FACE);let ft=I.side===ze;dt&&(ft=!ft),mt(ft),I.blending===Vn&&I.transparent===!1?X(Cn):X(I.blending,I.blendEquation,I.blendSrc,I.blendDst,I.blendEquationAlpha,I.blendSrcAlpha,I.blendDstAlpha,I.blendColor,I.blendAlpha,I.premultipliedAlpha),l.setFunc(I.depthFunc),l.setTest(I.depthTest),l.setMask(I.depthWrite),o.setMask(I.colorWrite);const Dt=I.stencilWrite;c.setTest(Dt),Dt&&(c.setMask(I.stencilWriteMask),c.setFunc(I.stencilFunc,I.stencilRef,I.stencilFuncMask),c.setOp(I.stencilFail,I.stencilZFail,I.stencilZPass)),N(I.polygonOffset,I.polygonOffsetFactor,I.polygonOffsetUnits),I.alphaToCoverage===!0?Ft(s.SAMPLE_ALPHA_TO_COVERAGE):St(s.SAMPLE_ALPHA_TO_COVERAGE)}function mt(I){G!==I&&(I?s.frontFace(s.CW):s.frontFace(s.CCW),G=I)}function E(I){I!==ic?(Ft(s.CULL_FACE),I!==J&&(I===xa?s.cullFace(s.BACK):I===sc?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):St(s.CULL_FACE),J=I}function x(I){I!==D&&($&&s.lineWidth(I),D=I)}function N(I,dt,ft){I?(Ft(s.POLYGON_OFFSET_FILL),(B!==dt||k!==ft)&&(s.polygonOffset(dt,ft),B=dt,k=ft)):St(s.POLYGON_OFFSET_FILL)}function nt(I){I?Ft(s.SCISSOR_TEST):St(s.SCISSOR_TEST)}function tt(I){I===void 0&&(I=s.TEXTURE0+Y-1),it!==I&&(s.activeTexture(I),it=I)}function K(I,dt,ft){ft===void 0&&(it===null?ft=s.TEXTURE0+Y-1:ft=it);let Dt=ot[ft];Dt===void 0&&(Dt={type:void 0,texture:void 0},ot[ft]=Dt),(Dt.type!==I||Dt.texture!==dt)&&(it!==ft&&(s.activeTexture(ft),it=ft),s.bindTexture(I,dt||Lt[I]),Dt.type=I,Dt.texture=dt)}function yt(){const I=ot[it];I!==void 0&&I.type!==void 0&&(s.bindTexture(I.type,null),I.type=void 0,I.texture=void 0)}function ut(){try{s.compressedTexImage2D.apply(s,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function vt(){try{s.compressedTexImage3D.apply(s,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function bt(){try{s.texSubImage2D.apply(s,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Bt(){try{s.texSubImage3D.apply(s,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function et(){try{s.compressedTexSubImage2D.apply(s,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Yt(){try{s.compressedTexSubImage3D.apply(s,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function qt(){try{s.texStorage2D.apply(s,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Nt(){try{s.texStorage3D.apply(s,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function At(){try{s.texImage2D.apply(s,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function xt(){try{s.texImage3D.apply(s,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Ht(I){pt.equals(I)===!1&&(s.scissor(I.x,I.y,I.z,I.w),pt.copy(I))}function $t(I){Mt.equals(I)===!1&&(s.viewport(I.x,I.y,I.z,I.w),Mt.copy(I))}function le(I,dt){let ft=u.get(dt);ft===void 0&&(ft=new WeakMap,u.set(dt,ft));let Dt=ft.get(I);Dt===void 0&&(Dt=s.getUniformBlockIndex(dt,I.name),ft.set(I,Dt))}function Vt(I,dt){const Dt=u.get(dt).get(I);h.get(dt)!==Dt&&(s.uniformBlockBinding(dt,Dt,I.__bindingPointIndex),h.set(dt,Dt))}function ct(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),n===!0&&(s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null)),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),d={},it=null,ot={},m={},g=new WeakMap,_=[],p=null,f=!1,S=null,v=null,y=null,L=null,b=null,C=null,O=null,M=new Tt(0,0,0),w=0,F=!1,G=null,J=null,D=null,B=null,k=null,pt.set(0,0,s.canvas.width,s.canvas.height),Mt.set(0,0,s.canvas.width,s.canvas.height),o.reset(),l.reset(),c.reset()}return{buffers:{color:o,depth:l,stencil:c},enable:Ft,disable:St,bindFramebuffer:Ut,drawBuffers:P,useProgram:lt,setBlending:X,setMaterial:wt,setFlipSided:mt,setCullFace:E,setLineWidth:x,setPolygonOffset:N,setScissorTest:nt,activeTexture:tt,bindTexture:K,unbindTexture:yt,compressedTexImage2D:ut,compressedTexImage3D:vt,texImage2D:At,texImage3D:xt,updateUBOMapping:le,uniformBlockBinding:Vt,texStorage2D:qt,texStorage3D:Nt,texSubImage2D:bt,texSubImage3D:Bt,compressedTexSubImage2D:et,compressedTexSubImage3D:Yt,scissor:Ht,viewport:$t,reset:ct}}function em(s,t,e,n,i,r,a){const o=i.isWebGL2,l=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),h=new WeakMap;let u;const d=new WeakMap;let m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(E,x){return m?new OffscreenCanvas(E,x):Gs("canvas")}function _(E,x,N,nt){let tt=1;if((E.width>nt||E.height>nt)&&(tt=nt/Math.max(E.width,E.height)),tt<1||x===!0)if(typeof HTMLImageElement<"u"&&E instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&E instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&E instanceof ImageBitmap){const K=x?Xr:Math.floor,yt=K(tt*E.width),ut=K(tt*E.height);u===void 0&&(u=g(yt,ut));const vt=N?g(yt,ut):u;return vt.width=yt,vt.height=ut,vt.getContext("2d").drawImage(E,0,0,yt,ut),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+E.width+"x"+E.height+") to ("+yt+"x"+ut+")."),vt}else return"data"in E&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+E.width+"x"+E.height+")."),E;return E}function p(E){return Ka(E.width)&&Ka(E.height)}function f(E){return o?!1:E.wrapS!==tn||E.wrapT!==tn||E.minFilter!==Fe&&E.minFilter!==qe}function S(E,x){return E.generateMipmaps&&x&&E.minFilter!==Fe&&E.minFilter!==qe}function v(E){s.generateMipmap(E)}function y(E,x,N,nt,tt=!1){if(o===!1)return x;if(E!==null){if(s[E]!==void 0)return s[E];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+E+"'")}let K=x;if(x===s.RED&&(N===s.FLOAT&&(K=s.R32F),N===s.HALF_FLOAT&&(K=s.R16F),N===s.UNSIGNED_BYTE&&(K=s.R8)),x===s.RED_INTEGER&&(N===s.UNSIGNED_BYTE&&(K=s.R8UI),N===s.UNSIGNED_SHORT&&(K=s.R16UI),N===s.UNSIGNED_INT&&(K=s.R32UI),N===s.BYTE&&(K=s.R8I),N===s.SHORT&&(K=s.R16I),N===s.INT&&(K=s.R32I)),x===s.RG&&(N===s.FLOAT&&(K=s.RG32F),N===s.HALF_FLOAT&&(K=s.RG16F),N===s.UNSIGNED_BYTE&&(K=s.RG8)),x===s.RGBA){const yt=tt?Os:Zt.getTransfer(nt);N===s.FLOAT&&(K=s.RGBA32F),N===s.HALF_FLOAT&&(K=s.RGBA16F),N===s.UNSIGNED_BYTE&&(K=yt===ee?s.SRGB8_ALPHA8:s.RGBA8),N===s.UNSIGNED_SHORT_4_4_4_4&&(K=s.RGBA4),N===s.UNSIGNED_SHORT_5_5_5_1&&(K=s.RGB5_A1)}return(K===s.R16F||K===s.R32F||K===s.RG16F||K===s.RG32F||K===s.RGBA16F||K===s.RGBA32F)&&t.get("EXT_color_buffer_float"),K}function L(E,x,N){return S(E,N)===!0||E.isFramebufferTexture&&E.minFilter!==Fe&&E.minFilter!==qe?Math.log2(Math.max(x.width,x.height))+1:E.mipmaps!==void 0&&E.mipmaps.length>0?E.mipmaps.length:E.isCompressedTexture&&Array.isArray(E.image)?x.mipmaps.length:1}function b(E){return E===Fe||E===wa||E===Qs?s.NEAREST:s.LINEAR}function C(E){const x=E.target;x.removeEventListener("dispose",C),M(x),x.isVideoTexture&&h.delete(x)}function O(E){const x=E.target;x.removeEventListener("dispose",O),F(x)}function M(E){const x=n.get(E);if(x.__webglInit===void 0)return;const N=E.source,nt=d.get(N);if(nt){const tt=nt[x.__cacheKey];tt.usedTimes--,tt.usedTimes===0&&w(E),Object.keys(nt).length===0&&d.delete(N)}n.remove(E)}function w(E){const x=n.get(E);s.deleteTexture(x.__webglTexture);const N=E.source,nt=d.get(N);delete nt[x.__cacheKey],a.memory.textures--}function F(E){const x=E.texture,N=n.get(E),nt=n.get(x);if(nt.__webglTexture!==void 0&&(s.deleteTexture(nt.__webglTexture),a.memory.textures--),E.depthTexture&&E.depthTexture.dispose(),E.isWebGLCubeRenderTarget)for(let tt=0;tt<6;tt++){if(Array.isArray(N.__webglFramebuffer[tt]))for(let K=0;K<N.__webglFramebuffer[tt].length;K++)s.deleteFramebuffer(N.__webglFramebuffer[tt][K]);else s.deleteFramebuffer(N.__webglFramebuffer[tt]);N.__webglDepthbuffer&&s.deleteRenderbuffer(N.__webglDepthbuffer[tt])}else{if(Array.isArray(N.__webglFramebuffer))for(let tt=0;tt<N.__webglFramebuffer.length;tt++)s.deleteFramebuffer(N.__webglFramebuffer[tt]);else s.deleteFramebuffer(N.__webglFramebuffer);if(N.__webglDepthbuffer&&s.deleteRenderbuffer(N.__webglDepthbuffer),N.__webglMultisampledFramebuffer&&s.deleteFramebuffer(N.__webglMultisampledFramebuffer),N.__webglColorRenderbuffer)for(let tt=0;tt<N.__webglColorRenderbuffer.length;tt++)N.__webglColorRenderbuffer[tt]&&s.deleteRenderbuffer(N.__webglColorRenderbuffer[tt]);N.__webglDepthRenderbuffer&&s.deleteRenderbuffer(N.__webglDepthRenderbuffer)}if(E.isWebGLMultipleRenderTargets)for(let tt=0,K=x.length;tt<K;tt++){const yt=n.get(x[tt]);yt.__webglTexture&&(s.deleteTexture(yt.__webglTexture),a.memory.textures--),n.remove(x[tt])}n.remove(x),n.remove(E)}let G=0;function J(){G=0}function D(){const E=G;return E>=i.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+E+" texture units while this GPU supports only "+i.maxTextures),G+=1,E}function B(E){const x=[];return x.push(E.wrapS),x.push(E.wrapT),x.push(E.wrapR||0),x.push(E.magFilter),x.push(E.minFilter),x.push(E.anisotropy),x.push(E.internalFormat),x.push(E.format),x.push(E.type),x.push(E.generateMipmaps),x.push(E.premultiplyAlpha),x.push(E.flipY),x.push(E.unpackAlignment),x.push(E.colorSpace),x.join()}function k(E,x){const N=n.get(E);if(E.isVideoTexture&&wt(E),E.isRenderTargetTexture===!1&&E.version>0&&N.__version!==E.version){const nt=E.image;if(nt===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(nt.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{pt(N,E,x);return}}e.bindTexture(s.TEXTURE_2D,N.__webglTexture,s.TEXTURE0+x)}function Y(E,x){const N=n.get(E);if(E.version>0&&N.__version!==E.version){pt(N,E,x);return}e.bindTexture(s.TEXTURE_2D_ARRAY,N.__webglTexture,s.TEXTURE0+x)}function $(E,x){const N=n.get(E);if(E.version>0&&N.__version!==E.version){pt(N,E,x);return}e.bindTexture(s.TEXTURE_3D,N.__webglTexture,s.TEXTURE0+x)}function j(E,x){const N=n.get(E);if(E.version>0&&N.__version!==E.version){Mt(N,E,x);return}e.bindTexture(s.TEXTURE_CUBE_MAP,N.__webglTexture,s.TEXTURE0+x)}const Z={[Hr]:s.REPEAT,[tn]:s.CLAMP_TO_EDGE,[Gr]:s.MIRRORED_REPEAT},it={[Fe]:s.NEAREST,[wa]:s.NEAREST_MIPMAP_NEAREST,[Qs]:s.NEAREST_MIPMAP_LINEAR,[qe]:s.LINEAR,[Fc]:s.LINEAR_MIPMAP_NEAREST,[Yi]:s.LINEAR_MIPMAP_LINEAR},ot={[$c]:s.NEVER,[th]:s.ALWAYS,[jc]:s.LESS,[ml]:s.LEQUAL,[Zc]:s.EQUAL,[Qc]:s.GEQUAL,[Jc]:s.GREATER,[Kc]:s.NOTEQUAL};function W(E,x,N){if(N?(s.texParameteri(E,s.TEXTURE_WRAP_S,Z[x.wrapS]),s.texParameteri(E,s.TEXTURE_WRAP_T,Z[x.wrapT]),(E===s.TEXTURE_3D||E===s.TEXTURE_2D_ARRAY)&&s.texParameteri(E,s.TEXTURE_WRAP_R,Z[x.wrapR]),s.texParameteri(E,s.TEXTURE_MAG_FILTER,it[x.magFilter]),s.texParameteri(E,s.TEXTURE_MIN_FILTER,it[x.minFilter])):(s.texParameteri(E,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(E,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),(E===s.TEXTURE_3D||E===s.TEXTURE_2D_ARRAY)&&s.texParameteri(E,s.TEXTURE_WRAP_R,s.CLAMP_TO_EDGE),(x.wrapS!==tn||x.wrapT!==tn)&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping."),s.texParameteri(E,s.TEXTURE_MAG_FILTER,b(x.magFilter)),s.texParameteri(E,s.TEXTURE_MIN_FILTER,b(x.minFilter)),x.minFilter!==Fe&&x.minFilter!==qe&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.")),x.compareFunction&&(s.texParameteri(E,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(E,s.TEXTURE_COMPARE_FUNC,ot[x.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){const nt=t.get("EXT_texture_filter_anisotropic");if(x.magFilter===Fe||x.minFilter!==Qs&&x.minFilter!==Yi||x.type===bn&&t.has("OES_texture_float_linear")===!1||o===!1&&x.type===$i&&t.has("OES_texture_half_float_linear")===!1)return;(x.anisotropy>1||n.get(x).__currentAnisotropy)&&(s.texParameterf(E,nt.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,i.getMaxAnisotropy())),n.get(x).__currentAnisotropy=x.anisotropy)}}function Q(E,x){let N=!1;E.__webglInit===void 0&&(E.__webglInit=!0,x.addEventListener("dispose",C));const nt=x.source;let tt=d.get(nt);tt===void 0&&(tt={},d.set(nt,tt));const K=B(x);if(K!==E.__cacheKey){tt[K]===void 0&&(tt[K]={texture:s.createTexture(),usedTimes:0},a.memory.textures++,N=!0),tt[K].usedTimes++;const yt=tt[E.__cacheKey];yt!==void 0&&(tt[E.__cacheKey].usedTimes--,yt.usedTimes===0&&w(x)),E.__cacheKey=K,E.__webglTexture=tt[K].texture}return N}function pt(E,x,N){let nt=s.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&(nt=s.TEXTURE_2D_ARRAY),x.isData3DTexture&&(nt=s.TEXTURE_3D);const tt=Q(E,x),K=x.source;e.bindTexture(nt,E.__webglTexture,s.TEXTURE0+N);const yt=n.get(K);if(K.version!==yt.__version||tt===!0){e.activeTexture(s.TEXTURE0+N);const ut=Zt.getPrimaries(Zt.workingColorSpace),vt=x.colorSpace===je?null:Zt.getPrimaries(x.colorSpace),bt=x.colorSpace===je||ut===vt?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,x.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,x.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,bt);const Bt=f(x)&&p(x.image)===!1;let et=_(x.image,Bt,!1,i.maxTextureSize);et=mt(x,et);const Yt=p(et)||o,qt=r.convert(x.format,x.colorSpace);let Nt=r.convert(x.type),At=y(x.internalFormat,qt,Nt,x.colorSpace,x.isVideoTexture);W(nt,x,Yt);let xt;const Ht=x.mipmaps,$t=o&&x.isVideoTexture!==!0&&At!==dl,le=yt.__version===void 0||tt===!0,Vt=L(x,et,Yt);if(x.isDepthTexture)At=s.DEPTH_COMPONENT,o?x.type===bn?At=s.DEPTH_COMPONENT32F:x.type===An?At=s.DEPTH_COMPONENT24:x.type===Wn?At=s.DEPTH24_STENCIL8:At=s.DEPTH_COMPONENT16:x.type===bn&&console.error("WebGLRenderer: Floating point depth texture requires WebGL2."),x.format===Xn&&At===s.DEPTH_COMPONENT&&x.type!==Qr&&x.type!==An&&(console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture."),x.type=An,Nt=r.convert(x.type)),x.format===Ai&&At===s.DEPTH_COMPONENT&&(At=s.DEPTH_STENCIL,x.type!==Wn&&(console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture."),x.type=Wn,Nt=r.convert(x.type))),le&&($t?e.texStorage2D(s.TEXTURE_2D,1,At,et.width,et.height):e.texImage2D(s.TEXTURE_2D,0,At,et.width,et.height,0,qt,Nt,null));else if(x.isDataTexture)if(Ht.length>0&&Yt){$t&&le&&e.texStorage2D(s.TEXTURE_2D,Vt,At,Ht[0].width,Ht[0].height);for(let ct=0,I=Ht.length;ct<I;ct++)xt=Ht[ct],$t?e.texSubImage2D(s.TEXTURE_2D,ct,0,0,xt.width,xt.height,qt,Nt,xt.data):e.texImage2D(s.TEXTURE_2D,ct,At,xt.width,xt.height,0,qt,Nt,xt.data);x.generateMipmaps=!1}else $t?(le&&e.texStorage2D(s.TEXTURE_2D,Vt,At,et.width,et.height),e.texSubImage2D(s.TEXTURE_2D,0,0,0,et.width,et.height,qt,Nt,et.data)):e.texImage2D(s.TEXTURE_2D,0,At,et.width,et.height,0,qt,Nt,et.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){$t&&le&&e.texStorage3D(s.TEXTURE_2D_ARRAY,Vt,At,Ht[0].width,Ht[0].height,et.depth);for(let ct=0,I=Ht.length;ct<I;ct++)xt=Ht[ct],x.format!==en?qt!==null?$t?e.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,ct,0,0,0,xt.width,xt.height,et.depth,qt,xt.data,0,0):e.compressedTexImage3D(s.TEXTURE_2D_ARRAY,ct,At,xt.width,xt.height,et.depth,0,xt.data,0,0):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):$t?e.texSubImage3D(s.TEXTURE_2D_ARRAY,ct,0,0,0,xt.width,xt.height,et.depth,qt,Nt,xt.data):e.texImage3D(s.TEXTURE_2D_ARRAY,ct,At,xt.width,xt.height,et.depth,0,qt,Nt,xt.data)}else{$t&&le&&e.texStorage2D(s.TEXTURE_2D,Vt,At,Ht[0].width,Ht[0].height);for(let ct=0,I=Ht.length;ct<I;ct++)xt=Ht[ct],x.format!==en?qt!==null?$t?e.compressedTexSubImage2D(s.TEXTURE_2D,ct,0,0,xt.width,xt.height,qt,xt.data):e.compressedTexImage2D(s.TEXTURE_2D,ct,At,xt.width,xt.height,0,xt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):$t?e.texSubImage2D(s.TEXTURE_2D,ct,0,0,xt.width,xt.height,qt,Nt,xt.data):e.texImage2D(s.TEXTURE_2D,ct,At,xt.width,xt.height,0,qt,Nt,xt.data)}else if(x.isDataArrayTexture)$t?(le&&e.texStorage3D(s.TEXTURE_2D_ARRAY,Vt,At,et.width,et.height,et.depth),e.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,et.width,et.height,et.depth,qt,Nt,et.data)):e.texImage3D(s.TEXTURE_2D_ARRAY,0,At,et.width,et.height,et.depth,0,qt,Nt,et.data);else if(x.isData3DTexture)$t?(le&&e.texStorage3D(s.TEXTURE_3D,Vt,At,et.width,et.height,et.depth),e.texSubImage3D(s.TEXTURE_3D,0,0,0,0,et.width,et.height,et.depth,qt,Nt,et.data)):e.texImage3D(s.TEXTURE_3D,0,At,et.width,et.height,et.depth,0,qt,Nt,et.data);else if(x.isFramebufferTexture){if(le)if($t)e.texStorage2D(s.TEXTURE_2D,Vt,At,et.width,et.height);else{let ct=et.width,I=et.height;for(let dt=0;dt<Vt;dt++)e.texImage2D(s.TEXTURE_2D,dt,At,ct,I,0,qt,Nt,null),ct>>=1,I>>=1}}else if(Ht.length>0&&Yt){$t&&le&&e.texStorage2D(s.TEXTURE_2D,Vt,At,Ht[0].width,Ht[0].height);for(let ct=0,I=Ht.length;ct<I;ct++)xt=Ht[ct],$t?e.texSubImage2D(s.TEXTURE_2D,ct,0,0,qt,Nt,xt):e.texImage2D(s.TEXTURE_2D,ct,At,qt,Nt,xt);x.generateMipmaps=!1}else $t?(le&&e.texStorage2D(s.TEXTURE_2D,Vt,At,et.width,et.height),e.texSubImage2D(s.TEXTURE_2D,0,0,0,qt,Nt,et)):e.texImage2D(s.TEXTURE_2D,0,At,qt,Nt,et);S(x,Yt)&&v(nt),yt.__version=K.version,x.onUpdate&&x.onUpdate(x)}E.__version=x.version}function Mt(E,x,N){if(x.image.length!==6)return;const nt=Q(E,x),tt=x.source;e.bindTexture(s.TEXTURE_CUBE_MAP,E.__webglTexture,s.TEXTURE0+N);const K=n.get(tt);if(tt.version!==K.__version||nt===!0){e.activeTexture(s.TEXTURE0+N);const yt=Zt.getPrimaries(Zt.workingColorSpace),ut=x.colorSpace===je?null:Zt.getPrimaries(x.colorSpace),vt=x.colorSpace===je||yt===ut?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,x.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,x.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,vt);const bt=x.isCompressedTexture||x.image[0].isCompressedTexture,Bt=x.image[0]&&x.image[0].isDataTexture,et=[];for(let ct=0;ct<6;ct++)!bt&&!Bt?et[ct]=_(x.image[ct],!1,!0,i.maxCubemapSize):et[ct]=Bt?x.image[ct].image:x.image[ct],et[ct]=mt(x,et[ct]);const Yt=et[0],qt=p(Yt)||o,Nt=r.convert(x.format,x.colorSpace),At=r.convert(x.type),xt=y(x.internalFormat,Nt,At,x.colorSpace),Ht=o&&x.isVideoTexture!==!0,$t=K.__version===void 0||nt===!0;let le=L(x,Yt,qt);W(s.TEXTURE_CUBE_MAP,x,qt);let Vt;if(bt){Ht&&$t&&e.texStorage2D(s.TEXTURE_CUBE_MAP,le,xt,Yt.width,Yt.height);for(let ct=0;ct<6;ct++){Vt=et[ct].mipmaps;for(let I=0;I<Vt.length;I++){const dt=Vt[I];x.format!==en?Nt!==null?Ht?e.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,I,0,0,dt.width,dt.height,Nt,dt.data):e.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,I,xt,dt.width,dt.height,0,dt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Ht?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,I,0,0,dt.width,dt.height,Nt,At,dt.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,I,xt,dt.width,dt.height,0,Nt,At,dt.data)}}}else{Vt=x.mipmaps,Ht&&$t&&(Vt.length>0&&le++,e.texStorage2D(s.TEXTURE_CUBE_MAP,le,xt,et[0].width,et[0].height));for(let ct=0;ct<6;ct++)if(Bt){Ht?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,0,0,0,et[ct].width,et[ct].height,Nt,At,et[ct].data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,0,xt,et[ct].width,et[ct].height,0,Nt,At,et[ct].data);for(let I=0;I<Vt.length;I++){const ft=Vt[I].image[ct].image;Ht?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,I+1,0,0,ft.width,ft.height,Nt,At,ft.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,I+1,xt,ft.width,ft.height,0,Nt,At,ft.data)}}else{Ht?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,0,0,0,Nt,At,et[ct]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,0,xt,Nt,At,et[ct]);for(let I=0;I<Vt.length;I++){const dt=Vt[I];Ht?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,I+1,0,0,Nt,At,dt.image[ct]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ct,I+1,xt,Nt,At,dt.image[ct])}}}S(x,qt)&&v(s.TEXTURE_CUBE_MAP),K.__version=tt.version,x.onUpdate&&x.onUpdate(x)}E.__version=x.version}function _t(E,x,N,nt,tt,K){const yt=r.convert(N.format,N.colorSpace),ut=r.convert(N.type),vt=y(N.internalFormat,yt,ut,N.colorSpace);if(!n.get(x).__hasExternalTextures){const Bt=Math.max(1,x.width>>K),et=Math.max(1,x.height>>K);tt===s.TEXTURE_3D||tt===s.TEXTURE_2D_ARRAY?e.texImage3D(tt,K,vt,Bt,et,x.depth,0,yt,ut,null):e.texImage2D(tt,K,vt,Bt,et,0,yt,ut,null)}e.bindFramebuffer(s.FRAMEBUFFER,E),X(x)?l.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,nt,tt,n.get(N).__webglTexture,0,rt(x)):(tt===s.TEXTURE_2D||tt>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&tt<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,nt,tt,n.get(N).__webglTexture,K),e.bindFramebuffer(s.FRAMEBUFFER,null)}function Lt(E,x,N){if(s.bindRenderbuffer(s.RENDERBUFFER,E),x.depthBuffer&&!x.stencilBuffer){let nt=o===!0?s.DEPTH_COMPONENT24:s.DEPTH_COMPONENT16;if(N||X(x)){const tt=x.depthTexture;tt&&tt.isDepthTexture&&(tt.type===bn?nt=s.DEPTH_COMPONENT32F:tt.type===An&&(nt=s.DEPTH_COMPONENT24));const K=rt(x);X(x)?l.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,K,nt,x.width,x.height):s.renderbufferStorageMultisample(s.RENDERBUFFER,K,nt,x.width,x.height)}else s.renderbufferStorage(s.RENDERBUFFER,nt,x.width,x.height);s.framebufferRenderbuffer(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.RENDERBUFFER,E)}else if(x.depthBuffer&&x.stencilBuffer){const nt=rt(x);N&&X(x)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,nt,s.DEPTH24_STENCIL8,x.width,x.height):X(x)?l.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,nt,s.DEPTH24_STENCIL8,x.width,x.height):s.renderbufferStorage(s.RENDERBUFFER,s.DEPTH_STENCIL,x.width,x.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.RENDERBUFFER,E)}else{const nt=x.isWebGLMultipleRenderTargets===!0?x.texture:[x.texture];for(let tt=0;tt<nt.length;tt++){const K=nt[tt],yt=r.convert(K.format,K.colorSpace),ut=r.convert(K.type),vt=y(K.internalFormat,yt,ut,K.colorSpace),bt=rt(x);N&&X(x)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,bt,vt,x.width,x.height):X(x)?l.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,bt,vt,x.width,x.height):s.renderbufferStorage(s.RENDERBUFFER,vt,x.width,x.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function Ft(E,x){if(x&&x.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(s.FRAMEBUFFER,E),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!n.get(x.depthTexture).__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),k(x.depthTexture,0);const nt=n.get(x.depthTexture).__webglTexture,tt=rt(x);if(x.depthTexture.format===Xn)X(x)?l.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,nt,0,tt):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,nt,0);else if(x.depthTexture.format===Ai)X(x)?l.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,nt,0,tt):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,nt,0);else throw new Error("Unknown depthTexture format")}function St(E){const x=n.get(E),N=E.isWebGLCubeRenderTarget===!0;if(E.depthTexture&&!x.__autoAllocateDepthBuffer){if(N)throw new Error("target.depthTexture not supported in Cube render targets");Ft(x.__webglFramebuffer,E)}else if(N){x.__webglDepthbuffer=[];for(let nt=0;nt<6;nt++)e.bindFramebuffer(s.FRAMEBUFFER,x.__webglFramebuffer[nt]),x.__webglDepthbuffer[nt]=s.createRenderbuffer(),Lt(x.__webglDepthbuffer[nt],E,!1)}else e.bindFramebuffer(s.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer=s.createRenderbuffer(),Lt(x.__webglDepthbuffer,E,!1);e.bindFramebuffer(s.FRAMEBUFFER,null)}function Ut(E,x,N){const nt=n.get(E);x!==void 0&&_t(nt.__webglFramebuffer,E,E.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),N!==void 0&&St(E)}function P(E){const x=E.texture,N=n.get(E),nt=n.get(x);E.addEventListener("dispose",O),E.isWebGLMultipleRenderTargets!==!0&&(nt.__webglTexture===void 0&&(nt.__webglTexture=s.createTexture()),nt.__version=x.version,a.memory.textures++);const tt=E.isWebGLCubeRenderTarget===!0,K=E.isWebGLMultipleRenderTargets===!0,yt=p(E)||o;if(tt){N.__webglFramebuffer=[];for(let ut=0;ut<6;ut++)if(o&&x.mipmaps&&x.mipmaps.length>0){N.__webglFramebuffer[ut]=[];for(let vt=0;vt<x.mipmaps.length;vt++)N.__webglFramebuffer[ut][vt]=s.createFramebuffer()}else N.__webglFramebuffer[ut]=s.createFramebuffer()}else{if(o&&x.mipmaps&&x.mipmaps.length>0){N.__webglFramebuffer=[];for(let ut=0;ut<x.mipmaps.length;ut++)N.__webglFramebuffer[ut]=s.createFramebuffer()}else N.__webglFramebuffer=s.createFramebuffer();if(K)if(i.drawBuffers){const ut=E.texture;for(let vt=0,bt=ut.length;vt<bt;vt++){const Bt=n.get(ut[vt]);Bt.__webglTexture===void 0&&(Bt.__webglTexture=s.createTexture(),a.memory.textures++)}}else console.warn("THREE.WebGLRenderer: WebGLMultipleRenderTargets can only be used with WebGL2 or WEBGL_draw_buffers extension.");if(o&&E.samples>0&&X(E)===!1){const ut=K?x:[x];N.__webglMultisampledFramebuffer=s.createFramebuffer(),N.__webglColorRenderbuffer=[],e.bindFramebuffer(s.FRAMEBUFFER,N.__webglMultisampledFramebuffer);for(let vt=0;vt<ut.length;vt++){const bt=ut[vt];N.__webglColorRenderbuffer[vt]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,N.__webglColorRenderbuffer[vt]);const Bt=r.convert(bt.format,bt.colorSpace),et=r.convert(bt.type),Yt=y(bt.internalFormat,Bt,et,bt.colorSpace,E.isXRRenderTarget===!0),qt=rt(E);s.renderbufferStorageMultisample(s.RENDERBUFFER,qt,Yt,E.width,E.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+vt,s.RENDERBUFFER,N.__webglColorRenderbuffer[vt])}s.bindRenderbuffer(s.RENDERBUFFER,null),E.depthBuffer&&(N.__webglDepthRenderbuffer=s.createRenderbuffer(),Lt(N.__webglDepthRenderbuffer,E,!0)),e.bindFramebuffer(s.FRAMEBUFFER,null)}}if(tt){e.bindTexture(s.TEXTURE_CUBE_MAP,nt.__webglTexture),W(s.TEXTURE_CUBE_MAP,x,yt);for(let ut=0;ut<6;ut++)if(o&&x.mipmaps&&x.mipmaps.length>0)for(let vt=0;vt<x.mipmaps.length;vt++)_t(N.__webglFramebuffer[ut][vt],E,x,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ut,vt);else _t(N.__webglFramebuffer[ut],E,x,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ut,0);S(x,yt)&&v(s.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(K){const ut=E.texture;for(let vt=0,bt=ut.length;vt<bt;vt++){const Bt=ut[vt],et=n.get(Bt);e.bindTexture(s.TEXTURE_2D,et.__webglTexture),W(s.TEXTURE_2D,Bt,yt),_t(N.__webglFramebuffer,E,Bt,s.COLOR_ATTACHMENT0+vt,s.TEXTURE_2D,0),S(Bt,yt)&&v(s.TEXTURE_2D)}e.unbindTexture()}else{let ut=s.TEXTURE_2D;if((E.isWebGL3DRenderTarget||E.isWebGLArrayRenderTarget)&&(o?ut=E.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY:console.error("THREE.WebGLTextures: THREE.Data3DTexture and THREE.DataArrayTexture only supported with WebGL2.")),e.bindTexture(ut,nt.__webglTexture),W(ut,x,yt),o&&x.mipmaps&&x.mipmaps.length>0)for(let vt=0;vt<x.mipmaps.length;vt++)_t(N.__webglFramebuffer[vt],E,x,s.COLOR_ATTACHMENT0,ut,vt);else _t(N.__webglFramebuffer,E,x,s.COLOR_ATTACHMENT0,ut,0);S(x,yt)&&v(ut),e.unbindTexture()}E.depthBuffer&&St(E)}function lt(E){const x=p(E)||o,N=E.isWebGLMultipleRenderTargets===!0?E.texture:[E.texture];for(let nt=0,tt=N.length;nt<tt;nt++){const K=N[nt];if(S(K,x)){const yt=E.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:s.TEXTURE_2D,ut=n.get(K).__webglTexture;e.bindTexture(yt,ut),v(yt),e.unbindTexture()}}}function q(E){if(o&&E.samples>0&&X(E)===!1){const x=E.isWebGLMultipleRenderTargets?E.texture:[E.texture],N=E.width,nt=E.height;let tt=s.COLOR_BUFFER_BIT;const K=[],yt=E.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ut=n.get(E),vt=E.isWebGLMultipleRenderTargets===!0;if(vt)for(let bt=0;bt<x.length;bt++)e.bindFramebuffer(s.FRAMEBUFFER,ut.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+bt,s.RENDERBUFFER,null),e.bindFramebuffer(s.FRAMEBUFFER,ut.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+bt,s.TEXTURE_2D,null,0);e.bindFramebuffer(s.READ_FRAMEBUFFER,ut.__webglMultisampledFramebuffer),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,ut.__webglFramebuffer);for(let bt=0;bt<x.length;bt++){K.push(s.COLOR_ATTACHMENT0+bt),E.depthBuffer&&K.push(yt);const Bt=ut.__ignoreDepthValues!==void 0?ut.__ignoreDepthValues:!1;if(Bt===!1&&(E.depthBuffer&&(tt|=s.DEPTH_BUFFER_BIT),E.stencilBuffer&&(tt|=s.STENCIL_BUFFER_BIT)),vt&&s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,ut.__webglColorRenderbuffer[bt]),Bt===!0&&(s.invalidateFramebuffer(s.READ_FRAMEBUFFER,[yt]),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[yt])),vt){const et=n.get(x[bt]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,et,0)}s.blitFramebuffer(0,0,N,nt,0,0,N,nt,tt,s.NEAREST),c&&s.invalidateFramebuffer(s.READ_FRAMEBUFFER,K)}if(e.bindFramebuffer(s.READ_FRAMEBUFFER,null),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),vt)for(let bt=0;bt<x.length;bt++){e.bindFramebuffer(s.FRAMEBUFFER,ut.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+bt,s.RENDERBUFFER,ut.__webglColorRenderbuffer[bt]);const Bt=n.get(x[bt]).__webglTexture;e.bindFramebuffer(s.FRAMEBUFFER,ut.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+bt,s.TEXTURE_2D,Bt,0)}e.bindFramebuffer(s.DRAW_FRAMEBUFFER,ut.__webglMultisampledFramebuffer)}}function rt(E){return Math.min(i.maxSamples,E.samples)}function X(E){const x=n.get(E);return o&&E.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function wt(E){const x=a.render.frame;h.get(E)!==x&&(h.set(E,x),E.update())}function mt(E,x){const N=E.colorSpace,nt=E.format,tt=E.type;return E.isCompressedTexture===!0||E.isVideoTexture===!0||E.format===Vr||N!==vn&&N!==je&&(Zt.getTransfer(N)===ee?o===!1?t.has("EXT_sRGB")===!0&&nt===en?(E.format=Vr,E.minFilter=qe,E.generateMipmaps=!1):x=_l.sRGBToLinear(x):(nt!==en||tt!==Pn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",N)),x}this.allocateTextureUnit=D,this.resetTextureUnits=J,this.setTexture2D=k,this.setTexture2DArray=Y,this.setTexture3D=$,this.setTextureCube=j,this.rebindTextures=Ut,this.setupRenderTarget=P,this.updateRenderTargetMipmap=lt,this.updateMultisampleRenderTarget=q,this.setupDepthRenderbuffer=St,this.setupFrameBufferTexture=_t,this.useMultisampledRTT=X}function nm(s,t,e){const n=e.isWebGL2;function i(r,a=je){let o;const l=Zt.getTransfer(a);if(r===Pn)return s.UNSIGNED_BYTE;if(r===ol)return s.UNSIGNED_SHORT_4_4_4_4;if(r===ll)return s.UNSIGNED_SHORT_5_5_5_1;if(r===Oc)return s.BYTE;if(r===Bc)return s.SHORT;if(r===Qr)return s.UNSIGNED_SHORT;if(r===al)return s.INT;if(r===An)return s.UNSIGNED_INT;if(r===bn)return s.FLOAT;if(r===$i)return n?s.HALF_FLOAT:(o=t.get("OES_texture_half_float"),o!==null?o.HALF_FLOAT_OES:null);if(r===zc)return s.ALPHA;if(r===en)return s.RGBA;if(r===Hc)return s.LUMINANCE;if(r===Gc)return s.LUMINANCE_ALPHA;if(r===Xn)return s.DEPTH_COMPONENT;if(r===Ai)return s.DEPTH_STENCIL;if(r===Vr)return o=t.get("EXT_sRGB"),o!==null?o.SRGB_ALPHA_EXT:null;if(r===kc)return s.RED;if(r===cl)return s.RED_INTEGER;if(r===Vc)return s.RG;if(r===hl)return s.RG_INTEGER;if(r===ul)return s.RGBA_INTEGER;if(r===tr||r===er||r===nr||r===ir)if(l===ee)if(o=t.get("WEBGL_compressed_texture_s3tc_srgb"),o!==null){if(r===tr)return o.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(r===er)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(r===nr)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(r===ir)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(o=t.get("WEBGL_compressed_texture_s3tc"),o!==null){if(r===tr)return o.COMPRESSED_RGB_S3TC_DXT1_EXT;if(r===er)return o.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(r===nr)return o.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(r===ir)return o.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(r===Ta||r===Aa||r===ba||r===Ca)if(o=t.get("WEBGL_compressed_texture_pvrtc"),o!==null){if(r===Ta)return o.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(r===Aa)return o.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(r===ba)return o.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(r===Ca)return o.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(r===dl)return o=t.get("WEBGL_compressed_texture_etc1"),o!==null?o.COMPRESSED_RGB_ETC1_WEBGL:null;if(r===Ra||r===Pa)if(o=t.get("WEBGL_compressed_texture_etc"),o!==null){if(r===Ra)return l===ee?o.COMPRESSED_SRGB8_ETC2:o.COMPRESSED_RGB8_ETC2;if(r===Pa)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:o.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(r===La||r===Da||r===Ia||r===Ua||r===Na||r===Fa||r===Oa||r===Ba||r===za||r===Ha||r===Ga||r===ka||r===Va||r===Wa)if(o=t.get("WEBGL_compressed_texture_astc"),o!==null){if(r===La)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:o.COMPRESSED_RGBA_ASTC_4x4_KHR;if(r===Da)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:o.COMPRESSED_RGBA_ASTC_5x4_KHR;if(r===Ia)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:o.COMPRESSED_RGBA_ASTC_5x5_KHR;if(r===Ua)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:o.COMPRESSED_RGBA_ASTC_6x5_KHR;if(r===Na)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:o.COMPRESSED_RGBA_ASTC_6x6_KHR;if(r===Fa)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:o.COMPRESSED_RGBA_ASTC_8x5_KHR;if(r===Oa)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:o.COMPRESSED_RGBA_ASTC_8x6_KHR;if(r===Ba)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:o.COMPRESSED_RGBA_ASTC_8x8_KHR;if(r===za)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:o.COMPRESSED_RGBA_ASTC_10x5_KHR;if(r===Ha)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:o.COMPRESSED_RGBA_ASTC_10x6_KHR;if(r===Ga)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:o.COMPRESSED_RGBA_ASTC_10x8_KHR;if(r===ka)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:o.COMPRESSED_RGBA_ASTC_10x10_KHR;if(r===Va)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:o.COMPRESSED_RGBA_ASTC_12x10_KHR;if(r===Wa)return l===ee?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:o.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(r===sr||r===Xa||r===qa)if(o=t.get("EXT_texture_compression_bptc"),o!==null){if(r===sr)return l===ee?o.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:o.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(r===Xa)return o.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(r===qa)return o.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(r===Wc||r===Ya||r===$a||r===ja)if(o=t.get("EXT_texture_compression_rgtc"),o!==null){if(r===sr)return o.COMPRESSED_RED_RGTC1_EXT;if(r===Ya)return o.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(r===$a)return o.COMPRESSED_RED_GREEN_RGTC2_EXT;if(r===ja)return o.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return r===Wn?n?s.UNSIGNED_INT_24_8:(o=t.get("WEBGL_depth_texture"),o!==null?o.UNSIGNED_INT_24_8_WEBGL:null):s[r]!==void 0?s[r]:null}return{convert:i}}class im extends $e{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class he extends oe{constructor(){super(),this.isGroup=!0,this.type="Group"}}const sm={type:"move"};class Rr{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new he,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new he,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new R,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new R),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new he,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new R,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new R),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let i=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){a=!0;for(const _ of t.hand.values()){const p=e.getJointPose(_,n),f=this._getHandJoint(c,_);p!==null&&(f.matrix.fromArray(p.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=p.radius),f.visible=p!==null}const h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),m=.02,g=.005;c.inputState.pinching&&d>m+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&d<=m-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(i=e.getPose(t.targetRaySpace,n),i===null&&r!==null&&(i=r),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity)):o.hasLinearVelocity=!1,i.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(sm)))}return o!==null&&(o.visible=i!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new he;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}class rm extends Ci{constructor(t,e){super();const n=this;let i=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,m=null,g=null;const _=e.getContextAttributes();let p=null,f=null;const S=[],v=[],y=new at;let L=null;const b=new $e;b.layers.enable(1),b.viewport=new Se;const C=new $e;C.layers.enable(2),C.viewport=new Se;const O=[b,C],M=new im;M.layers.enable(1),M.layers.enable(2);let w=null,F=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(W){let Q=S[W];return Q===void 0&&(Q=new Rr,S[W]=Q),Q.getTargetRaySpace()},this.getControllerGrip=function(W){let Q=S[W];return Q===void 0&&(Q=new Rr,S[W]=Q),Q.getGripSpace()},this.getHand=function(W){let Q=S[W];return Q===void 0&&(Q=new Rr,S[W]=Q),Q.getHandSpace()};function G(W){const Q=v.indexOf(W.inputSource);if(Q===-1)return;const pt=S[Q];pt!==void 0&&(pt.update(W.inputSource,W.frame,c||a),pt.dispatchEvent({type:W.type,data:W.inputSource}))}function J(){i.removeEventListener("select",G),i.removeEventListener("selectstart",G),i.removeEventListener("selectend",G),i.removeEventListener("squeeze",G),i.removeEventListener("squeezestart",G),i.removeEventListener("squeezeend",G),i.removeEventListener("end",J),i.removeEventListener("inputsourceschange",D);for(let W=0;W<S.length;W++){const Q=v[W];Q!==null&&(v[W]=null,S[W].disconnect(Q))}w=null,F=null,t.setRenderTarget(p),m=null,d=null,u=null,i=null,f=null,ot.stop(),n.isPresenting=!1,t.setPixelRatio(L),t.setSize(y.width,y.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(W){r=W,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(W){o=W,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(W){c=W},this.getBaseLayer=function(){return d!==null?d:m},this.getBinding=function(){return u},this.getFrame=function(){return g},this.getSession=function(){return i},this.setSession=async function(W){if(i=W,i!==null){if(p=t.getRenderTarget(),i.addEventListener("select",G),i.addEventListener("selectstart",G),i.addEventListener("selectend",G),i.addEventListener("squeeze",G),i.addEventListener("squeezestart",G),i.addEventListener("squeezeend",G),i.addEventListener("end",J),i.addEventListener("inputsourceschange",D),_.xrCompatible!==!0&&await e.makeXRCompatible(),L=t.getPixelRatio(),t.getSize(y),i.renderState.layers===void 0||t.capabilities.isWebGL2===!1){const Q={antialias:i.renderState.layers===void 0?_.antialias:!0,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:r};m=new XRWebGLLayer(i,e,Q),i.updateRenderState({baseLayer:m}),t.setPixelRatio(1),t.setSize(m.framebufferWidth,m.framebufferHeight,!1),f=new Yn(m.framebufferWidth,m.framebufferHeight,{format:en,type:Pn,colorSpace:t.outputColorSpace,stencilBuffer:_.stencil})}else{let Q=null,pt=null,Mt=null;_.depth&&(Mt=_.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,Q=_.stencil?Ai:Xn,pt=_.stencil?Wn:An);const _t={colorFormat:e.RGBA8,depthFormat:Mt,scaleFactor:r};u=new XRWebGLBinding(i,e),d=u.createProjectionLayer(_t),i.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),f=new Yn(d.textureWidth,d.textureHeight,{format:en,type:Pn,depthTexture:new Pl(d.textureWidth,d.textureHeight,pt,void 0,void 0,void 0,void 0,void 0,void 0,Q),stencilBuffer:_.stencil,colorSpace:t.outputColorSpace,samples:_.antialias?4:0});const Lt=t.properties.get(f);Lt.__ignoreDepthValues=d.ignoreDepthValues}f.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await i.requestReferenceSpace(o),ot.setContext(i),ot.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode};function D(W){for(let Q=0;Q<W.removed.length;Q++){const pt=W.removed[Q],Mt=v.indexOf(pt);Mt>=0&&(v[Mt]=null,S[Mt].disconnect(pt))}for(let Q=0;Q<W.added.length;Q++){const pt=W.added[Q];let Mt=v.indexOf(pt);if(Mt===-1){for(let Lt=0;Lt<S.length;Lt++)if(Lt>=v.length){v.push(pt),Mt=Lt;break}else if(v[Lt]===null){v[Lt]=pt,Mt=Lt;break}if(Mt===-1)break}const _t=S[Mt];_t&&_t.connect(pt)}}const B=new R,k=new R;function Y(W,Q,pt){B.setFromMatrixPosition(Q.matrixWorld),k.setFromMatrixPosition(pt.matrixWorld);const Mt=B.distanceTo(k),_t=Q.projectionMatrix.elements,Lt=pt.projectionMatrix.elements,Ft=_t[14]/(_t[10]-1),St=_t[14]/(_t[10]+1),Ut=(_t[9]+1)/_t[5],P=(_t[9]-1)/_t[5],lt=(_t[8]-1)/_t[0],q=(Lt[8]+1)/Lt[0],rt=Ft*lt,X=Ft*q,wt=Mt/(-lt+q),mt=wt*-lt;Q.matrixWorld.decompose(W.position,W.quaternion,W.scale),W.translateX(mt),W.translateZ(wt),W.matrixWorld.compose(W.position,W.quaternion,W.scale),W.matrixWorldInverse.copy(W.matrixWorld).invert();const E=Ft+wt,x=St+wt,N=rt-mt,nt=X+(Mt-mt),tt=Ut*St/x*E,K=P*St/x*E;W.projectionMatrix.makePerspective(N,nt,tt,K,E,x),W.projectionMatrixInverse.copy(W.projectionMatrix).invert()}function $(W,Q){Q===null?W.matrixWorld.copy(W.matrix):W.matrixWorld.multiplyMatrices(Q.matrixWorld,W.matrix),W.matrixWorldInverse.copy(W.matrixWorld).invert()}this.updateCamera=function(W){if(i===null)return;M.near=C.near=b.near=W.near,M.far=C.far=b.far=W.far,(w!==M.near||F!==M.far)&&(i.updateRenderState({depthNear:M.near,depthFar:M.far}),w=M.near,F=M.far);const Q=W.parent,pt=M.cameras;$(M,Q);for(let Mt=0;Mt<pt.length;Mt++)$(pt[Mt],Q);pt.length===2?Y(M,b,C):M.projectionMatrix.copy(b.projectionMatrix),j(W,M,Q)};function j(W,Q,pt){pt===null?W.matrix.copy(Q.matrixWorld):(W.matrix.copy(pt.matrixWorld),W.matrix.invert(),W.matrix.multiply(Q.matrixWorld)),W.matrix.decompose(W.position,W.quaternion,W.scale),W.updateMatrixWorld(!0),W.projectionMatrix.copy(Q.projectionMatrix),W.projectionMatrixInverse.copy(Q.projectionMatrixInverse),W.isPerspectiveCamera&&(W.fov=Wr*2*Math.atan(1/W.projectionMatrix.elements[5]),W.zoom=1)}this.getCamera=function(){return M},this.getFoveation=function(){if(!(d===null&&m===null))return l},this.setFoveation=function(W){l=W,d!==null&&(d.fixedFoveation=W),m!==null&&m.fixedFoveation!==void 0&&(m.fixedFoveation=W)};let Z=null;function it(W,Q){if(h=Q.getViewerPose(c||a),g=Q,h!==null){const pt=h.views;m!==null&&(t.setRenderTargetFramebuffer(f,m.framebuffer),t.setRenderTarget(f));let Mt=!1;pt.length!==M.cameras.length&&(M.cameras.length=0,Mt=!0);for(let _t=0;_t<pt.length;_t++){const Lt=pt[_t];let Ft=null;if(m!==null)Ft=m.getViewport(Lt);else{const Ut=u.getViewSubImage(d,Lt);Ft=Ut.viewport,_t===0&&(t.setRenderTargetTextures(f,Ut.colorTexture,d.ignoreDepthValues?void 0:Ut.depthStencilTexture),t.setRenderTarget(f))}let St=O[_t];St===void 0&&(St=new $e,St.layers.enable(_t),St.viewport=new Se,O[_t]=St),St.matrix.fromArray(Lt.transform.matrix),St.matrix.decompose(St.position,St.quaternion,St.scale),St.projectionMatrix.fromArray(Lt.projectionMatrix),St.projectionMatrixInverse.copy(St.projectionMatrix).invert(),St.viewport.set(Ft.x,Ft.y,Ft.width,Ft.height),_t===0&&(M.matrix.copy(St.matrix),M.matrix.decompose(M.position,M.quaternion,M.scale)),Mt===!0&&M.cameras.push(St)}}for(let pt=0;pt<S.length;pt++){const Mt=v[pt],_t=S[pt];Mt!==null&&_t!==void 0&&_t.update(Mt,Q,c||a)}Z&&Z(W,Q),Q.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:Q}),g=null}const ot=new Cl;ot.setAnimationLoop(it),this.setAnimationLoop=function(W){Z=W},this.dispose=function(){}}}function am(s,t){function e(p,f){p.matrixAutoUpdate===!0&&p.updateMatrix(),f.value.copy(p.matrix)}function n(p,f){f.color.getRGB(p.fogColor.value,Tl(s)),f.isFog?(p.fogNear.value=f.near,p.fogFar.value=f.far):f.isFogExp2&&(p.fogDensity.value=f.density)}function i(p,f,S,v,y){f.isMeshBasicMaterial||f.isMeshLambertMaterial?r(p,f):f.isMeshToonMaterial?(r(p,f),u(p,f)):f.isMeshPhongMaterial?(r(p,f),h(p,f)):f.isMeshStandardMaterial?(r(p,f),d(p,f),f.isMeshPhysicalMaterial&&m(p,f,y)):f.isMeshMatcapMaterial?(r(p,f),g(p,f)):f.isMeshDepthMaterial?r(p,f):f.isMeshDistanceMaterial?(r(p,f),_(p,f)):f.isMeshNormalMaterial?r(p,f):f.isLineBasicMaterial?(a(p,f),f.isLineDashedMaterial&&o(p,f)):f.isPointsMaterial?l(p,f,S,v):f.isSpriteMaterial?c(p,f):f.isShadowMaterial?(p.color.value.copy(f.color),p.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function r(p,f){p.opacity.value=f.opacity,f.color&&p.diffuse.value.copy(f.color),f.emissive&&p.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(p.map.value=f.map,e(f.map,p.mapTransform)),f.alphaMap&&(p.alphaMap.value=f.alphaMap,e(f.alphaMap,p.alphaMapTransform)),f.bumpMap&&(p.bumpMap.value=f.bumpMap,e(f.bumpMap,p.bumpMapTransform),p.bumpScale.value=f.bumpScale,f.side===ze&&(p.bumpScale.value*=-1)),f.normalMap&&(p.normalMap.value=f.normalMap,e(f.normalMap,p.normalMapTransform),p.normalScale.value.copy(f.normalScale),f.side===ze&&p.normalScale.value.negate()),f.displacementMap&&(p.displacementMap.value=f.displacementMap,e(f.displacementMap,p.displacementMapTransform),p.displacementScale.value=f.displacementScale,p.displacementBias.value=f.displacementBias),f.emissiveMap&&(p.emissiveMap.value=f.emissiveMap,e(f.emissiveMap,p.emissiveMapTransform)),f.specularMap&&(p.specularMap.value=f.specularMap,e(f.specularMap,p.specularMapTransform)),f.alphaTest>0&&(p.alphaTest.value=f.alphaTest);const S=t.get(f).envMap;if(S&&(p.envMap.value=S,p.flipEnvMap.value=S.isCubeTexture&&S.isRenderTargetTexture===!1?-1:1,p.reflectivity.value=f.reflectivity,p.ior.value=f.ior,p.refractionRatio.value=f.refractionRatio),f.lightMap){p.lightMap.value=f.lightMap;const v=s._useLegacyLights===!0?Math.PI:1;p.lightMapIntensity.value=f.lightMapIntensity*v,e(f.lightMap,p.lightMapTransform)}f.aoMap&&(p.aoMap.value=f.aoMap,p.aoMapIntensity.value=f.aoMapIntensity,e(f.aoMap,p.aoMapTransform))}function a(p,f){p.diffuse.value.copy(f.color),p.opacity.value=f.opacity,f.map&&(p.map.value=f.map,e(f.map,p.mapTransform))}function o(p,f){p.dashSize.value=f.dashSize,p.totalSize.value=f.dashSize+f.gapSize,p.scale.value=f.scale}function l(p,f,S,v){p.diffuse.value.copy(f.color),p.opacity.value=f.opacity,p.size.value=f.size*S,p.scale.value=v*.5,f.map&&(p.map.value=f.map,e(f.map,p.uvTransform)),f.alphaMap&&(p.alphaMap.value=f.alphaMap,e(f.alphaMap,p.alphaMapTransform)),f.alphaTest>0&&(p.alphaTest.value=f.alphaTest)}function c(p,f){p.diffuse.value.copy(f.color),p.opacity.value=f.opacity,p.rotation.value=f.rotation,f.map&&(p.map.value=f.map,e(f.map,p.mapTransform)),f.alphaMap&&(p.alphaMap.value=f.alphaMap,e(f.alphaMap,p.alphaMapTransform)),f.alphaTest>0&&(p.alphaTest.value=f.alphaTest)}function h(p,f){p.specular.value.copy(f.specular),p.shininess.value=Math.max(f.shininess,1e-4)}function u(p,f){f.gradientMap&&(p.gradientMap.value=f.gradientMap)}function d(p,f){p.metalness.value=f.metalness,f.metalnessMap&&(p.metalnessMap.value=f.metalnessMap,e(f.metalnessMap,p.metalnessMapTransform)),p.roughness.value=f.roughness,f.roughnessMap&&(p.roughnessMap.value=f.roughnessMap,e(f.roughnessMap,p.roughnessMapTransform)),t.get(f).envMap&&(p.envMapIntensity.value=f.envMapIntensity)}function m(p,f,S){p.ior.value=f.ior,f.sheen>0&&(p.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),p.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(p.sheenColorMap.value=f.sheenColorMap,e(f.sheenColorMap,p.sheenColorMapTransform)),f.sheenRoughnessMap&&(p.sheenRoughnessMap.value=f.sheenRoughnessMap,e(f.sheenRoughnessMap,p.sheenRoughnessMapTransform))),f.clearcoat>0&&(p.clearcoat.value=f.clearcoat,p.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(p.clearcoatMap.value=f.clearcoatMap,e(f.clearcoatMap,p.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,e(f.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(p.clearcoatNormalMap.value=f.clearcoatNormalMap,e(f.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===ze&&p.clearcoatNormalScale.value.negate())),f.iridescence>0&&(p.iridescence.value=f.iridescence,p.iridescenceIOR.value=f.iridescenceIOR,p.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(p.iridescenceMap.value=f.iridescenceMap,e(f.iridescenceMap,p.iridescenceMapTransform)),f.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=f.iridescenceThicknessMap,e(f.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),f.transmission>0&&(p.transmission.value=f.transmission,p.transmissionSamplerMap.value=S.texture,p.transmissionSamplerSize.value.set(S.width,S.height),f.transmissionMap&&(p.transmissionMap.value=f.transmissionMap,e(f.transmissionMap,p.transmissionMapTransform)),p.thickness.value=f.thickness,f.thicknessMap&&(p.thicknessMap.value=f.thicknessMap,e(f.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=f.attenuationDistance,p.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(p.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(p.anisotropyMap.value=f.anisotropyMap,e(f.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=f.specularIntensity,p.specularColor.value.copy(f.specularColor),f.specularColorMap&&(p.specularColorMap.value=f.specularColorMap,e(f.specularColorMap,p.specularColorMapTransform)),f.specularIntensityMap&&(p.specularIntensityMap.value=f.specularIntensityMap,e(f.specularIntensityMap,p.specularIntensityMapTransform))}function g(p,f){f.matcap&&(p.matcap.value=f.matcap)}function _(p,f){const S=t.get(f).light;p.referencePosition.value.setFromMatrixPosition(S.matrixWorld),p.nearDistance.value=S.shadow.camera.near,p.farDistance.value=S.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function om(s,t,e,n){let i={},r={},a=[];const o=e.isWebGL2?s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS):0;function l(S,v){const y=v.program;n.uniformBlockBinding(S,y)}function c(S,v){let y=i[S.id];y===void 0&&(g(S),y=h(S),i[S.id]=y,S.addEventListener("dispose",p));const L=v.program;n.updateUBOMapping(S,L);const b=t.render.frame;r[S.id]!==b&&(d(S),r[S.id]=b)}function h(S){const v=u();S.__bindingPointIndex=v;const y=s.createBuffer(),L=S.__size,b=S.usage;return s.bindBuffer(s.UNIFORM_BUFFER,y),s.bufferData(s.UNIFORM_BUFFER,L,b),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,v,y),y}function u(){for(let S=0;S<o;S++)if(a.indexOf(S)===-1)return a.push(S),S;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(S){const v=i[S.id],y=S.uniforms,L=S.__cache;s.bindBuffer(s.UNIFORM_BUFFER,v);for(let b=0,C=y.length;b<C;b++){const O=Array.isArray(y[b])?y[b]:[y[b]];for(let M=0,w=O.length;M<w;M++){const F=O[M];if(m(F,b,M,L)===!0){const G=F.__offset,J=Array.isArray(F.value)?F.value:[F.value];let D=0;for(let B=0;B<J.length;B++){const k=J[B],Y=_(k);typeof k=="number"||typeof k=="boolean"?(F.__data[0]=k,s.bufferSubData(s.UNIFORM_BUFFER,G+D,F.__data)):k.isMatrix3?(F.__data[0]=k.elements[0],F.__data[1]=k.elements[1],F.__data[2]=k.elements[2],F.__data[3]=0,F.__data[4]=k.elements[3],F.__data[5]=k.elements[4],F.__data[6]=k.elements[5],F.__data[7]=0,F.__data[8]=k.elements[6],F.__data[9]=k.elements[7],F.__data[10]=k.elements[8],F.__data[11]=0):(k.toArray(F.__data,D),D+=Y.storage/Float32Array.BYTES_PER_ELEMENT)}s.bufferSubData(s.UNIFORM_BUFFER,G,F.__data)}}}s.bindBuffer(s.UNIFORM_BUFFER,null)}function m(S,v,y,L){const b=S.value,C=v+"_"+y;if(L[C]===void 0)return typeof b=="number"||typeof b=="boolean"?L[C]=b:L[C]=b.clone(),!0;{const O=L[C];if(typeof b=="number"||typeof b=="boolean"){if(O!==b)return L[C]=b,!0}else if(O.equals(b)===!1)return O.copy(b),!0}return!1}function g(S){const v=S.uniforms;let y=0;const L=16;for(let C=0,O=v.length;C<O;C++){const M=Array.isArray(v[C])?v[C]:[v[C]];for(let w=0,F=M.length;w<F;w++){const G=M[w],J=Array.isArray(G.value)?G.value:[G.value];for(let D=0,B=J.length;D<B;D++){const k=J[D],Y=_(k),$=y%L;$!==0&&L-$<Y.boundary&&(y+=L-$),G.__data=new Float32Array(Y.storage/Float32Array.BYTES_PER_ELEMENT),G.__offset=y,y+=Y.storage}}}const b=y%L;return b>0&&(y+=L-b),S.__size=y,S.__cache={},this}function _(S){const v={boundary:0,storage:0};return typeof S=="number"||typeof S=="boolean"?(v.boundary=4,v.storage=4):S.isVector2?(v.boundary=8,v.storage=8):S.isVector3||S.isColor?(v.boundary=16,v.storage=12):S.isVector4?(v.boundary=16,v.storage=16):S.isMatrix3?(v.boundary=48,v.storage=48):S.isMatrix4?(v.boundary=64,v.storage=64):S.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",S),v}function p(S){const v=S.target;v.removeEventListener("dispose",p);const y=a.indexOf(v.__bindingPointIndex);a.splice(y,1),s.deleteBuffer(i[v.id]),delete i[v.id],delete r[v.id]}function f(){for(const S in i)s.deleteBuffer(i[S]);a=[],i={},r={}}return{bind:l,update:c,dispose:f}}class Fl{constructor(t={}){const{canvas:e=nh(),context:n=null,depth:i=!0,stencil:r=!0,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1}=t;this.isWebGLRenderer=!0;let d;n!==null?d=n.getContextAttributes().alpha:d=a;const m=new Uint32Array(4),g=new Int32Array(4);let _=null,p=null;const f=[],S=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=Ee,this._useLegacyLights=!1,this.toneMapping=Rn,this.toneMappingExposure=1;const v=this;let y=!1,L=0,b=0,C=null,O=-1,M=null;const w=new Se,F=new Se;let G=null;const J=new Tt(0);let D=0,B=e.width,k=e.height,Y=1,$=null,j=null;const Z=new Se(0,0,B,k),it=new Se(0,0,B,k);let ot=!1;const W=new ea;let Q=!1,pt=!1,Mt=null;const _t=new ne,Lt=new at,Ft=new R,St={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function Ut(){return C===null?Y:1}let P=n;function lt(T,U){for(let H=0;H<T.length;H++){const V=T[H],z=e.getContext(V,U);if(z!==null)return z}return null}try{const T={alpha:!0,depth:i,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${Kr}`),e.addEventListener("webglcontextlost",ct,!1),e.addEventListener("webglcontextrestored",I,!1),e.addEventListener("webglcontextcreationerror",dt,!1),P===null){const U=["webgl2","webgl","experimental-webgl"];if(v.isWebGL1Renderer===!0&&U.shift(),P=lt(U,T),P===null)throw lt(U)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}typeof WebGLRenderingContext<"u"&&P instanceof WebGLRenderingContext&&console.warn("THREE.WebGLRenderer: WebGL 1 support was deprecated in r153 and will be removed in r163."),P.getShaderPrecisionFormat===void 0&&(P.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(T){throw console.error("THREE.WebGLRenderer: "+T.message),T}let q,rt,X,wt,mt,E,x,N,nt,tt,K,yt,ut,vt,bt,Bt,et,Yt,qt,Nt,At,xt,Ht,$t;function le(){q=new _f(P),rt=new uf(P,q,t),q.init(rt),xt=new nm(P,q,rt),X=new tm(P,q,rt),wt=new yf(P),mt=new Hp,E=new em(P,q,X,mt,rt,xt,wt),x=new ff(v),N=new gf(v),nt=new bh(P,rt),Ht=new cf(P,q,nt,rt),tt=new vf(P,nt,wt,Ht),K=new wf(P,tt,nt,wt),qt=new Ef(P,rt,E),Bt=new df(mt),yt=new zp(v,x,N,q,rt,Ht,Bt),ut=new am(v,mt),vt=new kp,bt=new $p(q,rt),Yt=new lf(v,x,N,X,K,d,l),et=new Qp(v,K,rt),$t=new om(P,wt,rt,X),Nt=new hf(P,q,wt,rt),At=new xf(P,q,wt,rt),wt.programs=yt.programs,v.capabilities=rt,v.extensions=q,v.properties=mt,v.renderLists=vt,v.shadowMap=et,v.state=X,v.info=wt}le();const Vt=new rm(v,P);this.xr=Vt,this.getContext=function(){return P},this.getContextAttributes=function(){return P.getContextAttributes()},this.forceContextLoss=function(){const T=q.get("WEBGL_lose_context");T&&T.loseContext()},this.forceContextRestore=function(){const T=q.get("WEBGL_lose_context");T&&T.restoreContext()},this.getPixelRatio=function(){return Y},this.setPixelRatio=function(T){T!==void 0&&(Y=T,this.setSize(B,k,!1))},this.getSize=function(T){return T.set(B,k)},this.setSize=function(T,U,H=!0){if(Vt.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}B=T,k=U,e.width=Math.floor(T*Y),e.height=Math.floor(U*Y),H===!0&&(e.style.width=T+"px",e.style.height=U+"px"),this.setViewport(0,0,T,U)},this.getDrawingBufferSize=function(T){return T.set(B*Y,k*Y).floor()},this.setDrawingBufferSize=function(T,U,H){B=T,k=U,Y=H,e.width=Math.floor(T*H),e.height=Math.floor(U*H),this.setViewport(0,0,T,U)},this.getCurrentViewport=function(T){return T.copy(w)},this.getViewport=function(T){return T.copy(Z)},this.setViewport=function(T,U,H,V){T.isVector4?Z.set(T.x,T.y,T.z,T.w):Z.set(T,U,H,V),X.viewport(w.copy(Z).multiplyScalar(Y).floor())},this.getScissor=function(T){return T.copy(it)},this.setScissor=function(T,U,H,V){T.isVector4?it.set(T.x,T.y,T.z,T.w):it.set(T,U,H,V),X.scissor(F.copy(it).multiplyScalar(Y).floor())},this.getScissorTest=function(){return ot},this.setScissorTest=function(T){X.setScissorTest(ot=T)},this.setOpaqueSort=function(T){$=T},this.setTransparentSort=function(T){j=T},this.getClearColor=function(T){return T.copy(Yt.getClearColor())},this.setClearColor=function(){Yt.setClearColor.apply(Yt,arguments)},this.getClearAlpha=function(){return Yt.getClearAlpha()},this.setClearAlpha=function(){Yt.setClearAlpha.apply(Yt,arguments)},this.clear=function(T=!0,U=!0,H=!0){let V=0;if(T){let z=!1;if(C!==null){const gt=C.texture.format;z=gt===ul||gt===hl||gt===cl}if(z){const gt=C.texture.type,Et=gt===Pn||gt===An||gt===Qr||gt===Wn||gt===ol||gt===ll,Pt=Yt.getClearColor(),It=Yt.getClearAlpha(),kt=Pt.r,Ot=Pt.g,zt=Pt.b;Et?(m[0]=kt,m[1]=Ot,m[2]=zt,m[3]=It,P.clearBufferuiv(P.COLOR,0,m)):(g[0]=kt,g[1]=Ot,g[2]=zt,g[3]=It,P.clearBufferiv(P.COLOR,0,g))}else V|=P.COLOR_BUFFER_BIT}U&&(V|=P.DEPTH_BUFFER_BIT),H&&(V|=P.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),P.clear(V)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",ct,!1),e.removeEventListener("webglcontextrestored",I,!1),e.removeEventListener("webglcontextcreationerror",dt,!1),vt.dispose(),bt.dispose(),mt.dispose(),x.dispose(),N.dispose(),K.dispose(),Ht.dispose(),$t.dispose(),yt.dispose(),Vt.dispose(),Vt.removeEventListener("sessionstart",Le),Vt.removeEventListener("sessionend",te),Mt&&(Mt.dispose(),Mt=null),De.stop()};function ct(T){T.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),y=!0}function I(){console.log("THREE.WebGLRenderer: Context Restored."),y=!1;const T=wt.autoReset,U=et.enabled,H=et.autoUpdate,V=et.needsUpdate,z=et.type;le(),wt.autoReset=T,et.enabled=U,et.autoUpdate=H,et.needsUpdate=V,et.type=z}function dt(T){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",T.statusMessage)}function ft(T){const U=T.target;U.removeEventListener("dispose",ft),Dt(U)}function Dt(T){Ct(T),mt.remove(T)}function Ct(T){const U=mt.get(T).programs;U!==void 0&&(U.forEach(function(H){yt.releaseProgram(H)}),T.isShaderMaterial&&yt.releaseShaderCache(T))}this.renderBufferDirect=function(T,U,H,V,z,gt){U===null&&(U=St);const Et=z.isMesh&&z.matrixWorld.determinant()<0,Pt=Jl(T,U,H,V,z);X.setMaterial(V,Et);let It=H.index,kt=1;if(V.wireframe===!0){if(It=tt.getWireframeAttribute(H),It===void 0)return;kt=2}const Ot=H.drawRange,zt=H.attributes.position;let ue=Ot.start*kt,Ge=(Ot.start+Ot.count)*kt;gt!==null&&(ue=Math.max(ue,gt.start*kt),Ge=Math.min(Ge,(gt.start+gt.count)*kt)),It!==null?(ue=Math.max(ue,0),Ge=Math.min(Ge,It.count)):zt!=null&&(ue=Math.max(ue,0),Ge=Math.min(Ge,zt.count));const ve=Ge-ue;if(ve<0||ve===1/0)return;Ht.setup(z,V,Pt,H,It);let ln,se=Nt;if(It!==null&&(ln=nt.get(It),se=At,se.setIndex(ln)),z.isMesh)V.wireframe===!0?(X.setLineWidth(V.wireframeLinewidth*Ut()),se.setMode(P.LINES)):se.setMode(P.TRIANGLES);else if(z.isLine){let Wt=V.linewidth;Wt===void 0&&(Wt=1),X.setLineWidth(Wt*Ut()),z.isLineSegments?se.setMode(P.LINES):z.isLineLoop?se.setMode(P.LINE_LOOP):se.setMode(P.LINE_STRIP)}else z.isPoints?se.setMode(P.POINTS):z.isSprite&&se.setMode(P.TRIANGLES);if(z.isBatchedMesh)se.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else if(z.isInstancedMesh)se.renderInstances(ue,ve,z.count);else if(H.isInstancedBufferGeometry){const Wt=H._maxInstanceCount!==void 0?H._maxInstanceCount:1/0,js=Math.min(H.instanceCount,Wt);se.renderInstances(ue,ve,js)}else se.render(ue,ve)};function Kt(T,U,H){T.transparent===!0&&T.side===Be&&T.forceSinglePass===!1?(T.side=ze,T.needsUpdate=!0,ns(T,U,H),T.side=Dn,T.needsUpdate=!0,ns(T,U,H),T.side=Be):ns(T,U,H)}this.compile=function(T,U,H=null){H===null&&(H=T),p=bt.get(H),p.init(),S.push(p),H.traverseVisible(function(z){z.isLight&&z.layers.test(U.layers)&&(p.pushLight(z),z.castShadow&&p.pushShadow(z))}),T!==H&&T.traverseVisible(function(z){z.isLight&&z.layers.test(U.layers)&&(p.pushLight(z),z.castShadow&&p.pushShadow(z))}),p.setupLights(v._useLegacyLights);const V=new Set;return T.traverse(function(z){const gt=z.material;if(gt)if(Array.isArray(gt))for(let Et=0;Et<gt.length;Et++){const Pt=gt[Et];Kt(Pt,H,z),V.add(Pt)}else Kt(gt,H,z),V.add(gt)}),S.pop(),p=null,V},this.compileAsync=function(T,U,H=null){const V=this.compile(T,U,H);return new Promise(z=>{function gt(){if(V.forEach(function(Et){mt.get(Et).currentProgram.isReady()&&V.delete(Et)}),V.size===0){z(T);return}setTimeout(gt,10)}q.get("KHR_parallel_shader_compile")!==null?gt():setTimeout(gt,10)})};let Qt=null;function _e(T){Qt&&Qt(T)}function Le(){De.stop()}function te(){De.start()}const De=new Cl;De.setAnimationLoop(_e),typeof self<"u"&&De.setContext(self),this.setAnimationLoop=function(T){Qt=T,Vt.setAnimationLoop(T),T===null?De.stop():De.start()},Vt.addEventListener("sessionstart",Le),Vt.addEventListener("sessionend",te),this.render=function(T,U){if(U!==void 0&&U.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(y===!0)return;T.matrixWorldAutoUpdate===!0&&T.updateMatrixWorld(),U.parent===null&&U.matrixWorldAutoUpdate===!0&&U.updateMatrixWorld(),Vt.enabled===!0&&Vt.isPresenting===!0&&(Vt.cameraAutoUpdate===!0&&Vt.updateCamera(U),U=Vt.getCamera()),T.isScene===!0&&T.onBeforeRender(v,T,U,C),p=bt.get(T,S.length),p.init(),S.push(p),_t.multiplyMatrices(U.projectionMatrix,U.matrixWorldInverse),W.setFromProjectionMatrix(_t),pt=this.localClippingEnabled,Q=Bt.init(this.clippingPlanes,pt),_=vt.get(T,f.length),_.init(),f.push(_),nn(T,U,0,v.sortObjects),_.finish(),v.sortObjects===!0&&_.sort($,j),this.info.render.frame++,Q===!0&&Bt.beginShadows();const H=p.state.shadowsArray;if(et.render(H,T,U),Q===!0&&Bt.endShadows(),this.info.autoReset===!0&&this.info.reset(),Yt.render(_,T),p.setupLights(v._useLegacyLights),U.isArrayCamera){const V=U.cameras;for(let z=0,gt=V.length;z<gt;z++){const Et=V[z];fa(_,T,Et,Et.viewport)}}else fa(_,T,U);C!==null&&(E.updateMultisampleRenderTarget(C),E.updateRenderTargetMipmap(C)),T.isScene===!0&&T.onAfterRender(v,T,U),Ht.resetDefaultState(),O=-1,M=null,S.pop(),S.length>0?p=S[S.length-1]:p=null,f.pop(),f.length>0?_=f[f.length-1]:_=null};function nn(T,U,H,V){if(T.visible===!1)return;if(T.layers.test(U.layers)){if(T.isGroup)H=T.renderOrder;else if(T.isLOD)T.autoUpdate===!0&&T.update(U);else if(T.isLight)p.pushLight(T),T.castShadow&&p.pushShadow(T);else if(T.isSprite){if(!T.frustumCulled||W.intersectsSprite(T)){V&&Ft.setFromMatrixPosition(T.matrixWorld).applyMatrix4(_t);const Et=K.update(T),Pt=T.material;Pt.visible&&_.push(T,Et,Pt,H,Ft.z,null)}}else if((T.isMesh||T.isLine||T.isPoints)&&(!T.frustumCulled||W.intersectsObject(T))){const Et=K.update(T),Pt=T.material;if(V&&(T.boundingSphere!==void 0?(T.boundingSphere===null&&T.computeBoundingSphere(),Ft.copy(T.boundingSphere.center)):(Et.boundingSphere===null&&Et.computeBoundingSphere(),Ft.copy(Et.boundingSphere.center)),Ft.applyMatrix4(T.matrixWorld).applyMatrix4(_t)),Array.isArray(Pt)){const It=Et.groups;for(let kt=0,Ot=It.length;kt<Ot;kt++){const zt=It[kt],ue=Pt[zt.materialIndex];ue&&ue.visible&&_.push(T,Et,ue,H,Ft.z,zt)}}else Pt.visible&&_.push(T,Et,Pt,H,Ft.z,null)}}const gt=T.children;for(let Et=0,Pt=gt.length;Et<Pt;Et++)nn(gt[Et],U,H,V)}function fa(T,U,H,V){const z=T.opaque,gt=T.transmissive,Et=T.transparent;p.setupLightsView(H),Q===!0&&Bt.setGlobalState(v.clippingPlanes,H),gt.length>0&&Zl(z,gt,U,H),V&&X.viewport(w.copy(V)),z.length>0&&es(z,U,H),gt.length>0&&es(gt,U,H),Et.length>0&&es(Et,U,H),X.buffers.depth.setTest(!0),X.buffers.depth.setMask(!0),X.buffers.color.setMask(!0),X.setPolygonOffset(!1)}function Zl(T,U,H,V){if((H.isScene===!0?H.overrideMaterial:null)!==null)return;const gt=rt.isWebGL2;Mt===null&&(Mt=new Yn(1,1,{generateMipmaps:!0,type:q.has("EXT_color_buffer_half_float")?$i:Pn,minFilter:Yi,samples:gt?4:0})),v.getDrawingBufferSize(Lt),gt?Mt.setSize(Lt.x,Lt.y):Mt.setSize(Xr(Lt.x),Xr(Lt.y));const Et=v.getRenderTarget();v.setRenderTarget(Mt),v.getClearColor(J),D=v.getClearAlpha(),D<1&&v.setClearColor(16777215,.5),v.clear();const Pt=v.toneMapping;v.toneMapping=Rn,es(T,H,V),E.updateMultisampleRenderTarget(Mt),E.updateRenderTargetMipmap(Mt);let It=!1;for(let kt=0,Ot=U.length;kt<Ot;kt++){const zt=U[kt],ue=zt.object,Ge=zt.geometry,ve=zt.material,ln=zt.group;if(ve.side===Be&&ue.layers.test(V.layers)){const se=ve.side;ve.side=ze,ve.needsUpdate=!0,pa(ue,H,V,Ge,ve,ln),ve.side=se,ve.needsUpdate=!0,It=!0}}It===!0&&(E.updateMultisampleRenderTarget(Mt),E.updateRenderTargetMipmap(Mt)),v.setRenderTarget(Et),v.setClearColor(J,D),v.toneMapping=Pt}function es(T,U,H){const V=U.isScene===!0?U.overrideMaterial:null;for(let z=0,gt=T.length;z<gt;z++){const Et=T[z],Pt=Et.object,It=Et.geometry,kt=V===null?Et.material:V,Ot=Et.group;Pt.layers.test(H.layers)&&pa(Pt,U,H,It,kt,Ot)}}function pa(T,U,H,V,z,gt){T.onBeforeRender(v,U,H,V,z,gt),T.modelViewMatrix.multiplyMatrices(H.matrixWorldInverse,T.matrixWorld),T.normalMatrix.getNormalMatrix(T.modelViewMatrix),z.onBeforeRender(v,U,H,V,T,gt),z.transparent===!0&&z.side===Be&&z.forceSinglePass===!1?(z.side=ze,z.needsUpdate=!0,v.renderBufferDirect(H,U,V,z,T,gt),z.side=Dn,z.needsUpdate=!0,v.renderBufferDirect(H,U,V,z,T,gt),z.side=Be):v.renderBufferDirect(H,U,V,z,T,gt),T.onAfterRender(v,U,H,V,z,gt)}function ns(T,U,H){U.isScene!==!0&&(U=St);const V=mt.get(T),z=p.state.lights,gt=p.state.shadowsArray,Et=z.state.version,Pt=yt.getParameters(T,z.state,gt,U,H),It=yt.getProgramCacheKey(Pt);let kt=V.programs;V.environment=T.isMeshStandardMaterial?U.environment:null,V.fog=U.fog,V.envMap=(T.isMeshStandardMaterial?N:x).get(T.envMap||V.environment),kt===void 0&&(T.addEventListener("dispose",ft),kt=new Map,V.programs=kt);let Ot=kt.get(It);if(Ot!==void 0){if(V.currentProgram===Ot&&V.lightsStateVersion===Et)return ga(T,Pt),Ot}else Pt.uniforms=yt.getUniforms(T),T.onBuild(H,Pt,v),T.onBeforeCompile(Pt,v),Ot=yt.acquireProgram(Pt,It),kt.set(It,Ot),V.uniforms=Pt.uniforms;const zt=V.uniforms;return(!T.isShaderMaterial&&!T.isRawShaderMaterial||T.clipping===!0)&&(zt.clippingPlanes=Bt.uniform),ga(T,Pt),V.needsLights=Ql(T),V.lightsStateVersion=Et,V.needsLights&&(zt.ambientLightColor.value=z.state.ambient,zt.lightProbe.value=z.state.probe,zt.directionalLights.value=z.state.directional,zt.directionalLightShadows.value=z.state.directionalShadow,zt.spotLights.value=z.state.spot,zt.spotLightShadows.value=z.state.spotShadow,zt.rectAreaLights.value=z.state.rectArea,zt.ltc_1.value=z.state.rectAreaLTC1,zt.ltc_2.value=z.state.rectAreaLTC2,zt.pointLights.value=z.state.point,zt.pointLightShadows.value=z.state.pointShadow,zt.hemisphereLights.value=z.state.hemi,zt.directionalShadowMap.value=z.state.directionalShadowMap,zt.directionalShadowMatrix.value=z.state.directionalShadowMatrix,zt.spotShadowMap.value=z.state.spotShadowMap,zt.spotLightMatrix.value=z.state.spotLightMatrix,zt.spotLightMap.value=z.state.spotLightMap,zt.pointShadowMap.value=z.state.pointShadowMap,zt.pointShadowMatrix.value=z.state.pointShadowMatrix),V.currentProgram=Ot,V.uniformsList=null,Ot}function ma(T){if(T.uniformsList===null){const U=T.currentProgram.getUniforms();T.uniformsList=Us.seqWithValue(U.seq,T.uniforms)}return T.uniformsList}function ga(T,U){const H=mt.get(T);H.outputColorSpace=U.outputColorSpace,H.batching=U.batching,H.instancing=U.instancing,H.instancingColor=U.instancingColor,H.skinning=U.skinning,H.morphTargets=U.morphTargets,H.morphNormals=U.morphNormals,H.morphColors=U.morphColors,H.morphTargetsCount=U.morphTargetsCount,H.numClippingPlanes=U.numClippingPlanes,H.numIntersection=U.numClipIntersection,H.vertexAlphas=U.vertexAlphas,H.vertexTangents=U.vertexTangents,H.toneMapping=U.toneMapping}function Jl(T,U,H,V,z){U.isScene!==!0&&(U=St),E.resetTextureUnits();const gt=U.fog,Et=V.isMeshStandardMaterial?U.environment:null,Pt=C===null?v.outputColorSpace:C.isXRRenderTarget===!0?C.texture.colorSpace:vn,It=(V.isMeshStandardMaterial?N:x).get(V.envMap||Et),kt=V.vertexColors===!0&&!!H.attributes.color&&H.attributes.color.itemSize===4,Ot=!!H.attributes.tangent&&(!!V.normalMap||V.anisotropy>0),zt=!!H.morphAttributes.position,ue=!!H.morphAttributes.normal,Ge=!!H.morphAttributes.color;let ve=Rn;V.toneMapped&&(C===null||C.isXRRenderTarget===!0)&&(ve=v.toneMapping);const ln=H.morphAttributes.position||H.morphAttributes.normal||H.morphAttributes.color,se=ln!==void 0?ln.length:0,Wt=mt.get(V),js=p.state.lights;if(Q===!0&&(pt===!0||T!==M)){const We=T===M&&V.id===O;Bt.setState(V,T,We)}let ce=!1;V.version===Wt.__version?(Wt.needsLights&&Wt.lightsStateVersion!==js.state.version||Wt.outputColorSpace!==Pt||z.isBatchedMesh&&Wt.batching===!1||!z.isBatchedMesh&&Wt.batching===!0||z.isInstancedMesh&&Wt.instancing===!1||!z.isInstancedMesh&&Wt.instancing===!0||z.isSkinnedMesh&&Wt.skinning===!1||!z.isSkinnedMesh&&Wt.skinning===!0||z.isInstancedMesh&&Wt.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&Wt.instancingColor===!1&&z.instanceColor!==null||Wt.envMap!==It||V.fog===!0&&Wt.fog!==gt||Wt.numClippingPlanes!==void 0&&(Wt.numClippingPlanes!==Bt.numPlanes||Wt.numIntersection!==Bt.numIntersection)||Wt.vertexAlphas!==kt||Wt.vertexTangents!==Ot||Wt.morphTargets!==zt||Wt.morphNormals!==ue||Wt.morphColors!==Ge||Wt.toneMapping!==ve||rt.isWebGL2===!0&&Wt.morphTargetsCount!==se)&&(ce=!0):(ce=!0,Wt.__version=V.version);let In=Wt.currentProgram;ce===!0&&(In=ns(V,U,z));let _a=!1,Di=!1,Zs=!1;const Te=In.getUniforms(),Un=Wt.uniforms;if(X.useProgram(In.program)&&(_a=!0,Di=!0,Zs=!0),V.id!==O&&(O=V.id,Di=!0),_a||M!==T){Te.setValue(P,"projectionMatrix",T.projectionMatrix),Te.setValue(P,"viewMatrix",T.matrixWorldInverse);const We=Te.map.cameraPosition;We!==void 0&&We.setValue(P,Ft.setFromMatrixPosition(T.matrixWorld)),rt.logarithmicDepthBuffer&&Te.setValue(P,"logDepthBufFC",2/(Math.log(T.far+1)/Math.LN2)),(V.isMeshPhongMaterial||V.isMeshToonMaterial||V.isMeshLambertMaterial||V.isMeshBasicMaterial||V.isMeshStandardMaterial||V.isShaderMaterial)&&Te.setValue(P,"isOrthographic",T.isOrthographicCamera===!0),M!==T&&(M=T,Di=!0,Zs=!0)}if(z.isSkinnedMesh){Te.setOptional(P,z,"bindMatrix"),Te.setOptional(P,z,"bindMatrixInverse");const We=z.skeleton;We&&(rt.floatVertexTextures?(We.boneTexture===null&&We.computeBoneTexture(),Te.setValue(P,"boneTexture",We.boneTexture,E)):console.warn("THREE.WebGLRenderer: SkinnedMesh can only be used with WebGL 2. With WebGL 1 OES_texture_float and vertex textures support is required."))}z.isBatchedMesh&&(Te.setOptional(P,z,"batchingTexture"),Te.setValue(P,"batchingTexture",z._matricesTexture,E));const Js=H.morphAttributes;if((Js.position!==void 0||Js.normal!==void 0||Js.color!==void 0&&rt.isWebGL2===!0)&&qt.update(z,H,In),(Di||Wt.receiveShadow!==z.receiveShadow)&&(Wt.receiveShadow=z.receiveShadow,Te.setValue(P,"receiveShadow",z.receiveShadow)),V.isMeshGouraudMaterial&&V.envMap!==null&&(Un.envMap.value=It,Un.flipEnvMap.value=It.isCubeTexture&&It.isRenderTargetTexture===!1?-1:1),Di&&(Te.setValue(P,"toneMappingExposure",v.toneMappingExposure),Wt.needsLights&&Kl(Un,Zs),gt&&V.fog===!0&&ut.refreshFogUniforms(Un,gt),ut.refreshMaterialUniforms(Un,V,Y,k,Mt),Us.upload(P,ma(Wt),Un,E)),V.isShaderMaterial&&V.uniformsNeedUpdate===!0&&(Us.upload(P,ma(Wt),Un,E),V.uniformsNeedUpdate=!1),V.isSpriteMaterial&&Te.setValue(P,"center",z.center),Te.setValue(P,"modelViewMatrix",z.modelViewMatrix),Te.setValue(P,"normalMatrix",z.normalMatrix),Te.setValue(P,"modelMatrix",z.matrixWorld),V.isShaderMaterial||V.isRawShaderMaterial){const We=V.uniformsGroups;for(let Ks=0,tc=We.length;Ks<tc;Ks++)if(rt.isWebGL2){const va=We[Ks];$t.update(va,In),$t.bind(va,In)}else console.warn("THREE.WebGLRenderer: Uniform Buffer Objects can only be used with WebGL 2.")}return In}function Kl(T,U){T.ambientLightColor.needsUpdate=U,T.lightProbe.needsUpdate=U,T.directionalLights.needsUpdate=U,T.directionalLightShadows.needsUpdate=U,T.pointLights.needsUpdate=U,T.pointLightShadows.needsUpdate=U,T.spotLights.needsUpdate=U,T.spotLightShadows.needsUpdate=U,T.rectAreaLights.needsUpdate=U,T.hemisphereLights.needsUpdate=U}function Ql(T){return T.isMeshLambertMaterial||T.isMeshToonMaterial||T.isMeshPhongMaterial||T.isMeshStandardMaterial||T.isShadowMaterial||T.isShaderMaterial&&T.lights===!0}this.getActiveCubeFace=function(){return L},this.getActiveMipmapLevel=function(){return b},this.getRenderTarget=function(){return C},this.setRenderTargetTextures=function(T,U,H){mt.get(T.texture).__webglTexture=U,mt.get(T.depthTexture).__webglTexture=H;const V=mt.get(T);V.__hasExternalTextures=!0,V.__hasExternalTextures&&(V.__autoAllocateDepthBuffer=H===void 0,V.__autoAllocateDepthBuffer||q.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),V.__useRenderToTexture=!1))},this.setRenderTargetFramebuffer=function(T,U){const H=mt.get(T);H.__webglFramebuffer=U,H.__useDefaultFramebuffer=U===void 0},this.setRenderTarget=function(T,U=0,H=0){C=T,L=U,b=H;let V=!0,z=null,gt=!1,Et=!1;if(T){const It=mt.get(T);It.__useDefaultFramebuffer!==void 0?(X.bindFramebuffer(P.FRAMEBUFFER,null),V=!1):It.__webglFramebuffer===void 0?E.setupRenderTarget(T):It.__hasExternalTextures&&E.rebindTextures(T,mt.get(T.texture).__webglTexture,mt.get(T.depthTexture).__webglTexture);const kt=T.texture;(kt.isData3DTexture||kt.isDataArrayTexture||kt.isCompressedArrayTexture)&&(Et=!0);const Ot=mt.get(T).__webglFramebuffer;T.isWebGLCubeRenderTarget?(Array.isArray(Ot[U])?z=Ot[U][H]:z=Ot[U],gt=!0):rt.isWebGL2&&T.samples>0&&E.useMultisampledRTT(T)===!1?z=mt.get(T).__webglMultisampledFramebuffer:Array.isArray(Ot)?z=Ot[H]:z=Ot,w.copy(T.viewport),F.copy(T.scissor),G=T.scissorTest}else w.copy(Z).multiplyScalar(Y).floor(),F.copy(it).multiplyScalar(Y).floor(),G=ot;if(X.bindFramebuffer(P.FRAMEBUFFER,z)&&rt.drawBuffers&&V&&X.drawBuffers(T,z),X.viewport(w),X.scissor(F),X.setScissorTest(G),gt){const It=mt.get(T.texture);P.framebufferTexture2D(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_CUBE_MAP_POSITIVE_X+U,It.__webglTexture,H)}else if(Et){const It=mt.get(T.texture),kt=U||0;P.framebufferTextureLayer(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,It.__webglTexture,H||0,kt)}O=-1},this.readRenderTargetPixels=function(T,U,H,V,z,gt,Et){if(!(T&&T.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Pt=mt.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&Et!==void 0&&(Pt=Pt[Et]),Pt){X.bindFramebuffer(P.FRAMEBUFFER,Pt);try{const It=T.texture,kt=It.format,Ot=It.type;if(kt!==en&&xt.convert(kt)!==P.getParameter(P.IMPLEMENTATION_COLOR_READ_FORMAT)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}const zt=Ot===$i&&(q.has("EXT_color_buffer_half_float")||rt.isWebGL2&&q.has("EXT_color_buffer_float"));if(Ot!==Pn&&xt.convert(Ot)!==P.getParameter(P.IMPLEMENTATION_COLOR_READ_TYPE)&&!(Ot===bn&&(rt.isWebGL2||q.has("OES_texture_float")||q.has("WEBGL_color_buffer_float")))&&!zt){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}U>=0&&U<=T.width-V&&H>=0&&H<=T.height-z&&P.readPixels(U,H,V,z,xt.convert(kt),xt.convert(Ot),gt)}finally{const It=C!==null?mt.get(C).__webglFramebuffer:null;X.bindFramebuffer(P.FRAMEBUFFER,It)}}},this.copyFramebufferToTexture=function(T,U,H=0){const V=Math.pow(2,-H),z=Math.floor(U.image.width*V),gt=Math.floor(U.image.height*V);E.setTexture2D(U,0),P.copyTexSubImage2D(P.TEXTURE_2D,H,0,0,T.x,T.y,z,gt),X.unbindTexture()},this.copyTextureToTexture=function(T,U,H,V=0){const z=U.image.width,gt=U.image.height,Et=xt.convert(H.format),Pt=xt.convert(H.type);E.setTexture2D(H,0),P.pixelStorei(P.UNPACK_FLIP_Y_WEBGL,H.flipY),P.pixelStorei(P.UNPACK_PREMULTIPLY_ALPHA_WEBGL,H.premultiplyAlpha),P.pixelStorei(P.UNPACK_ALIGNMENT,H.unpackAlignment),U.isDataTexture?P.texSubImage2D(P.TEXTURE_2D,V,T.x,T.y,z,gt,Et,Pt,U.image.data):U.isCompressedTexture?P.compressedTexSubImage2D(P.TEXTURE_2D,V,T.x,T.y,U.mipmaps[0].width,U.mipmaps[0].height,Et,U.mipmaps[0].data):P.texSubImage2D(P.TEXTURE_2D,V,T.x,T.y,Et,Pt,U.image),V===0&&H.generateMipmaps&&P.generateMipmap(P.TEXTURE_2D),X.unbindTexture()},this.copyTextureToTexture3D=function(T,U,H,V,z=0){if(v.isWebGL1Renderer){console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: can only be used with WebGL2.");return}const gt=T.max.x-T.min.x+1,Et=T.max.y-T.min.y+1,Pt=T.max.z-T.min.z+1,It=xt.convert(V.format),kt=xt.convert(V.type);let Ot;if(V.isData3DTexture)E.setTexture3D(V,0),Ot=P.TEXTURE_3D;else if(V.isDataArrayTexture||V.isCompressedArrayTexture)E.setTexture2DArray(V,0),Ot=P.TEXTURE_2D_ARRAY;else{console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");return}P.pixelStorei(P.UNPACK_FLIP_Y_WEBGL,V.flipY),P.pixelStorei(P.UNPACK_PREMULTIPLY_ALPHA_WEBGL,V.premultiplyAlpha),P.pixelStorei(P.UNPACK_ALIGNMENT,V.unpackAlignment);const zt=P.getParameter(P.UNPACK_ROW_LENGTH),ue=P.getParameter(P.UNPACK_IMAGE_HEIGHT),Ge=P.getParameter(P.UNPACK_SKIP_PIXELS),ve=P.getParameter(P.UNPACK_SKIP_ROWS),ln=P.getParameter(P.UNPACK_SKIP_IMAGES),se=H.isCompressedTexture?H.mipmaps[z]:H.image;P.pixelStorei(P.UNPACK_ROW_LENGTH,se.width),P.pixelStorei(P.UNPACK_IMAGE_HEIGHT,se.height),P.pixelStorei(P.UNPACK_SKIP_PIXELS,T.min.x),P.pixelStorei(P.UNPACK_SKIP_ROWS,T.min.y),P.pixelStorei(P.UNPACK_SKIP_IMAGES,T.min.z),H.isDataTexture||H.isData3DTexture?P.texSubImage3D(Ot,z,U.x,U.y,U.z,gt,Et,Pt,It,kt,se.data):H.isCompressedArrayTexture?(console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: untested support for compressed srcTexture."),P.compressedTexSubImage3D(Ot,z,U.x,U.y,U.z,gt,Et,Pt,It,se.data)):P.texSubImage3D(Ot,z,U.x,U.y,U.z,gt,Et,Pt,It,kt,se),P.pixelStorei(P.UNPACK_ROW_LENGTH,zt),P.pixelStorei(P.UNPACK_IMAGE_HEIGHT,ue),P.pixelStorei(P.UNPACK_SKIP_PIXELS,Ge),P.pixelStorei(P.UNPACK_SKIP_ROWS,ve),P.pixelStorei(P.UNPACK_SKIP_IMAGES,ln),z===0&&V.generateMipmaps&&P.generateMipmap(Ot),X.unbindTexture()},this.initTexture=function(T){T.isCubeTexture?E.setTextureCube(T,0):T.isData3DTexture?E.setTexture3D(T,0):T.isDataArrayTexture||T.isCompressedArrayTexture?E.setTexture2DArray(T,0):E.setTexture2D(T,0),X.unbindTexture()},this.resetState=function(){L=0,b=0,C=null,X.reset(),Ht.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return gn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorSpace=t===ta?"display-p3":"srgb",e.unpackColorSpace=Zt.workingColorSpace===Xs?"display-p3":"srgb"}get outputEncoding(){return console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace===Ee?qn:fl}set outputEncoding(t){console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace=t===qn?Ee:vn}get useLegacyLights(){return console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights}set useLegacyLights(t){console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights=t}}class lm extends Fl{}lm.prototype.isWebGL1Renderer=!0;class ia{constructor(t,e=25e-5){this.isFogExp2=!0,this.name="",this.color=new Tt(t),this.density=e}clone(){return new ia(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}}class sa{constructor(t,e=1,n=1e3){this.isFog=!0,this.name="",this.color=new Tt(t),this.near=e,this.far=n}clone(){return new sa(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class cm extends oe{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e}}class hm{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=kr,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.version=0,this.uuid=_n()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}get updateRange(){return console.warn("THREE.InterleavedBuffer: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,n){t*=this.stride,n*=e.stride;for(let i=0,r=this.stride;i<r;i++)this.array[t+i]=e.array[n+i];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=_n()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(e,this.stride);return n.setUsage(this.usage),n}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=_n()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const Ie=new R;class ks{constructor(t,e,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,n=this.data.count;e<n;e++)Ie.fromBufferAttribute(this,e),Ie.applyMatrix4(t),this.setXYZ(e,Ie.x,Ie.y,Ie.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Ie.fromBufferAttribute(this,e),Ie.applyNormalMatrix(t),this.setXYZ(e,Ie.x,Ie.y,Ie.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Ie.fromBufferAttribute(this,e),Ie.transformDirection(t),this.setXYZ(e,Ie.x,Ie.y,Ie.z);return this}setX(t,e){return this.normalized&&(e=Jt(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=Jt(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=Jt(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=Jt(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=mn(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=mn(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=mn(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=mn(e,this.array)),e}setXY(t,e,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=Jt(e,this.array),n=Jt(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this}setXYZ(t,e,n,i){return t=t*this.data.stride+this.offset,this.normalized&&(e=Jt(e,this.array),n=Jt(n,this.array),i=Jt(i,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=i,this}setXYZW(t,e,n,i,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=Jt(e,this.array),n=Jt(n,this.array),i=Jt(i,this.array),r=Jt(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=i,this.data.array[t+3]=r,this}clone(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[i+r])}return new Pe(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new ks(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class ji extends xn{constructor(t){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Tt(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}let fi;const Oi=new R,pi=new R,mi=new R,gi=new at,Bi=new at,Ol=new ne,Ts=new R,zi=new R,As=new R,Bo=new at,Pr=new at,zo=new at;class Bl extends oe{constructor(t=new ji){if(super(),this.isSprite=!0,this.type="Sprite",fi===void 0){fi=new we;const e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new hm(e,5);fi.setIndex([0,1,2,0,2,3]),fi.setAttribute("position",new ks(n,3,0,!1)),fi.setAttribute("uv",new ks(n,2,3,!1))}this.geometry=fi,this.material=t,this.center=new at(.5,.5)}raycast(t,e){t.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),pi.setFromMatrixScale(this.matrixWorld),Ol.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),mi.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&pi.multiplyScalar(-mi.z);const n=this.material.rotation;let i,r;n!==0&&(r=Math.cos(n),i=Math.sin(n));const a=this.center;bs(Ts.set(-.5,-.5,0),mi,a,pi,i,r),bs(zi.set(.5,-.5,0),mi,a,pi,i,r),bs(As.set(.5,.5,0),mi,a,pi,i,r),Bo.set(0,0),Pr.set(1,0),zo.set(1,1);let o=t.ray.intersectTriangle(Ts,zi,As,!1,Oi);if(o===null&&(bs(zi.set(-.5,.5,0),mi,a,pi,i,r),Pr.set(0,1),o=t.ray.intersectTriangle(Ts,As,zi,!1,Oi),o===null))return;const l=t.ray.origin.distanceTo(Oi);l<t.near||l>t.far||e.push({distance:l,point:Oi.clone(),uv:Ye.getInterpolation(Oi,Ts,zi,As,Bo,Pr,zo,new at),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}}function bs(s,t,e,n,i,r){gi.subVectors(s,e).addScalar(.5).multiply(n),i!==void 0?(Bi.x=r*gi.x-i*gi.y,Bi.y=i*gi.x+r*gi.y):Bi.copy(gi),s.copy(t),s.x+=Bi.x,s.y+=Bi.y,s.applyMatrix4(Ol)}class Ho extends Pe{constructor(t,e,n,i=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const _i=new ne,Go=new ne,Cs=[],ko=new Zn,um=new ne,Hi=new st,Gi=new Pi;class Vo extends st{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new Ho(new Float32Array(n*16),16),this.instanceColor=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,um)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new Zn),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,_i),ko.copy(t.boundingBox).applyMatrix4(_i),this.boundingBox.union(ko)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new Pi),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,_i),Gi.copy(t.boundingSphere).applyMatrix4(_i),this.boundingSphere.union(Gi)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}raycast(t,e){const n=this.matrixWorld,i=this.count;if(Hi.geometry=this.geometry,Hi.material=this.material,Hi.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Gi.copy(this.boundingSphere),Gi.applyMatrix4(n),t.ray.intersectsSphere(Gi)!==!1))for(let r=0;r<i;r++){this.getMatrixAt(r,_i),Go.multiplyMatrices(n,_i),Hi.matrixWorld=Go,Hi.raycast(t,Cs);for(let a=0,o=Cs.length;a<o;a++){const l=Cs[a];l.instanceId=r,l.object=this,e.push(l)}Cs.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new Ho(new Float32Array(this.instanceMatrix.count*3),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"})}}class ra extends xn{constructor(t){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Tt(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}const Wo=new ne,Yr=new yl,Rs=new Pi,Ps=new R;class zl extends oe{constructor(t=new we,e=new ra){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){const n=this.geometry,i=this.matrixWorld,r=t.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Rs.copy(n.boundingSphere),Rs.applyMatrix4(i),Rs.radius+=r,t.ray.intersectsSphere(Rs)===!1)return;Wo.copy(i).invert(),Yr.copy(t.ray).applyMatrix4(Wo);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,u=n.attributes.position;if(c!==null){const d=Math.max(0,a.start),m=Math.min(c.count,a.start+a.count);for(let g=d,_=m;g<_;g++){const p=c.getX(g);Ps.fromBufferAttribute(u,p),Xo(Ps,p,l,i,t,e,this)}}else{const d=Math.max(0,a.start),m=Math.min(u.count,a.start+a.count);for(let g=d,_=m;g<_;g++)Ps.fromBufferAttribute(u,g),Xo(Ps,g,l,i,t,e,this)}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Xo(s,t,e,n,i,r,a){const o=Yr.distanceSqToPoint(s);if(o<e){const l=new R;Yr.closestPointToPoint(s,l),l.applyMatrix4(n);const c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:t,face:null,object:a})}}class ts extends He{constructor(t,e,n,i,r,a,o,l,c){super(t,e,n,i,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class on{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(t,e){const n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){const t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const e=[];let n,i=this.getPoint(0),r=0;e.push(0);for(let a=1;a<=t;a++)n=this.getPoint(a/t),r+=n.distanceTo(i),e.push(r),i=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e){const n=this.getLengths();let i=0;const r=n.length;let a;e?a=e:a=t*n[r-1];let o=0,l=r-1,c;for(;o<=l;)if(i=Math.floor(o+(l-o)/2),c=n[i]-a,c<0)o=i+1;else if(c>0)l=i-1;else{l=i;break}if(i=l,n[i]===a)return i/(r-1);const h=n[i],d=n[i+1]-h,m=(a-h)/d;return(i+m)/(r-1)}getTangent(t,e){let i=t-1e-4,r=t+1e-4;i<0&&(i=0),r>1&&(r=1);const a=this.getPoint(i),o=this.getPoint(r),l=e||(a.isVector2?new at:new R);return l.copy(o).sub(a).normalize(),l}getTangentAt(t,e){const n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e){const n=new R,i=[],r=[],a=[],o=new R,l=new ne;for(let m=0;m<=t;m++){const g=m/t;i[m]=this.getTangentAt(g,new R)}r[0]=new R,a[0]=new R;let c=Number.MAX_VALUE;const h=Math.abs(i[0].x),u=Math.abs(i[0].y),d=Math.abs(i[0].z);h<=c&&(c=h,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),o.crossVectors(i[0],n).normalize(),r[0].crossVectors(i[0],o),a[0].crossVectors(i[0],r[0]);for(let m=1;m<=t;m++){if(r[m]=r[m-1].clone(),a[m]=a[m-1].clone(),o.crossVectors(i[m-1],i[m]),o.length()>Number.EPSILON){o.normalize();const g=Math.acos(Re(i[m-1].dot(i[m]),-1,1));r[m].applyMatrix4(l.makeRotationAxis(o,g))}a[m].crossVectors(i[m],r[m])}if(e===!0){let m=Math.acos(Re(r[0].dot(r[t]),-1,1));m/=t,i[0].dot(o.crossVectors(r[0],r[t]))>0&&(m=-m);for(let g=1;g<=t;g++)r[g].applyMatrix4(l.makeRotationAxis(i[g],m*g)),a[g].crossVectors(i[g],r[g])}return{tangents:i,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){const t={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}}class aa extends on{constructor(t=0,e=0,n=1,i=1,r=0,a=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=i,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(t,e){const n=e||new at,i=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=i;for(;r>i;)r-=i;r<Number.EPSILON&&(a?r=0:r=i),this.aClockwise===!0&&!a&&(r===i?r=-i:r=r-i);const o=this.aStartAngle+t*r;let l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){const h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=l-this.aX,m=c-this.aY;l=d*h-m*u+this.aX,c=d*u+m*h+this.aY}return n.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){const t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}}class dm extends aa{constructor(t,e,n,i,r,a){super(t,e,n,n,i,r,a),this.isArcCurve=!0,this.type="ArcCurve"}}function oa(){let s=0,t=0,e=0,n=0;function i(r,a,o,l){s=r,t=o,e=-3*r+3*a-2*o-l,n=2*r-2*a+o+l}return{initCatmullRom:function(r,a,o,l,c){i(a,o,c*(o-r),c*(l-a))},initNonuniformCatmullRom:function(r,a,o,l,c,h,u){let d=(a-r)/c-(o-r)/(c+h)+(o-a)/h,m=(o-a)/h-(l-a)/(h+u)+(l-o)/u;d*=h,m*=h,i(a,o,d,m)},calc:function(r){const a=r*r,o=a*r;return s+t*r+e*a+n*o}}}const Ls=new R,Lr=new oa,Dr=new oa,Ir=new oa;class fm extends on{constructor(t=[],e=!1,n="centripetal",i=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=i}getPoint(t,e=new R){const n=e,i=this.points,r=i.length,a=(r-(this.closed?0:1))*t;let o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:l===0&&o===r-1&&(o=r-2,l=1);let c,h;this.closed||o>0?c=i[(o-1)%r]:(Ls.subVectors(i[0],i[1]).add(i[0]),c=Ls);const u=i[o%r],d=i[(o+1)%r];if(this.closed||o+2<r?h=i[(o+2)%r]:(Ls.subVectors(i[r-1],i[r-2]).add(i[r-1]),h=Ls),this.curveType==="centripetal"||this.curveType==="chordal"){const m=this.curveType==="chordal"?.5:.25;let g=Math.pow(c.distanceToSquared(u),m),_=Math.pow(u.distanceToSquared(d),m),p=Math.pow(d.distanceToSquared(h),m);_<1e-4&&(_=1),g<1e-4&&(g=_),p<1e-4&&(p=_),Lr.initNonuniformCatmullRom(c.x,u.x,d.x,h.x,g,_,p),Dr.initNonuniformCatmullRom(c.y,u.y,d.y,h.y,g,_,p),Ir.initNonuniformCatmullRom(c.z,u.z,d.z,h.z,g,_,p)}else this.curveType==="catmullrom"&&(Lr.initCatmullRom(c.x,u.x,d.x,h.x,this.tension),Dr.initCatmullRom(c.y,u.y,d.y,h.y,this.tension),Ir.initCatmullRom(c.z,u.z,d.z,h.z,this.tension));return n.set(Lr.calc(l),Dr.calc(l),Ir.calc(l)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(i.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const i=this.points[e];t.points.push(i.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(new R().fromArray(i))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}}function qo(s,t,e,n,i){const r=(n-t)*.5,a=(i-e)*.5,o=s*s,l=s*o;return(2*e-2*n+r+a)*l+(-3*e+3*n-2*r-a)*o+r*s+e}function pm(s,t){const e=1-s;return e*e*t}function mm(s,t){return 2*(1-s)*s*t}function gm(s,t){return s*s*t}function Vi(s,t,e,n){return pm(s,t)+mm(s,e)+gm(s,n)}function _m(s,t){const e=1-s;return e*e*e*t}function vm(s,t){const e=1-s;return 3*e*e*s*t}function xm(s,t){return 3*(1-s)*s*s*t}function ym(s,t){return s*s*s*t}function Wi(s,t,e,n,i){return _m(s,t)+vm(s,e)+xm(s,n)+ym(s,i)}class Hl extends on{constructor(t=new at,e=new at,n=new at,i=new at){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=i}getPoint(t,e=new at){const n=e,i=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(Wi(t,i.x,r.x,a.x,o.x),Wi(t,i.y,r.y,a.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class Mm extends on{constructor(t=new R,e=new R,n=new R,i=new R){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=i}getPoint(t,e=new R){const n=e,i=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(Wi(t,i.x,r.x,a.x,o.x),Wi(t,i.y,r.y,a.y,o.y),Wi(t,i.z,r.z,a.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class Gl extends on{constructor(t=new at,e=new at){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new at){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new at){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Sm extends on{constructor(t=new R,e=new R){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new R){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new R){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class kl extends on{constructor(t=new at,e=new at,n=new at){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new at){const n=e,i=this.v0,r=this.v1,a=this.v2;return n.set(Vi(t,i.x,r.x,a.x),Vi(t,i.y,r.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Em extends on{constructor(t=new R,e=new R,n=new R){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new R){const n=e,i=this.v0,r=this.v1,a=this.v2;return n.set(Vi(t,i.x,r.x,a.x),Vi(t,i.y,r.y,a.y),Vi(t,i.z,r.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Vl extends on{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new at){const n=e,i=this.points,r=(i.length-1)*t,a=Math.floor(r),o=r-a,l=i[a===0?a:a-1],c=i[a],h=i[a>i.length-2?i.length-1:a+1],u=i[a>i.length-3?i.length-1:a+2];return n.set(qo(o,l.x,c.x,h.x,u.x),qo(o,l.y,c.y,h.y,u.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(i.clone())}return this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const i=this.points[e];t.points.push(i.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(new at().fromArray(i))}return this}}var $r=Object.freeze({__proto__:null,ArcCurve:dm,CatmullRomCurve3:fm,CubicBezierCurve:Hl,CubicBezierCurve3:Mm,EllipseCurve:aa,LineCurve:Gl,LineCurve3:Sm,QuadraticBezierCurve:kl,QuadraticBezierCurve3:Em,SplineCurve:Vl});class wm extends on{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){const t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){const n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new $r[n](e,t))}return this}getPoint(t,e){const n=t*this.getLength(),i=this.getCurveLengths();let r=0;for(;r<i.length;){if(i[r]>=n){const a=i[r]-n,o=this.curves[r],l=o.getLength(),c=l===0?0:1-a/l;return o.getPointAt(c,e)}r++}return null}getLength(){const t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const t=[];let e=0;for(let n=0,i=this.curves.length;n<i;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){const e=[];let n;for(let i=0,r=this.curves;i<r.length;i++){const a=r[i],o=a.isEllipseCurve?t*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?t*a.points.length:t,l=a.getPoints(o);for(let c=0;c<l.length;c++){const h=l[c];n&&n.equals(h)||(e.push(h),n=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const i=t.curves[e];this.curves.push(i.clone())}return this.autoClose=t.autoClose,this}toJSON(){const t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){const i=this.curves[e];t.curves.push(i.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const i=t.curves[e];this.curves.push(new $r[i.type]().fromJSON(i))}return this}}class Yo extends wm{constructor(t){super(),this.type="Path",this.currentPoint=new at,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){const n=new Gl(this.currentPoint.clone(),new at(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,i){const r=new kl(this.currentPoint.clone(),new at(t,e),new at(n,i));return this.curves.push(r),this.currentPoint.set(n,i),this}bezierCurveTo(t,e,n,i,r,a){const o=new Hl(this.currentPoint.clone(),new at(t,e),new at(n,i),new at(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(t){const e=[this.currentPoint.clone()].concat(t),n=new Vl(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,i,r,a){const o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+o,e+l,n,i,r,a),this}absarc(t,e,n,i,r,a){return this.absellipse(t,e,n,n,i,r,a),this}ellipse(t,e,n,i,r,a,o,l){const c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,n,i,r,a,o,l),this}absellipse(t,e,n,i,r,a,o,l){const c=new aa(t,e,n,i,r,a,o,l);if(this.curves.length>0){const u=c.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(c);const h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){const t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}}class ye extends we{constructor(t=1,e=1,n=1,i=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:i,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};const c=this;i=Math.floor(i),r=Math.floor(r);const h=[],u=[],d=[],m=[];let g=0;const _=[],p=n/2;let f=0;S(),a===!1&&(t>0&&v(!0),e>0&&v(!1)),this.setIndex(h),this.setAttribute("position",new ie(u,3)),this.setAttribute("normal",new ie(d,3)),this.setAttribute("uv",new ie(m,2));function S(){const y=new R,L=new R;let b=0;const C=(e-t)/n;for(let O=0;O<=r;O++){const M=[],w=O/r,F=w*(e-t)+t;for(let G=0;G<=i;G++){const J=G/i,D=J*l+o,B=Math.sin(D),k=Math.cos(D);L.x=F*B,L.y=-w*n+p,L.z=F*k,u.push(L.x,L.y,L.z),y.set(B,C,k).normalize(),d.push(y.x,y.y,y.z),m.push(J,1-w),M.push(g++)}_.push(M)}for(let O=0;O<i;O++)for(let M=0;M<r;M++){const w=_[M][O],F=_[M+1][O],G=_[M+1][O+1],J=_[M][O+1];h.push(w,F,J),h.push(F,G,J),b+=6}c.addGroup(f,b,0),f+=b}function v(y){const L=g,b=new at,C=new R;let O=0;const M=y===!0?t:e,w=y===!0?1:-1;for(let G=1;G<=i;G++)u.push(0,p*w,0),d.push(0,w,0),m.push(.5,.5),g++;const F=g;for(let G=0;G<=i;G++){const D=G/i*l+o,B=Math.cos(D),k=Math.sin(D);C.x=M*k,C.y=p*w,C.z=M*B,u.push(C.x,C.y,C.z),d.push(0,w,0),b.x=B*.5+.5,b.y=k*.5*w+.5,m.push(b.x,b.y),g++}for(let G=0;G<i;G++){const J=L+G,D=F+G;y===!0?h.push(D,D+1,J):h.push(D+1,D,J),O+=3}c.addGroup(f,O,y===!0?1:2),f+=O}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ye(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class Me extends ye{constructor(t=1,e=1,n=32,i=1,r=!1,a=0,o=Math.PI*2){super(0,t,e,n,i,r,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:i,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(t){return new Me(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class la extends we{constructor(t=[],e=[],n=1,i=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:n,detail:i};const r=[],a=[];o(i),c(n),h(),this.setAttribute("position",new ie(r,3)),this.setAttribute("normal",new ie(r.slice(),3)),this.setAttribute("uv",new ie(a,2)),i===0?this.computeVertexNormals():this.normalizeNormals();function o(S){const v=new R,y=new R,L=new R;for(let b=0;b<e.length;b+=3)m(e[b+0],v),m(e[b+1],y),m(e[b+2],L),l(v,y,L,S)}function l(S,v,y,L){const b=L+1,C=[];for(let O=0;O<=b;O++){C[O]=[];const M=S.clone().lerp(y,O/b),w=v.clone().lerp(y,O/b),F=b-O;for(let G=0;G<=F;G++)G===0&&O===b?C[O][G]=M:C[O][G]=M.clone().lerp(w,G/F)}for(let O=0;O<b;O++)for(let M=0;M<2*(b-O)-1;M++){const w=Math.floor(M/2);M%2===0?(d(C[O][w+1]),d(C[O+1][w]),d(C[O][w])):(d(C[O][w+1]),d(C[O+1][w+1]),d(C[O+1][w]))}}function c(S){const v=new R;for(let y=0;y<r.length;y+=3)v.x=r[y+0],v.y=r[y+1],v.z=r[y+2],v.normalize().multiplyScalar(S),r[y+0]=v.x,r[y+1]=v.y,r[y+2]=v.z}function h(){const S=new R;for(let v=0;v<r.length;v+=3){S.x=r[v+0],S.y=r[v+1],S.z=r[v+2];const y=p(S)/2/Math.PI+.5,L=f(S)/Math.PI+.5;a.push(y,1-L)}g(),u()}function u(){for(let S=0;S<a.length;S+=6){const v=a[S+0],y=a[S+2],L=a[S+4],b=Math.max(v,y,L),C=Math.min(v,y,L);b>.9&&C<.1&&(v<.2&&(a[S+0]+=1),y<.2&&(a[S+2]+=1),L<.2&&(a[S+4]+=1))}}function d(S){r.push(S.x,S.y,S.z)}function m(S,v){const y=S*3;v.x=t[y+0],v.y=t[y+1],v.z=t[y+2]}function g(){const S=new R,v=new R,y=new R,L=new R,b=new at,C=new at,O=new at;for(let M=0,w=0;M<r.length;M+=9,w+=6){S.set(r[M+0],r[M+1],r[M+2]),v.set(r[M+3],r[M+4],r[M+5]),y.set(r[M+6],r[M+7],r[M+8]),b.set(a[w+0],a[w+1]),C.set(a[w+2],a[w+3]),O.set(a[w+4],a[w+5]),L.copy(S).add(v).add(y).divideScalar(3);const F=p(L);_(b,w+0,S,F),_(C,w+2,v,F),_(O,w+4,y,F)}}function _(S,v,y,L){L<0&&S.x===1&&(a[v]=S.x-1),y.x===0&&y.z===0&&(a[v]=L/2/Math.PI+.5)}function p(S){return Math.atan2(S.z,-S.x)}function f(S){return Math.atan2(-S.y,Math.sqrt(S.x*S.x+S.z*S.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new la(t.vertices,t.indices,t.radius,t.details)}}class ca extends la{constructor(t=1,e=0){const n=(1+Math.sqrt(5))/2,i=1/n,r=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-i,-n,0,-i,n,0,i,-n,0,i,n,-i,-n,0,-i,n,0,i,-n,0,i,n,0,-n,0,-i,n,0,-i,-n,0,i,n,0,i],a=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(r,a,t,e),this.type="DodecahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new ca(t.radius,t.detail)}}class Zi extends Yo{constructor(t){super(t),this.uuid=_n(),this.type="Shape",this.holes=[]}getPointsHoles(t){const e=[];for(let n=0,i=this.holes.length;n<i;n++)e[n]=this.holes[n].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){const i=t.holes[e];this.holes.push(i.clone())}return this}toJSON(){const t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,n=this.holes.length;e<n;e++){const i=this.holes[e];t.holes.push(i.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){const i=t.holes[e];this.holes.push(new Yo().fromJSON(i))}return this}}const Tm={triangulate:function(s,t,e=2){const n=t&&t.length,i=n?t[0]*e:s.length;let r=Wl(s,0,i,e,!0);const a=[];if(!r||r.next===r.prev)return a;let o,l,c,h,u,d,m;if(n&&(r=Pm(s,t,r,e)),s.length>80*e){o=c=s[0],l=h=s[1];for(let g=e;g<i;g+=e)u=s[g],d=s[g+1],u<o&&(o=u),d<l&&(l=d),u>c&&(c=u),d>h&&(h=d);m=Math.max(c-o,h-l),m=m!==0?32767/m:0}return Ji(r,a,e,o,l,m,0),a}};function Wl(s,t,e,n,i){let r,a;if(i===Gm(s,t,e,n)>0)for(r=t;r<e;r+=n)a=$o(r,s[r],s[r+1],a);else for(r=e-n;r>=t;r-=n)a=$o(r,s[r],s[r+1],a);return a&&$s(a,a.next)&&(Qi(a),a=a.next),a}function jn(s,t){if(!s)return s;t||(t=s);let e=s,n;do if(n=!1,!e.steiner&&($s(e,e.next)||ae(e.prev,e,e.next)===0)){if(Qi(e),e=t=e.prev,e===e.next)break;n=!0}else e=e.next;while(n||e!==t);return t}function Ji(s,t,e,n,i,r,a){if(!s)return;!a&&r&&Nm(s,n,i,r);let o=s,l,c;for(;s.prev!==s.next;){if(l=s.prev,c=s.next,r?bm(s,n,i,r):Am(s)){t.push(l.i/e|0),t.push(s.i/e|0),t.push(c.i/e|0),Qi(s),s=c.next,o=c.next;continue}if(s=c,s===o){a?a===1?(s=Cm(jn(s),t,e),Ji(s,t,e,n,i,r,2)):a===2&&Rm(s,t,e,n,i,r):Ji(jn(s),t,e,n,i,r,1);break}}}function Am(s){const t=s.prev,e=s,n=s.next;if(ae(t,e,n)>=0)return!1;const i=t.x,r=e.x,a=n.x,o=t.y,l=e.y,c=n.y,h=i<r?i<a?i:a:r<a?r:a,u=o<l?o<c?o:c:l<c?l:c,d=i>r?i>a?i:a:r>a?r:a,m=o>l?o>c?o:c:l>c?l:c;let g=n.next;for(;g!==t;){if(g.x>=h&&g.x<=d&&g.y>=u&&g.y<=m&&Mi(i,o,r,l,a,c,g.x,g.y)&&ae(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function bm(s,t,e,n){const i=s.prev,r=s,a=s.next;if(ae(i,r,a)>=0)return!1;const o=i.x,l=r.x,c=a.x,h=i.y,u=r.y,d=a.y,m=o<l?o<c?o:c:l<c?l:c,g=h<u?h<d?h:d:u<d?u:d,_=o>l?o>c?o:c:l>c?l:c,p=h>u?h>d?h:d:u>d?u:d,f=jr(m,g,t,e,n),S=jr(_,p,t,e,n);let v=s.prevZ,y=s.nextZ;for(;v&&v.z>=f&&y&&y.z<=S;){if(v.x>=m&&v.x<=_&&v.y>=g&&v.y<=p&&v!==i&&v!==a&&Mi(o,h,l,u,c,d,v.x,v.y)&&ae(v.prev,v,v.next)>=0||(v=v.prevZ,y.x>=m&&y.x<=_&&y.y>=g&&y.y<=p&&y!==i&&y!==a&&Mi(o,h,l,u,c,d,y.x,y.y)&&ae(y.prev,y,y.next)>=0))return!1;y=y.nextZ}for(;v&&v.z>=f;){if(v.x>=m&&v.x<=_&&v.y>=g&&v.y<=p&&v!==i&&v!==a&&Mi(o,h,l,u,c,d,v.x,v.y)&&ae(v.prev,v,v.next)>=0)return!1;v=v.prevZ}for(;y&&y.z<=S;){if(y.x>=m&&y.x<=_&&y.y>=g&&y.y<=p&&y!==i&&y!==a&&Mi(o,h,l,u,c,d,y.x,y.y)&&ae(y.prev,y,y.next)>=0)return!1;y=y.nextZ}return!0}function Cm(s,t,e){let n=s;do{const i=n.prev,r=n.next.next;!$s(i,r)&&Xl(i,n,n.next,r)&&Ki(i,r)&&Ki(r,i)&&(t.push(i.i/e|0),t.push(n.i/e|0),t.push(r.i/e|0),Qi(n),Qi(n.next),n=s=r),n=n.next}while(n!==s);return jn(n)}function Rm(s,t,e,n,i,r){let a=s;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&Bm(a,o)){let l=ql(a,o);a=jn(a,a.next),l=jn(l,l.next),Ji(a,t,e,n,i,r,0),Ji(l,t,e,n,i,r,0);return}o=o.next}a=a.next}while(a!==s)}function Pm(s,t,e,n){const i=[];let r,a,o,l,c;for(r=0,a=t.length;r<a;r++)o=t[r]*n,l=r<a-1?t[r+1]*n:s.length,c=Wl(s,o,l,n,!1),c===c.next&&(c.steiner=!0),i.push(Om(c));for(i.sort(Lm),r=0;r<i.length;r++)e=Dm(i[r],e);return e}function Lm(s,t){return s.x-t.x}function Dm(s,t){const e=Im(s,t);if(!e)return t;const n=ql(e,s);return jn(n,n.next),jn(e,e.next)}function Im(s,t){let e=t,n=-1/0,i;const r=s.x,a=s.y;do{if(a<=e.y&&a>=e.next.y&&e.next.y!==e.y){const d=e.x+(a-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(d<=r&&d>n&&(n=d,i=e.x<e.next.x?e:e.next,d===r))return i}e=e.next}while(e!==t);if(!i)return null;const o=i,l=i.x,c=i.y;let h=1/0,u;e=i;do r>=e.x&&e.x>=l&&r!==e.x&&Mi(a<c?r:n,a,l,c,a<c?n:r,a,e.x,e.y)&&(u=Math.abs(a-e.y)/(r-e.x),Ki(e,s)&&(u<h||u===h&&(e.x>i.x||e.x===i.x&&Um(i,e)))&&(i=e,h=u)),e=e.next;while(e!==o);return i}function Um(s,t){return ae(s.prev,s,t.prev)<0&&ae(t.next,s,s.next)<0}function Nm(s,t,e,n){let i=s;do i.z===0&&(i.z=jr(i.x,i.y,t,e,n)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next;while(i!==s);i.prevZ.nextZ=null,i.prevZ=null,Fm(i)}function Fm(s){let t,e,n,i,r,a,o,l,c=1;do{for(e=s,s=null,r=null,a=0;e;){for(a++,n=e,o=0,t=0;t<c&&(o++,n=n.nextZ,!!n);t++);for(l=c;o>0||l>0&&n;)o!==0&&(l===0||!n||e.z<=n.z)?(i=e,e=e.nextZ,o--):(i=n,n=n.nextZ,l--),r?r.nextZ=i:s=i,i.prevZ=r,r=i;e=n}r.nextZ=null,c*=2}while(a>1);return s}function jr(s,t,e,n,i){return s=(s-e)*i|0,t=(t-n)*i|0,s=(s|s<<8)&16711935,s=(s|s<<4)&252645135,s=(s|s<<2)&858993459,s=(s|s<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,s|t<<1}function Om(s){let t=s,e=s;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==s);return e}function Mi(s,t,e,n,i,r,a,o){return(i-a)*(t-o)>=(s-a)*(r-o)&&(s-a)*(n-o)>=(e-a)*(t-o)&&(e-a)*(r-o)>=(i-a)*(n-o)}function Bm(s,t){return s.next.i!==t.i&&s.prev.i!==t.i&&!zm(s,t)&&(Ki(s,t)&&Ki(t,s)&&Hm(s,t)&&(ae(s.prev,s,t.prev)||ae(s,t.prev,t))||$s(s,t)&&ae(s.prev,s,s.next)>0&&ae(t.prev,t,t.next)>0)}function ae(s,t,e){return(t.y-s.y)*(e.x-t.x)-(t.x-s.x)*(e.y-t.y)}function $s(s,t){return s.x===t.x&&s.y===t.y}function Xl(s,t,e,n){const i=Is(ae(s,t,e)),r=Is(ae(s,t,n)),a=Is(ae(e,n,s)),o=Is(ae(e,n,t));return!!(i!==r&&a!==o||i===0&&Ds(s,e,t)||r===0&&Ds(s,n,t)||a===0&&Ds(e,s,n)||o===0&&Ds(e,t,n))}function Ds(s,t,e){return t.x<=Math.max(s.x,e.x)&&t.x>=Math.min(s.x,e.x)&&t.y<=Math.max(s.y,e.y)&&t.y>=Math.min(s.y,e.y)}function Is(s){return s>0?1:s<0?-1:0}function zm(s,t){let e=s;do{if(e.i!==s.i&&e.next.i!==s.i&&e.i!==t.i&&e.next.i!==t.i&&Xl(e,e.next,s,t))return!0;e=e.next}while(e!==s);return!1}function Ki(s,t){return ae(s.prev,s,s.next)<0?ae(s,t,s.next)>=0&&ae(s,s.prev,t)>=0:ae(s,t,s.prev)<0||ae(s,s.next,t)<0}function Hm(s,t){let e=s,n=!1;const i=(s.x+t.x)/2,r=(s.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&i<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(n=!n),e=e.next;while(e!==s);return n}function ql(s,t){const e=new Zr(s.i,s.x,s.y),n=new Zr(t.i,t.x,t.y),i=s.next,r=t.prev;return s.next=t,t.prev=s,e.next=i,i.prev=e,n.next=e,e.prev=n,r.next=n,n.prev=r,n}function $o(s,t,e,n){const i=new Zr(s,t,e);return n?(i.next=n.next,i.prev=n,n.next.prev=i,n.next=i):(i.prev=i,i.next=i),i}function Qi(s){s.next.prev=s.prev,s.prev.next=s.next,s.prevZ&&(s.prevZ.nextZ=s.nextZ),s.nextZ&&(s.nextZ.prevZ=s.prevZ)}function Zr(s,t,e){this.i=s,this.x=t,this.y=e,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}function Gm(s,t,e,n){let i=0;for(let r=t,a=e-n;r<e;r+=n)i+=(s[a]-s[r])*(s[r+1]+s[a+1]),a=r;return i}class Ln{static area(t){const e=t.length;let n=0;for(let i=e-1,r=0;r<e;i=r++)n+=t[i].x*t[r].y-t[r].x*t[i].y;return n*.5}static isClockWise(t){return Ln.area(t)<0}static triangulateShape(t,e){const n=[],i=[],r=[];jo(t),Zo(n,t);let a=t.length;e.forEach(jo);for(let l=0;l<e.length;l++)i.push(a),a+=e[l].length,Zo(n,e[l]);const o=Tm.triangulate(n,i);for(let l=0;l<o.length;l+=3)r.push(o.slice(l,l+3));return r}}function jo(s){const t=s.length;t>2&&s[t-1].equals(s[0])&&s.pop()}function Zo(s,t){for(let e=0;e<t.length;e++)s.push(t[e].x),s.push(t[e].y)}class ha extends we{constructor(t=new Zi([new at(.5,.5),new at(-.5,.5),new at(-.5,-.5),new at(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];const n=this,i=[],r=[];for(let o=0,l=t.length;o<l;o++){const c=t[o];a(c)}this.setAttribute("position",new ie(i,3)),this.setAttribute("uv",new ie(r,2)),this.computeVertexNormals();function a(o){const l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,u=e.depth!==void 0?e.depth:1;let d=e.bevelEnabled!==void 0?e.bevelEnabled:!0,m=e.bevelThickness!==void 0?e.bevelThickness:.2,g=e.bevelSize!==void 0?e.bevelSize:m-.1,_=e.bevelOffset!==void 0?e.bevelOffset:0,p=e.bevelSegments!==void 0?e.bevelSegments:3;const f=e.extrudePath,S=e.UVGenerator!==void 0?e.UVGenerator:km;let v,y=!1,L,b,C,O;f&&(v=f.getSpacedPoints(h),y=!0,d=!1,L=f.computeFrenetFrames(h,!1),b=new R,C=new R,O=new R),d||(p=0,m=0,g=0,_=0);const M=o.extractPoints(c);let w=M.shape;const F=M.holes;if(!Ln.isClockWise(w)){w=w.reverse();for(let P=0,lt=F.length;P<lt;P++){const q=F[P];Ln.isClockWise(q)&&(F[P]=q.reverse())}}const J=Ln.triangulateShape(w,F),D=w;for(let P=0,lt=F.length;P<lt;P++){const q=F[P];w=w.concat(q)}function B(P,lt,q){return lt||console.error("THREE.ExtrudeGeometry: vec does not exist"),P.clone().addScaledVector(lt,q)}const k=w.length,Y=J.length;function $(P,lt,q){let rt,X,wt;const mt=P.x-lt.x,E=P.y-lt.y,x=q.x-P.x,N=q.y-P.y,nt=mt*mt+E*E,tt=mt*N-E*x;if(Math.abs(tt)>Number.EPSILON){const K=Math.sqrt(nt),yt=Math.sqrt(x*x+N*N),ut=lt.x-E/K,vt=lt.y+mt/K,bt=q.x-N/yt,Bt=q.y+x/yt,et=((bt-ut)*N-(Bt-vt)*x)/(mt*N-E*x);rt=ut+mt*et-P.x,X=vt+E*et-P.y;const Yt=rt*rt+X*X;if(Yt<=2)return new at(rt,X);wt=Math.sqrt(Yt/2)}else{let K=!1;mt>Number.EPSILON?x>Number.EPSILON&&(K=!0):mt<-Number.EPSILON?x<-Number.EPSILON&&(K=!0):Math.sign(E)===Math.sign(N)&&(K=!0),K?(rt=-E,X=mt,wt=Math.sqrt(nt)):(rt=mt,X=E,wt=Math.sqrt(nt/2))}return new at(rt/wt,X/wt)}const j=[];for(let P=0,lt=D.length,q=lt-1,rt=P+1;P<lt;P++,q++,rt++)q===lt&&(q=0),rt===lt&&(rt=0),j[P]=$(D[P],D[q],D[rt]);const Z=[];let it,ot=j.concat();for(let P=0,lt=F.length;P<lt;P++){const q=F[P];it=[];for(let rt=0,X=q.length,wt=X-1,mt=rt+1;rt<X;rt++,wt++,mt++)wt===X&&(wt=0),mt===X&&(mt=0),it[rt]=$(q[rt],q[wt],q[mt]);Z.push(it),ot=ot.concat(it)}for(let P=0;P<p;P++){const lt=P/p,q=m*Math.cos(lt*Math.PI/2),rt=g*Math.sin(lt*Math.PI/2)+_;for(let X=0,wt=D.length;X<wt;X++){const mt=B(D[X],j[X],rt);_t(mt.x,mt.y,-q)}for(let X=0,wt=F.length;X<wt;X++){const mt=F[X];it=Z[X];for(let E=0,x=mt.length;E<x;E++){const N=B(mt[E],it[E],rt);_t(N.x,N.y,-q)}}}const W=g+_;for(let P=0;P<k;P++){const lt=d?B(w[P],ot[P],W):w[P];y?(C.copy(L.normals[0]).multiplyScalar(lt.x),b.copy(L.binormals[0]).multiplyScalar(lt.y),O.copy(v[0]).add(C).add(b),_t(O.x,O.y,O.z)):_t(lt.x,lt.y,0)}for(let P=1;P<=h;P++)for(let lt=0;lt<k;lt++){const q=d?B(w[lt],ot[lt],W):w[lt];y?(C.copy(L.normals[P]).multiplyScalar(q.x),b.copy(L.binormals[P]).multiplyScalar(q.y),O.copy(v[P]).add(C).add(b),_t(O.x,O.y,O.z)):_t(q.x,q.y,u/h*P)}for(let P=p-1;P>=0;P--){const lt=P/p,q=m*Math.cos(lt*Math.PI/2),rt=g*Math.sin(lt*Math.PI/2)+_;for(let X=0,wt=D.length;X<wt;X++){const mt=B(D[X],j[X],rt);_t(mt.x,mt.y,u+q)}for(let X=0,wt=F.length;X<wt;X++){const mt=F[X];it=Z[X];for(let E=0,x=mt.length;E<x;E++){const N=B(mt[E],it[E],rt);y?_t(N.x,N.y+v[h-1].y,v[h-1].x+q):_t(N.x,N.y,u+q)}}}Q(),pt();function Q(){const P=i.length/3;if(d){let lt=0,q=k*lt;for(let rt=0;rt<Y;rt++){const X=J[rt];Lt(X[2]+q,X[1]+q,X[0]+q)}lt=h+p*2,q=k*lt;for(let rt=0;rt<Y;rt++){const X=J[rt];Lt(X[0]+q,X[1]+q,X[2]+q)}}else{for(let lt=0;lt<Y;lt++){const q=J[lt];Lt(q[2],q[1],q[0])}for(let lt=0;lt<Y;lt++){const q=J[lt];Lt(q[0]+k*h,q[1]+k*h,q[2]+k*h)}}n.addGroup(P,i.length/3-P,0)}function pt(){const P=i.length/3;let lt=0;Mt(D,lt),lt+=D.length;for(let q=0,rt=F.length;q<rt;q++){const X=F[q];Mt(X,lt),lt+=X.length}n.addGroup(P,i.length/3-P,1)}function Mt(P,lt){let q=P.length;for(;--q>=0;){const rt=q;let X=q-1;X<0&&(X=P.length-1);for(let wt=0,mt=h+p*2;wt<mt;wt++){const E=k*wt,x=k*(wt+1),N=lt+rt+E,nt=lt+X+E,tt=lt+X+x,K=lt+rt+x;Ft(N,nt,tt,K)}}}function _t(P,lt,q){l.push(P),l.push(lt),l.push(q)}function Lt(P,lt,q){St(P),St(lt),St(q);const rt=i.length/3,X=S.generateTopUV(n,i,rt-3,rt-2,rt-1);Ut(X[0]),Ut(X[1]),Ut(X[2])}function Ft(P,lt,q,rt){St(P),St(lt),St(rt),St(lt),St(q),St(rt);const X=i.length/3,wt=S.generateSideWallUV(n,i,X-6,X-3,X-2,X-1);Ut(wt[0]),Ut(wt[1]),Ut(wt[3]),Ut(wt[1]),Ut(wt[2]),Ut(wt[3])}function St(P){i.push(l[P*3+0]),i.push(l[P*3+1]),i.push(l[P*3+2])}function Ut(P){r.push(P.x),r.push(P.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON(),e=this.parameters.shapes,n=this.parameters.options;return Vm(e,n,t)}static fromJSON(t,e){const n=[];for(let r=0,a=t.shapes.length;r<a;r++){const o=e[t.shapes[r]];n.push(o)}const i=t.options.extrudePath;return i!==void 0&&(t.options.extrudePath=new $r[i.type]().fromJSON(i)),new ha(n,t.options)}}const km={generateTopUV:function(s,t,e,n,i){const r=t[e*3],a=t[e*3+1],o=t[n*3],l=t[n*3+1],c=t[i*3],h=t[i*3+1];return[new at(r,a),new at(o,l),new at(c,h)]},generateSideWallUV:function(s,t,e,n,i,r){const a=t[e*3],o=t[e*3+1],l=t[e*3+2],c=t[n*3],h=t[n*3+1],u=t[n*3+2],d=t[i*3],m=t[i*3+1],g=t[i*3+2],_=t[r*3],p=t[r*3+1],f=t[r*3+2];return Math.abs(o-h)<Math.abs(a-c)?[new at(a,1-l),new at(c,1-u),new at(d,1-g),new at(_,1-f)]:[new at(o,1-l),new at(h,1-u),new at(m,1-g),new at(p,1-f)]}};function Vm(s,t,e){if(e.shapes=[],Array.isArray(s))for(let n=0,i=s.length;n<i;n++){const r=s[n];e.shapes.push(r.uuid)}else e.shapes.push(s.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}class Vs extends we{constructor(t=new Zi([new at(0,.5),new at(-.5,-.5),new at(.5,-.5)]),e=12){super(),this.type="ShapeGeometry",this.parameters={shapes:t,curveSegments:e};const n=[],i=[],r=[],a=[];let o=0,l=0;if(Array.isArray(t)===!1)c(t);else for(let h=0;h<t.length;h++)c(t[h]),this.addGroup(o,l,h),o+=l,l=0;this.setIndex(n),this.setAttribute("position",new ie(i,3)),this.setAttribute("normal",new ie(r,3)),this.setAttribute("uv",new ie(a,2));function c(h){const u=i.length/3,d=h.extractPoints(e);let m=d.shape;const g=d.holes;Ln.isClockWise(m)===!1&&(m=m.reverse());for(let p=0,f=g.length;p<f;p++){const S=g[p];Ln.isClockWise(S)===!0&&(g[p]=S.reverse())}const _=Ln.triangulateShape(m,g);for(let p=0,f=g.length;p<f;p++){const S=g[p];m=m.concat(S)}for(let p=0,f=m.length;p<f;p++){const S=m[p];i.push(S.x,S.y,0),r.push(0,0,1),a.push(S.x,S.y)}for(let p=0,f=_.length;p<f;p++){const S=_[p],v=S[0]+u,y=S[1]+u,L=S[2]+u;n.push(v,y,L),l+=3}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON(),e=this.parameters.shapes;return Wm(e,t)}static fromJSON(t,e){const n=[];for(let i=0,r=t.shapes.length;i<r;i++){const a=e[t.shapes[i]];n.push(a)}return new Vs(n,t.curveSegments)}}function Wm(s,t){if(t.shapes=[],Array.isArray(s))for(let e=0,n=s.length;e<n;e++){const i=s[e];t.shapes.push(i.uuid)}else t.shapes.push(s.uuid);return t}class pe extends we{constructor(t=1,e=32,n=16,i=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:i,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));const l=Math.min(a+o,Math.PI);let c=0;const h=[],u=new R,d=new R,m=[],g=[],_=[],p=[];for(let f=0;f<=n;f++){const S=[],v=f/n;let y=0;f===0&&a===0?y=.5/e:f===n&&l===Math.PI&&(y=-.5/e);for(let L=0;L<=e;L++){const b=L/e;u.x=-t*Math.cos(i+b*r)*Math.sin(a+v*o),u.y=t*Math.cos(a+v*o),u.z=t*Math.sin(i+b*r)*Math.sin(a+v*o),g.push(u.x,u.y,u.z),d.copy(u).normalize(),_.push(d.x,d.y,d.z),p.push(b+y,1-v),S.push(c++)}h.push(S)}for(let f=0;f<n;f++)for(let S=0;S<e;S++){const v=h[f][S+1],y=h[f][S],L=h[f+1][S],b=h[f+1][S+1];(f!==0||a>0)&&m.push(v,y,b),(f!==n-1||l<Math.PI)&&m.push(y,L,b)}this.setIndex(m),this.setAttribute("position",new ie(g,3)),this.setAttribute("normal",new ie(_,3)),this.setAttribute("uv",new ie(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new pe(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class Ei extends we{constructor(t=1,e=.4,n=12,i=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:n,tubularSegments:i,arc:r},n=Math.floor(n),i=Math.floor(i);const a=[],o=[],l=[],c=[],h=new R,u=new R,d=new R;for(let m=0;m<=n;m++)for(let g=0;g<=i;g++){const _=g/i*r,p=m/n*Math.PI*2;u.x=(t+e*Math.cos(p))*Math.cos(_),u.y=(t+e*Math.cos(p))*Math.sin(_),u.z=e*Math.sin(p),o.push(u.x,u.y,u.z),h.x=t*Math.cos(_),h.y=t*Math.sin(_),d.subVectors(u,h).normalize(),l.push(d.x,d.y,d.z),c.push(g/i),c.push(m/n)}for(let m=1;m<=n;m++)for(let g=1;g<=i;g++){const _=(i+1)*m+g-1,p=(i+1)*(m-1)+g-1,f=(i+1)*(m-1)+g,S=(i+1)*m+g;a.push(_,p,S),a.push(p,f,S)}this.setIndex(a),this.setAttribute("position",new ie(o,3)),this.setAttribute("normal",new ie(l,3)),this.setAttribute("uv",new ie(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ei(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}}class Rt extends xn{constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new Tt(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Tt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=pl,this.normalScale=new at(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class ua extends oe{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Tt(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),e}}class Xm extends ua{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(oe.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Tt(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const Ur=new ne,Jo=new R,Ko=new R;class qm{constructor(t){this.camera=t,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new at(512,512),this.map=null,this.mapPass=null,this.matrix=new ne,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new ea,this._frameExtents=new at(1,1),this._viewportCount=1,this._viewports=[new Se(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;Jo.setFromMatrixPosition(t.matrixWorld),e.position.copy(Jo),Ko.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Ko),e.updateMatrixWorld(),Ur.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Ur),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Ur)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}class Ym extends qm{constructor(){super(new Rl(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class $m extends ua{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(oe.DEFAULT_UP),this.updateMatrix(),this.target=new oe,this.shadow=new Ym}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}class jm extends ua{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Kr}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Kr);class Zm{constructor(){A(this,"lastRequestId");A(this,"isRunning",!1);A(this,"lastTimestamp",0);A(this,"accumulator",0);A(this,"DEFAULT_FPS",60);A(this,"MIN_FPS",20);A(this,"targetFps",this.DEFAULT_FPS)}get targetFrameTime(){return 1e3/this.targetFps}get maxDeltaTime(){return 1e3/this.MIN_FPS}setTargetFPS(t){this.targetFps=Math.min(Math.max(t,this.MIN_FPS),144)}start(t,e){if(this.isRunning)return;this.isRunning=!0,this.lastTimestamp=performance.now(),this.accumulator=0;const n=i=>{if(!this.isRunning)return;this.lastRequestId=requestAnimationFrame(n);let r=i-this.lastTimestamp;for(this.lastTimestamp=i,r=Math.min(r,this.maxDeltaTime),this.accumulator+=r;this.accumulator>=this.targetFrameTime;)t(this.targetFrameTime/1e3),this.accumulator-=this.targetFrameTime;e()};requestAnimationFrame(n)}stop(){this.isRunning=!1,this.lastRequestId&&(cancelAnimationFrame(this.lastRequestId),this.lastRequestId=void 0)}isActive(){return this.isRunning}}const Xi=class Xi{static detectMobile(){return/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)||window.innerWidth<=768||"ontouchstart"in window}static getPixelRatio(){return this.isMobile?Math.min(window.devicePixelRatio,1.5):Math.min(window.devicePixelRatio,2)}static getShadowEnabled(){return!this.isMobile}static getAntialiasEnabled(){return!this.isMobile}static getMaxEnemies(){return this.isMobile?5:10}static getParticleCount(){return this.isMobile?20:50}static getProjectilePoolSize(){return this.isMobile?100:200}static getTargetFPS(){return this.isMobile?30:60}};A(Xi,"isMobile",Xi.detectMobile()),A(Xi,"DEBUG",!1);let an=Xi;const jt={PLAYER:{PITCH_SPEED:2,YAW_SPEED:1.5,ROLL_SPEED:3,BASE_SPEED:25,MAX_SPEED:50},PROJECTILE:{SPEED:100,MAX_DISTANCE:500},CAMERA:{FOV:75,NEAR:.1,FAR:2e3,OFFSET:{x:0,y:5,z:15},SMOOTH_FACTOR:.1},WORLD:{FOG_NEAR:100,FOG_FAR:1e3},POWERUP:{SPAWN_CHANCE:.4},LEVEL:{START_DELAY:2},MISSILE:{DAMAGE:50,TURN_SPEED:2,MAX_FLIGHT_DISTANCE:2400,STARTING_MISSILES:2,MISSILE_RESPAWN_TIME:7.5,MAX_RESPAWN_MISSILES:10}};class Jm{constructor(){A(this,"scene");A(this,"camera");A(this,"renderer");this.scene=new cm,this.scene.fog=new sa(8900331,jt.WORLD.FOG_NEAR,jt.WORLD.FOG_FAR),this.camera=new $e(jt.CAMERA.FOV,window.innerWidth/window.innerHeight,jt.CAMERA.NEAR,jt.CAMERA.FAR),this.camera.position.set(0,5,10),this.renderer=new Fl({antialias:an.getAntialiasEnabled(),powerPreference:"high-performance"}),this.renderer.setSize(window.innerWidth,window.innerHeight),this.renderer.setPixelRatio(an.getPixelRatio()),this.renderer.shadowMap.enabled=an.getShadowEnabled(),this.renderer.shadowMap.type=il,document.body.appendChild(this.renderer.domElement),this.setupLighting(),this.setupSkybox(),this.setupGround(),this.setupResizeHandler()}setupLighting(){const t=new jm(16777215,.6);this.scene.add(t);const e=new $m(16777215,1);e.position.set(100,100,50),e.castShadow=an.getShadowEnabled(),e.shadow.mapSize.width=2048,e.shadow.mapSize.height=2048,e.shadow.camera.near=.5,e.shadow.camera.far=500,this.scene.add(e);const n=new Xm(8900331,4021340,.4);this.scene.add(n)}setupSkybox(){const t=document.createElement("canvas");t.width=2,t.height=512;const e=t.getContext("2d"),n=e.createLinearGradient(0,0,0,512);n.addColorStop(0,"#1e3c72"),n.addColorStop(.3,"#2a5298"),n.addColorStop(.6,"#87CEEB"),n.addColorStop(1,"#ffffff"),e.fillStyle=n,e.fillRect(0,0,2,512);const i=new ts(t);this.scene.background=i}setupGround(){const t=new Ce(2e3,2e3),e=new Rt({color:4021340,roughness:1,metalness:0}),n=new st(t,e);n.rotation.x=-Math.PI/2,n.position.y=-50,n.receiveShadow=!0,this.scene.add(n)}setupResizeHandler(){window.addEventListener("resize",()=>{this.camera.aspect=window.innerWidth/window.innerHeight,this.camera.updateProjectionMatrix(),this.renderer.setSize(window.innerWidth,window.innerHeight)})}render(){this.renderer.render(this.scene,this.camera)}dispose(){this.renderer.dispose(),this.scene.traverse(t=>{t instanceof st&&(t.geometry.dispose(),Array.isArray(t.material)?t.material.forEach(e=>e.dispose()):t.material.dispose())})}}class Km{constructor(){A(this,"keys",new Set);A(this,"joystickActive",!1);A(this,"joystickX",0);A(this,"joystickY",0);A(this,"joystickTouchId",null);A(this,"firePressed",!1);A(this,"throttlePressed",!1);A(this,"missilePressed",!1);A(this,"isMobile");this.isMobile=an.isMobile,this.setupListeners()}setupListeners(){window.addEventListener("keydown",t=>{this.keys.add(t.code)}),window.addEventListener("keyup",t=>{this.keys.delete(t.code)}),this.isMobile&&this.setupTouchControls()}setupTouchControls(){const t=document.getElementById("joystick"),e=document.getElementById("joystick-knob"),n=document.getElementById("fire-button"),i=document.getElementById("throttle-button"),r=document.getElementById("missile-button");if(!t||!e){console.warn("Joystick elements not found");return}t.addEventListener("touchstart",l=>{if(l.preventDefault(),l.stopPropagation(),l.changedTouches.length===0)return;const c=l.changedTouches[0],h=t.getBoundingClientRect();c.clientX>=h.left&&c.clientX<=h.right&&c.clientY>=h.top&&c.clientY<=h.bottom&&(this.joystickTouchId=c.identifier,this.joystickActive=!0)},{passive:!1});const a=l=>{if(!this.joystickActive||this.joystickTouchId===null)return;l.preventDefault();const c=Array.from(l.touches).find(S=>S.identifier===this.joystickTouchId);if(!c)return;const h=t.getBoundingClientRect();if(!(c.clientX>=h.left&&c.clientX<=h.right&&c.clientY>=h.top&&c.clientY<=h.bottom)){this.joystickActive=!1,this.joystickX=0,this.joystickY=0,this.joystickTouchId=null,e.style.transform="translate(-50%, -50%) translate(0px, 0px)";return}const d=h.left+h.width/2,m=h.top+h.height/2,g=h.width/2;let _=c.clientX-d,p=c.clientY-m;const f=Math.sqrt(_*_+p*p);f>g&&(_=_/f*g,p=p/f*g),e.style.transform=`translate(-50%, -50%) translate(${_}px, ${p}px)`,this.joystickX=_/g,this.joystickY=p/g};document.addEventListener("touchmove",a,{passive:!1});const o=l=>{if(this.joystickTouchId===null)return;Array.from(l.changedTouches).some(h=>h.identifier===this.joystickTouchId)&&(this.joystickActive=!1,this.joystickX=0,this.joystickY=0,this.joystickTouchId=null,e.style.transform="translate(-50%, -50%) translate(0px, 0px)")};document.addEventListener("touchend",o),document.addEventListener("touchcancel",o),n&&(n.addEventListener("touchstart",l=>{l.preventDefault(),this.firePressed=!0},{passive:!1}),n.addEventListener("touchend",()=>{this.firePressed=!1})),i&&(i.addEventListener("touchstart",l=>{l.preventDefault(),this.throttlePressed=!0},{passive:!1}),i.addEventListener("touchend",()=>{this.throttlePressed=!1})),r&&(r.addEventListener("touchstart",l=>{l.preventDefault(),this.missilePressed=!0},{passive:!1}),r.addEventListener("touchend",()=>{this.missilePressed=!1})),document.addEventListener("touchmove",l=>{l.target instanceof Element&&l.target.closest(".mobile-controls")&&l.preventDefault()},{passive:!1})}getState(){return this.isMobile?this.getMobileState():this.getDesktopState()}getMobileState(){return{pitchUp:this.joystickY<-.3,pitchDown:this.joystickY>.3,yawLeft:this.joystickX<-.3,yawRight:this.joystickX>.3,rollLeft:!1,rollRight:!1,fire:this.firePressed,missile:this.missilePressed,throttle:this.throttlePressed}}getDesktopState(){return{pitchUp:this.keys.has("KeyW")||this.keys.has("ArrowUp"),pitchDown:this.keys.has("KeyS")||this.keys.has("ArrowDown"),yawLeft:this.keys.has("KeyA"),yawRight:this.keys.has("KeyD"),rollLeft:this.keys.has("KeyQ"),rollRight:this.keys.has("KeyE"),fire:this.keys.has("Space"),missile:this.keys.has("KeyM")||this.keys.has("ShiftRight"),throttle:this.keys.has("ShiftLeft")||this.keys.has("ControlLeft")}}}class Qm{constructor(t,e){A(this,"aircraft");A(this,"currentSpeed");A(this,"forward");A(this,"autoLevelSpeed",2);A(this,"flameSprite");A(this,"normalFlameSize",3);A(this,"boostFlameSize",5);A(this,"currentFlameSize",3);A(this,"normalFlameColor",new Tt(16746564));A(this,"boostFlameColor",new Tt(16755200));A(this,"flameColor",new Tt);this.aircraft=t,this.currentSpeed=jt.PLAYER.BASE_SPEED,this.forward=new R;const n=this.createFlameTexture(),i=new ji({map:n,color:16746564,transparent:!0,opacity:.8,blending:qi,depthWrite:!1});this.flameSprite=new Bl(i),this.flameSprite.scale.set(this.normalFlameSize,this.normalFlameSize,1),this.flameSprite.position.set(0,-.2,2.8),this.aircraft.add(this.flameSprite)}createFlameTexture(){const e=document.createElement("canvas");e.width=128,e.height=128;const n=e.getContext("2d");if(!n)throw new Error("Failed to get 2D context for flame texture");const i=128/2,r=128/2,a=128/2,o=n.createRadialGradient(i,r,0,i,r,a);o.addColorStop(0,"rgba(255, 255, 255, 1)"),o.addColorStop(.15,"rgba(255, 200, 100, 0.9)"),o.addColorStop(.4,"rgba(255, 120, 0, 0.6)"),o.addColorStop(.7,"rgba(200, 50, 0, 0.3)"),o.addColorStop(1,"rgba(100, 0, 0, 0)"),n.fillStyle=o,n.fillRect(0,0,128,128);const l=new ts(e);return l.needsUpdate=!0,l}update(t,e){const n=e.pitchUp||e.pitchDown||e.yawLeft||e.yawRight||e.rollLeft||e.rollRight;if(e.throttle?this.currentSpeed=Math.min(jt.PLAYER.MAX_SPEED,this.currentSpeed+20*t):this.currentSpeed=Math.max(jt.PLAYER.BASE_SPEED*.5,this.currentSpeed-10*t),e.pitchUp&&this.aircraft.rotateX(jt.PLAYER.PITCH_SPEED*t),e.pitchDown&&this.aircraft.rotateX(-2*t),e.yawLeft&&this.aircraft.rotateY(jt.PLAYER.YAW_SPEED*t),e.yawRight&&this.aircraft.rotateY(-1.5*t),e.rollLeft&&this.aircraft.rotateZ(jt.PLAYER.ROLL_SPEED*t),e.rollRight&&this.aircraft.rotateZ(-3*t),!n){const a=new R(1,0,0);a.applyQuaternion(this.aircraft.quaternion);const o=a.y;if(Math.abs(o)>.01){const l=this.autoLevelSpeed*t,c=Math.sign(o)*-Math.min(l,Math.abs(o));this.aircraft.rotateZ(c)}}this.forward.set(0,0,-1),this.forward.applyQuaternion(this.aircraft.quaternion),this.aircraft.position.addScaledVector(this.forward,this.currentSpeed*t);const i=e.throttle?this.boostFlameSize:this.normalFlameSize,r=e.throttle?this.boostFlameColor:this.normalFlameColor;this.currentFlameSize+=(i-this.currentFlameSize)*8*t,this.flameColor.lerp(r,5*t),this.flameSprite.scale.set(this.currentFlameSize,this.currentFlameSize,1),this.flameSprite.material instanceof ji&&this.flameSprite.material.color.copy(this.flameColor)}getPosition(){return this.aircraft.position.clone()}getQuaternion(){return this.aircraft.quaternion.clone()}getSpeed(){return this.currentSpeed}getAircraft(){return this.aircraft}dispose(){this.flameSprite&&(this.aircraft.remove(this.flameSprite),this.flameSprite.material instanceof xn&&this.flameSprite.material.dispose())}}class tg{constructor(t,e,n){A(this,"camera");A(this,"target");A(this,"offset");A(this,"currentPosition");A(this,"smoothFactor");this.camera=t,this.target=e,this.offset=n||new R(jt.CAMERA.OFFSET.x,jt.CAMERA.OFFSET.y,jt.CAMERA.OFFSET.z),this.currentPosition=new R,this.smoothFactor=jt.CAMERA.SMOOTH_FACTOR}update(){const t=this.offset.clone();t.applyQuaternion(this.target.quaternion),t.add(this.target.position),this.currentPosition.lerp(t,this.smoothFactor),this.camera.position.copy(this.currentPosition),this.camera.lookAt(this.target.position)}setSmoothFactor(t){this.smoothFactor=Math.max(0,Math.min(1,t))}}class Qo{constructor(t){A(this,"pool",[]);A(this,"maxDistance");A(this,"scene");this.scene=t,this.maxDistance=jt.PROJECTILE.MAX_DISTANCE;const e=an.getProjectilePoolSize(),n=new pe(.3,8,8),i=new fe({color:16776960,transparent:!0,opacity:.9});for(let r=0;r<e;r++){const a=new st(n,i.clone());a.visible=!1,this.scene.add(a),this.pool.push({mesh:a,direction:new R,speed:jt.PROJECTILE.SPEED,active:!1,startPosition:new R,damage:10})}}fire(t,e,n,i,r){const a=this.pool.find(o=>!o.active);a&&(a.mesh.position.copy(t),a.direction.copy(e).normalize(),a.startPosition.copy(t),a.damage=n,a.owner=i,a.mesh.userData.faction=r,a.mesh.visible=!0,a.active=!0)}update(t){for(const e of this.pool){if(!e.active)continue;e.mesh.position.addScaledVector(e.direction,e.speed*t),e.mesh.position.distanceTo(e.startPosition)>this.maxDistance&&this.deactivate(e)}}checkCollisions(t,e){for(const n of this.pool)if(n.active)for(const i of t){if(!i.visible||n.owner&&i===n.owner)continue;if(n.mesh.position.distanceTo(i.position)<5){e(i,n.mesh,n.damage),this.deactivate(n);break}}}deactivate(t){t.mesh.visible=!1,t.active=!1}getActiveProjectiles(){return this.pool.filter(t=>t.active).map(t=>t.mesh)}}class Yl{constructor(t=100){A(this,"maxHealth");A(this,"currentHealth");A(this,"isDead",!1);A(this,"onDamage");A(this,"onDeath");this.maxHealth=t,this.currentHealth=t}takeDamage(t){this.isDead||(this.currentHealth=Math.max(0,this.currentHealth-t),this.onDamage&&this.onDamage(t,this.currentHealth),this.currentHealth<=0&&(this.isDead=!0,this.onDeath&&this.onDeath()))}heal(t){this.isDead||(this.currentHealth=Math.min(this.maxHealth,this.currentHealth+t))}getHealthPercent(){return this.currentHealth/this.maxHealth}getCurrentHealth(){return this.currentHealth}getMaxHealth(){return this.maxHealth}isEntityDead(){return this.isDead}reset(){this.currentHealth=this.maxHealth,this.isDead=!1}}class $l{constructor(t){A(this,"scene");A(this,"particles",[]);A(this,"particleMeshes");A(this,"maxParticles");A(this,"geometries",new Map);A(this,"materials",new Map);this.scene=t,this.particleMeshes=new he,this.particleMeshes.name="particles",this.scene.add(this.particleMeshes),this.maxParticles=an.isMobile?200:500,this.initAssets()}initAssets(){this.geometries.set("EXPLOSION",new pe(.5,8,8)),this.materials.set("EXPLOSION",new fe({color:16737792,transparent:!0,opacity:1})),this.geometries.set("SMOKE",new pe(1,8,8)),this.materials.set("SMOKE",new fe({color:8947848,transparent:!0,opacity:.6})),this.geometries.set("SPARK",new pe(.1,4,4)),this.materials.set("SPARK",new fe({color:16776960,transparent:!0,opacity:1})),this.geometries.set("FIRE",new pe(.3,8,8)),this.materials.set("FIRE",new fe({color:16729088,transparent:!0,opacity:.9})),this.geometries.set("DEBRIS",new Oe(.3,.3,.3)),this.materials.set("DEBRIS",new fe({color:6710886}))}createExplosion(t,e=1){const n=Math.floor(30*e);for(let i=0;i<n*.4;i++)this.spawnParticle("FIRE",t.clone(),{speed:20*e,life:.3+Math.random()*.3,size:.5+Math.random()*1.5,color:new Tt().setHSL(.05+Math.random()*.1,1,.5)});for(let i=0;i<n*.3;i++)this.spawnParticle("EXPLOSION",t.clone(),{speed:30*e,life:.2+Math.random()*.4,size:.3+Math.random()*1,color:new Tt().setHSL(.08,1,.6)});for(let i=0;i<n*.2;i++)this.spawnParticle("SPARK",t.clone(),{speed:50*e,life:.5+Math.random()*.5,size:.1+Math.random()*.2,color:new Tt(16776960)});for(let i=0;i<n*.1;i++)this.spawnParticle("DEBRIS",t.clone(),{speed:15*e,life:1+Math.random()*1,size:.2+Math.random()*.3,color:new Tt(6710886),gravity:!0});setTimeout(()=>{for(let i=0;i<n*.3;i++)this.spawnParticle("SMOKE",t.clone(),{speed:5*e,life:2+Math.random()*2,size:2+Math.random()*3,color:new Tt().setHSL(0,0,.3+Math.random()*.3)})},100)}createHit(t){for(let e=0;e<10;e++)this.spawnParticle("SPARK",t.clone(),{speed:20,life:.2+Math.random()*.3,size:.1+Math.random()*.2,color:new Tt(16755200)})}createTrail(t,e){this.spawnParticle("SMOKE",t.clone(),{speed:2,life:.3,size:.3,color:e.clone()})}spawnParticle(t,e,n){if(this.particles.length>=this.maxParticles){const u=this.particles.shift();u!=null&&u.mesh&&this.particleMeshes.remove(u.mesh)}const r=new R((Math.random()-.5)*2,(Math.random()-.5)*2,(Math.random()-.5)*2).normalize().multiplyScalar(n.speed),a=this.geometries.get(t),o=this.materials.get(t);if(!a||!o)return;const l=o.clone();l.color=n.color;const c=new st(a,l);c.position.copy(e),c.scale.setScalar(n.size),this.particleMeshes.add(c);const h={position:e.clone(),velocity:r,life:n.life,maxLife:n.life,size:n.size,color:n.color,type:t,mesh:c,active:!0};this.particles.push(h)}update(t){const e=new R(0,-9.8,0);for(let n=this.particles.length-1;n>=0;n--){const i=this.particles[n];if(i.active){if(i.life-=t,i.life<=0){i.mesh&&(this.particleMeshes.remove(i.mesh),i.mesh.geometry.dispose(),i.mesh.material.dispose()),this.particles.splice(n,1);continue}if(i.velocity.add(e.clone().multiplyScalar(t*.3)),i.position.add(i.velocity.clone().multiplyScalar(t)),i.mesh){i.mesh.position.copy(i.position);const r=i.life/i.maxLife,a=i.mesh.material;if(a.opacity=r,i.type==="SMOKE"){const o=i.size*(1+(1-r)*2);i.mesh.scale.setScalar(o)}i.type==="DEBRIS"&&(i.mesh.rotation.x+=t*5,i.mesh.rotation.y+=t*3)}}}}clear(){for(const t of this.particles)t.mesh&&(this.particleMeshes.remove(t.mesh),t.mesh.geometry.dispose(),t.mesh.material.dispose());this.particles=[]}getActiveCount(){return this.particles.length}}class eg{constructor(t,e,n,i,r=[]){A(this,"mesh");A(this,"velocity");A(this,"target");A(this,"active",!0);A(this,"lifetime",0);A(this,"maxLifetime",10);A(this,"turnSpeed",jt.MISSILE.TURN_SPEED);A(this,"speed",80);A(this,"trail",null);A(this,"particleSystem");A(this,"startPosition");A(this,"maxFlightDistance",jt.MISSILE.MAX_FLIGHT_DISTANCE);A(this,"enemies",[]);this.particleSystem=i,this.target=n,this.enemies=r,this.startPosition=e.clone(),this.mesh=new he;const a=new Me(.4,2.5,16),o=new Rt({color:16729156,emissive:16711680,emissiveIntensity:.5,metalness:.8,roughness:.2}),l=new st(a,o);l.rotation.x=-Math.PI/2,this.mesh.add(l);const c=new Me(.25,2,16),h=new fe({color:16768256,transparent:!0,opacity:1});if(this.trail=new st(c,h),this.trail.rotation.x=-Math.PI/2,this.trail.position.z=1.5,this.mesh.add(this.trail),this.mesh.position.copy(e),t.add(this.mesh),this.velocity=new R,this.active=!0,this.target){const u=new R().subVectors(this.target.position,e).normalize();this.velocity.copy(u).multiplyScalar(this.speed)}else this.velocity.set(0,0,-this.speed);if(this.velocity.length()>0){const u=this.mesh.position.clone().add(this.velocity);this.mesh.lookAt(u)}}update(t){if(this.lifetime+=t,this.mesh.position.distanceTo(this.startPosition)>this.maxFlightDistance){this.active=!1;return}if(this.lifetime>this.maxLifetime){if(this.target&&this.target.parent){const n=new Tt(16737792);this.particleSystem.createTrail(this.mesh.position.clone(),n)}this.active=!1;return}if(!this.target||this.target&&!this.target.parent){const n=this.findNearestEnemy();n&&(this.target=n,console.log("导弹重新锁定目标"))}if(this.target&&this.target.parent&&this.huntTarget(t),this.mesh.position.add(this.velocity.clone().multiplyScalar(t)),this.velocity.length()>0){const n=this.mesh.position.clone().add(this.velocity),i=new oe;i.position.copy(this.mesh.position),i.lookAt(n),this.mesh.quaternion.slerp(i.quaternion,.3)}if(this.active){const n=this.mesh.position.clone(),i=this.velocity.clone().normalize().multiplyScalar(-1.5);n.add(i);const r=new Tt().setHSL(.08+Math.random()*.03,1,.6);this.particleSystem.createTrail(n,r)}}huntTarget(t){if(!this.target)return;const e=new R().subVectors(this.target.position,this.mesh.position).normalize(),n=this.velocity.clone().normalize(),i=this.turnSpeed*t,r=Math.atan2(e.x,e.z),a=Math.atan2(n.x,n.z);let o=r-a;for(;o>Math.PI;)o-=Math.PI*2;for(;o<-Math.PI;)o+=Math.PI*2;o=Math.max(-i,Math.min(i,o));const l=a+o;this.velocity.set(Math.sin(l)*this.speed,e.y*this.speed,Math.cos(l)*this.speed)}findNearestEnemy(){let t=null,e=1/0;for(const n of this.enemies){if(!n.parent)continue;const i=this.mesh.position.distanceTo(n.position);i<e&&(e=i,t=n)}return t}setTarget(t){this.target=t}updateEnemies(t){this.enemies=t}dispose(t){t.remove(this.mesh),this.active=!1}}class ng{constructor(t,e){A(this,"scene");A(this,"particleSystem");A(this,"missiles",[]);A(this,"enemies",[]);this.scene=t,this.particleSystem=e||new $l(t)}updateEnemies(t){this.enemies=t;for(const e of this.missiles)e.updateEnemies(t)}fire(t,e,n){const i=new eg(this.scene,t,n||null,this.particleSystem,this.enemies);this.missiles.push(i)}update(t){for(const e of this.missiles)e.active&&e.update(t);this.missiles=this.missiles.filter(e=>e.active?!0:(e.dispose(this.scene),!1))}checkCollisions(t,e){for(const n of this.missiles)if(n.active)for(const i of t){if(!i.parent)continue;if(n.mesh.position.distanceTo(i.position)<2){n.active=!1,e(i);break}}}getActiveCount(){return this.missiles.filter(t=>t.active).length}dispose(){for(const t of this.missiles)t.dispose(this.scene);this.missiles=[]}}class ig{constructor(){A(this,"container");A(this,"healthBarContainer");A(this,"healthBarFill");A(this,"healthText");A(this,"scoreDisplay");A(this,"speedDisplay");A(this,"enemiesDisplay");A(this,"remainingEnemiesDisplay");A(this,"livesDisplay");A(this,"missilesDisplay");A(this,"missileProgressDisplay");A(this,"missileProgressFill");A(this,"powerUpDisplay");A(this,"powerUpBigDisplay");A(this,"gameOverDisplay");A(this,"powerUpTimer",0);A(this,"activePowerUpDuration",0);A(this,"powerUpBigTimer",0);this.container=document.createElement("div"),this.container.id="hud";const t=an.isMobile,e=t?"10px":"20px",n=t?"16px":"20px";this.container.style.cssText=`
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
    `,this.missilesDisplay.textContent="导弹: 🚀🚀";const i=t?120:144;this.missileProgressDisplay=document.createElement("div"),this.missileProgressDisplay.style.cssText=`
      position: absolute;
      top: ${i}px;
      right: ${e};
      width: ${t?"100px":"120px"};
      height: 6px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.5);
    `,this.missileProgressFill=document.createElement("div"),this.missileProgressFill.style.cssText=`
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #ffffff, #e0e0e0);
      transition: width 0.5s ease-out;
    `,this.missileProgressDisplay.appendChild(this.missileProgressFill),this.powerUpDisplay=document.createElement("div"),this.powerUpDisplay.style.cssText=`
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
    `,this.powerUpDisplay.textContent="",this.powerUpBigDisplay=document.createElement("div"),this.powerUpBigDisplay.style.cssText=`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 80;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    `,this.powerUpBigDisplay.innerHTML=`
      <div class="powerup-big-icon" style="
        font-size: ${t?"120px":"150px"};
        text-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 215, 0, 0.4);
        margin-bottom: 20px;
        animation: bounce 0.5s ease-out;
      "></div>
      <div class="powerup-big-text" style="
        font-size: ${t?"48px":"64px"};
        font-weight: bold;
        color: #ffff00;
        text-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 4px 4px 8px rgba(0, 0, 0, 1);
        white-space: nowrap;
      "></div>
      <div class="powerup-big-subtext" style="
        font-size: ${t?"24px":"32px"};
        font-weight: bold;
        color: #ffffff;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 1);
        margin-top: 10px;
        white-space: nowrap;
      ">获得道具！</div>
    `,this.gameOverDisplay=document.createElement("div"),this.gameOverDisplay.style.cssText=`
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
    `,this.container.appendChild(this.healthBarContainer),this.container.appendChild(this.healthText),this.container.appendChild(this.scoreDisplay),this.container.appendChild(this.speedDisplay),this.container.appendChild(this.enemiesDisplay),this.container.appendChild(this.livesDisplay),this.container.appendChild(this.missilesDisplay),this.container.appendChild(this.missileProgressDisplay),this.container.appendChild(this.powerUpDisplay),document.body.appendChild(this.container),document.body.appendChild(this.powerUpBigDisplay),document.body.appendChild(this.gameOverDisplay)}createHealthText(t){const e=document.createElement("span");return e.className="health-text",e.style.cssText=`
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
    `,e.appendChild(this.healthBarFill),e}updateHealth(t){this.healthBarFill.style.width=`${t*100}%`,this.healthText.textContent=`${Math.ceil(t*100)}`;let e,n="#ffffff";t>.6?e="linear-gradient(90deg, #00ff66, #00ff33, #00cc00)":t>.3?(e="linear-gradient(90deg, #ffcc00, #ffdd00, #88aa00)",n="#ffdd00"):t>.15?(e="linear-gradient(90deg, #ff9900, #ffcc00, #ffaa00)",n="#ffaa00"):(e="linear-gradient(90deg, #ff3300, #cc0000, #ff0000)",n="#ff0000"),this.healthBarFill.style.background=e,this.healthText.style.color=n}updateScore(t){this.scoreDisplay.textContent=`分数: ${t}`}updateSpeed(t){const e=Math.round(t*10);this.speedDisplay.textContent=`速度: ${e} km/h`}updateEnemies(t){this.enemiesDisplay.textContent=`敌人: ${t}`}updateRemainingEnemies(t){this.remainingEnemiesDisplay.textContent=`剩余: ${t}`}updateLives(t){const e="❤️".repeat(Math.max(0,t))+"🖤".repeat(Math.max(0,3-t));this.livesDisplay.textContent=`生命: ${e}`}updateMissiles(t){const n="🚀".repeat(Math.max(0,t))+"⬜".repeat(Math.max(0,10-t));this.missilesDisplay.textContent=`导弹: ${n}`}updateMissileProgress(t){const e=Math.max(0,Math.min(1,t));this.missileProgressFill.style.width=`${e*100}%`}showPowerUp(t,e,n=0){if(n<=0){this.hidePowerUp();return}this.activePowerUpDuration=n,this.powerUpTimer=n,this.powerUpDisplay.style.opacity="1",this.powerUpDisplay.textContent=`${e} ${t} ${Math.ceil(n)}`}update(t){if(this.activePowerUpDuration>0&&this.powerUpTimer>0){this.powerUpTimer-=t;const e=Math.max(0,Math.ceil(this.powerUpTimer)),n=this.powerUpDisplay.textContent.lastIndexOf(" ");n!==-1&&(this.powerUpDisplay.textContent=this.powerUpDisplay.textContent.substring(0,n)+" "+e),this.powerUpTimer<=0&&this.hidePowerUp()}this.powerUpBigTimer>0&&(this.powerUpBigTimer-=t,this.powerUpBigTimer<=0&&this.hidePowerUpBig())}hidePowerUp(){this.powerUpDisplay.style.opacity="0",this.activePowerUpDuration=0,this.powerUpTimer=0}showPowerUpBig(t,e,n=1){const i=this.powerUpBigDisplay.querySelector(".powerup-big-icon"),r=this.powerUpBigDisplay.querySelector(".powerup-big-text");i&&(i.textContent=t),r&&(r.textContent=e),this.powerUpBigDisplay.style.opacity="1",this.powerUpBigTimer=n}hidePowerUpBig(){this.powerUpBigDisplay.style.opacity="0",this.powerUpBigTimer=0}hide(){this.container.style.display="none"}show(){this.container.style.display="block"}showGameOver(t){const e=this.gameOverDisplay.querySelector("#final-score");e&&(e.textContent=`最终得分: ${t}`),this.gameOverDisplay.style.opacity="1",this.gameOverDisplay.style.pointerEvents="auto"}hideGameOver(){this.gameOverDisplay.style.opacity="0",this.gameOverDisplay.style.pointerEvents="none"}}class sg{constructor(){A(this,"container");A(this,"settingsContainer");A(this,"onStart");A(this,"settings",{difficulty:1,soundVolume:.7,playerLives:3,startLevel:1});this.container=this.createContainer(),this.settingsContainer=this.createSettingsPanel(),this.container.appendChild(this.settingsContainer),document.body.appendChild(this.container)}createContainer(){const t=document.createElement("div");return t.id="start-menu",t.innerHTML=`
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
    `,t}createSettingsPanel(){const t=document.createElement("div");t.className="settings-panel";const e=this.createSettingRow("难度",this.getDifficultyText(this.settings.difficulty),()=>{this.settings.difficulty=Math.max(1,this.settings.difficulty-1),this.updateDisplay()},()=>{this.settings.difficulty=Math.min(5,this.settings.difficulty+1),this.updateDisplay()});e.id="difficulty-row";const n=this.createSettingRow("音效音量",`${Math.round(this.settings.soundVolume*100)}%`,()=>{this.settings.soundVolume=Math.max(0,this.settings.soundVolume-.1),this.updateDisplay()},()=>{this.settings.soundVolume=Math.min(1,this.settings.soundVolume+.1),this.updateDisplay()});n.id="sound-row";const i=this.createSettingRow("生命数",`${this.settings.playerLives}`,()=>{this.settings.playerLives=Math.max(1,this.settings.playerLives-1),this.updateDisplay()},()=>{this.settings.playerLives=Math.min(9,this.settings.playerLives+1),this.updateDisplay()});i.id="lives-row";const r=this.createSettingRow("起始关卡",`第${this.settings.startLevel}关`,()=>{this.settings.startLevel=Math.max(1,this.settings.startLevel-1),this.updateDisplay()},()=>{this.settings.startLevel=Math.min(5,this.settings.startLevel+1),this.updateDisplay()});r.id="level-row",t.appendChild(e),t.appendChild(n),t.appendChild(i),t.appendChild(r),t.appendChild(i);const a=document.createElement("button");a.className="start-btn",a.textContent="🎮 开始游戏",a.onclick=()=>this.startGame(),t.appendChild(a);const o=document.createElement("div");return o.className="controls-info",o.innerHTML=`
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
    `,t.appendChild(o),t}createSettingRow(t,e,n,i){const r=document.createElement("div");r.className="setting-row";const a=document.createElement("span");a.className="setting-label",a.textContent=t;const o=document.createElement("div");o.className="setting-control";const l=document.createElement("button");l.className="setting-btn",l.textContent="-",l.onclick=n;const c=document.createElement("span");c.className="setting-value",c.textContent=e,c.id=`${t.toLowerCase()}-value`;const h=document.createElement("button");return h.className="setting-btn",h.textContent="+",h.onclick=i,o.appendChild(l),o.appendChild(c),o.appendChild(h),r.appendChild(a),r.appendChild(o),r}getDifficultyText(t){return["简单","普通","困难","专家","地狱"][t-1]}updateDisplay(){const t=document.getElementById("难度-value")||document.querySelector("#difficulty-row .setting-value"),e=document.getElementById("音效音量-value")||document.querySelector("#sound-row .setting-value"),n=document.getElementById("生命数-value")||document.querySelector("#lives-row .setting-value"),i=document.getElementById("起始关卡-value")||document.querySelector("#level-row .setting-value");t&&(t.textContent=this.getDifficultyText(this.settings.difficulty)),e&&(e.textContent=`${Math.round(this.settings.soundVolume*100)}%`),n&&(n.textContent=`${this.settings.playerLives}`),i&&(i.textContent=`第${this.settings.startLevel}关`)}startGame(){var t;this.container.style.display="none",(t=this.onStart)==null||t.call(this,this.settings)}setOnStart(t){this.onStart=t}show(){this.container.style.display="flex"}hide(){this.container.style.display="none"}}class rg{constructor(){A(this,"container");A(this,"healthBars",new Map);this.container=document.createElement("div"),this.container.id="enemy-health-bars",this.container.style.cssText=`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 35;
    `,document.body.appendChild(this.container)}update(t,e,n,i){const r=new Set(t.map(l=>l.mesh.uuid)),a=new Set(e.map(l=>l.mesh.uuid)),o=new Set([...r,...a]);for(const[l]of this.healthBars)o.has(l)||this.removeHealthBar(l);for(const l of t)this.updateOrCreateHealthBar(l,n,i,!1);for(const l of e)this.updateOrCreateHealthBar(l,n,i,!0)}updateOrCreateHealthBar(t,e,n,i=!1){const r=t.mesh.uuid;let a=this.healthBars.get(r);const o=this.worldToScreen(t.mesh.position.clone(),e);a&&(a.screenPos={x:o.x,y:o.y});const l=o.x>=0&&o.x<=1&&o.y>=0&&o.y<=1&&o.z<1;if(!a){const u=this.createHealthBar(),d=this.createBackgroundBar(60),m=this.createTargetName(i),g=i?null:this.createArrowIndicator();u.appendChild(d),u.appendChild(m),this.container.appendChild(u),g&&this.container.appendChild(g),a={bar:u,background:d,targetName:m,arrow:g,screenPos:null},this.healthBars.set(r,a)}const c=t.currentHealth/t.maxHealth,h=this.getHealthColor(c);if(l){a.bar.style.display="block",a.arrow&&(a.arrow.style.display="none");const{x:m,y:g}=this.calculateBarPosition(t.mesh,e,60,6);a.bar.style.left=`${m}px`,a.bar.style.top=`${g}px`,a.background.style.background=h,a.background.style.width=`${60*c}px`;const _=this.getTargetName(t.mesh,i);a.targetName.textContent=_;const f=(60-a.targetName.offsetWidth)/2;a.targetName.style.left=`${f}px`}else if(a.bar.style.display="none",a.arrow){a.arrow.style.display="block";const u=n.distanceTo(t.mesh.position),d=t.mesh.position.clone().sub(n),g=new R(1,0,0).applyQuaternion(e.quaternion).dot(d)>0;this.updateArrowIndicator(a.arrow,o,u,g)}}createHealthBar(){const t=document.createElement("div");return t.className="enemy-health-bar",t.style.cssText=`
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
    `,e}createTargetName(t=!1){const e=document.createElement("span");return e.className="enemy-name",e.style.cssText=`
      font-size: 12px;
      font-weight: bold;
      white-space: nowrap;
      position: absolute;
      bottom: 100%; /* 在血条上方 */
      left: 0; /* 将由 JavaScript 动态计算居中 */
      margin-bottom: 4px; /* 距离血条4px */
      color: ${t?"#ffff00":"#ffffff"}; /* 友军黄色，敌人白色 */
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9), /* 更强的阴影 */
                   -1px -1px 2px rgba(0, 0, 0, 0.8);
    `,e}createArrowIndicator(){const t=document.createElement("div");t.className="enemy-arrow-indicator",t.style.cssText=`
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
    `,n.textContent="",t.appendChild(n),t}updateArrowIndicator(t,e,n,i){const o=e.y-.5,l=.08;let c,h;i?(c=1-l,h=Math.max(l,Math.min(1-l,.5+o))):(c=l,h=Math.max(l,Math.min(1-l,.5+o)));const u=c-.5,d=h-.5,m=Math.atan2(d,u)*(180/Math.PI);t.style.left=`${c*100}%`,t.style.top=`${h*100}%`,t.style.transform=`translate(-50%, -50%) rotate(${m+90}deg)`;const g=t.querySelector("div");g&&(g.style.borderBottomColor="#ffff00");const _=t.querySelector(".arrow-distance-label");_&&(_.textContent=`${Math.round(n)}m`,_.style.transform="none")}worldToScreen(t,e){const n=t.clone();return n.project(e),{x:(n.x+1)/2,y:1-(n.y+1)/2,z:n.z}}getHealthColor(t){return t>.6?"linear-gradient(90deg, #00ff66, #00ff33, #00cc00)":t>.3?"linear-gradient(90deg, #ffcc00, #ffdd00, #88aa00)":t>.15?"linear-gradient(90deg, #ff9900, #ffcc00, #ffaa00)":"linear-gradient(90deg, #ff3300, #cc0000, #ff0000)"}getEnemyName(t){const e=t.name||"";return e.includes("Scout")?"SCOUT":e.includes("Fighter")?"FIGHTER":e.includes("Heavy")?"HEAVY":e.includes("Sniper")?"SNIPER":e.includes("Ace")?"ACE":"ENEMY"}getTargetName(t,e){if(e){const i=(t.name||"").replace("-friendly","");return i.includes("Scout")?"SCOUT":i.includes("Fighter")?"FIGHTER":i.includes("Heavy")?"HEAVY":i.includes("Sniper")?"SNIPER":i.includes("Ace")?"ACE":i||"UNKNOWN"}return this.getEnemyName(t)}calculateBarPosition(t,e,n,i){const r=t.position.clone();r.y+=2;const a=this.worldToScreen(r,e),o=n/2,l=i+15;return{x:a.x*window.innerWidth-o,y:a.y*window.innerHeight-l}}removeHealthBar(t){const e=this.healthBars.get(t);e&&(e.bar.remove(),e.arrow&&e.arrow.remove(),this.healthBars.delete(t))}clear(){for(const t of this.healthBars.values())t.bar.remove();this.healthBars.clear(),this.container.remove()}getFirstEnemyScreenPos(){for(const t of this.healthBars.values())if(t.screenPos&&t.bar.style.display!=="none")return t.screenPos;return null}}class ag{constructor(){A(this,"container");A(this,"lockCircle");A(this,"lockProgress");A(this,"noMissileLabel");A(this,"isLockingOn",!1);A(this,"currentTarget",null);A(this,"lockProgressValue",0);A(this,"lockTime",.8);A(this,"lockedTarget",null);A(this,"centerX",window.innerWidth/2);A(this,"centerY",window.innerHeight/2);A(this,"lockCircleSize",0);this.container=document.createElement("div"),this.container.id="lock-on-indicator",this.container.style.cssText=`
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
    `,this.noMissileLabel.textContent="NO MISSILE",this.container.appendChild(this.noMissileLabel),this.container.appendChild(this.lockProgress),this.container.appendChild(this.lockCircle),document.body.appendChild(this.container),this.updateLockCircleSize(),window.addEventListener("resize",()=>{this.centerX=window.innerWidth/2,this.centerY=window.innerHeight/2,this.updateLockCircleSize()})}updateLockCircleSize(){this.lockCircleSize=Math.min(window.innerWidth,window.innerHeight)*.3,this.lockCircle.style.width=`${this.lockCircleSize}px`,this.lockCircle.style.height=`${this.lockCircleSize}px`}startLockOn(){this.isLockingOn=!0,this.lockProgressValue=0,this.currentTarget=null,this.lockedTarget=null,this.container.style.display="block",this.noMissileLabel.style.display="none",this.lockCircle.style.display="block",this.lockCircle.style.borderColor="rgba(255, 200, 0, 0.8)",this.lockCircle.style.backgroundColor="rgba(255, 200, 0, 0.1)",this.lockProgress.style.display="none"}cancelLockOn(){this.isLockingOn=!1,this.currentTarget=null,this.lockedTarget=null,this.lockProgressValue=0,this.container.style.display="none"}setNoMissiles(t){t?(this.container.style.display="block",this.lockCircle.style.display="none",this.lockProgress.style.display="none",this.noMissileLabel.style.display="block",this.isLockingOn=!1):(this.noMissileLabel.style.display="none",this.isLockingOn&&(this.lockCircle.style.display="block"))}onMissileFired(){this.cancelLockOn()}update(t,e,n,i,r){if(!this.isLockingOn)return!1;const a=this.lockCircleSize/2,o=jt.MISSILE.MAX_FLIGHT_DISTANCE/2;if(this.lockedTarget){if(!this.lockedTarget.parent)return this.lockedTarget=null,this.currentTarget=null,this.lockProgressValue=Math.max(0,this.lockProgressValue-i*3),this.updateLockProgress(null),!1;const h=this.worldToScreenPixels(this.lockedTarget.position,n);if(!h)return this.lockedTarget=null,this.currentTarget=null,this.lockProgressValue=Math.max(0,this.lockProgressValue-i*3),this.updateLockProgress(null),!1;if(t.distanceTo(this.lockedTarget.position)>o)return this.lockedTarget=null,this.currentTarget=null,this.lockProgressValue=Math.max(0,this.lockProgressValue-i*3),this.updateLockProgress(null),!1;const d=h.x-this.centerX,m=h.y-this.centerY;if(Math.sqrt(d*d+m*m)>a)return this.lockedTarget=null,this.currentTarget=null,this.lockProgressValue=Math.max(0,this.lockProgressValue-i*3),this.updateLockProgress(null),!1;this.lockProgressValue+=i/this.lockTime;const _={x:h.x/window.innerWidth,y:h.y/window.innerHeight};return this.updateLockProgress(_),this.lockProgressValue>=1?(this.lockProgressValue=1,this.onLockComplete(),!0):!1}let l=null,c=1/0;for(const h of e){const u=t.distanceTo(h.position);if(u>o)continue;const d=this.worldToScreenPixels(h.position,n);if(!d)continue;const m=d.x-this.centerX,g=d.y-this.centerY;Math.sqrt(m*m+g*g)>a||u<c&&(c=u,l=h)}return l?(this.lockedTarget=l,this.currentTarget=l):this.updateLockProgress(null),!1}worldToScreenPixels(t,e){const n=t.clone();return n.project(e),n.z>1?null:{x:(n.x+1)/2*window.innerWidth,y:-(n.y-1)/2*window.innerHeight}}updateLockProgress(t){if(this.lockProgressValue>=1&&t){const e=t.x*window.innerWidth,n=t.y*window.innerHeight;this.lockProgress.style.display="block",this.lockProgress.style.left=`${e}px`,this.lockProgress.style.top=`${n}px`,this.lockProgress.style.width="40px",this.lockProgress.style.height="40px",this.lockProgress.style.border="3px solid #00ff00",this.lockProgress.style.backgroundColor="rgba(0, 255, 0, 0.3)",this.lockProgress.style.boxShadow="0 0 15px #00ff00",this.lockCircle.style.borderColor="#00ff00",this.lockCircle.style.backgroundColor="rgba(0, 255, 0, 0.1)",this.lockCircle.style.boxShadow="0 0 20px #00ff00"}else if(this.lockProgressValue>0&&t){const e=this.lockProgressValue,n=this.lockCircleSize,r=n-(n-40)*e,a=t.x*window.innerWidth,o=t.y*window.innerHeight,l=this.centerX+(a-this.centerX)*e,c=this.centerY+(o-this.centerY)*e;this.lockProgress.style.display="block",this.lockProgress.style.left=`${l}px`,this.lockProgress.style.top=`${c}px`,this.lockProgress.style.width=`${r}px`,this.lockProgress.style.height=`${r}px`,this.lockProgress.style.border="3px solid rgba(255, 150, 0, 0.9)",this.lockProgress.style.backgroundColor="rgba(255, 150, 0, 0.2)",this.lockProgress.style.boxShadow="none",this.lockCircle.style.borderColor="rgba(255, 200, 0, 0.8)",this.lockCircle.style.backgroundColor="rgba(255, 200, 0, 0.1)",this.lockCircle.style.boxShadow="none"}else this.lockProgress.style.display="none",this.lockCircle.style.borderColor="rgba(255, 200, 0, 0.8)",this.lockCircle.style.backgroundColor="rgba(255, 200, 0, 0.1)",this.lockCircle.style.boxShadow="none"}onLockComplete(){}getCurrentTarget(){return this.lockProgressValue>=1?this.currentTarget:null}getLockProgress(){return this.lockProgressValue}isLocking(){return this.isLockingOn}dispose(){this.container.remove()}}var Ns=(s=>(s.MENU="MENU",s.PLAYING="PLAYING",s.PAUSED="PAUSED",s.GAME_OVER="GAME_OVER",s))(Ns||{});class og{constructor(){A(this,"status","MENU");A(this,"score",0);A(this,"enemiesDestroyed",0)}setStatus(t){this.status=t}getStatus(){return this.status}addScore(t){this.score+=t}getScore(){return this.score}incrementEnemiesDestroyed(){this.enemiesDestroyed++}getEnemiesDestroyed(){return this.enemiesDestroyed}start(){this.status="PLAYING"}isPlaying(){return this.status==="PLAYING"}reset(){this.score=0,this.enemiesDestroyed=0,this.status="MENU"}}var vi=(s=>(s.LAKE="LAKE",s.DESERT="DESERT",s.MOUNTAINS="MOUNTAINS",s.OCEAN="OCEAN",s.CITY="CITY",s))(vi||{});const lg=[{id:1,name:"湖畔晨曦",description:"在宁静的湖面上空进行首次战斗",terrain:"LAKE",groundColor:2969622,waterColor:2003199,fogColor:11393254,skyColors:["#1e3c72","#2a5298","#87ceeb","#ffffff"],totalWaves:5,enemiesPerWave:[2,3,4,5,6],enemyTypes:[{type:"SCOUT",minWave:1,maxCount:2},{type:"FIGHTER",minWave:2,maxCount:2}],waveInterval:15,powerUpFrequency:.3,powerUpTypes:["HEALTH","SPEED","SHIELD"],difficulty:2},{id:2,name:"沙漠风暴",description:"在炎热的沙漠上空迎战敌人",terrain:"DESERT",groundColor:12759680,fogColor:16032864,skyColors:["#ff6b35","#ff8c42","#ffd166","#fff8dc"],totalWaves:5,enemiesPerWave:[3,4,5,6,7],enemyTypes:[{type:"SCOUT",minWave:1,maxCount:2},{type:"FIGHTER",minWave:1,maxCount:3},{type:"SNIPER",minWave:3,maxCount:1}],waveInterval:12,powerUpFrequency:.25,powerUpTypes:["HEALTH","DAMAGE","SPEED"],difficulty:4},{id:3,name:"雪山之巅",description:"在高耸的雪山上空进行艰苦战斗",terrain:"MOUNTAINS",groundColor:16777215,fogColor:14474460,skyColors:["#2c3e50","#4ca1af","#c4e0e5","#ffffff"],totalWaves:7,enemiesPerWave:[3,4,4,5,5,6,6],enemyTypes:[{type:"FIGHTER",minWave:1,maxCount:3},{type:"HEAVY",minWave:2,maxCount:2},{type:"SNIPER",minWave:3,maxCount:2}],waveInterval:10,powerUpFrequency:.35,powerUpTypes:["HEALTH","SHIELD","DAMAGE","SPEED"],difficulty:6},{id:4,name:"深海决战",description:"在广阔的海洋上空进行最终决战",terrain:"OCEAN",groundColor:139,waterColor:27028,fogColor:8900331,skyColors:["#0f0c29","#302b63","#24243e","#0f0c29"],totalWaves:8,enemiesPerWave:[4,4,5,5,6,6,7,8],enemyTypes:[{type:"FIGHTER",minWave:1,maxCount:4},{type:"HEAVY",minWave:2,maxCount:2},{type:"SNIPER",minWave:3,maxCount:2},{type:"ACE",minWave:5,maxCount:1}],waveInterval:8,powerUpFrequency:.4,powerUpTypes:["HEALTH","SHIELD","DAMAGE","SPEED","MULTISHOT"],difficulty:8},{id:5,name:"城市废墟",description:"在废弃的城市上空进行终极挑战",terrain:"CITY",groundColor:4013373,fogColor:6908265,skyColors:["#1a1a2e","#16213e","#0f3460","#533483"],totalWaves:10,enemiesPerWave:[4,5,5,6,6,7,7,8,8,10],enemyTypes:[{type:"SCOUT",minWave:1,maxCount:3},{type:"FIGHTER",minWave:1,maxCount:4},{type:"HEAVY",minWave:2,maxCount:3},{type:"SNIPER",minWave:3,maxCount:2},{type:"ACE",minWave:6,maxCount:2}],waveInterval:6,powerUpFrequency:.5,powerUpTypes:["HEALTH","SHIELD","DAMAGE","SPEED","MULTISHOT","BOMB"],difficulty:10}];function cg(s){return lg.find(t=>t.id===s)}var re=(s=>(s.SCOUT="SCOUT",s.FIGHTER="FIGHTER",s.HEAVY="HEAVY",s.SNIPER="SNIPER",s.ACE="ACE",s))(re||{}),sn=(s=>(s.CHASE="chase",s.FIXED_DIRECTION="fixed_direction",s.CIRCLE="circle",s))(sn||{});const da={SCOUT:{type:"SCOUT",name:"侦察机",health:60,speed:40,damage:5,detectionRange:120,attackRange:25,attackCooldown:.4,evasionChance:.3,accuracy:.4,turnSpeed:1.5,maxRollAngle:Math.PI/4,wanderRadius:80,stateProbabilities:{chase:.25,fixed_direction:.5,circle:.25},stateDurationRange:[4,8],circleRadius:150,circleHeight:30,scoreValue:50,color:4521796,scale:.7},FIGHTER:{type:"FIGHTER",name:"战斗机",health:100,speed:55,damage:7.5,detectionRange:100,attackRange:30,attackCooldown:.5,evasionChance:.15,accuracy:.5,turnSpeed:2,maxRollAngle:Math.PI/4,wanderRadius:60,stateProbabilities:{chase:.325,fixed_direction:.475,circle:.2},stateDurationRange:[4,8],circleRadius:120,circleHeight:40,scoreValue:100,color:16729156,scale:1},HEAVY:{type:"HEAVY",name:"重型轰炸机",health:300,speed:35,damage:15,detectionRange:80,attackRange:40,attackCooldown:.8,evasionChance:.02,accuracy:.6,turnSpeed:.8,maxRollAngle:Math.PI/10,wanderRadius:40,stateProbabilities:{chase:.35,fixed_direction:.45,circle:.2},stateDurationRange:[5,9],circleRadius:100,circleHeight:20,scoreValue:200,color:8930304,scale:1.8},SNIPER:{type:"SNIPER",name:"狙击机",health:80,speed:45,damage:20,detectionRange:200,attackRange:80,attackCooldown:1,evasionChance:.2,accuracy:.7,turnSpeed:1.2,maxRollAngle:Math.PI/8,wanderRadius:100,stateProbabilities:{chase:.3,fixed_direction:.5,circle:.2},stateDurationRange:[4,8],circleRadius:180,circleHeight:50,scoreValue:150,color:8913151,scale:.9},ACE:{type:"ACE",name:"王牌飞行员",health:160,speed:70,damage:12.5,detectionRange:150,attackRange:35,attackCooldown:.4,evasionChance:.4,accuracy:.6,turnSpeed:2.4,maxRollAngle:Math.PI/3,wanderRadius:60,stateProbabilities:{chase:.4,fixed_direction:.45,circle:.15},stateDurationRange:[3,7],circleRadius:100,circleHeight:50,scoreValue:500,color:16768256,scale:1.2}};function hg(s,t){const e=[];return s===1?t===1?e.push("SCOUT"):(t===2||t>=3)&&e.push("SCOUT","FIGHTER"):s===2?(e.push("FIGHTER"),t>=2&&e.push("SNIPER"),t>=3&&e.push("SCOUT")):s===3?(e.push("FIGHTER","SNIPER"),t>=2&&e.push("HEAVY")):(e.push("FIGHTER","HEAVY"),t>=2&&e.push("ACE"),t>=3&&e.push("SNIPER")),e}function ug(s){const t=s.map(i=>1e3/da[i].scoreValue),e=t.reduce((i,r)=>i+r,0);let n=Math.random()*e;for(let i=0;i<s.length;i++)if(n-=t[i],n<=0)return s[i];return s[0]}class dg{constructor(t,e,n=65535){A(this,"scene");A(this,"particles",[]);A(this,"maxParticles",50);A(this,"spawnInterval",.1);A(this,"spawnTimer",0);A(this,"material");this.scene=t;const i=this.createParticleTexture();this.material=new ji({map:i,color:n,transparent:!0,opacity:.8,blending:Vn,depthWrite:!1})}createParticleTexture(){const e=document.createElement("canvas");e.width=64,e.height=64;const n=e.getContext("2d");if(!n)throw new Error("Failed to get 2D context");const i=n.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);i.addColorStop(0,"rgba(255, 255, 255, 1)"),i.addColorStop(.3,"rgba(255, 255, 255, 0.8)"),i.addColorStop(.5,"rgba(255, 255, 255, 0.4)"),i.addColorStop(1,"rgba(255, 255, 255, 0)"),n.fillStyle=i,n.fillRect(0,0,64,64);const r=new ts(e);return r.needsUpdate=!0,r}addPoint(t,e){if(this.spawnTimer+=.016,this.spawnTimer>=this.spawnInterval){this.spawnTimer=0;const n=e?t.clone().add(e):t;this.spawnParticle(n)}}spawnParticle(t){if(this.particles.length>=this.maxParticles){const a=this.particles.shift();a&&(this.scene.remove(a.sprite),a.sprite.material.dispose())}const e=new Bl(this.material.clone());e.position.copy(t);const n=2.5,i=.8+Math.random()*.2;e.scale.set(n*i,n*i,1),this.scene.add(e);const r={sprite:e,life:1,decay:.008+Math.random()*.004,initialScale:n*i};this.particles.push(r)}update(t){for(let e=this.particles.length-1;e>=0;e--){const n=this.particles[e];n.life-=n.decay*t*60,n.sprite.material instanceof ji&&(n.sprite.material.opacity=Math.max(0,n.life*.8));const i=n.initialScale*n.life;n.sprite.scale.set(i,i,1),n.life<=0&&(this.scene.remove(n.sprite),n.sprite.material.dispose(),this.particles.splice(e,1))}}dispose(){for(const t of this.particles)this.scene.remove(t.sprite),t.sprite.material.dispose();this.particles=[],this.material.dispose()}}class jl{constructor(t,e,n){A(this,"mesh");A(this,"config");A(this,"health");A(this,"trail");A(this,"velocity");A(this,"targetPosition");A(this,"currentState",sn.CHASE);A(this,"stateTimer",0);A(this,"fixedDirection");A(this,"circleAngle",0);A(this,"attackCooldown",0);A(this,"onFire");A(this,"onDestroy");this.mesh=t,this.config=e,this.health=new Yl(e.health),this.targetPosition=null,this.velocity=new R(0,0,-e.speed),this.fixedDirection=this.randomDirection();const i=this.getTrailColor(e.type);this.trail=new dg(n,t,i),this.selectNewState(),this.stateTimer=this.randomStateDuration(),this.health.onDeath=()=>{var r;(r=this.onDestroy)==null||r.call(this,this.mesh.position.clone())}}getTrailColor(t){return 16777215}update(t,e){const n=this.mesh.position;if(!isFinite(n.x)||!isFinite(n.y)||!isFinite(n.z)){console.error("Enemy position is NaN or Infinity, resetting to origin",{position:{x:n.x,y:n.y,z:n.z}}),this.mesh.position.set(0,0,0);return}switch(this.targetPosition=e,this.stateTimer-=t,this.stateTimer<=0&&(this.selectNewState(),this.stateTimer=this.randomStateDuration()),this.currentState){case sn.CHASE:this.updateChase(t);break;case sn.FIXED_DIRECTION:this.updateFixedDirection(t);break;case sn.CIRCLE:this.updateCircle(t);break}if(this.mesh.position.add(this.velocity.clone().multiplyScalar(t)),this.velocity.length()>0){const a=this.mesh.position.clone().add(this.velocity),o=new oe;o.position.copy(this.mesh.position),o.lookAt(a),this.mesh.quaternion.slerp(o.quaternion,.3)}const r=new R(0,0,2).applyMatrix4(this.mesh.matrixWorld);this.trail.addPoint(r),this.attackCooldown=Math.max(0,this.attackCooldown-t),this.trail.update(t)}updateChase(t){if(!this.targetPosition)return;const e=new R().subVectors(this.targetPosition,this.mesh.position).normalize(),n=this.velocity.clone().normalize(),i=this.config.turnSpeed*t,r=Math.atan2(e.x,e.z),a=Math.atan2(n.x,n.z);let o=r-a;for(;o>Math.PI;)o-=Math.PI*2;for(;o<-Math.PI;)o+=Math.PI*2;o=Math.max(-i,Math.min(i,o));const l=a+o;if(this.velocity.set(Math.sin(l)*this.config.speed,e.y*this.config.speed,Math.cos(l)*this.config.speed),this.attackCooldown<=0&&this.targetPosition){const c=new R().subVectors(this.targetPosition,this.mesh.position).normalize(),h=this.velocity.clone().normalize(),u=c.dot(h),d=Math.cos(30*Math.PI/180);u>d&&(this.fire(this.targetPosition),this.attackCooldown=this.config.attackCooldown)}}updateFixedDirection(t){}updateCircle(t){if(!this.targetPosition)return;const e=this.config.speed/this.config.circleRadius;this.circleAngle+=e*t;const n=this.targetPosition,i=n.x+Math.cos(this.circleAngle)*this.config.circleRadius,r=n.z+Math.sin(this.circleAngle)*this.config.circleRadius,a=n.y+this.config.circleHeight,o=new R(i,a,r),l=new R().subVectors(o,this.mesh.position).normalize(),c=this.velocity.clone().normalize(),h=this.config.turnSpeed*t,u=Math.atan2(l.x,l.z),d=Math.atan2(c.x,c.z);let m=u-d;for(;m>Math.PI;)m-=Math.PI*2;for(;m<-Math.PI;)m+=Math.PI*2;m=Math.max(-h,Math.min(h,m));const g=d+m;this.velocity.set(Math.sin(g)*this.config.speed,l.y*this.config.speed,Math.cos(g)*this.config.speed),this.attackCooldown<=0&&this.config.type==="HEAVY"&&(this.fire(this.targetPosition),this.attackCooldown=this.config.attackCooldown*1.5)}selectNewState(){const t=Math.random(),e=this.config.stateProbabilities;let n=0;if(n+=e[sn.CHASE],t<n){this.currentState=sn.CHASE;return}if(n+=e[sn.FIXED_DIRECTION],t<n){this.currentState=sn.FIXED_DIRECTION,this.fixedDirection=this.randomDirection(),this.velocity.copy(this.fixedDirection).multiplyScalar(this.config.speed);return}this.currentState=sn.CIRCLE,this.circleAngle=0}randomDirection(){const t=Math.random()*Math.PI*2;return new R(Math.cos(t),0,Math.sin(t)).normalize()}randomStateDuration(){const[t,e]=this.config.stateDurationRange;return t+Math.random()*(e-t)}fire(t){var a;const e=new R().subVectors(t,this.mesh.position);e.normalize();const n=(1-this.config.accuracy)*.4,i=(Math.random()-.5)*n,r=new Ri;r.setFromAxisAngle(new R(0,1,0),i),e.applyQuaternion(r),e.normalize(),(a=this.onFire)==null||a.call(this,this.mesh.position.clone(),e,this.config.damage)}getHealth(){return{current:this.health.getCurrentHealth(),max:this.health.getMaxHealth()}}getHealthSystem(){return this.health}getConfig(){return this.config}getMesh(){return this.mesh}isAlive(){return this.health.getCurrentHealth()>0}takeDamage(t){this.health.takeDamage(t)}getPosition(){return this.mesh.position.clone()}getVelocity(){return this.velocity.clone()}reset(t){this.mesh.position.copy(t),this.mesh.visible=!1,this.health.reset(),this.velocity=new R(0,0,-this.config.speed),this.selectNewState(),this.stateTimer=this.randomStateDuration()}dispose(){for(this.mesh.visible=!1,this.mesh.parent&&this.mesh.parent.remove(this.mesh),this.trail.dispose();this.mesh.children.length>0;){const t=this.mesh.children[0];this.mesh.remove(t),t instanceof st&&(t.geometry.dispose(),t.material instanceof xn&&t.material.dispose())}}}class fg{constructor(t){A(this,"scene");A(this,"terrainGroup");A(this,"waterMesh");A(this,"trees",[]);A(this,"clouds",[]);A(this,"grass",null);A(this,"rocks",[]);A(this,"time",0);this.scene=t,this.terrainGroup=new he,this.terrainGroup.name="terrain",this.scene.add(this.terrainGroup)}generateTerrain(t){switch(this.clearTerrain(),this.createSky(t.skyColors),t.terrain){case vi.LAKE:this.generateLakeTerrain(t);break;case vi.DESERT:this.generateDesertTerrain(t);break;case vi.MOUNTAINS:this.generateMountainTerrain(t);break;case vi.OCEAN:this.generateOceanTerrain(t);break;case vi.CITY:this.generateCityTerrain(t);break}this.createClouds(),this.scene.fog=new ia(t.fogColor,8e-4)}generateLakeTerrain(t){const e=new Ce(2e3,2e3,200,200),n=e.attributes.position;for(let a=0;a<n.count;a++){const o=n.getX(a),l=n.getY(a),c=Math.sin(o*.01)*Math.cos(l*.01)*8,h=Math.sin(o*.03+1)*Math.cos(l*.03)*3,u=Math.sin(o*.005)*Math.cos(l*.005)*15;n.setZ(a,c+h+u)}e.computeVertexNormals();const i=new Rt({color:t.groundColor,roughness:.9,metalness:0,flatShading:!1}),r=new st(e,i);r.rotation.x=-Math.PI/2,r.position.y=-50,r.receiveShadow=!0,this.terrainGroup.add(r),this.createBeautifulLake(t),this.createForest(80,-49,1e3,200),this.createGrassField(500,1e5),this.createFlowers(300,2e4),this.createRocks(30)}createBeautifulLake(t){const e=new Zi,n=64;for(let u=0;u<=n;u++){const d=u/n*Math.PI*2,m=180+Math.sin(d*3)*20+Math.cos(d*5)*15,g=Math.cos(d)*m,_=Math.sin(d)*m;u===0?e.moveTo(g,_):e.lineTo(g,_)}const i=new Vs(e,32),r=new Rt({color:t.waterColor||2003199,transparent:!0,opacity:.85,roughness:.1,metalness:.3}),a=new st(i,r);a.rotation.x=-Math.PI/2,a.position.y=-48.5,this.terrainGroup.add(a),this.waterMesh=a;const o=new Zi;for(let u=0;u<=n;u++){const d=u/n*Math.PI*2,m=200+Math.sin(d*3)*20+Math.cos(d*5)*15,g=Math.cos(d)*m,_=Math.sin(d)*m;u===0?o.moveTo(g,_):o.lineTo(g,_)}o.holes.push(e);const l=new Vs(o),c=new Rt({color:16049340,roughness:1,metalness:0}),h=new st(l,c);h.rotation.x=-Math.PI/2,h.position.y=-48.8,h.receiveShadow=!0,this.terrainGroup.add(h)}createForest(t,e,n,i){const r=[{color:2263842,height:12,width:6},{color:3050327,height:18,width:5},{color:3329330,height:8,width:4},{color:25600,height:15,width:7}];for(let a=0;a<t;a++){const o=Math.random()*Math.PI*2,l=i+Math.random()*(n-i),c=Math.cos(o)*l,h=Math.sin(o)*l,u=r[Math.floor(Math.random()*r.length)],d=this.createBeautifulTree(u.color,u.height,u.width);d.position.set(c,e,h),d.scale.setScalar(.8+Math.random()*.6),d.rotation.y=Math.random()*Math.PI*2,this.terrainGroup.add(d),this.trees.push(d)}}createBeautifulTree(t,e,n){const i=new he,r=new ye(n*.08,n*.15,e*.4,8),a=new Rt({color:4863784,roughness:.9}),o=new st(r,a);o.position.y=e*.2,o.castShadow=!0,i.add(o);const l=new Rt({color:t,roughness:.8}),c=new st(new Me(n*.8,e*.4,8),l);c.position.y=e*.5,c.castShadow=!0,i.add(c);const h=new st(new Me(n*.6,e*.35,8),l);h.position.y=e*.7,h.castShadow=!0,i.add(h);const u=new st(new Me(n*.4,e*.3,8),l);return u.position.y=e*.9,u.castShadow=!0,i.add(u),i}createGrassField(t,e){const n=new Me(.1,.5,4),i=new Rt({color:8190976,roughness:.9});this.grass=new Vo(n,i,e);const r=new oe;for(let a=0;a<e;a++){const o=Math.random()*Math.PI*2,l=Math.random()*t;r.position.set(Math.cos(o)*l,-49.5,Math.sin(o)*l),r.rotation.set((Math.random()-.5)*.2,Math.random()*Math.PI*2,(Math.random()-.5)*.2),r.scale.setScalar(.5+Math.random()*1),r.updateMatrix(),this.grass.setMatrixAt(a,r.matrix)}this.grass.instanceMatrix.needsUpdate=!0,this.terrainGroup.add(this.grass)}createFlowers(t,e){const n=[16738740,16766720,16737095,9662683,52945],i=new pe(.15,8,8);n.forEach(r=>{const a=new Rt({color:r,emissive:r,emissiveIntensity:.1}),o=new Vo(i,a,Math.floor(e/n.length)),l=new oe;for(let c=0;c<Math.floor(e/n.length);c++){const h=Math.random()*Math.PI*2,u=Math.random()*t;l.position.set(Math.cos(h)*u,-49.3,Math.sin(h)*u),l.scale.setScalar(.8+Math.random()*.4),l.updateMatrix(),o.setMatrixAt(c,l.matrix)}o.instanceMatrix.needsUpdate=!0,this.terrainGroup.add(o)})}createRocks(t){for(let e=0;e<t;e++){const n=new ca(1+Math.random()*2,0),i=n.attributes.position;for(let o=0;o<i.count;o++)i.setX(o,i.getX(o)*(.8+Math.random()*.4)),i.setY(o,i.getY(o)*(.6+Math.random()*.8)),i.setZ(o,i.getZ(o)*(.8+Math.random()*.4));n.computeVertexNormals();const r=new Rt({color:new Tt().setHSL(0,0,.3+Math.random()*.2),roughness:.9,metalness:.1}),a=new st(n,r);a.position.set((Math.random()-.5)*1500,-49,(Math.random()-.5)*1500),a.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI),a.castShadow=!0,a.receiveShadow=!0,this.terrainGroup.add(a),this.rocks.push(a)}}generateDesertTerrain(t){const e=new Ce(2e3,2e3,150,150),n=e.attributes.position;for(let a=0;a<n.count;a++){const o=n.getX(a),l=n.getY(a),c=Math.sin(o*.008+l*.003)*8,h=Math.sin(o*.015)*Math.cos(l*.012)*5,u=Math.sin(o*.004+l*.006)*12;n.setZ(a,Math.max(0,c+h+u))}e.computeVertexNormals();const i=new Rt({color:t.groundColor,roughness:1,metalness:0}),r=new st(e,i);r.rotation.x=-Math.PI/2,r.position.y=-50,r.receiveShadow=!0,this.terrainGroup.add(r),this.createCacti(50),this.createRocks(20),this.createDeadTrees(15)}createCacti(t){for(let e=0;e<t;e++){const n=(Math.random()-.5)*1500,i=(Math.random()-.5)*1500,r=this.createBeautifulCactus();r.position.set(n,-50,i),r.scale.setScalar(.5+Math.random()*1),r.rotation.y=Math.random()*Math.PI*2,this.terrainGroup.add(r)}}createBeautifulCactus(){const t=new he,e=new Rt({color:2972199,roughness:.8}),n=6+Math.random()*4,i=new st(new ye(.8,1.2,n,8),e);i.position.y=n/2,i.castShadow=!0,t.add(i);const r=Math.floor(Math.random()*3)+1;for(let a=0;a<r;a++){const o=Math.random()>.5?1:-1,l=n*(.3+Math.random()*.4),c=new st(new ye(.4,.5,2+Math.random()*2,8),e);c.rotation.z=Math.PI/2*o,c.position.set(o*1.5,l,0),c.castShadow=!0,t.add(c);const h=new st(new ye(.3,.4,2+Math.random()*2,8),e);h.position.set(o*2.5,l+1,0),h.castShadow=!0,t.add(h)}if(Math.random()>.6){const a=new st(new pe(.3,8,8),new Rt({color:16738740,emissive:16738740,emissiveIntensity:.2}));a.position.y=n+.3,t.add(a)}return t}createDeadTrees(t){for(let e=0;e<t;e++){const n=(Math.random()-.5)*1500,i=(Math.random()-.5)*1500,r=new he,a=new Rt({color:4865066,roughness:1}),o=new st(new ye(.3,.5,5+Math.random()*3,6),a);o.position.y=2.5,o.rotation.set((Math.random()-.5)*.3,0,(Math.random()-.5)*.3),o.castShadow=!0,r.add(o);for(let l=0;l<3;l++){const c=new st(new ye(.1,.15,2+Math.random(),6),a);c.position.set((Math.random()-.5)*.5,3+l*1.2,(Math.random()-.5)*.5),c.rotation.set((Math.random()-.5)*1,Math.random()*Math.PI*2,(Math.random()-.5)*1),c.castShadow=!0,r.add(c)}r.position.set(n,-50,i),r.scale.setScalar(.5+Math.random()*.5),this.terrainGroup.add(r)}}generateMountainTerrain(t){const e=new Ce(2e3,2e3,150,150),n=e.attributes.position;for(let a=0;a<n.count;a++){const o=n.getX(a),l=n.getY(a),c=Math.sin(o*.02)*Math.cos(l*.02)*40,h=Math.sin(o*.035)*Math.cos(l*.03)*20,u=Math.sin(o*.1)*Math.cos(l*.1)*5;n.setZ(a,Math.max(0,c+h+u))}e.computeVertexNormals();const i=new Rt({color:t.groundColor,roughness:.8,metalness:0}),r=new st(e,i);r.rotation.x=-Math.PI/2,r.position.y=-50,r.receiveShadow=!0,this.terrainGroup.add(r),this.createBeautifulMountains(20),this.createPineForest(60,-50,800,200)}createBeautifulMountains(t){for(let e=0;e<t;e++){const n=e/t*Math.PI*2+Math.random()*.5,i=400+Math.random()*400,r=Math.cos(n)*i,a=Math.sin(n)*i,o=new he,l=60+Math.random()*60,c=30+Math.random()*20,h=new Rt({color:6908265,roughness:.9,flatShading:!0}),u=new st(new Me(c,l,6+Math.floor(Math.random()*3)),h);u.position.y=l/2,u.castShadow=!0,o.add(u);const d=new Rt({color:16777215,roughness:.5}),m=new st(new Me(c*.5,l*.35,6),d);m.position.y=l*.7,o.add(m),o.position.set(r,-50,a),o.rotation.y=Math.random()*Math.PI*2,this.terrainGroup.add(o)}}createPineForest(t,e,n,i){for(let r=0;r<t;r++){const a=Math.random()*Math.PI*2,o=i+Math.random()*(n-i),l=Math.cos(a)*o,c=Math.sin(a)*o,h=this.createPineTree();h.position.set(l,e,c),h.scale.setScalar(.6+Math.random()*.8),this.terrainGroup.add(h),this.trees.push(h)}}createPineTree(){const t=new he,e=new st(new ye(.2,.4,3,8),new Rt({color:4863784}));e.position.y=1.5,e.castShadow=!0,t.add(e);const n=new Rt({color:1722154,roughness:.8});for(let i=0;i<5;i++){const r=new st(new Me(2-i*.3,2.5-i*.3,8),n);r.position.y=3+i*1.5,r.castShadow=!0,t.add(r)}if(Math.random()>.5){const i=new st(new Me(.3,1,8),new Rt({color:16777215}));i.position.y=10,t.add(i)}return t}generateOceanTerrain(t){const e=new Ce(2e3,2e3,200,200),n=e.attributes.position;for(let a=0;a<n.count;a++){const o=n.getX(a),l=n.getY(a),c=Math.sin(o*.05)*Math.cos(l*.05)*2;n.setZ(a,c)}e.computeVertexNormals();const i=new Rt({color:t.waterColor||27028,transparent:!0,opacity:.9,roughness:.1,metalness:.3}),r=new st(e,i);r.rotation.x=-Math.PI/2,r.position.y=-50,this.terrainGroup.add(r),this.waterMesh=r,this.createTropicalIslands(10),this.createPalmTrees(40)}createTropicalIslands(t){for(let e=0;e<t;e++){const n=(Math.random()-.5)*1800,i=(Math.random()-.5)*1800,r=new he,a=15+Math.random()*25,o=new st(new Me(a,a*.5,8),new Rt({color:12759680,roughness:1}));o.position.y=-47,r.add(o);const l=new st(new ye(a*1.3,a*1.5,2,16),new Rt({color:16049340,roughness:1}));l.position.y=-48,r.add(l);const c=new st(new Me(a*.8,a*.4,8),new Rt({color:2263842}));c.position.y=-46,r.add(c),r.position.set(n,0,i),this.terrainGroup.add(r)}}createPalmTrees(t){for(let e=0;e<t;e++){const n=(Math.random()-.5)*1800,i=(Math.random()-.5)*1800,r=this.createBeautifulPalmTree();r.position.set(n,-48,i),r.scale.setScalar(.5+Math.random()*.5),r.rotation.y=Math.random()*Math.PI*2,this.terrainGroup.add(r),this.trees.push(r)}}createBeautifulPalmTree(){const t=new he,e=new Rt({color:9127187,roughness:.9}),n=new st(new ye(.2,.4,8,8),e);n.rotation.set((Math.random()-.5)*.3,0,(Math.random()-.5)*.3),n.position.y=4,n.castShadow=!0,t.add(n);const i=new Rt({color:2263842,side:Be});for(let r=0;r<8;r++){const a=new st(new Ce(.8,6),i);a.position.set(0,8,0),a.rotation.set(Math.PI/4,r/8*Math.PI*2,0),t.add(a)}for(let r=0;r<3;r++){const a=new st(new pe(.3,8,8),new Rt({color:6636321}));a.position.set((Math.random()-.5)*.5,7.5,(Math.random()-.5)*.5),t.add(a)}return t}generateCityTerrain(t){const e=new Ce(2e3,2e3),n=new Rt({color:t.groundColor,roughness:.7,metalness:0}),i=new st(e,n);i.rotation.x=-Math.PI/2,i.position.y=-50,i.receiveShadow=!0,this.terrainGroup.add(i),this.createRoads(),this.createBuildings(120)}createRoads(){const t=new Rt({color:3355443,roughness:.9});for(let e=-3;e<=3;e++){const n=new st(new Ce(2e3,20),t);n.rotation.x=-Math.PI/2,n.position.set(0,-49.9,e*250),this.terrainGroup.add(n);const i=new Rt({color:16777215});for(let r=-20;r<=20;r++){const a=new st(new Ce(15,1),i);a.rotation.x=-Math.PI/2,a.position.set(r*50,-49.8,e*250),this.terrainGroup.add(a)}}for(let e=-3;e<=3;e++){const n=new st(new Ce(20,2e3),t);n.rotation.x=-Math.PI/2,n.position.set(e*250,-49.9,0),this.terrainGroup.add(n)}}createBuildings(t){for(let e=0;e<t;e++){const n=Math.floor((Math.random()-.5)*6),i=Math.floor((Math.random()-.5)*6),r=n*250+(Math.random()-.5)*200,a=i*250+(Math.random()-.5)*200,o=this.createBeautifulBuilding();o.position.set(r,-50,a),this.terrainGroup.add(o)}}createBeautifulBuilding(){const t=new he,e=15+Math.random()*60,n=8+Math.random()*15,i=8+Math.random()*15,r=new Rt({color:new Tt().setHSL(Math.random()*.1+.55,.1+Math.random()*.1,.2+Math.random()*.3),roughness:.5,metalness:.3}),a=new st(new Oe(n,e,i),r);a.position.y=e/2,a.castShadow=!0,a.receiveShadow=!0,t.add(a);const o=new Rt({color:16777113,emissive:16776960,emissiveIntensity:.3}),l=1.5,c=4;for(let h=3;h<e-3;h+=c)for(let u=0;u<4;u++){const d=new st(new Ce(l,l*1.5),o),m=u/4*Math.PI*2,g=(u%2===0?n:i)/2+.1;d.position.set(Math.cos(m)*g*.7,h,Math.sin(m)*g*.7),d.rotation.y=-m+Math.PI/2,t.add(d)}if(Math.random()>.5){const h=new st(new Oe(n*.3,3,i*.3),r);h.position.y=e+1.5,t.add(h)}if(Math.random()>.7){const h=new st(new ye(.1,.1,5,8),new Rt({color:8947848}));h.position.y=e+2.5,t.add(h)}return t}createSky(t){const e=document.createElement("canvas");e.width=2,e.height=512;const n=e.getContext("2d"),i=n.createLinearGradient(0,0,0,512);i.addColorStop(0,t[0]),i.addColorStop(.3,t[1]),i.addColorStop(.6,t[2]),i.addColorStop(1,t[3]),n.fillStyle=i,n.fillRect(0,0,2,512);const r=new ts(e);this.scene.background=r}createClouds(){for(let t=0;t<30;t++){const e=this.createFluffyCloud();e.position.set((Math.random()-.5)*2e3,80+Math.random()*150,(Math.random()-.5)*2e3),e.scale.setScalar(8+Math.random()*15),this.terrainGroup.add(e),this.clouds.push(e)}}createFluffyCloud(){const t=new he,e=new Rt({color:16777215,transparent:!0,opacity:.9}),n=5+Math.floor(Math.random()*4);for(let i=0;i<n;i++){const r=.5+Math.random()*.5,a=new st(new pe(r,12,12),e);a.position.set((Math.random()-.5)*2,(Math.random()-.5)*.5,(Math.random()-.5)*1.5),t.add(a)}return t}update(t){if(this.time+=t,this.waterMesh){const e=this.waterMesh.geometry.attributes.position;for(let n=0;n<e.count;n++){const i=e.getX(n),r=e.getY(n),a=Math.sin(i*.05+this.time)*Math.cos(r*.05+this.time*.7)*2;e.setZ(n,a)}e.needsUpdate=!0}for(const e of this.clouds)e.position.x+=t*3,e.position.x>1200&&(e.position.x=-1200)}clearTerrain(){for(;this.terrainGroup.children.length>0;){const t=this.terrainGroup.children[0];this.terrainGroup.remove(t),t instanceof st&&(t.geometry.dispose(),Array.isArray(t.material)?t.material.forEach(e=>e.dispose()):t.material.dispose())}this.trees=[],this.clouds=[],this.waterMesh=void 0,this.grass=null,this.rocks=[]}}class pg{constructor(t,e){A(this,"group");A(this,"ring1");A(this,"ring2");A(this,"ring3");A(this,"coreSphere");A(this,"outerGlow");A(this,"particleSystem");A(this,"particleCount",100);A(this,"particleSpeeds",[]);A(this,"lifetime",0);A(this,"maxLifetime",5);A(this,"isComplete",!1);A(this,"onComplete");this.onComplete=e,this.group=new he,this.group.position.copy(t),this.createPortalEffect(),this.createParticles()}createPortalEffect(){const t=new fe({color:65535,transparent:!0,opacity:.8}),e=new fe({color:16711935,transparent:!0,opacity:.6,side:Be}),n=new fe({color:43775,transparent:!0,opacity:.3}),i=new pe(2,32,32);this.coreSphere=new st(i,t),this.coreSphere.scale.set(0,0,0),this.group.add(this.coreSphere);const r=new Ei(4,.5,16,100);this.ring1=new st(r,e),this.ring1.rotation.x=Math.PI/2,this.ring1.scale.set(0,0,0),this.group.add(this.ring1);const a=new Ei(6,.8,16,100);this.ring2=new st(a,e),this.ring2.rotation.x=Math.PI/2,this.ring2.scale.set(0,0,0),this.group.add(this.ring2);const o=new Ei(8,1,16,100);this.ring3=new st(o,e),this.ring3.rotation.x=Math.PI/2,this.ring3.scale.set(0,0,0),this.group.add(this.ring3);const l=new pe(12,32,32);this.outerGlow=new st(l,n),this.outerGlow.scale.set(0,0,0),this.group.add(this.outerGlow)}createParticles(){const t=new we,e=new Float32Array(this.particleCount*3),n=new Float32Array(this.particleCount*3),i=new Tt(65535),r=new Tt(16711935);for(let o=0;o<this.particleCount;o++){const l=o*3,c=o/this.particleCount*Math.PI*2*5,h=3+o/this.particleCount*8,u=(o/this.particleCount-.5)*10;e[l]=Math.cos(c)*h,e[l+1]=u,e[l+2]=Math.sin(c)*h;const d=o/this.particleCount,m=i.clone().lerp(r,d);n[l]=m.r,n[l+1]=m.g,n[l+2]=m.b,this.particleSpeeds[o]=5+Math.random()*10}t.setAttribute("position",new Pe(e,3)),t.setAttribute("color",new Pe(n,3));const a=new ra({size:.8,vertexColors:!0,transparent:!0,opacity:.9,blending:qi});this.particleSystem=new zl(t,a),this.particleSystem.visible=!1,this.group.add(this.particleSystem)}update(t){var o;if(this.isComplete)return;this.lifetime+=t;const e=this.lifetime/this.maxLifetime;if(e<.4){const l=e/.4,c=this.easeOutBack(l);this.coreSphere.scale.set(c*1.5,c*1.5,c*1.5),this.ring1.scale.set(c,c,c),this.ring2.scale.set(c*.9,c*.9,c*.9),this.ring3.scale.set(c*.8,c*.8,c*.8),this.outerGlow.scale.set(c*2,c*2,c*2)}const n=2;this.ring1.rotation.z+=n*t,this.ring2.rotation.z-=n*1.5*t,this.ring3.rotation.z+=n*2*t;const i=1+Math.sin(this.lifetime*4)*.1;this.coreSphere.scale.multiplyScalar(i);const r=this.lifetime*.5%1,a=new Tt().setHSL(r,1,.5);if(this.ring1.material.color=a,this.ring2.material.color=a,this.ring3.material.color=a,e>.2&&e<.8){this.particleSystem.visible=!0;const l=this.particleSystem.geometry.attributes.position.array;for(let c=0;c<this.particleCount;c++){const h=c*3,u=this.particleSpeeds[c]*t,d=l[h],m=l[h+1],g=l[h+2],_=Math.sqrt(d*d+m*m+g*g);_>0&&(l[h]+=d/_*u,l[h+1]+=m/_*u*.5,l[h+2]+=g/_*u)}this.particleSystem.geometry.attributes.position.needsUpdate=!0}else this.particleSystem.visible=!1;if(e>.8){const l=(e-.8)/.2,c=1-l;this.coreSphere.scale.multiplyScalar(c),this.ring1.scale.multiplyScalar(c),this.ring2.scale.multiplyScalar(c),this.ring3.scale.multiplyScalar(c),this.outerGlow.scale.multiplyScalar(c);const h=1-l;this.coreSphere.material.opacity=h*.8,this.ring1.material.opacity=h*.6,this.ring2.material.opacity=h*.6,this.ring3.material.opacity=h*.6,this.outerGlow.material.opacity=h*.3}this.lifetime>=this.maxLifetime&&(this.isComplete=!0,(o=this.onComplete)==null||o.call(this))}easeOutBack(t){return 1+2.70158*Math.pow(t-1,3)+1.70158*Math.pow(t-1,2)}getMesh(){return this.group}isFinished(){return this.isComplete}dispose(){this.group.removeFromParent(),this.coreSphere.geometry.dispose(),this.coreSphere.material.dispose(),this.ring1.geometry.dispose(),this.ring1.material.dispose(),this.ring2.geometry.dispose(),this.ring2.material.dispose(),this.ring3.geometry.dispose(),this.ring3.material.dispose(),this.outerGlow.geometry.dispose(),this.outerGlow.material.dispose(),this.particleSystem.geometry.dispose(),this.particleSystem.material.dispose()}}class mg{constructor(t){A(this,"scene");A(this,"terrainGenerator");A(this,"combatBounds",{maxHeight:150,minHeight:-20,horizontalDistance:750});A(this,"currentLevel",null);A(this,"currentWave",0);A(this,"state","IDLE");A(this,"enemies",[]);A(this,"enemyPool",[]);A(this,"enemiesSpawnedThisWave",0);A(this,"totalEnemiesSpawned",0);A(this,"activePortals",[]);A(this,"spawnTimer",0);A(this,"spawnInterval",.5);A(this,"waveDelayTimer",0);A(this,"waveGroupCenter");A(this,"onWaveStart");A(this,"onWaveComplete");A(this,"onLevelComplete");A(this,"onEnemySpawned");A(this,"onEnemyKilled");this.scene=t,this.terrainGenerator=new fg(t)}loadLevel(t){const e=cg(t);if(!e){console.error(`Level ${t} not found`);return}this.currentLevel=e,this.currentWave=0,this.state="IDLE",this.terrainGenerator.generateTerrain(e),console.log(`Loaded level ${t}: ${e.name}`)}startWave(t,e=!1){var n,i;if(this.currentLevel){if(this.currentWave===0&&t&&!e){const r=Math.random()*Math.PI*2,a=600+Math.random()*200;this.waveGroupCenter=new R(t.x+Math.cos(r)*a,t.y,t.z+Math.sin(r)*a),this.state="WAVE_ACTIVE",this.enemiesSpawnedThisWave=0,this.spawnTimer=0,(n=this.onWaveStart)==null||n.call(this,this.currentWave),this.enemies=this.enemies.filter(o=>o.isAlive());return}this.state!=="IDLE"&&this.state!=="WAVE_COMPLETE"||(this.state="WAVE_ACTIVE",this.enemiesSpawnedThisWave=0,this.spawnTimer=0,(i=this.onWaveStart)==null||i.call(this,this.currentWave),this.enemies=this.enemies.filter(r=>r.isAlive()))}}spawnEnemy(t){if(!this.currentLevel)return;this.enemiesSpawnedThisWave++,this.totalEnemiesSpawned++;const e=hg(this.currentLevel.id,this.currentWave);e.length===0&&e.push(re.SCOUT);const n=ug(e),i=this.getSpawnPosition(t),r=new pg(i,()=>{var o;const a=this.getOrCreateEnemy(n);a.reset(i),a.getMesh().visible=!0,(o=this.onEnemySpawned)==null||o.call(this,a)});this.scene.add(r.getMesh()),this.activePortals.push(r)}update(t,e,n){var i,r;for(let a=this.activePortals.length-1;a>=0;a--){const o=this.activePortals[a];o.update(t),o.isFinished()&&(o.dispose(),this.activePortals.splice(a,1))}if(this.waveDelayTimer>0&&this.currentLevel&&(this.waveDelayTimer-=t,this.waveDelayTimer<=0&&(this.currentWave>=this.currentLevel.totalWaves?(this.state="LEVEL_COMPLETE",console.log(`[Level ${this.currentLevel.id}] Complete! All waves defeated.`),(i=this.onLevelComplete)==null||i.call(this,this.currentLevel.id)):this.startNextWave(e))),this.state==="WAVE_ACTIVE"&&this.currentLevel){const a=this.currentLevel.enemiesPerWave[this.currentWave]||0,o=this.enemies.filter(l=>l.isAlive()).length;this.enemiesSpawnedThisWave<a?(this.spawnTimer+=t,this.spawnTimer>=this.spawnInterval&&(this.spawnTimer=0,this.spawnEnemy(e))):this.activePortals.length===0&&o===0&&this.enemiesSpawnedThisWave>=a&&(console.log(`[Wave ${this.currentWave}] Complete! All enemies defeated.`),this.state="WAVE_COMPLETE",this.enemiesSpawnedThisWave=0,this.waveDelayTimer=3,(r=this.onWaveComplete)==null||r.call(this,this.currentWave))}for(const a of this.enemies)if(n&&n.length>0){let o=e,l=a.getPosition().distanceTo(e);for(const c of n){const h=a.getPosition().distanceTo(c.position);h<l&&(l=h,o=c.position)}a.update(t,o)}else a.update(t,e);this.enemies=this.enemies.filter(a=>a.isAlive())}getEnemies(){return this.enemies}isEnemySpawning(t){const e=t.getPosition(),n=this.activePortals.some(a=>a.getMesh().position.distanceTo(e)<1),i=t.getMesh(),r=i&&!i.visible;return n||r}getAliveEnemyCount(){return this.enemies.filter(t=>t.isAlive()).length}getSpawnedEnemyCount(){return this.totalEnemiesSpawned}getTotalEnemyCount(){return this.currentLevel?this.currentLevel.enemiesPerWave.reduce((t,e)=>t+e,0):0}clear(){for(const t of this.enemyPool)t.getMesh().removeFromParent();this.enemies=[],this.enemyPool=[];for(const t of this.activePortals)t.dispose();this.activePortals=[],this.enemiesSpawnedThisWave=0}startNextWave(t){if(!this.currentLevel)return;this.currentWave++;const e=Math.random()*Math.PI*2,n=600+Math.random()*200;this.waveGroupCenter=new R(t.x+Math.cos(e)*n,t.y,t.z+Math.sin(e)*n),this.startWave(void 0,!0)}getSpawnPosition(t){const a=this.combatBounds.maxHeight,o=this.combatBounds.minHeight,l=this.combatBounds.horizontalDistance;let c=null,h=0;const u=20;for(let d=0;d<u;d++){if(!this.waveGroupCenter){console.warn("[Wave Manager] No group center set, using fallback position");const L=600+Math.random()*200,b=Math.random()*Math.PI*2,C=t.x+Math.cos(b)*L,O=t.z+Math.sin(b)*L;let M=C,w=O;const F=Math.sqrt(Math.pow(C-t.x,2)+Math.pow(O-t.z,2));if(F>l-60){const Y=(l-60)/F;M=t.x+(C-t.x)*Y,w=t.z+(O-t.z)*Y}const G=Math.random()*Math.PI*2,J=Math.random()*60,D=M+Math.cos(G)*J,B=w+Math.sin(G)*J,k=Math.max(o,Math.min(a,t.y+(Math.random()-.5)*30));c=new R(D,k,B);break}const m=this.waveGroupCenter,g=Math.random()*Math.PI*2,_=Math.random()*60,p=m.x+Math.cos(g)*_,f=m.z+Math.sin(g)*_,S=Math.max(o,Math.min(a,t.y+(Math.random()-.5)*30)),v=new R(p,S,f);let y=1/0;for(const L of this.enemies)if(L.isAlive()){const b=v.distanceTo(L.getPosition());y=Math.min(y,b)}if((y===1/0||y>h)&&(h=y,c=v),y>=40)break}if(!c){const d=Math.max(o,Math.min(a,t.y));c=new R(t.x+(Math.random()-.5)*200,d,t.z+(Math.random()-.5)*200)}return c}getOrCreateEnemy(t){const e=this.enemyPool.findIndex(a=>a.getConfig().type===t);if(e!==-1){const a=this.enemyPool.splice(e,1)[0];return this.enemies.push(a),a}const n=da[t],i=this.createEnemyMesh(n);this.scene.add(i);const r=new jl(i,n,this.scene);return this.enemies.push(r),r}dispose(t){for(const e of this.enemies)e.dispose();this.enemies=[]}createEnemyMesh(t){const e=new he;let n,i,r,a=1.6,o=6,l=3,c=.8,h=1;switch(t.type){case re.SCOUT:n=4871556,i=7043982,r=4020871,a=1.2,o=5,l=2.2,h=.85;break;case re.FIGHTER:n=13382400,i=15087872,r=9118976,a=1.8,o=7,l=3.5,h=1.1;break;case re.HEAVY:n=2894892,i=3815994,r=1710618,a=2.2,o=8,l=4.2,h=1.3;break;case re.SNIPER:n=4858714,i=7031930,r=8141549,a=1.6,o=7.5,l=2.8,h=.95;break;case re.ACE:n=9109504,i=16766720,r=16729344,a=1.9,o=7,l=3.3,h=1.15;break;default:n=t.color,i=t.color,r=t.color}e.scale.set(h,h,h);const u=new ye(a*.4,a*.3,o,8),d=new Rt({color:n,metalness:.7,roughness:.3}),m=new st(u,d);m.rotation.x=Math.PI/2,m.rotation.z=Math.PI/2,m.castShadow=!0,e.add(m);const g=new Me(a*.3,o*.25,8),_=new Rt({color:r,metalness:.8,roughness:.2}),p=new st(g,_);p.rotation.x=Math.PI/2,p.rotation.z=Math.PI/2,p.position.set(0,0,o/2+.5),p.castShadow=!0,e.add(p);const f=new Oe(l,.15,1.2),S=new Rt({color:i,metalness:.6,roughness:.4}),v=new st(f,S);v.position.set(0,0,-.8),v.castShadow=!0,e.add(v);const y=new pe(a*.35,8,8),L=new Rt({color:r,metalness:.9,roughness:.1,emissive:r,emissiveIntensity:.3}),b=new st(y,L);b.position.set(0,a*.25,.5),b.castShadow=!0,e.add(b);const C=new Oe(c,.12,1),O=new Rt({color:i,metalness:.6,roughness:.4}),M=new st(C,O);M.position.set(0,0,-o/2-.3),M.castShadow=!0,e.add(M);const w=new Oe(.15,1.2,.8),F=new st(w,O);F.position.set(0,.6,-o/2+.1),F.castShadow=!0,e.add(F);const G=new ye(a*.2,a*.15,.5,8),J=new fe({color:16737792,transparent:!0,opacity:.8}),D=new st(G,J);switch(D.rotation.x=Math.PI/2,D.position.set(0,0,-o/2-.8),e.add(D),t.type){case re.SCOUT:e.name="Scout";break;case re.FIGHTER:e.name="Fighter";break;case re.HEAVY:e.name="Heavy";break;case re.SNIPER:e.name="Sniper";break;case re.ACE:e.name="Ace";break}return e}}class gg{constructor(){A(this,"context",null);A(this,"masterVolume",null);A(this,"engineOscillator",null);A(this,"engineGain",null);A(this,"isEnginePlaying",!1);A(this,"masterVolumeValue",.5);A(this,"sfxVolume",.7)}initContext(){if(!this.context)try{this.context=new(window.AudioContext||window.webkitAudioContext),this.masterVolume=this.context.createGain(),this.masterVolume.gain.value=this.masterVolumeValue,this.masterVolume.connect(this.context.destination)}catch{console.warn("Web Audio API not supported")}}resume(){var t;this.initContext(),((t=this.context)==null?void 0:t.state)==="suspended"&&this.context.resume()}startEngine(){if(this.initContext(),!(!this.context||!this.masterVolume||this.isEnginePlaying))try{this.engineOscillator=this.context.createOscillator(),this.engineGain=this.context.createGain(),this.engineOscillator.type="sawtooth",this.engineOscillator.frequency.value=80,this.engineGain.gain.value=.05*this.sfxVolume;const t=this.context.createBiquadFilter();t.type="lowpass",t.frequency.value=500,this.engineOscillator.connect(t),t.connect(this.engineGain),this.engineGain.connect(this.masterVolume),this.engineOscillator.start(),this.isEnginePlaying=!0}catch{console.warn("Failed to start engine sound")}}updateEngine(t){var o,l;if(!this.engineOscillator||!this.engineGain)return;const e=60,n=150,i=Math.min(t/100,1),r=e+(n-e)*i;this.engineOscillator.frequency.setValueAtTime(r,((o=this.context)==null?void 0:o.currentTime)||0);const a=.03+i*.04;this.engineGain.gain.setValueAtTime(a*this.sfxVolume,((l=this.context)==null?void 0:l.currentTime)||0)}stopEngine(){this.engineOscillator&&(this.engineOscillator.stop(),this.engineOscillator=null),this.isEnginePlaying=!1}playShoot(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="square",e.frequency.setValueAtTime(800,t),e.frequency.exponentialRampToValueAtTime(200,t+.1),n.gain.setValueAtTime(.2*this.sfxVolume,t),n.gain.exponentialRampToValueAtTime(.01,t+.1),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.1),this.playNoise(.05,.1,.1*this.sfxVolume)}catch{}}playExplosion(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="sine",e.frequency.setValueAtTime(150,t),e.frequency.exponentialRampToValueAtTime(20,t+.5),n.gain.setValueAtTime(.5*this.sfxVolume,t),n.gain.exponentialRampToValueAtTime(.01,t+.5),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.5),this.playNoise(.3,.5,.3*this.sfxVolume)}catch{}}playHit(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="triangle",e.frequency.setValueAtTime(400,t),e.frequency.exponentialRampToValueAtTime(100,t+.1),n.gain.setValueAtTime(.15*this.sfxVolume,t),n.gain.exponentialRampToValueAtTime(.01,t+.1),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.1)}catch{}}playPowerUp(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime;[523.25,659.25,783.99,1046.5].forEach((n,i)=>{const r=this.context.createOscillator(),a=this.context.createGain();r.type="sine",r.frequency.value=n;const o=t+i*.08;a.gain.setValueAtTime(0,o),a.gain.linearRampToValueAtTime(.15*this.sfxVolume,o+.02),a.gain.exponentialRampToValueAtTime(.01,o+.15),r.connect(a),a.connect(this.masterVolume),r.start(o),r.stop(o+.15)})}catch{}}playLevelUp(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime;[392,523.25,659.25,783.99].forEach((n,i)=>{const r=this.context.createOscillator(),a=this.context.createGain();r.type="triangle",r.frequency.value=n;const o=t+i*.1;a.gain.setValueAtTime(0,o),a.gain.linearRampToValueAtTime(.2*this.sfxVolume,o+.05),a.gain.exponentialRampToValueAtTime(.01,o+.3),r.connect(a),a.connect(this.masterVolume),r.start(o),r.stop(o+.3)})}catch{}}playWaveStart(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime;for(let e=0;e<3;e++){const n=this.context.createOscillator(),i=this.context.createGain();n.type="square",n.frequency.value=440;const r=t+e*.15;i.gain.setValueAtTime(.1*this.sfxVolume,r),i.gain.setValueAtTime(0,r+.1),n.connect(i),i.connect(this.masterVolume),n.start(r),n.stop(r+.1)}}catch{}}playGameOver(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime;[392,349.23,329.63,293.66].forEach((n,i)=>{const r=this.context.createOscillator(),a=this.context.createGain();r.type="triangle",r.frequency.value=n;const o=t+i*.2;a.gain.setValueAtTime(.15*this.sfxVolume,o),a.gain.exponentialRampToValueAtTime(.01,o+.4),r.connect(a),a.connect(this.masterVolume),r.start(o),r.stop(o+.4)})}catch{}}playNoise(t,e,n){if(!(!this.context||!this.masterVolume))try{const i=this.context.sampleRate*t,r=this.context.createBuffer(1,i,this.context.sampleRate),a=r.getChannelData(0);for(let h=0;h<i;h++)a[h]=Math.random()*2-1;const o=this.context.createBufferSource();o.buffer=r;const l=this.context.createGain(),c=this.context.currentTime;l.gain.setValueAtTime(0,c),l.gain.linearRampToValueAtTime(n,c+e),l.gain.exponentialRampToValueAtTime(.01,c+t),o.connect(l),l.connect(this.masterVolume),o.start(c)}catch{}}setMasterVolume(t){this.masterVolumeValue=Math.max(0,Math.min(1,t)),this.masterVolume&&(this.masterVolume.gain.value=this.masterVolumeValue)}playBalloonPop(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="sine",e.frequency.setValueAtTime(880,t),e.frequency.exponentialRampToValueAtTime(220,t+.1),n.gain.setValueAtTime(0,t),n.gain.linearRampToValueAtTime(.3*this.sfxVolume,t+.01),n.gain.exponentialRampToValueAtTime(.01,t+.15),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.15);const i=this.context.createOscillator(),r=this.context.createGain();i.type="square",i.frequency.setValueAtTime(1200,t+.05),r.gain.setValueAtTime(0,t+.05),r.gain.linearRampToValueAtTime(.15*this.sfxVolume,t+.05),r.gain.exponentialRampToValueAtTime(.01,t+.1),i.connect(r),r.connect(this.masterVolume),i.start(t+.05),i.stop(t+.1)}catch{}}playMissileLock(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="sine",e.frequency.setValueAtTime(1200,t),e.frequency.exponentialRampToValueAtTime(1800,t+.1),n.gain.setValueAtTime(0,t),n.gain.linearRampToValueAtTime(.25*this.sfxVolume,t+.01),n.gain.exponentialRampToValueAtTime(.01,t+.15),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.15)}catch{}}playMissileFire(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="sawtooth",e.frequency.setValueAtTime(300,t),e.frequency.exponentialRampToValueAtTime(150,t+.3),n.gain.setValueAtTime(0,t),n.gain.linearRampToValueAtTime(.3*this.sfxVolume,t+.02),n.gain.exponentialRampToValueAtTime(.01,t+.3),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.3)}catch{}}playMissileExplosion(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="sawtooth",e.frequency.setValueAtTime(100,t),e.frequency.exponentialRampToValueAtTime(30,t+.5),n.gain.setValueAtTime(0,t),n.gain.linearRampToValueAtTime(.6*this.sfxVolume,t+.02),n.gain.exponentialRampToValueAtTime(.01,t+.5),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.5),this.playNoise(.6,.1,.8*this.sfxVolume)}catch{}}setSFXVolume(t){this.sfxVolume=Math.max(0,Math.min(1,t))}playMissileLaunch(){if(this.initContext(),!(!this.context||!this.masterVolume))try{const t=this.context.currentTime,e=this.context.createOscillator(),n=this.context.createGain();e.type="sawtooth",e.frequency.setValueAtTime(400,t),e.frequency.exponentialRampToValueAtTime(600,t+.1),n.gain.setValueAtTime(0,t),n.gain.linearRampToValueAtTime(.2*this.sfxVolume,t+.01),n.gain.exponentialRampToValueAtTime(.01,t+.2),e.connect(n),n.connect(this.masterVolume),e.start(t),e.stop(t+.15)}catch{}}mute(){this.masterVolume&&(this.masterVolume.gain.value=0)}unmute(){this.masterVolume&&(this.masterVolume.gain.value=this.masterVolumeValue)}}class _g{constructor(t,e,n){A(this,"mesh");A(this,"config");A(this,"balloon");A(this,"string");A(this,"baseY");A(this,"time",0);A(this,"floatAmount",.8);A(this,"bobSpeed",2);A(this,"spawnInvincibleTimer",.5);this.config={type:e,icon:n||(n?Tn[e].icon:"?"),isRandom:!n},this.baseY=t.y,this.mesh=new he,this.mesh.position.copy(t),this.createBalloon()}createBalloon(){const t=this.config,e=new pe(3,16,16),n=new Rt({color:16777215,emissive:4474111,emissiveIntensity:.3,metalness:.3,roughness:.7});this.balloon=new st(e,n),this.balloon.scale.set(1,1.2,1);const i=new ye(.1,.1,2),r=new Rt({color:13421772});this.string=new st(i,r),this.string.position.y=-2.5;const a=document.createElement("canvas");a.width=128,a.height=128;const o=a.getContext("2d");o.fillStyle="#ffffff",o.beginPath(),o.arc(64,64,60,0,Math.PI*2),o.fill(),o.fillStyle="#333333",o.font="bold 64px Arial",o.textAlign="center",o.textBaseline="middle",o.fillText(t.icon,64,64);const l=new ts(a),c=new Ce(5,5),h=new fe({map:l,transparent:!0,side:Be}),u=new st(c,h);u.position.y=5.5,this.mesh.add(this.string),this.mesh.add(this.balloon),this.mesh.add(u)}update(t){this.time+=t,this.spawnInvincibleTimer>0&&(this.spawnInvincibleTimer-=t);const e=Math.sin(this.time*this.bobSpeed)*this.floatAmount;this.mesh.position.y=this.baseY+e,this.mesh.rotation.y+=t*.5;const n=this.time*.5%1,i=new Tt().setHSL(n,1,.5),r=this.balloon.material;r.emissive=i,r.emissiveIntensity=.4+Math.sin(this.time*4)*.2,r.color.setHex(16777215)}getMesh(){return this.mesh}getConfig(){return this.config}getBalloonHeight(){return 5}canBeHit(){return this.spawnInvincibleTimer<=0}dispose(t){var n;t.remove(this.mesh),this.balloon.geometry.dispose(),this.balloon.material.dispose(),this.string.geometry.dispose(),this.string.material.dispose();const e=this.mesh.children.find(i=>i instanceof st&&i.geometry instanceof Ce);e&&(e.geometry.dispose(),e.material.dispose(),(n=e.material.map)==null||n.dispose())}}class vg{constructor(t,e){A(this,"group");A(this,"glowSphere");A(this,"ring");A(this,"starParticles");A(this,"lifetime",0);A(this,"maxLifetime",2);A(this,"isComplete",!1);A(this,"isCancelled",!1);A(this,"onComplete");this.onComplete=e,this.group=new he,this.group.position.copy(t),this.createSpawnEffect()}createSpawnEffect(){const t=new fe({color:65535,transparent:!0,opacity:.6}),e=new fe({color:16776960,transparent:!0,opacity:.5,side:Be}),n=new pe(3,32,32);this.glowSphere=new st(n,t),this.glowSphere.scale.set(0,0,0),this.group.add(this.glowSphere);const i=new Ei(4,.3,16,100);this.ring=new st(i,e),this.ring.rotation.x=Math.PI/2,this.ring.scale.set(0,0,0),this.group.add(this.ring),this.createStarParticles()}createStarParticles(){const e=new we,n=new Float32Array(30*3),i=new Float32Array(30*3);for(let a=0;a<30;a++){const o=a*3,l=Math.random()*Math.PI*2,c=Math.random()*Math.PI,h=5;n[o]=h*Math.sin(c)*Math.cos(l),n[o+1]=h*Math.cos(c),n[o+2]=h*Math.sin(c)*Math.sin(l),i[o]=1,i[o+1]=.84,i[o+2]=0}e.setAttribute("position",new Pe(n,3)),e.setAttribute("color",new Pe(i,3));const r=new ra({size:.6,vertexColors:!0,transparent:!0,opacity:.9,blending:qi});this.starParticles=new zl(e,r),this.starParticles.visible=!1,this.group.add(this.starParticles)}update(t){var r;if(this.isComplete||this.isCancelled)return;this.lifetime+=t;const e=this.lifetime/this.maxLifetime;if(e<.25){const a=e/.25,o=this.easeOutBack(a);this.glowSphere.scale.set(o,o,o),this.ring.scale.set(o*1.5,o*1.5,o*1.5)}const n=3;this.ring.rotation.z+=n*t;const i=1+Math.sin(this.lifetime*6)*.15;if(e>=.25&&this.glowSphere.scale.multiplyScalar(i),e>.15&&e<.75){this.starParticles.visible=!0;const a=this.starParticles.geometry.attributes.position.array;for(let o=0;o<a.length;o+=3){const l=8*t,c=a[o],h=a[o+1],u=a[o+2],d=Math.sqrt(c*c+h*h+u*u);d>0&&(a[o]+=c/d*l,a[o+1]+=h/d*l,a[o+2]+=u/d*l)}this.starParticles.geometry.attributes.position.needsUpdate=!0}else this.starParticles.visible=!1;if(e>.75){const a=(e-.75)/.25,o=1-a;this.glowSphere.scale.multiplyScalar(o),this.ring.scale.multiplyScalar(o);const l=1-a;this.glowSphere.material.opacity=l*.6,this.ring.material.opacity=l*.5}this.lifetime>=this.maxLifetime&&!this.isCancelled&&(this.isComplete=!0,(r=this.onComplete)==null||r.call(this))}cancel(){this.isCancelled=!0,this.isComplete=!0}easeOutBack(t){return 1+2.70158*Math.pow(t-1,3)+1.70158*Math.pow(t-1,2)}getMesh(){return this.group}isFinished(){return this.isComplete||this.isCancelled}isCancelledState(){return this.isCancelled}dispose(){this.group.removeFromParent(),this.glowSphere.geometry.dispose(),this.glowSphere.material.dispose(),this.ring.geometry.dispose(),this.ring.material.dispose(),this.starParticles.geometry.dispose(),this.starParticles.material.dispose()}}var Ne=(s=>(s.HEALTH="HEALTH",s.SHIELD="SHIELD",s.SPEED="SPEED",s.DAMAGE="DAMAGE",s.MULTISHOT="MULTISHOT",s.BOMB="BOMB",s))(Ne||{});const Tn={HEALTH:{type:"HEALTH",name:"生命恢复",description:"恢复 30 点生命值",color:65280,duration:0,value:30,icon:"❤️"},SHIELD:{type:"SHIELD",name:"能量护盾",description:"获得 10 秒无敌护盾",color:65535,duration:10,value:1,icon:"🛡️"},SPEED:{type:"SPEED",name:"速度提升",description:"速度提升 50%，持续 15 秒",color:16776960,duration:15,value:1.5,icon:"⚡"},DAMAGE:{type:"DAMAGE",name:"伤害提升",description:"伤害提升 100%，持续 20 秒",color:16729156,duration:20,value:2,icon:"🔥"},MULTISHOT:{type:"MULTISHOT",name:"多重射击",description:"同时发射 3 发子弹，持续 20 秒",color:16711935,duration:20,value:3,icon:"🎯"},BOMB:{type:"BOMB",name:"召唤友军",description:"召唤一架友军飞机协助战斗",color:16746496,duration:0,value:1,icon:"✈️"}};class xg{constructor(t,e){A(this,"scene");A(this,"balloons",[]);A(this,"activePowerUps",[]);A(this,"particleSystem");A(this,"spawnEffects",[]);A(this,"spawningPositions",new Set);A(this,"onPowerUpCollected");A(this,"onPowerUpExpired");A(this,"onBombUsed");A(this,"onBalloonDestroyed");this.scene=t,this.particleSystem=e}spawn(t,e,n){const i=`${Math.floor(t.x)},${Math.floor(t.z)}`;if(this.spawningPositions.has(i))return;this.spawningPositions.add(i);const r=e||this.getRandomPowerUpType(),a=n||(Math.random()>.5?"?":Tn[r].icon),o=new vg(t.clone(),()=>{const l=new _g(t.clone(),r,a);this.balloons.push(l),this.scene.add(l.getMesh()),this.spawningPositions.delete(i);const c=this.spawnEffects.indexOf(o);c!==-1&&this.spawnEffects.splice(c,1),o.dispose()});this.spawnEffects.push(o),this.scene.add(o.getMesh())}getRandomPowerUpType(){const t=Object.values(Ne),e=[25,20,20,20,10,5],n=e.reduce((r,a)=>r+a,0);let i=Math.random()*n;for(let r=0;r<t.length;r++)if(i-=e[r],i<=0)return t[r];return"HEALTH"}update(t){for(const e of this.balloons)e.update(t);for(let e=this.spawnEffects.length-1;e>=0;e--){const n=this.spawnEffects[e];n.update(t),n.isFinished()&&(this.spawnEffects.splice(e,1),n.dispose())}this.updateActivePowerUps(t)}checkProjectileCollisions(t,e){for(let n=this.balloons.length-1;n>=0;n--){const i=this.balloons[n];if(i.canBeHit()){for(const r of t)if(i.getMesh().position.distanceTo(r)<3){const a=i.getConfig().type;e(i,a),this.createExplosion(i.getMesh().position.clone(),a),i.dispose(this.scene),this.balloons.splice(n,1);break}}}}checkPlayerCollisions(t,e){for(let n=this.balloons.length-1;n>=0;n--){const i=this.balloons[n];if(i.getMesh().position.distanceTo(t)<3){const r=i.getConfig().type,a=Tn[r];e(r,a),i.dispose(this.scene),this.balloons.splice(n,1);break}}}createExplosion(t,e){this.particleSystem.createExplosion(t,.5)}hasEffect(t){return this.activePowerUps.some(e=>e.type===t)}getBalloons(){return this.balloons}clear(){for(const t of this.balloons)t.dispose(this.scene);this.balloons=[],this.activePowerUps=[];for(const t of this.spawnEffects)t.dispose();this.spawnEffects=[],this.spawningPositions.clear()}getActiveEffects(){return this.activePowerUps}removeBalloon(t){const e=this.balloons.indexOf(t);e!==-1&&(t.dispose(this.scene),this.balloons.splice(e,1))}addActivePowerUp(t,e){var r,a;const n=Date.now();if(this.activePowerUps.some(o=>o.type===t)){const o=this.activePowerUps.find(l=>l.type===t);o&&e.duration>0&&(o.remainingTime=e.duration,o.startTime=n,console.log(`刷新道具效果: ${e.name}`));return}const i={type:t,config:e,remainingTime:e.duration,startTime:n};this.activePowerUps.push(i),console.log(`激活道具效果: ${e.name}, 持续时间: ${e.duration}秒`),(r=this.onPowerUpCollected)==null||r.call(this,t,e),t==="BOMB"&&((a=this.onBombUsed)==null||a.call(this))}updateActivePowerUps(t){var e;for(let n=this.activePowerUps.length-1;n>=0;n--){const i=this.activePowerUps[n];i.config.duration>0&&(i.remainingTime-=t,i.remainingTime<=0&&(console.log(`道具效果过期: ${i.config.name}`),(e=this.onPowerUpExpired)==null||e.call(this,i.type),this.activePowerUps.splice(n,1)))}}}var Jr=(s=>(s.MAX_HEALTH="MAX_HEALTH",s.DAMAGE="DAMAGE",s.FIRE_RATE="FIRE_RATE",s.SPEED="SPEED",s.SHIELD_DURATION="SHIELD_DURATION",s))(Jr||{});const Nr={MAX_HEALTH:{type:"MAX_HEALTH",name:"最大生命值",description:"增加最大生命值",maxLevel:10,baseCost:100,costMultiplier:1.5,effectPerLevel:20},DAMAGE:{type:"DAMAGE",name:"武器伤害",description:"增加子弹伤害",maxLevel:10,baseCost:150,costMultiplier:1.6,effectPerLevel:5},FIRE_RATE:{type:"FIRE_RATE",name:"射速",description:"提高射击速度",maxLevel:8,baseCost:200,costMultiplier:1.7,effectPerLevel:.02},SPEED:{type:"SPEED",name:"飞行速度",description:"提高最大飞行速度",maxLevel:8,baseCost:120,costMultiplier:1.5,effectPerLevel:5},SHIELD_DURATION:{type:"SHIELD_DURATION",name:"护盾持续时间",description:"增加护盾持续时间",maxLevel:5,baseCost:250,costMultiplier:2,effectPerLevel:2}};class yg{constructor(){A(this,"upgradeLevels",new Map);A(this,"totalScore",0);A(this,"availablePoints",0);Object.values(Jr).forEach(t=>{this.upgradeLevels.set(t,0)})}addScore(t){this.totalScore+=t;const e=Math.floor(this.totalScore/500)-this.availablePoints;e>0&&(this.availablePoints+=e)}getLevel(t){return this.upgradeLevels.get(t)||0}upgrade(t){const e=this.getLevel(t),n=Nr[t];if(e>=n.maxLevel)return!1;const i=this.getUpgradeCost(t);return this.availablePoints<i?!1:(this.availablePoints-=i,this.upgradeLevels.set(t,e+1),!0)}getUpgradeCost(t){const e=this.getLevel(t),n=Nr[t];return Math.floor(n.baseCost*Math.pow(n.costMultiplier,e))}getEffectValue(t){const e=this.getLevel(t),n=Nr[t];return e*n.effectPerLevel}getTotalScore(){return this.totalScore}getAvailablePoints(){return this.availablePoints}reset(){Object.values(Jr).forEach(t=>{this.upgradeLevels.set(t,0)}),this.totalScore=0,this.availablePoints=0}export(){const t={totalScore:this.totalScore,availablePoints:this.availablePoints,upgrades:{}};return this.upgradeLevels.forEach((e,n)=>{t.upgrades[n]=e}),t}import(t){this.totalScore=t.totalScore||0,this.availablePoints=t.availablePoints||0,t.upgrades&&Object.entries(t.upgrades).forEach(([e,n])=>{this.upgradeLevels.set(e,n)})}}class Mg{constructor(){A(this,"upgrades");A(this,"baseHealth",100);A(this,"baseDamage",12.5);A(this,"baseFireRate",.3);A(this,"baseSpeed",100);A(this,"baseShieldDuration",10);this.upgrades=new yg}getMaxHealth(){return this.baseHealth+this.upgrades.getEffectValue("MAX_HEALTH")}getDamage(t=1){return(this.baseDamage+this.upgrades.getEffectValue("DAMAGE"))*t}getFireRate(){const t=this.upgrades.getEffectValue("FIRE_RATE");return Math.max(.05,this.baseFireRate-t)}getMaxSpeed(){return this.baseSpeed+this.upgrades.getEffectValue("SPEED")}getShieldDuration(){return this.baseShieldDuration+this.upgrades.getEffectValue("SHIELD_DURATION")}getAccuracy(){return .9}getUpgrades(){return this.upgrades}addScore(t){this.upgrades.addScore(t)}reset(){this.upgrades.reset()}}class Sg{constructor(t,e,n){A(this,"enemy");A(this,"isFriendly",!0);this.enemy=new jl(t,e,n),t.userData.isFriendly=!0,this.enemy.onFire=(i,r,a)=>{}}update(t,e){const n=this.findNearestEnemy(e),i=n?this.enemy.getMesh().position.distanceTo(n.position):1/0;console.log(`[友军AI] 更新, 最近敌人距离: ${i.toFixed(1)}m`);const r=n?n.position:new R;this.enemy.update(t,r),n&&this.enemy.attackCooldown<=0&&console.log("[友军AI] 攻击冷却完毕，应该开火")}findNearestEnemy(t){let e=null,n=1/0;for(const i of t){if(i===this.enemy.getMesh())continue;const r=this.enemy.getMesh().position.distanceTo(i.position);r<n&&(n=r,e=i)}return e}getMesh(){return this.enemy.getMesh()}isAlive(){return this.enemy.isAlive()}getHealth(){return this.enemy.getHealth()}takeDamage(t){this.enemy.takeDamage(t)}dispose(t){const e=this.enemy.getMesh();t.remove(e),this.enemy.trail.dispose()}}var Qe=(s=>(s.ENEMY="ENEMY",s.FRIENDLY="FRIENDLY",s.NEUTRAL="NEUTRAL",s))(Qe||{});function Eg(s,t){return!(s==="FRIENDLY"&&t==="NEUTRAL"||s==="NEUTRAL"&&t==="FRIENDLY")}class wg{constructor(){A(this,"gameLoop");A(this,"gameScene");A(this,"inputHandler");A(this,"gameState");A(this,"playerAircraft");A(this,"playerController");A(this,"playerHealth");A(this,"playerStats");A(this,"thirdPersonCamera");A(this,"playerProjectilePool");A(this,"enemyProjectilePool");A(this,"levelManager");A(this,"particleSystem");A(this,"audioManager");A(this,"powerUpManager");A(this,"friendlyAIs",[]);A(this,"hud");A(this,"startMenu");A(this,"lockOnIndicator");A(this,"enemyHealthBars");A(this,"fireCooldown",0);A(this,"missileSystem");A(this,"missileCount",2);A(this,"missileFiringScheduled",!1);A(this,"missileRespawnTimer",0);A(this,"currentLevelId",1);A(this,"shieldMesh");A(this,"shieldActive",!1);A(this,"lives",3);A(this,"isRespawning",!1);A(this,"respawnTimer",0);A(this,"respawnDelay",2);A(this,"deathPosition");A(this,"audioInitialized",!1);this.gameLoop=new Zm,this.gameScene=new Jm,this.inputHandler=new Km,this.gameState=new og,this.playerStats=new Mg,this.playerAircraft=this.createPlayerAircraft(),this.playerController=new Qm(this.playerAircraft,this.gameScene.scene),this.playerHealth=new Yl(this.playerStats.getMaxHealth()),this.thirdPersonCamera=new tg(this.gameScene.camera,this.playerAircraft),this.playerProjectilePool=new Qo(this.gameScene.scene),this.enemyProjectilePool=new Qo(this.gameScene.scene),this.levelManager=new mg(this.gameScene.scene),this.particleSystem=new $l(this.gameScene.scene),this.audioManager=new gg,this.powerUpManager=new xg(this.gameScene.scene,this.particleSystem),this.hud=new ig,this.lockOnIndicator=new ag,this.missileSystem=new ng(this.gameScene.scene,this.particleSystem),this.enemyHealthBars=new rg,this.startMenu=new sg,this.setupCallbacks(),this.startMenu.setOnStart(t=>{this.lives=t.playerLives,this.audioManager.setSFXVolume(t.soundVolume),this.currentLevelId=t.startLevel,this.gameState.start(),this.start()})}setupCallbacks(){this.playerHealth.onDamage=()=>{!this.shieldActive&&!this.isRespawning&&(this.audioManager.playHit(),this.particleSystem.createHit(this.playerAircraft.position))},this.playerHealth.onDeath=()=>{this.onPlayerDeath()},this.levelManager.onWaveStart=t=>{this.audioManager.playWaveStart(),console.log(`第 ${t} 波开始！`)},this.levelManager.onWaveComplete=t=>{console.log(`第 ${t} 波完成！`)},this.levelManager.onLevelComplete=t=>{this.audioManager.playLevelUp(),console.log(`关卡 ${t} 完成！`)},this.levelManager.onEnemySpawned=t=>{t.onFire=(e,n,i)=>{this.fireAIProjectile(e,n,Qe.ENEMY,i),this.audioManager.playShoot()},t.onDestroy=()=>{const e=t.getConfig(),n=t.getPosition().clone();this.gameState.addScore(e.scoreValue),this.playerStats.addScore(e.scoreValue),this.audioManager.playExplosion(),this.particleSystem.createExplosion(n,e.scale),Math.random()<jt.POWERUP.SPAWN_CHANCE&&this.powerUpManager.spawn(n),t.dispose()}},this.powerUpManager.onPowerUpCollected=(t,e)=>{this.audioManager.playPowerUp(),console.log(`获得道具: ${e.name}`),this.hud.showPowerUp(e.name,e.icon,e.duration),t===Ne.HEALTH?this.playerHealth.heal(e.value):t===Ne.SHIELD&&this.activateShield()},this.powerUpManager.onPowerUpExpired=t=>{t===Ne.SHIELD&&this.deactivateShield()},this.powerUpManager.onBombUsed=()=>{this.spawnFriendlyAI(),console.log("召唤友军！")}}fireAIProjectile(t,e,n,i=10){let r;if(n===Qe.FRIENDLY){for(const o of this.friendlyAIs)if(o.isAlive()&&o.getMesh().position.distanceTo(t)<10){r=o.getMesh();break}}else if(n===Qe.ENEMY){const o=this.levelManager.getEnemies();for(const l of o)if(l.isAlive()&&l.getMesh().position.distanceTo(t)<10){r=l.getMesh();break}}this.enemyProjectilePool.fire(t,e,i,r,n)}updateFriendlyAIs(t,e){console.log(`[Game] updateFriendlyAIs 被调用, 友军数量: ${this.friendlyAIs.length}, 敌人数: ${e.length}`);for(let n=this.friendlyAIs.length-1;n>=0;n--){const i=this.friendlyAIs[n];i.isAlive()?i.update(t,e):this.friendlyAIs.splice(n,1)}}createAircraftMesh(t){const e=new he;let n,i,r,a=1.6,o=6,l=3,c=.8,h=1;switch(t.type){case re.SCOUT:n=4871556,i=7043982,r=4020871,a=1.2,o=5,l=2.2,h=.85;break;case re.FIGHTER:n=13382400,i=15087872,r=9118976,a=1.8,o=7,l=3.5,h=1.1;break;case re.HEAVY:n=2894892,i=3815994,r=1710618,a=2.2,o=8,l=4.2,h=1.3;break;case re.SNIPER:n=4858714,i=7031930,r=8141549,a=1.6,o=7.5,l=2.8,h=.95;break;case re.ACE:n=9109504,i=16766720,r=16729344,a=1.9,o=7,l=3.3,h=1.15;break;default:n=t.color,i=t.color,r=t.color}e.scale.set(h,h,h);const u=new ye(a*.4,a*.3,o,8),d=new Rt({color:n,metalness:.7,roughness:.3}),m=new st(u,d);m.rotation.x=Math.PI/2,m.rotation.z=Math.PI/2,m.castShadow=!0,e.add(m);const g=new Me(a*.3,o*.25,8),_=new Rt({color:r,metalness:.8,roughness:.2}),p=new st(g,_);p.rotation.x=Math.PI/2,p.rotation.z=Math.PI/2,p.position.set(0,0,o/2+.5),p.castShadow=!0,e.add(p);const f=new Oe(l,.15,1.2),S=new Rt({color:i,metalness:.6,roughness:.4}),v=new st(f,S);v.position.set(0,0,-.8),v.castShadow=!0,e.add(v);const y=new pe(a*.35,8,8),L=new Rt({color:r,metalness:.9,roughness:.1,emissive:r,emissiveIntensity:.3}),b=new st(y,L);b.position.set(0,a*.25,.5),b.castShadow=!0,e.add(b);const C=new Oe(c,.12,1),O=new Rt({color:i,metalness:.6,roughness:.4}),M=new st(C,O);M.position.set(0,0,-o/2-.3),M.castShadow=!0,e.add(M);const w=new Oe(.15,1.2,.8),F=new st(w,O);F.position.set(0,.6,-o/2+.1),F.castShadow=!0,e.add(F);const G=new ye(a*.2,a*.15,.5,8),J=new fe({color:16737792,transparent:!0,opacity:.8}),D=new st(G,J);switch(D.rotation.x=Math.PI/2,D.position.set(0,0,-o/2-.8),e.add(D),t.type){case re.SCOUT:e.name="Scout-Friendly";break;case re.FIGHTER:e.name="Fighter-Friendly";break;case re.HEAVY:e.name="Heavy-Friendly";break;case re.SNIPER:e.name="Sniper-Friendly";break;case re.ACE:e.name="Ace-Friendly";break}return e}spawnFriendlyAI(){console.log("[DEBUG] spawnFriendlyAI() 被调用！当前友军数量:",this.friendlyAIs.length),console.trace("[DEBUG] 调用栈追踪：");const t=Object.values(re),e=t[Math.floor(Math.random()*t.length)],n=da[e],i=this.createAircraftMesh(n);console.log("[友军] 创建飞机模型，config:",n.name);const r=new Sg(i,n,this.gameScene.scene);console.log("[友军] 友军AI实例创建完成");const a=this.playerController.getPosition(),o=new R((Math.random()-.5)*100,(Math.random()-.5)*50,(Math.random()-.5)*100);i.position.copy(a).add(o),this.gameScene.scene.add(i),this.friendlyAIs.push(r),r.enemy.onFire=(h,u,d)=>{this.fireAIProjectile(h,u,Qe.FRIENDLY,d),this.audioManager.playShoot()};const l=r.enemy,c=l.health.onDeath;l.health.onDeath=()=>{c&&c();const h=this.friendlyAIs.indexOf(r);h!==-1&&this.friendlyAIs.splice(h,1),r.dispose(this.gameScene.scene),this.particleSystem.createExplosion(i.position.clone(),1),this.audioManager.playExplosion(),console.log("友军被击落")}}onBalloonDestroyed(t,e,n){console.log(`气球被打破: ${n.name}`),this.audioManager.playBalloonPop(),this.hud.showPowerUpBig(n.icon,n.name,1),n.duration>0&&this.hud.showPowerUp(n.name,n.icon,n.duration),this.powerUpManager.addActivePowerUp(e,n)}onPlayerDeath(){this.lives--,this.deathPosition=this.playerAircraft.position.clone(),this.audioManager.stopEngine(),this.audioManager.playExplosion(),this.particleSystem.createExplosion(this.playerAircraft.position.clone(),2),this.lockOnIndicator.cancelLockOn(),this.playerAircraft.visible=!1,this.lives<=0?(this.gameState.setStatus(Ns.GAME_OVER),this.audioManager.playGameOver(),this.hud.showGameOver(this.gameState.getScore()),console.log("游戏结束！最终得分:",this.gameState.getScore())):(this.isRespawning=!0,this.respawnTimer=this.respawnDelay,console.log(`剩余生命: ${this.lives}`))}respawnPlayer(){this.playerHealth.reset(),this.deathPosition&&this.playerAircraft.position.copy(this.deathPosition),this.playerAircraft.rotation.set(0,0,0),this.playerAircraft.quaternion.set(0,0,0,1),this.particleSystem.createExplosion(this.playerAircraft.position.clone(),1.5),this.playerAircraft.visible=!0,this.missileCount=jt.MISSILE.STARTING_MISSILES,this.hud.updateMissiles(this.missileCount),this.powerUpManager.addActivePowerUp(Ne.SHIELD,Tn[Ne.SHIELD]),this.audioManager.startEngine(),this.isRespawning=!1,console.log("原地复活成功！")}activateShield(){if(this.shieldActive=!0,!this.shieldMesh){const t=new pe(3,16,16),e=new fe({color:65535,transparent:!0,opacity:.3,side:Be});this.shieldMesh=new st(t,e),this.gameScene.scene.add(this.shieldMesh)}this.shieldMesh.visible=!0}deactivateShield(){this.shieldActive=!1,this.shieldMesh&&(this.shieldMesh.visible=!1)}createPlayerAircraft(){const t=new he,e=new Rt({color:4491519,metalness:.7,roughness:.2}),n=new Me(.5,3.5,12),i=new st(n,e);i.rotation.x=Math.PI/2,t.add(i);const r=new Rt({color:1118515,metalness:.9,roughness:.1}),a=new pe(.3,12,12),o=new st(a,r);o.position.set(0,.3,-.5),o.scale.set(1,.6,1.5),t.add(o);const l=new Rt({color:3368669,metalness:.6,roughness:.3}),c=new Zi;c.moveTo(0,0),c.lineTo(2,.8),c.lineTo(.3,1),c.lineTo(0,0);const h={depth:.05,bevelEnabled:!1},u=new ha(c,h),d=new st(u,l);d.rotation.x=Math.PI/2,d.rotation.z=Math.PI,d.position.set(-.3,0,.3),t.add(d);const m=new st(u,l);m.rotation.x=Math.PI/2,m.position.set(.3,0,.3),t.add(m);const g=new Oe(.05,.8,.6),_=new st(g,l);_.position.set(0,.5,1.5),t.add(_);const p=new Me(.2,.8,8),f=new fe({color:16729088,transparent:!0,opacity:.8}),S=new st(p,f);return S.rotation.x=-Math.PI/2,S.position.set(0,0,2),S.name="engineGlow",t.add(S),t.traverse(v=>{v instanceof st&&v.name!=="engineGlow"&&(v.castShadow=!0,v.receiveShadow=!0)}),this.gameScene.scene.add(t),t}update(t){if(this.gameState.getStatus()!==Ns.PLAYING)return;this.isRespawning&&(this.respawnTimer-=t,this.respawnTimer<=0&&this.respawnPlayer());const e=this.levelManager.getEnemies().filter(_=>_.isAlive()).map(_=>_.getMesh());this.updateEnemyHealthBars(e);const n=this.inputHandler.getState();if(!this.isRespawning){this.playerController.update(t,n);const _=this.playerController.getPosition();_.y<-45&&this.gameState.isPlaying()&&(this.playerHealth.takeDamage(1e3),this.audioManager.playExplosion(),this.particleSystem.createExplosion(_.clone(),3));const f=this.playerStats.getFireRate();this.fireCooldown=Math.max(0,this.fireCooldown-t),n.fire&&this.fireCooldown<=0&&(this.playerFire(),this.fireCooldown=f),this.handleMissileInput(n,e)}this.playerProjectilePool.update(t),this.enemyProjectilePool.update(t),this.missileSystem.update(t);const i=this.friendlyAIs.map(_=>_.getMesh());this.levelManager.update(t,this.playerController.getPosition(),i),this.updateFriendlyAIs(t,e);const r=this.levelManager.getEnemies().filter(_=>_.isAlive()).map(_=>_.getMesh());this.missileSystem.updateEnemies(r);const a=this.powerUpManager.hasEffect(Ne.DAMAGE)?Tn[Ne.DAMAGE].value:1;this.playerProjectilePool.checkCollisions(r,_=>{const p=this.levelManager.getEnemies().find(f=>f.getMesh()===_);if(p){const f=this.playerStats.getDamage(a);p.takeDamage(f)}}),this.missileSystem.checkCollisions(r,_=>{const p=this.levelManager.getEnemies().find(f=>f.getMesh()===_);if(p){const f=this.powerUpManager.hasEffect(Ne.DAMAGE)?Tn[Ne.DAMAGE].value:1,S=jt.MISSILE.DAMAGE*f;p.takeDamage(S),this.audioManager.playMissileExplosion(),this.particleSystem.createExplosion(_.position.clone(),2)}});const o={mesh:this.playerAircraft,faction:Qe.NEUTRAL},l=this.levelManager.getEnemies().map(_=>({mesh:_.getMesh(),faction:Qe.ENEMY,ai:_})),c=this.friendlyAIs.map(_=>({mesh:_.getMesh(),faction:Qe.FRIENDLY,ai:_})),h=[o,...l,...c];this.enemyProjectilePool.checkCollisions(h.map(_=>_.mesh),(_,p,f)=>{const S=this.enemyProjectilePool.pool.find(L=>L.mesh===p);if(!S)return;const v=S.mesh.userData.faction;if(!v){console.warn("AI子弹没有阵营标识，忽略碰撞");return}const y=h.find(L=>L.mesh===_);if(y&&Eg(v,y.faction)){if(y.faction===Qe.NEUTRAL&&!this.shieldActive)this.playerHealth.takeDamage(f),console.log(`[碰撞检测] 敌人子弹命中玩家，伤害: ${f}`);else if(y.faction===Qe.ENEMY)y.ai.takeDamage(f),console.log(`[碰撞检测] 友军子弹命中敌军，伤害: ${f}`);else if(y.faction===Qe.FRIENDLY){const L=this.friendlyAIs.find(b=>b.getMesh()===_);L&&L.isAlive()&&(L.takeDamage(f),console.log(`[碰撞检测] 敌人子弹命中友军，伤害: ${f}`))}}}),this.powerUpManager.update(t);const d=this.playerProjectilePool.getActiveProjectiles().map(_=>_.position);this.powerUpManager.checkProjectileCollisions(d,(_,p)=>{const f=Tn[p];this.onBalloonDestroyed(_,p,f)}),this.powerUpManager.checkPlayerCollisions(this.playerController.getPosition(),(_,p)=>{console.log(`收集到道具: ${p.name}`)}),this.particleSystem.update(t),this.shieldMesh&&this.shieldActive&&this.shieldMesh.position.copy(this.playerAircraft.position),this.audioManager.updateEngine(this.playerController.getSpeed());const m=this.playerAircraft.getObjectByName("engineGlow");if(m){const _=.5+this.playerController.getSpeed()/100*1;m.scale.setScalar(_)}this.thirdPersonCamera.update(),this.updateEnemyHealthBars(e),this.hud.updateHealth(this.playerHealth.getHealthPercent()/(this.playerStats.getMaxHealth()/100)),this.hud.updateSpeed(this.playerController.getSpeed()),this.hud.updateScore(this.gameState.getScore()),this.hud.updateEnemies(this.levelManager.getAliveEnemyCount());const g=this.levelManager.getTotalEnemyCount()-this.levelManager.getSpawnedEnemyCount();this.hud.updateRemainingEnemies(g),this.hud.updateLives(this.lives),this.hud.update(t),this.missileCount<jt.MISSILE.MAX_RESPAWN_MISSILES&&(this.missileRespawnTimer+=t,this.missileRespawnTimer>=jt.MISSILE.MISSILE_RESPAWN_TIME&&(this.missileCount++,this.hud.updateMissiles(this.missileCount),this.missileRespawnTimer=0,console.log(`导弹补给！当前: ${this.missileCount}/${jt.MISSILE.MAX_RESPAWN_MISSILES}`))),this.hud.updateMissileProgress(this.missileRespawnTimer/jt.MISSILE.MISSILE_RESPAWN_TIME)}updateEnemyHealthBars(t){const n=this.levelManager.getEnemies().filter(o=>o.isAlive()),i=this.friendlyAIs.filter(o=>o.isAlive()),r=n.map(o=>{const l=o.getHealth(),c=o.getConfig();return{mesh:o.getMesh(),currentHealth:l.current,maxHealth:c.health}}),a=i.map(o=>{const l=o.getHealth();return{mesh:o.getMesh(),currentHealth:l.current,maxHealth:l.max}});this.enemyHealthBars.update(r,a,this.gameScene.camera,this.playerController.getPosition())}handleMissileInput(t,e){const n=this.enemyHealthBars.getFirstEnemyScreenPos();if(this.missileCount<=0)if(t.missile){this.lockOnIndicator.setNoMissiles(!0);return}else this.lockOnIndicator.setNoMissiles(!1);else this.lockOnIndicator.setNoMissiles(!1);if(this.lockOnIndicator.isLocking()){if(this.lockOnIndicator.update(this.playerController.getPosition(),e,this.gameScene.camera,.016,n)){const r=this.lockOnIndicator.getCurrentTarget();r&&this.missileCount>0&&!this.missileFiringScheduled&&(this.missileFiringScheduled=!0,setTimeout(()=>{this.fireMissile(r),this.lockOnIndicator.onMissileFired(),this.missileFiringScheduled=!1},200))}}else t.missile?(this.audioManager.playMissileLock(),this.lockOnIndicator.setNoMissiles(!1),this.lockOnIndicator.startLockOn()):this.lockOnIndicator.cancelLockOn()}fireMissile(t){if(this.missileCount<=0)return;const e=this.playerController.getPosition().clone(),n=this.playerController.getQuaternion(),i=new R(0,.3,-.5);i.applyQuaternion(n),e.add(i);const r=new R(0,0,-1);r.applyQuaternion(n);const a=this.powerUpManager.hasEffect(Ne.MULTISHOT)?3:1;if(!(this.missileCount<a)){if(a===3)for(let l=-1;l<=1;l++){const c=r.clone();c.applyAxisAngle(new R(0,1,0),l*.3),this.missileSystem.fire(e.clone(),c.normalize(),t)}else this.missileSystem.fire(e,r,t);this.audioManager.playMissileLaunch(),this.missileCount-=a,this.hud.updateMissiles(this.missileCount),this.lockOnIndicator.onMissileFired()}}playerFire(){const t=this.playerController.getPosition().clone(),e=this.playerController.getQuaternion(),n=new R(0,0,-1);n.applyQuaternion(e),t.add(n.clone().multiplyScalar(2)),this.audioManager.playShoot();const r=(1-this.playerStats.getAccuracy())*.24,a=(Math.random()-.5)*r;n.applyAxisAngle(new R(0,1,0),a);const o=this.powerUpManager.hasEffect(Ne.DAMAGE)?Tn[Ne.DAMAGE].value:1;if(this.powerUpManager.hasEffect(Ne.MULTISHOT))for(let c=-1;c<=1;c++){const h=n.clone();h.applyAxisAngle(new R(0,1,0),c*.3),this.playerProjectilePool.fire(t.clone(),h.normalize(),this.playerStats.getDamage(o))}else this.playerProjectilePool.fire(t,n,this.playerStats.getDamage(o))}render(){this.gameScene.render()}start(){this.gameState.setStatus(Ns.PLAYING),this.audioInitialized||(this.audioManager.resume(),this.audioInitialized=!0),this.levelManager.loadLevel(this.currentLevelId),setTimeout(()=>{const t=this.playerController.getPosition();this.levelManager.startWave(t)},jt.LEVEL.START_DELAY*1e3),this.missileCount=jt.MISSILE.STARTING_MISSILES,this.hud.updateMissiles(this.missileCount),this.gameLoop.start(t=>this.update(t),()=>this.render()),this.audioManager.startEngine(),console.log("游戏开始！"),setTimeout(()=>{this.spawnFriendlyAI(),this.hud.showPowerUpBig("✈️","召唤友军"),console.log("初始福利：自动召唤友军")},1e3)}stop(){this.gameLoop.stop(),this.audioManager.stopEngine()}dispose(){this.stop(),this.levelManager.clear(),this.particleSystem.clear(),this.powerUpManager.clear(),this.gameScene.dispose()}}function Tg(){const s=document.getElementById("loading-screen");s&&s.classList.add("hidden")}function tl(s){const t=document.getElementById("loading-screen");t&&(t.innerHTML=`
      <div style="text-align: center; color: white;">
        <h1 style="font-size: 32px; margin-bottom: 20px;">⚠️ 加载失败</h1>
        <p style="font-size: 16px; opacity: 0.8;">${s}</p>
        <p style="font-size: 14px; margin-top: 20px; opacity: 0.6;">
          请尝试刷新页面或使用其他浏览器
        </p>
      </div>
    `)}function Ag(){try{const s=document.createElement("canvas");return(s.getContext("webgl")||s.getContext("experimental-webgl"))!==null}catch{return!1}}async function el(){if(!Ag()){tl("您的浏览器不支持 WebGL");return}try{const s=new wg;Tg(),console.log("🎮 Air Supreme - 3D 空战游戏"),console.log("📖 控制说明:"),console.log("  W/S - 俯仰（机头上下）"),console.log("  A/D - 偏航（机头左右）"),console.log("  Q/E - 翻滚（机翼倾斜）"),console.log("  空格 - 开火"),console.log("  Shift - 加速"),console.log(""),console.log("📱 移动端: 使用虚拟摇杆和按钮控制"),console.log('⏳️ 请在菜单中选择"开始游戏"以开始'),window.addEventListener("beforeunload",()=>{s.dispose()})}catch(s){console.error("游戏初始化失败:",s),tl("游戏初始化失败，请查看控制台了解详情")}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>el()):el();
