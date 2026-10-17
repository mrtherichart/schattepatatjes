const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
for(const dir of ['web/modules/foundation','web/modules/features'])for(const name of fs.readdirSync(dir)){const file=path.join(dir,name);execFileSync(process.execPath,['--check',file]);if(dir.endsWith('features')&&/from ['"].*(?:database|transport)\.js/.test(fs.readFileSync(file,'utf8')))throw Error('Feature imports infrastructure: '+file);}
for(const file of ['web/modules/foundation/model.js','web/modules/features/customization.js'])if(/\bfetch\s*\(|localStorage|indexedDB/.test(fs.readFileSync(file,'utf8')))throw Error('Pure module has I/O: '+file);
console.log('Foundation syntax and import boundaries passed');
