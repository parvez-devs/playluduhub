'use strict';
const esbuild=require('esbuild');
const path=require('path');

async function main(){
  await esbuild.build({
    entryPoints:{
      player:path.join(__dirname,'../web/player.ts'),
      game:path.join(__dirname,'../web/game.ts'),
      admin:path.join(__dirname,'../web/admin.ts')
    },
    bundle:true,
    outdir:path.join(__dirname,'../public/assets'),
    entryNames:'[name]',
    assetNames:'[name]',
    format:'iife',
    platform:'browser',
    target:['es2022'],
    minify:true,
    legalComments:'none',
    logLevel:'info',
    loader:{'.css':'css'}
  });
}
main().catch(e=>{console.error(e);process.exit(1);});
