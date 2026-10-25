import {readFileSync,writeFileSync} from 'node:fs';
import {sampleField} from './sample-field.mts';
const fragment=readFileSync(new URL('./home-ascii.frag',import.meta.url),'utf8');
const logo=readFileSync(new URL('../assets/logo.svg',import.meta.url),'utf8');
const destination=process.argv[2];
if(!destination)throw Error('请提供浏览器表达式输出路径');
writeFileSync(destination,`(${sampleField.toString()})(${JSON.stringify({fragment,logo})})`);
