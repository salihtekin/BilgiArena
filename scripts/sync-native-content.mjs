import {TRIVIA,WORDS} from '../lib/question-content.ts';
import {writeFileSync} from 'node:fs';
const quote=value=>JSON.stringify(value);
const rows=values=>values.map(a=>'        {'+a.map(quote).join(',')+'}').join(',\n');
writeFileSync(new URL('../mobile/app/src/main/java/com/bilgiarena/app/BundledContent.java',import.meta.url),`package com.bilgiarena.app;
/** Generated from the reviewed server pool by scripts/sync-native-content.mjs. */
final class BundledContent {
    static final String[][] WORDS={
${rows(WORDS.map(w=>[w.word.toLocaleUpperCase('tr-TR'),w.hint]))}
    };
    static final String[][] TRIVIA={
${rows(TRIVIA.map(q=>[q.category,q.prompt,q.choices[q.answer],...q.choices.filter((_,i)=>i!==q.answer),q.explanation]))}
    };
}
`);
console.log(`Shared offline pool: ${WORDS.length} words, ${TRIVIA.length} trivia items.`);
