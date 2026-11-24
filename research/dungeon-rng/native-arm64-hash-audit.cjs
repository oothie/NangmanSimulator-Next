'use strict';
// Audit 60014 AArch64 native LuaJIT hash signatures. No native binary is distributed.
const fs=require('node:fs'), crypto=require('node:crypto');
const SHA='53398b3460ecc678d8be1ad62b8afd89e370d7ca7a77d65396c00c0706443154';
const sites={
  intern:{0x7e3a70:0xb94002a8,0x7e3a78:0x138b496a,0x7e3ad8:0x4b080159,0x7e3bbc:0x2901d019},
  vmLookup1:{0x803104:0xb9403429,0x803108:0xb9400f8a,0x80310c:0xf9401422,0x803110:0x0a0a0129,0x803114:0x8b090529,0x80311c:0x8b090c42},
  vmLookup2:{0x8053dc:0xb9403629,0x8053e0:0xb9400f8a,0x8053e4:0xf9401622,0x8053e8:0x0a0a0129,0x8053ec:0x8b090529,0x8053f4:0x8b090c42}
};
function auditNative(buffer){
  if (!Buffer.isBuffer(buffer))throw new TypeError('Expected ELF bytes');
  const sha=crypto.createHash('sha256').update(buffer).digest('hex');
  if(sha!==SHA)throw new Error('Unknown game native sha256: '+sha);
  if(buffer.toString('binary',0,4)!=='\x7fELF'||buffer[4]!==2||buffer[5]!==1||buffer.readUInt16LE(18)!==183)throw new Error('Not AArch64 ELF64');
  for(const [site,words] of Object.entries(sites))for(const [addr,value] of Object.entries(words)){
    const observed=buffer.readUInt32LE(Number(addr));
    if(observed!==value)throw new Error(site+' mismatch at '+Number(addr).toString(16));
  }
  if(!buffer.includes('LuaJIT 2.1.0-beta3'))throw new Error('Version fingerprint missing');
  return {verified:true,sha256:sha,opcodeChecks:16,independentTableLookupSites:2,
    stringInterning:'GCstr.hash at +0x0c, GCstr.len at +0x10',
    tableLookup:'(GCstr.hash & GCtab.hmask) * 24 + GCtab.node',
    sidBasedHash:false,
    remaining:'table constructor and native pairs() insertion/rehash order and prospective drops'};
}
if(require.main===module){
  if(!process.argv[2]){console.error('Usage: node native-arm64-hash-audit.cjs /path/to/libcocos2dlua.so');process.exitCode=2}
  else{try{console.log(JSON.stringify(auditNative(fs.readFileSync(process.argv[2])),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
}
module.exports={auditNative,sites};
